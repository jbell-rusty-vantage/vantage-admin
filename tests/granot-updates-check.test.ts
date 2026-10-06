import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuditDrawer, CheckResults, type ResultTab } from "../components/automations/granot-updates/check-results";
import { ApproveDialog } from "../components/automations/granot-updates/check-approve-dialog";
import { CheckProgress } from "../components/automations/granot-updates/check-progress";
import { CheckReview, type CheckReviewProps, type ReviewTab } from "../components/automations/granot-updates/check-review";
import { normalizeGranotRun, type GranotRun } from "../lib/api/granotAutomation";
import { checkOf, isFallbackMatch, resultRows } from "../lib/automations/granot-updates-model";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

const formRunPayload = {
  id: "aaaaaaaaaaaaaaaaaaaaaaa1",
  run_group_id: "group-1",
  operation: "form_leads",
  workflow: "apply",
  status: "awaiting_approval",
  plan_checksum: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  expires_at: "2026-10-06T13:14:00.000Z",
  counters: { update: 2, conflict: 1, no_match: 1, unchanged: 1 },
  collection: {
    requestedDateWindow: { from: "10/03/2026", to: "10/05/2026" },
    discoveredSourceLabels: ["TBM Forms", "Top10 Forms"],
    notObservedSourceLabels: ["Main Site Forms"],
    sources: [
      { sourceLabel: "TBM Forms", contentHash: "h1", bookedJobs: 1, followUpEstimates: 3 },
      { sourceLabel: "Top10 Forms", contentHash: "h2", bookedJobs: 0, followUpEstimates: 1 },
    ],
  },
  checkpoint: { phase: "planned", completed_units: 2, updated_at: "2026-10-05T13:14:00.000Z" },
  receipt_count: 0,
  created_at: "2026-10-05T13:12:00.000Z",
  plan: {
    kind: "form_leads",
    schema_version: 2,
    counters: { update: 2, conflict: 1, no_match: 1, unchanged: 1 },
    actions: [
      {
        action_id: "TBM Forms:followUpEstimates:3:P5563337",
        row_id: "followUpEstimates:3:P5563337",
        source_label: "TBM Forms",
        table_section: "followUpEstimates",
        classification: "update",
        match_method: "ref_no_exact",
        lead_id: "lead-maria",
        patch: { quoted: true, cubic_feet: 850 },
        expected: { quoted: false, cubic_feet: null },
        warnings: [],
        lifecycle_apply: { operation_id: "x", operation_kind: "lead_snapshot_apply" },
      },
      {
        action_id: "TBM Forms:followUpEstimates:4:P5563342",
        row_id: "followUpEstimates:4:P5563342",
        source_label: "TBM Forms",
        table_section: "followUpEstimates",
        classification: "update",
        match_method: "fallback",
        lead_id: "lead-dan",
        patch: { pickup_zip: "33101", receiver_agent: "agent-1", receiver_agent_name_snapshot: "Alex", receiver_agent_source: "extension_crm_username_match", receiver_agent_source_value: "alex", receiver_agent_set_at: "2026-10-05T13:13:00.000Z" },
        expected: { pickup_zip: null, receiver_agent: null },
        warnings: ["Exact ref matched a different source_company."],
      },
      {
        action_id: "TBM Forms:bookedJobs:1:P5563400",
        row_id: "bookedJobs:1:P5563400",
        source_label: "TBM Forms",
        table_section: "bookedJobs",
        classification: "conflict",
        match_method: "fallback",
        reason: "ambiguous_fallback",
      },
      {
        action_id: "Top10 Forms:followUpEstimates:1:P5563500",
        row_id: "followUpEstimates:1:P5563500",
        source_label: "Top10 Forms",
        table_section: "followUpEstimates",
        classification: "no_match",
        match_method: "none",
        reason: "No Form Lead matched the phone or ref.",
      },
      {
        action_id: "TBM Forms:followUpEstimates:5:P5563600",
        row_id: "followUpEstimates:5:P5563600",
        source_label: "TBM Forms",
        table_section: "followUpEstimates",
        classification: "unchanged",
        match_method: "mongo_id",
        lead_id: "lead-same",
      },
    ],
  },
  receipts: [],
};

