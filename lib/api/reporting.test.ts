import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmReportingRun,
  cloneReportingDefinition,
  createReportingDefinition,
  createReportingRevision,
  normalizeReportingCatalog,
  normalizeReportingDefinitionDetail,
  prepareReportingRun,
  previewReportingDraft,
  toReportingDraftPayload,
  type ReportingDefinitionDraft,
} from "./reporting";

const checksum = "a".repeat(64);
const definitionId = "507f1f77bcf86cd799439011";
const revisionId = "507f1f77bcf86cd799439012";
const previewId = "507f1f77bcf86cd799439013";

const draft: ReportingDefinitionDraft = {
  name: "Lead report",
  description: "",
  dataset_key: "lead_outcome_detail",
  dataset_schema_version: 1,
  timezone: "America/New_York",
  date_window_spec: {
    kind: "explicit",
    fromLocal: "2026-08-01",
    throughLocal: "2026-08-04",
  },
  source_selection: [
    {
      company_key: "best_relocation",
      company_label_snapshot: "Best Relocation",
      granularities: [
        { granularity_key: "google", granularity_label_snapshot: "Google" },
      ],
    },
  ],
  filters: { leadType: "form", route: "" },
  selected_columns: [{ id: "lead_type", label: "Lead Type" }],
  sort: [{ id: "lead_timestamp", direction: "asc" }],
  destination_id: "destination-1",
  destination_snapshot_checksum: checksum,
  strategy: "snapshot",
};

const wireDraft = {
  name: "Lead report",
  description: "",
  datasetKey: "lead_outcome_detail",
  datasetSchemaVersion: 1,
  timezone: "America/New_York",
  dateWindow: {
    kind: "explicit",
    fromLocal: "2026-08-01",
    throughLocal: "2026-08-04",
  },
  sources: {
    companyKeys: ["best_relocation"],
    granularityKeys: ["google"],
  },
  filters: { leadType: "form" },
  selectedColumns: [{ id: "lead_type", label: "Lead Type" }],
  sort: [{ id: "lead_timestamp", direction: "asc" }],
  destinationId: "destination-1",
  destinationSnapshotChecksum: checksum,
  strategy: "snapshot",
};

test("catalog adapter consumes the server camelCase DTO", () => {
  const result = normalizeReportingCatalog({
    defaultTimezone: "America/New_York",
    manualOnly: true,
    previewLimit: 50,
    dateWindow: {
      kinds: ["explicit", "rolling"],
      rolling: {
        presets: ["last_n_days"],
        minDays: 1,
        maxDays: 366,
        anchor: "preview_or_run_time",
        endPolicy: "include_current_local_day",
      },
    },
    datasets: [
      {
        key: "lead_outcome_detail",
        schemaVersion: 1,
        grain: "one lead",
        dateSemantic: "lead cohort",
        columns: [
          {
            id: "customer_name",
            defaultLabel: "Name",
            type: "string",
            sensitivity: "confidential_pii",
            default: true,
          },
        ],
        measures: [],
        filterKeys: ["leadType"],
        filterSchema: {
          unknownKeys: "reject",
          fields: [
            {
              id: "leadType",
              type: "enum",
              required: false,
              options: ["form", "call"],
            },
          ],
        },
        allowedSorts: ["lead_timestamp"],
        defaultSort: [{ id: "lead_timestamp", direction: "asc" }],
        requiredTieBreakers: [
          { id: "lead_type", direction: "asc" },
          { id: "lead_id", direction: "asc" },
        ],
        samplePolicyVersion: 1,
      },
    ],
  });

  assert.equal(result.default_timezone, "America/New_York");
  assert.equal(result.datasets[0]?.schema_version, 1);
  assert.equal(result.datasets[0]?.columns[0]?.default_label, "Name");
  assert.equal(result.datasets[0]?.columns[0]?.default_selected, true);
  assert.deepEqual(result.datasets[0]?.filters[0]?.options?.map((item) => item.value), [
    "form",
    "call",
  ]);
  assert.equal(result.datasets[0]?.filter_schema.unknown_keys, "reject");
  assert.deepEqual(result.datasets[0]?.required_tie_breakers, [
    { id: "lead_type", direction: "asc" },
    { id: "lead_id", direction: "asc" },
  ]);
  assert.equal(result.datasets[0]?.sample_policy_version, 1);
  assert.equal(result.date_window.rolling.max_days, 366);
});

