import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";
import {
  buildAdvancedCplCommand,
  buildSimpleCplInput,
  classifyCplPeriods,
  computeSimpleCplChanges,
  cplRowState,
  currentCplSince,
  groupCplSnapshotByCompany,
  type AdvancedCplForm,
  type CplCorrectionJob,
  type CplCorrectionPreviewResult,
  type CplScheduleState,
  type CplSnapshotItem,
} from "../lib/api/registryCpl";
import type { CplRate } from "../lib/api/cplRates";
import { LEAD_COSTS_COPY } from "../components/setup/lead-costs/lead-costs-copy";
import { LeadCostsGridView } from "../components/setup/lead-costs/lead-costs-grid";
import { FixPastLeadsView } from "../components/setup/lead-costs/fix-past-leads";
import { LeadCostSheetView } from "../components/setup/lead-costs/lead-cost-sheet";
import { OldRateBookView } from "../components/setup/lead-costs/old-rate-book";

function feed(
  id: string,
  company: string,
  extra: Partial<CplSnapshotItem["source_granularity"]> = {},
): CplSnapshotItem["source_granularity"] {
  return {
    id,
    _id: id,
    source_company: company,
    granularity_key: `key_${id}`,
    channel: "form",
    owner_label: `Feed ${id}`,
    crm_label: `Feed ${id}`,
    aliases: [],
    source_sites: [],
    priority: 0,
    active: true,
    schedule_revision: 1,
    created_from: "seed",
    ...extra,
  };
}

const items: CplSnapshotItem[] = [
  {
    source_granularity: feed("b-calls", "co-b", { channel: "call", owner_label: "Inbound calls" }),
    schedule_revision: 4,
    current_rate: { status: "resolved", amount: 205, amount_cents: 20500, period_id: "p2" },
  },
  {
    source_granularity: feed("a-forms", "co-a", { owner_label: "Web forms", local: "long_distance" }),
    schedule_revision: 2,
    current_rate: { status: "missing_rate", fallback_amount: 0 },
  },
  {
    source_granularity: feed("b-forms", "co-b", { owner_label: "Web forms", local: "local" }),
    schedule_revision: 3,
    current_rate: { status: "resolved", amount: 150, amount_cents: 15000 },
  },
  {
    source_granularity: feed("off-1", "co-a", { owner_label: "Old forms", active: false }),
    schedule_revision: 1,
    current_rate: { status: "duplicate_zero", amount: 0 },
  },
];
const names = new Map([
  ["co-a", "Alpha Leads"],
  ["co-b", "Beta Leads"],
]);
const nameOf = (id: string) => names.get(id) ?? "Other lead source";

const periods: CplScheduleState = {
  source_granularity_id: "b-calls",
  revision: 4,
  active: true,
  periods: [
    {
      id: "p1",
      source_granularity_id: "b-calls",
      amount_cents: 18000,
      effective_from: "",
      effective_from_date: "2026-01-01",
      effective_until_date_exclusive: "2026-07-30",
      business_timezone: "America/New_York",
    },
    {
      id: "p2",
      source_granularity_id: "b-calls",
      amount_cents: 20500,
      effective_from: "",
      effective_from_date: "2026-07-30",
      business_timezone: "America/New_York",
    },
    {
      id: "p3",
      source_granularity_id: "b-calls",
      amount_cents: 22000,
      effective_from: "",
      effective_from_date: "2026-12-01",
      business_timezone: "America/New_York",
    },
  ],
};

test("groups are alphabetical by company, forms before calls, long distance before local", () => {
  const groups = groupCplSnapshotByCompany(items.slice(0, 3), nameOf);
  assert.deepEqual(
    groups.map((g) => g.companyName),
    ["Alpha Leads", "Beta Leads"],
  );
  assert.deepEqual(
    groups[1]!.items.map((i) => i.source_granularity.id),
    ["b-forms", "b-calls"],
  );
});

test("row state keeps Missing apart from $0", () => {
  assert.equal(cplRowState({ status: "missing_rate", fallback_amount: 0 }).kind, "missing");
  assert.equal(cplRowState({ status: "duplicate_zero", amount: 0 }).kind, "recorded_twice");
  assert.deepEqual(cplRowState({ status: "resolved", amount: 0, amount_cents: 0 }), { kind: "resolved", amount: 0 });
});