const callRunPayload = {
  id: "aaaaaaaaaaaaaaaaaaaaaaa2",
  run_group_id: "group-1",
  operation: "call_leads",
  workflow: "apply",
  status: "awaiting_approval",
  plan_checksum: "b".repeat(64),
  expires_at: "2026-10-06T13:20:00.000Z",
  counters: { updateable: 1, conflict: 0, no_match: 1, unchanged: 0 },
  collection: {
    requestedDateWindow: { from: "10/03/2026", to: "10/05/2026" },
    discoveredSourceLabels: ["TBM Inbounds"],
    notObservedSourceLabels: [],
    sources: [{ sourceLabel: "TBM Inbounds", contentHash: "h3", bookedJobs: 2, followUpEstimates: 0 }],
  },
  receipt_count: 0,
  created_at: "2026-10-05T13:12:05.000Z",
  plan: {
    kind: "call_leads",
    schema_version: 2,
    actions: [
      {
        action_id: "booked_reconciliation:bookedJobs:1:P5563405",
        operation: "booked_reconciliation",
        row: { row_id: "bookedJobs:1:P5563405", source_label: "TBM Inbounds" },
        syncable: true,
        preview: { status: "updateable", message: "Ready", match_method: "phone_and_job_no", call_lead_id: "lead-call-1", job_no: "5563405", changes: ["granot_contact_snapshot", "booking.customer"], warnings: ["Phone matched two leads; newest chosen."] },
      },
      {
        action_id: "enrichment:followUpEstimates:2:P5563406",
        operation: "enrichment",
        row: { row_id: "followUpEstimates:2:P5563406", source_label: "TBM Inbounds" },
        syncable: false,
        preview: { status: "no_match", message: "No call lead matched.", match_method: "none", changes: [], warnings: [] },
      },
    ],
  },
  receipts: [],
};


const formRun = normalizeGranotRun(formRunPayload);
const callRun = normalizeGranotRun(callRunPayload);
const noop = () => undefined;

/** Visible text: tags and React comment markers removed, whitespace collapsed. */
function text(markup: string): string {
  return markup
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/ ·/g, " ·")
    .trim();
}

function assertClean(markup: string) {
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
  assert.equal(/\b[a-f0-9]{24}\b/i.test(markup), false);
  assert.equal(markup.includes("a1b2c3d4e5f6"), false);
}

function reviewProps(runs: GranotRun[], overrides: Partial<CheckReviewProps> = {}): CheckReviewProps {
  const hideFallback = overrides.hideFallback ?? false;
  const selectedOf = (runId: string) => {
    const run = runs.find((item) => item.run_id === runId);
    return new Set((run?.actions ?? []).filter((action) => action.syncable === true && !(hideFallback && isFallbackMatch(action))).map((action) => action.action_id));
  };
  return {
    check: checkOf(runs),
    runs,
    tab: "ready",
    onTab: noop,
    selectedOf,
    onSetSelected: noop,
    hideFallback,
    onHideFallback: noop,
    leadTypeFilter: "all",
    onLeadType: noop,
    onOpenLead: noop,
    onApply: noop,
    ...overrides,
  };
}

const review = (runs: GranotRun[], overrides: Partial<CheckReviewProps> = {}) => renderToStaticMarkup(createElement(CheckReview, reviewProps(runs, overrides)));

test("CheckProgress while collecting shows the start time, source counts and the leave sentence", () => {
  const collecting: GranotRun[] = [
    {
      ...formRun,
      status: "collecting",
      checkpoint: { phase: "collecting" },
      collection_summaries: [formRun.collection_summaries![0]!],
      collection: { ...formRun.collection!, discovered_source_labels: ["TBM Forms", "Top10 Forms", "Main Site Forms"], not_observed_source_labels: [] },
    },
    { ...callRun, status: "queued", checkpoint: undefined, collection_summaries: undefined, collection: undefined },
  ];
  const markup = renderToStaticMarkup(createElement(CheckProgress, { runs: collecting, check: checkOf(collecting) }));
  const words = text(markup);
  assert.match(words, /Checking Granot · started 9:12 AM/);
  assert.match(words, /Reading sources 1 \/ 3/);
  assert.match(words, /Form leads: reading TBM Forms…/);
  assert.match(words, /Call leads: waiting/);
  assert.match(words, /You can leave this page/);
  assertClean(markup);
});

test("CheckProgress failed state shows the generic sentence and Try again", () => {
  const failed: GranotRun[] = [{ ...formRun, status: "failed" }];
  const markup = renderToStaticMarkup(createElement(CheckProgress, { runs: failed, check: checkOf(failed), failed: true, onTryAgain: noop }));
  const words = text(markup);
  assert.match(words, /The check stopped/);
  assert.match(words, /The check stopped before it finished\./);
  assert.match(words, /Try again/);
  assert.match(words, /Starts a new check with the same choices\./);
  assertClean(markup);
});

test("CheckReview Ready tab: cards, rows, matched-by chip and the sticky bar", () => {
  const markup = review([formRun, callRun]);
  const words = text(markup);
  assert.match(words, /Ready 3 2 form · 1 call/);
  assert.match(words, /Needs a look 1/);
  assert.match(words, /Not found 2/);
  assert.match(words, /No change 1/);
  assert.match(words, /5563337/);
  assert.match(words, /Quoted no → yes · Cubic feet — → 850/);
  assert.match(words, /Ref no/);
  assert.match(markup, /crm-evidence--warn/);
  assert.match(words, /3 selected · 2 form · 1 call/);
  assert.match(words, /Apply 3 updates/);
  assert.match(markup, /gu-check-bar/);
  assert.match(words, /Both lead types/);
  assertClean(markup);
});