test("preview routes and bodies match create-draft and existing-definition contracts", async () => {
  const { calls, restore } = stubFetch(previewResponse());
  let createPreview;
  try {
    createPreview = await previewReportingDraft(null, draft);
    await previewReportingDraft(definitionId, draft);
  } finally {
    restore();
  }
  assert.equal(calls[0]?.url, "/api/proxy/api/v1/admin/reporting/draft/preview");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), wireDraft);
  assert.equal(
    calls[1]?.url,
    `/api/proxy/api/v1/admin/reporting/definitions/${definitionId}/preview`,
  );
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), { draft: wireDraft });
  assert.equal(createPreview.sample_evidence, "opaque-sample-evidence");
});

test("explicit and rolling windows serialize as strict discriminated wire shapes", () => {
  const exclusive = toReportingDraftPayload({
    ...draft,
    date_window_spec: {
      kind: "explicit",
      fromLocal: "2026-08-01",
      toExclusiveLocal: "2026-08-05",
    },
  });
  assert.deepEqual(exclusive.dateWindow, {
    kind: "explicit",
    fromLocal: "2026-08-01",
    toExclusiveLocal: "2026-08-05",
  });

  const rolling = toReportingDraftPayload({
    ...draft,
    date_window_spec: {
      kind: "rolling",
      preset: "last_n_days",
      days: 30,
      anchor: "preview_or_run_time",
      endPolicy: "include_current_local_day",
    },
  });
  assert.deepEqual(rolling.dateWindow, {
    kind: "rolling",
    preset: "last_n_days",
    days: 30,
    anchor: "preview_or_run_time",
    endPolicy: "include_current_local_day",
  });
});

test("preview preserves upper-bound estimate explanation", async () => {
  const response = previewResponse();
  const body = await response.json() as {
    ok: true;
    data: Record<string, unknown> & {
      estimate: { kind: string; rows: number; explanation?: string };
    };
  };
  body.data.estimate = {
    kind: "upper_bound",
    rows: 500,
    explanation: "Safe bound from indexed candidate manifest.",
  };
  const stub = stubFetch(ok(body.data));
  try {
    const result = await previewReportingDraft(null, draft);
    assert.equal(result.estimate.kind, "upper_bound");
    assert.equal(
      result.estimate.explanation,
      "Safe bound from indexed candidate manifest.",
    );
  } finally {
    stub.restore();
  }
});

test("save clients send only the strict draft, previewId, and previewChecksum fields", async () => {
  const { calls, restore } = stubFetch(
    ok({ definitionId, revisionId, revisionNumber: 1, revisionSnapshotChecksum: checksum }, 201),
  );
  try {
    const input = { draft, preview_id: previewId, preview_checksum: checksum };
    await createReportingDefinition(input);
    await createReportingRevision(definitionId, input);
  } finally {
    restore();
  }
  const expected = { draft: wireDraft, previewId, previewChecksum: checksum };
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), expected);
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), expected);
});

test("clone response exposes owner sort terms without required tie-breakers", async () => {
  const { calls, restore } = stubFetch(
    ok({
      draft: {
        ...wireDraft,
        sort: [{ id: "lead_timestamp", direction: "desc" }],
      },
    }),
  );
  try {
    const result = await cloneReportingDefinition(definitionId);
    assert.deepEqual(result.draft.sort, [{ id: "lead_timestamp", direction: "desc" }]);
  } finally {
    restore();
  }
  assert.equal(
    calls[0]?.url,
    `/api/proxy/api/v1/admin/reporting/definitions/${definitionId}/clone`,
  );
});

test("definition detail adapter joins definition, revisions, and previews", () => {
  const result = normalizeReportingDefinitionDetail({
    definition: {
      _id: definitionId,
      name: "Lead report",
      description: "",
      dataset_key: "lead_outcome_detail",
      state: "active",
      current_revision_id: revisionId,
      current_revision_number: 2,
      updated_at: "2026-08-04T10:00:00.000Z",
    },
    revisions: [
      {
        _id: revisionId,
        definition_id: definitionId,
        revision_number: 2,
        revision_snapshot_checksum: checksum,
        dataset_key: "lead_outcome_detail",
        dataset_schema_version: 1,
        date_window_spec: {
          kind: "rolling",
          preset: "last_n_days",
          days: 14,
          anchor: "preview_or_run_time",
          endPolicy: "include_current_local_day",
        },
        registry_snapshot: {
          companies: [{ id: "company-id", key: "best_relocation", label: "Best Relocation" }],
          granularities: [
            { key: "google", label: "Google", companyId: "company-id" },
          ],
        },
        filters: { leadType: "form" },
        selected_columns: [{ id: "lead_type", label: "Lead Type" }],
        effective_sort: [
          { id: "lead_timestamp", direction: "asc" },
          { id: "lead_type", direction: "asc" },
          { id: "lead_id", direction: "asc" },
        ],
        timezone: "America/New_York",
        destination_id: "destination-1",
        destination_snapshot_checksum: checksum,
        strategy: "snapshot",
        sample_count: 1,
        sample_evidence: "opaque-sample-evidence",
        created_at: "2026-08-04T10:00:00.000Z",
      },
    ],
    previews: [{ _id: previewId }],
  });

  assert.equal(result.definition.id, definitionId);
  assert.equal(result.definition.current_revision_number, 2);
  assert.equal(result.current_revision.id, revisionId);
  assert.equal(result.current_revision.draft.source_selection[0]?.granularities[0]?.granularity_key, "google");
  assert.deepEqual(result.current_revision.draft.date_window_spec, {
    kind: "rolling",
    preset: "last_n_days",
    days: 14,
    anchor: "preview_or_run_time",
    endPolicy: "include_current_local_day",
  });
  assert.deepEqual(result.current_revision.draft.sort, [
    { id: "lead_timestamp", direction: "asc" },
  ]);
  assert.equal(result.current_revision.sample_evidence, "opaque-sample-evidence");
  assert.equal(result.previews.length, 1);
});