test("the simple schedule body carries each changed row's own expected revision", () => {
  const snapshot = { generated_at: "", items };
  const changes = computeSimpleCplChanges(snapshot, { "a-forms": "99", "b-forms": "150", "b-calls": "210" });
  assert.deepEqual(
    changes.map((c) => c.source_granularity_id),
    ["b-calls", "a-forms"],
  );
  const body = buildSimpleCplInput(changes, "2026-10-06", "  new deal ");
  assert.deepEqual(body, {
    effective_date: "2026-10-06",
    expected_revisions: { "b-calls": 4, "a-forms": 2 },
    changes: [
      { source_granularity_id: "b-calls", amount: 210 },
      { source_granularity_id: "a-forms", amount: 99 },
    ],
    reason: "new deal",
  });
  assert.equal("reason" in buildSimpleCplInput(changes, "2026-10-06", "  "), false);
});

test("periods classify against the New York day and give the since date", () => {
  const split = classifyCplPeriods(periods.periods, "2026-10-06");
  assert.deepEqual([split.past.length, split.current.length, split.future.length], [1, 1, 1]);
  assert.equal(currentCplSince(periods.periods, "2026-10-06", "p2"), "2026-07-30");
  assert.equal(currentCplSince(periods.periods, "2026-10-06"), "2026-07-30");
  assert.equal(currentCplSince([], "2026-10-06"), null);
});

const baseForm: AdvancedCplForm = {
  kind: "add_future",
  effectiveDate: "2026-11-01",
  amount: "230",
  periodId: "",
  reason: "",
  replaceRows: [{ from: "2026-11-01", until: "", amount: "230" }],
};

test("advanced commands keep the revision and period rules", () => {
  assert.equal(buildAdvancedCplCommand(baseForm, null).ok, false);
  assert.deepEqual(buildAdvancedCplCommand(baseForm, 0), {
    ok: true,
    command: { operation: "add_future", expected_revision: 0, effective_date: "2026-11-01", amount: 230 },
  });
  assert.equal(buildAdvancedCplCommand({ ...baseForm, amount: "" }, 4).ok, false);
  assert.equal(buildAdvancedCplCommand({ ...baseForm, kind: "split" }, 4).ok, false);
  assert.deepEqual(buildAdvancedCplCommand({ ...baseForm, kind: "split", periodId: " p2 ", reason: "mid-month" }, 4), {
    ok: true,
    command: {
      operation: "split",
      expected_revision: 4,
      period_id: "p2",
      effective_date: "2026-11-01",
      amount: 230,
      reason: "mid-month",
    },
  });
  assert.deepEqual(buildAdvancedCplCommand({ ...baseForm, kind: "correct_period", periodId: "p1" }, 4), {
    ok: true,
    command: { operation: "correct_period", expected_revision: 4, period_id: "p1", amount: 230, reason: "Correction" },
  });
  assert.deepEqual(buildAdvancedCplCommand({ ...baseForm, kind: "replace_schedule" }, 4), {
    ok: true,
    command: {
      operation: "replace_schedule",
      expected_revision: 4,
      periods: [{ effective_from_date: "2026-11-01", amount: 230 }],
    },
  });
  assert.equal(buildAdvancedCplCommand({ ...baseForm, kind: "replace_schedule", replaceRows: [] }, 4).ok, false);
});

const grid = (readOnly: boolean, showOff: boolean, drafts: Record<string, string> = {}) =>
  renderToStaticMarkup(
    createElement(LeadCostsGridView, {
      groups: groupCplSnapshotByCompany(
        items.filter((i) => i.source_granularity.active),
        nameOf,
      ),
      offGroups: groupCplSnapshotByCompany(
        items.filter((i) => !i.source_granularity.active),
        nameOf,
      ),
      showOff,
      onToggleOff() {},
      sinceByFeed: { "b-calls": "2026-07-30", "b-forms": null },
      drafts,
      onDraft() {},
      readOnly,
      focusFeedId: "a-forms",
    }),
  );

