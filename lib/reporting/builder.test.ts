import assert from "node:assert/strict";
import test from "node:test";
import type { ReportingCatalogDataset, ReportingDefinitionDraft } from "@/lib/api/reporting";
import {
  defaultColumns,
  idempotencyKeyForCancelAttempt,
  idempotencyKeyForRunAttempt,
  localDateInTimeZone,
  moveColumn,
  normalizeSourceSelection,
  validateDraft,
} from "./builder";

const dataset: ReportingCatalogDataset = {
  key: "lead_outcome_detail",
  schema_version: 1,
  grain: "one lead",
  date_semantic: "lead cohort",
  filters: [],
  filter_schema: { unknown_keys: "reject", fields: [] },
  columns: [
    { id: "lead_type", default_label: "Lead Type", type: "enum", sensitivity: "internal", default_selected: true },
    { id: "customer_name", default_label: "Name", type: "string", sensitivity: "confidential_pii", default_selected: false },
  ],
  allowed_sorts: [{ id: "lead_timestamp" }],
  default_sort: [{ id: "lead_timestamp", direction: "asc" }],
  required_tie_breakers: [
    { id: "lead_type", direction: "asc" },
    { id: "lead_id", direction: "asc" },
  ],
  sample_policy_version: 1,
};

test("builder starts only with catalog-default columns and reorders without mutation", () => {
  assert.deepEqual(defaultColumns(dataset), [{ id: "lead_type", label: "Lead Type" }]);
  const columns = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
  assert.deepEqual(moveColumn(columns, 1, -1), [{ id: "b", label: "B" }, { id: "a", label: "A" }]);
  assert.deepEqual(columns, [{ id: "a", label: "A" }, { id: "b", label: "B" }]);
});

test("source selections retain hierarchy and normalize deterministically", () => {
  const normalized = normalizeSourceSelection([
    { company_key: "z", company_label_snapshot: "Z", granularities: [] },
    {
      company_key: "a",
      company_label_snapshot: "A",
      granularities: [
        { granularity_key: "two", granularity_label_snapshot: "Two" },
        { granularity_key: "one", granularity_label_snapshot: "One" },
      ],
    },
  ]);
  assert.deepEqual(normalized.map((item) => item.company_key), ["a", "z"]);
  assert.deepEqual(normalized[0]?.granularities.map((item) => item.granularity_key), ["one", "two"]);
});

test("default local date is derived in the selected IANA timezone", () => {
  const instant = new Date("2026-01-01T02:00:00.000Z");
  assert.equal(localDateInTimeZone("America/New_York", instant), "2025-12-31");
  assert.equal(localDateInTimeZone("Asia/Tokyo", instant), "2026-01-01");
});

test("one idempotency key is retained across both run steps and retries", () => {
  assert.equal(
    idempotencyKeyForRunAttempt(
      { revisionId: "revision-a", key: "stable-key" },
      "revision-a",
      () => "new",
    ),
    "stable-key",
  );
  assert.equal(
    idempotencyKeyForRunAttempt(
      { revisionId: "revision-a", key: "stable-key" },
      "revision-b",
      () => "new",
    ),
    "new",
  );
});

test("one idempotency key is retained across cancel retries for the same run", () => {
  assert.equal(
    idempotencyKeyForCancelAttempt(
      { runId: "run-a", key: "cancel-stable-key" },
      "run-a",
      () => "new-cancel-key",
    ),
    "cancel-stable-key",
  );
  assert.equal(
    idempotencyKeyForCancelAttempt(
      { runId: "run-a", key: "cancel-stable-key" },
      "run-b",
      () => "new-cancel-key",
    ),
    "new-cancel-key",
  );
});

test("draft validation fails closed on malformed destination reference and invalid timezone", () => {
  const draft = {
    name: "Report",
    dataset_key: "lead_outcome_detail",
    dataset_schema_version: 1,
    description: "",
    date_window_spec: { kind: "explicit", fromLocal: "2026-01-01", throughLocal: "2026-01-02" },
    timezone: "not/a-zone",
    source_selection: [{ company_key: "best", company_label_snapshot: "Best", granularities: [] }],
    filters: {},
    selected_columns: [{ id: "lead_type", label: "Lead Type" }],
    sort: [{ id: "lead_timestamp", direction: "asc" }],
    destination_id: "",
    destination_snapshot_checksum: "not-a-checksum",
    strategy: "snapshot",
  } as unknown as ReportingDefinitionDraft;
  const issues = validateDraft(draft);
  assert.ok(issues.some((issue) => issue.includes("IANA")));
  assert.ok(issues.some((issue) => issue.includes("Destination ID")));
  assert.ok(issues.some((issue) => issue.includes("checksum")));
});

test("rolling draft validation accepts only the vetted bounded policy", () => {
  const valid: ReportingDefinitionDraft = {
    name: "Rolling report",
    dataset_key: "lead_outcome_detail",
    dataset_schema_version: 1,
    description: "",
    timezone: "America/New_York",
    source_selection: [
      { company_key: "best", company_label_snapshot: "Best", granularities: [] },
    ],
    filters: {},
    selected_columns: [{ id: "lead_type", label: "Lead Type" }],
    sort: [{ id: "lead_timestamp", direction: "asc" }],
    destination_id: "destination",
    destination_snapshot_checksum: "a".repeat(64),
    strategy: "snapshot",
    date_window_spec: {
      kind: "rolling",
      preset: "last_n_days",
      days: 366,
      anchor: "preview_or_run_time",
      endPolicy: "include_current_local_day",
    },
  };
  assert.deepEqual(validateDraft(valid), []);
  const invalidWindow = {
    kind: "rolling",
    preset: "last_n_days",
    days: 367,
    anchor: "preview_or_run_time",
    endPolicy: "include_current_local_day",
  } as const;
  assert.ok(
    validateDraft({
      ...valid,
      date_window_spec: invalidWindow,
    }).some((issue) => issue.includes("1–366")),
  );
});