test("CheckReview hide fallback removes the fallback row and lowers the selection", () => {
  const markup = review([formRun, callRun], { hideFallback: true });
  const words = text(markup);
  assert.equal(words.includes("5563342"), false);
  assert.match(words, /2 selected · 1 form · 1 call/);
  assert.match(words, /Apply 2 updates/);
  assert.match(markup, /aria-pressed="true"/);
  assertClean(markup);
});

test("CheckReview other tabs say why, collapse the unchanged and list sources", () => {
  const tabs: ReviewTab[] = ["ready", "look", "missing", "same", "sources"];
  for (const tab of tabs) assertClean(review([formRun, callRun], { tab }));
  assert.match(text(review([formRun, callRun], { tab: "look" })), /More than one lead could be this job/);
  assert.match(text(review([formRun, callRun], { tab: "missing" })), /No Form Lead matched the phone or ref\./);
  const same = review([formRun, callRun], { tab: "same" });
  assert.match(same, /<details/);
  assert.match(text(same), /1 lead already matches Granot/);
  const sources = text(review([formRun, callRun], { tab: "sources" }));
  assert.match(sources, /TBM Forms/);
  assert.match(sources, /Main Site Forms requested but not observed/);
  assert.equal(sources.includes("h1"), false);
});

test("ApproveDialog names the updates, the per-field summary and a short plan id only", () => {
  const selected = [formRun, callRun].flatMap((run) => (run.actions ?? []).filter((action) => action.syncable === true).map((action) => ({ run, action })));
  const markup = renderToStaticMarkup(createElement(ApproveDialog, { selected, pending: false, onCancel: noop, onConfirm: noop }));
  const words = text(markup);
  assert.match(words, /Apply 3 updates to 3 leads\?/);
  assert.match(words, /Form leads 2: .*quoted ×1/);
  assert.match(words, /Call leads 1:/);
  assert.match(words, /This is plan a1b2c3d4 \(prepared/);
  assert.match(words, /Cancel/);
  assert.match(markup, /role="dialog"/);
  assert.equal(markup.includes(formRun.plan_checksum!), false);
  assert.equal(markup.includes("a1b2c3d4e5"), false);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

const appliedRun: GranotRun = {
  ...formRun,
  status: "completed_with_errors",
  receipt_count: 4,
  updated_at: "2026-10-05T13:21:00.000Z",
  receipts: [
    { receipt_id: "r1", lifecycle_receipt_id: "aaaaaaaaaaaaaaaaaaaaaaa9", observation_id: "obs-1", decision_id: "dec-1", action_id: formRun.actions![0]!.action_id, outcome: "applied", status: "applied", pending: false, applied_at: "2026-10-05T13:20:00.000Z" },
    { receipt_id: "r2", action_id: formRun.actions![1]!.action_id, outcome: "failed", status: "failed", pending: false, error_code: "expected_mismatch" },
    { receipt_id: "r3", action_id: "unknown-action", outcome: "accepted_for_processing", status: "accepted_for_processing", pending: true },
    { receipt_id: "r4", action_id: formRun.actions![4]!.action_id, outcome: "already_current", status: "already_current", pending: false },
  ],
};

function results(tab: ResultTab, runs: GranotRun[] = [appliedRun]) {
  return renderToStaticMarkup(createElement(CheckResults, { check: checkOf(runs), runs, tab, onTab: noop, onOpenLead: noop }));
}

test("CheckResults: cards, Applied row with time, Failed sentence, Export CSV, no ids", () => {
  const words = text(results("applied"));
  assert.match(words, /Granot updates · Oct 3 – Oct 5 · applied 9:20 AM/);
  assert.match(words, /Applied 1/);
  assert.match(words, /Already current 1/);
  assert.match(words, /Failed 1/);
  assert.match(words, /Pending 1/);
  assert.match(words, /5563337/);
  assert.match(words, /Applied 9:20 AM/);
  assert.match(words, /Export CSV/);
  for (const tab of ["applied", "same", "failed", "pending", "notSelected"] as const) assertClean(results(tab));
  assert.match(text(results("failed")), /Lead changed since the check · check again/);
  assert.match(text(results("pending")), /Waiting to match/);
  assert.match(text(results("notSelected")), /Ready updates you left unticked/);
});

test("CheckResults with no receipts says nothing was applied", () => {
  const empty = { ...formRun, status: "completed", receipts: [], actions: [] } as GranotRun;
  assert.match(text(results("applied", [empty])), /No updates were applied\./);
});

test("AuditDrawer holds the receipt id and the full plan checksum inside details", () => {
  const row = resultRows([appliedRun])[0]!;
  const markup = renderToStaticMarkup(createElement(AuditDrawer, { row, run: appliedRun, onClose: noop }));
  assert.match(markup, /<details open/);
  assert.match(markup, /aaaaaaaaaaaaaaaaaaaaaaa9/);
  assert.match(markup, new RegExp(appliedRun.plan_checksum!));
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});