test("the grid shows company headings, Missing in words, no ids, and the off feeds behind a toggle", () => {
  const markup = grid(false, false, { "a-forms": "7.5" });
  assert.match(markup, /Alpha Leads/);
  assert.match(markup, /Beta Leads/);
  assert.match(markup, /Missing/);
  assert.match(markup, /\$205\.00/);
  assert.match(markup, /Jul 30/);
  assert.match(markup, /Feeds that are off \(1\)/);
  assert.doesNotMatch(markup, /Old forms/);
  assert.match(grid(false, true), /Old forms/);
  assert.doesNotMatch(markup, /ObjectId|\b[a-f0-9]{24}\b/);
  assert.match(grid(true, false), /disabled/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

const preview: CplCorrectionPreviewResult = {
  preview_hash: "hash",
  target_schedule_revision: 4,
  impact: {
    matched_count: 12,
    form_lead_count: 10,
    call_lead_count: 2,
    would_change_count: 9,
    would_no_op_count: 3,
    sample: [
      {
        lead_model: "FormLead",
        lead_id: "abc",
        timestamp: "2026-09-01T00:00:00Z",
        current_cpl: 190,
        target_cpl: 205,
        target_resolution_status: "resolved",
        would_change: true,
      },
    ],
  },
};
const job: CplCorrectionJob = {
  id: "0123456789abcdef01234567",
  request_id: "r",
  source_granularity_id: "b-forms",
  window_from: "2026-09-01",
  window_until: "2026-09-30",
  target_schedule_revision: 4,
  preview_hash: "hash",
  status: "processing",
  reason: null,
  matched_count: 12,
  changed_count: 4,
  no_op_count: 1,
  failed_count: 0,
  last_error: null,
  started_at: null,
  completed_at: null,
  created_at: "",
  updated_at: "",
};

test("Fix past leads renders the preview and the job without ids or engineering words", () => {
  const noop = () => {};
  const markup = renderToStaticMarkup(
    createElement(FixPastLeadsView, {
      feeds: [{ value: "b-forms", label: "Beta Leads · Web forms · Local" }],
      feedId: "b-forms",
      onFeed: noop,
      from: "2026-09-01",
      onFrom: noop,
      until: "2026-09-30",
      onUntil: noop,
      reason: "",
      onReason: noop,
      preview,
      job,
      error: null,
      message: LEAD_COSTS_COPY.fix.started,
      readOnly: false,
      busy: false,
      onPreview: noop,
      onConfirm: noop,
      onCancel: noop,
    }),
  );
  assert.match(markup, /Would change/);
  assert.match(markup, /Running/);
  assert.match(markup, /Cancel the job/);
  assert.match(markup, /Changed 4/);
  assert.doesNotMatch(markup, /0123456789abcdef01234567/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("the Lead cost sheet speaks in sentences, never command names or period ids", () => {
  const noop = () => {};
  const render = (readOnly: boolean, kind: AdvancedCplForm["kind"]) =>
    renderToStaticMarkup(
      createElement(LeadCostSheetView, {
        title: LEAD_COSTS_COPY.sheet.title("Beta Leads", "Inbound calls"),
        item: items[0]!,
        schedule: periods,
        today: "2026-10-06",
        readOnly,
        simple: { amount: "", date: "2026-10-06", reason: "", canSave: false, saving: false, message: null, error: null },
        advanced: { form: { ...baseForm, kind }, canRun: false, running: false, message: null, error: null },
        onSimple: noop,
        onSaveSimple: noop,
        onAdvanced: noop,
        onRunAdvanced: noop,
        onClose: noop,
      }),
    );
  const markup = render(false, "split");
  assert.match(markup, /Lead cost · Beta Leads · Inbound calls/);
  assert.match(markup, /\$205\.00/);
  assert.match(markup, /since Jul 30/);
  assert.match(markup, /Add a new amount from a date/);
  assert.match(markup, /Split a period at a date/);
  assert.match(markup, /Replace the whole schedule/);
  assert.match(markup, /Correct a past period/);
  assert.match(markup, /view=fix/);
  // Visible text only: option values may carry ids, the words may not.
  assert.doesNotMatch(markup.replace(/<[^>]+>/g, " "), /add_future|correct_period|replace_schedule|\bp[123]\b/);
  for (const kind of ["add_future", "split", "replace_schedule", "correct_period"] as const) {
    assert.deepEqual(findOwnerMarkupLeaks(render(false, kind)), []);
  }
  assert.doesNotMatch(render(true, "split"), /Apply</);
});

test("the old rate book is read-only and labelled historical", () => {
  const rates: CplRate[] = [
    { id: "1", label: "Best Relocation Forms", source_company: "best_relocation_leads", lead_type: "form", cpl: 195 },
    { id: "2", label: "Best Relocation Inbounds", source_company: "best_relocation_leads", lead_type: "call", cpl: 205 },
  ];
  const markup = renderToStaticMarkup(createElement(OldRateBookView, { rates }));
  assert.match(markup, /Old rate book · read-only/);
  assert.match(markup, /Lead costs above are what the dashboard uses/);
  assert.match(markup, /\$195\.00/);
  assert.doesNotMatch(markup, /<input|<button/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});