test("both run confirmation steps use camelCase and map server responses", async () => {
  const first = stubFetch(
    ok({
      requiresConfirmation: true,
      confirmationToken: "confirmation-token",
      confirmationId: "confirmation-id",
      idempotencyKey: "stable-key",
      definitionId,
      revisionId,
      revisionSnapshotChecksum: checksum,
      destinationSnapshotChecksum: checksum,
      queryInputChecksum: checksum,
      estimate: {
        kind: "upper_bound",
        rows: 4,
        explanation: "Count timed out; safe indexed upper bound returned.",
        columns: 1,
        cellsIncludingHeader: 5,
        generatedAt: "2026-08-04T10:00:00.000Z",
      },
      warnings: [],
      intendedChanges: { action: "create_snapshot_workbook" },
      expiresAt: "2026-08-04T10:05:00.000Z",
    }),
  );
  let confirmation;
  try {
    confirmation = await prepareReportingRun(definitionId, revisionId, "stable-key");
  } finally {
    first.restore();
  }
  assert.deepEqual(JSON.parse(String(first.calls[0]?.init?.body)), {
    revisionId,
    idempotencyKey: "stable-key",
  });
  assert.equal("confirmation_token" in confirmation, true);
  if (!("confirmation_token" in confirmation)) {
    throw new Error("Expected a confirmation response.");
  }
  assert.equal(confirmation.confirmation_token, "confirmation-token");
  assert.equal(confirmation.confirmation_id, "confirmation-id");
  assert.equal(confirmation.idempotency_key, "stable-key");
  assert.equal(confirmation.estimate.cells_including_header, 5);
  assert.equal(
    confirmation.estimate.explanation,
    "Count timed out; safe indexed upper bound returned.",
  );

  const second = stubFetch(
    ok(
      {
        runId: "run-1",
        status: "queued",
        executionPackage: {},
        idempotentReplay: true,
      },
      202,
    ),
  );
  try {
    const result = await confirmReportingRun(definitionId, {
      revision_id: revisionId,
      confirmation_token: confirmation.confirmation_token,
      idempotency_key: "stable-key",
    });
    assert.equal(result.run_id, "run-1");
    assert.equal(result.idempotent_replay, true);
  } finally {
    second.restore();
  }
  assert.deepEqual(JSON.parse(String(second.calls[0]?.init?.body)), {
    revisionId,
    confirmationToken: "confirmation-token",
    idempotencyKey: "stable-key",
  });
});

test("run step one maps an idempotent queued replay", async () => {
  const replay = stubFetch(
    ok({
      runId: "run-replay",
      status: "queued",
      executionPackage: {},
      idempotentReplay: true,
    }),
  );
  try {
    const result = await prepareReportingRun(definitionId, revisionId, "stable-key");
    assert.equal("status" in result, true);
    if (!("status" in result)) throw new Error("Expected queued replay.");
    assert.equal(result.run_id, "run-replay");
    assert.equal(result.idempotent_replay, true);
  } finally {
    replay.restore();
  }
});

function previewResponse() {
  return ok({
    previewId,
    draftChecksum: checksum,
    previewChecksum: checksum,
    estimate: { kind: "exact", rows: 1 },
    projected: { rows: 2, columns: 1, cellsIncludingHeader: 2 },
    capacity: { applicableLimit: 100, remainingCells: 98 },
    batches: { queryPages: 1, writeBatches: 1 },
    sampleRows: [],
    sampleEvidence: "opaque-sample-evidence",
    warnings: [],
    piiColumnIds: [],
    destinationOwnership: "owner_controlled",
    intendedChanges: { action: "create_snapshot_workbook" },
    expiresAt: "2026-08-04T10:05:00.000Z",
  });
}

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(response: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response.clone();
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
