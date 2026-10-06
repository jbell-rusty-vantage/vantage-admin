import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGranotRun, type GranotAction, type GranotRun } from "../api/granotAutomation";
import {
  addDays,
  applyProgress,
  approvalSummary,
  bucketOf,
  changesWords,
  checkById,
  checkChoices,
  checkOf,
  checkStatusOf,
  checksOf,
  collectorFailureSentence,
  detailNeedsPolling,
  expiresInWords,
  fieldWords,
  fourBuckets,
  fromGranotApiDate,
  historyRows,
  isFallbackMatch,
  jobNoOf,
  lastCheckSummary,
  listNeedsPolling,
  matchedBy,
  notSelectedActions,
  outcomeWords,
  planShortId,
  presetWindow,
  receiptOutcomeWords,
  resultCounts,
  resultRows,
  resultsCsv,
  sinceLastCheck,
  waitingChecks,
  whatChanges,
  windowDays,
  windowWords,
} from "./granot-updates-model";

/** Plan schema v2 fixtures the way `GET /runs/:id?details=owner` sends them (`granot_statement` already redacted). */
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
        preview: { status: "updateable", message: "Ready", match_method: "phone_only", call_lead_id: "lead-call-1", job_no: "5563405", changes: ["granot_contact_snapshot", "booking.customer"], warnings: ["Phone matched two leads; newest chosen."] },
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
const action = (index: number): GranotAction => formRun.actions![index]!;

test("normalizeAction keeps patch, expected, lead id, section and preview values the review page reads", () => {
  assert.deepEqual(action(0).patch, { quoted: true, cubic_feet: 850 });
  assert.deepEqual(action(0).expected, { quoted: false, cubic_feet: null });
  assert.equal(action(0).lead_id, "lead-maria");
  assert.equal(action(0).table_section, "followUpEstimates");
  assert.equal(JSON.stringify(action(0)).includes("lifecycle_apply"), false);
  assert.equal(callRun.actions?.[0]?.lead_id, "lead-call-1");
  assert.equal(callRun.actions?.[0]?.job_no, "5563405");
});

test("whatChanges reads expected → patch per field for Form updates and names for Call actions", () => {
  assert.deepEqual(whatChanges(action(0)), [
    { field: "quoted", label: "Quoted", before: "no", after: "yes" },
    { field: "cubic_feet", label: "Cubic feet", before: null, after: "850" },
  ]);
  assert.equal(changesWords(whatChanges(action(0))), "Quoted no → yes · Cubic feet — → 850");
  // The rep shows its name, and the bookkeeping keys that ride with it are never rows.
  assert.deepEqual(whatChanges(action(1)), [
    { field: "pickup_zip", label: "Pickup zip", before: null, after: "33101" },
    { field: "receiver_agent", label: "Rep", before: null, after: "Alex" },
  ]);
  assert.deepEqual(whatChanges(callRun.actions![0]!), [
    { field: "granot_contact_snapshot", label: "Job details", before: null, after: null },
    { field: "booking.customer", label: "Booked call linked", before: null, after: null },
  ]);
  assert.equal(changesWords(whatChanges(callRun.actions![0]!)), "Job details · Booked call linked");
  assert.equal(changesWords([]), "—");
  // Once the server sends values (G2), objects are read.
  const withValues: GranotAction = { action_id: "x", preview: { changes: [{ field: "move_date", before: "2026-10-01", after: "2026-10-04" }] } };
  assert.deepEqual(whatChanges(withValues), [{ field: "move_date", label: "Move date", before: "2026-10-01", after: "2026-10-04" }]);
  assert.equal(fieldWords("some_new_thing"), "Some new thing");
});

test("jobNoOf prefers an explicit job number and parses the row id otherwise", () => {
  assert.equal(jobNoOf(action(0)), "5563337");
  assert.equal(jobNoOf(callRun.actions![0]!), "5563405");
  assert.equal(jobNoOf({ action_id: "Google:row-1", source_row_id: "row-1" }), null);
  assert.equal(jobNoOf({ action_id: "x", display: { job_no: "123456" } }), "123456");
});

test("matchedBy says Ref no · Lead id · Phone · Fallback and warns on phone and fallback", () => {
  assert.deepEqual(matchedBy(action(0)), { label: "Ref no", warn: false, warnings: [] });
  assert.deepEqual(matchedBy(action(1)), { label: "Fallback", warn: true, warnings: ["Exact ref matched a different source_company."] });
  assert.equal(matchedBy(action(4)).label, "Lead id");
  assert.equal(matchedBy(callRun.actions![0]!).label, "Phone");
  assert.equal(matchedBy(callRun.actions![0]!).warn, true);
  assert.equal(matchedBy(action(3)).label, "Not matched");
  assert.equal(isFallbackMatch(action(1)), true);
  assert.equal(isFallbackMatch(action(0)), false);
});

test("fourBuckets counts Ready / Needs a look / Not found / No change from actions, or from counters without them", () => {
  assert.equal(bucketOf(action(0)), "ready");
  assert.equal(bucketOf(action(2)), "look");
  assert.equal(bucketOf(action(3)), "missing");
  assert.equal(bucketOf(action(4)), "same");
  assert.deepEqual(fourBuckets([formRun, callRun]), { ready: 3, look: 1, missing: 2, same: 1, readyForm: 2, readyCall: 1 });
  const listOnly: GranotRun[] = [
    { ...formRun, actions: undefined },
    { ...callRun, actions: undefined },
  ];
  assert.deepEqual(fourBuckets(listOnly), { ready: 3, look: 1, missing: 2, same: 1, readyForm: 2, readyCall: 1 });
});

test("checkOf merges both runs into one check: operations, window, sources, expiry and status", () => {
  const check = checkOf([callRun, formRun]);
  assert.equal(check.id, "group-1");
  assert.deepEqual(check.operations, ["form_leads", "call_leads"]);
  assert.equal(check.from, "2026-10-03");
  assert.equal(check.to, "2026-10-05");
  assert.deepEqual(check.source_labels, ["Main Site Forms", "TBM Forms", "TBM Inbounds", "Top10 Forms"]);
  assert.equal(check.expires_at, "2026-10-06T13:14:00.000Z");
  assert.equal(check.status, "awaiting");
  assert.equal(check.runs[0]?.run_id, formRun.run_id);
  assert.equal(checkStatusOf([{ ...formRun, status: "collecting" }, callRun]), "checking");
  assert.equal(checkStatusOf([{ ...formRun, status: "completed" }, { ...callRun, status: "applying" }]), "applying");
  assert.equal(checkStatusOf([{ ...formRun, status: "expired" }, { ...callRun, status: "expired" }]), "expired");
  assert.equal(checkStatusOf([{ ...formRun, status: "completed" }, { ...callRun, status: "failed" }]), "failed");
  assert.equal(checkStatusOf([{ ...formRun, status: "completed" }, { ...callRun, status: "completed_with_errors" }]), "done_with_errors");
  assert.equal(checkStatusOf([{ ...formRun, status: "completed" }, { ...callRun, status: "completed" }]), "done");
});

test("checksOf groups by run group newest first; checkById also answers a run id", () => {
  const older: GranotRun = { ...formRun, run_id: "old-run", run_group_id: undefined, status: "completed", created_at: "2026-10-01T10:00:00.000Z" };
  const checks = checksOf([older, formRun, callRun]);
  assert.deepEqual(checks.map((check) => check.id), ["group-1", "old-run"]);
  assert.equal(checks[0]?.runs.length, 2);
  assert.equal(checkById([older, formRun, callRun], "group-1")?.runs.length, 2);
  assert.equal(checkById([older, formRun, callRun], formRun.run_id)?.id, "group-1");
  assert.equal(checkById([older, formRun, callRun], "old-run")?.id, "old-run");
  assert.equal(checkById([older], "nope"), null);
  assert.deepEqual(waitingChecks([older, formRun, callRun]).map((check) => check.id), ["group-1"]);
});

test("dates: Granot MM/DD/YYYY to day keys, windows in words, presets and Since last check in New York days", () => {
  assert.equal(fromGranotApiDate("10/03/2026"), "2026-10-03");
  assert.equal(fromGranotApiDate("2026-10-03"), null);
  assert.equal(windowWords("2026-10-03", "2026-10-05"), "Oct 3 – Oct 5");
  assert.equal(windowWords("2026-10-05", "2026-10-05"), "Oct 5");
  assert.equal(windowWords("2025-12-30", "2026-01-02", "2026-10-06"), "Dec 30, 2025 – Jan 2");
  assert.equal(windowDays("2026-10-03", "2026-10-05"), 3);
  assert.equal(windowDays("2026-10-05", "2026-10-03"), 0);
  assert.equal(addDays("2026-10-06", -6), "2026-09-30");
  // 2026-10-06 production fix: an empty or malformed key must never throw inside a render (it did: "Invalid time value").
  assert.equal(addDays("", -6), "");
  assert.equal(addDays("not-a-day", 1), "not-a-day");
  assert.deepEqual(presetWindow("today", "2026-10-06", [], ["form_leads"]), { from: "2026-10-06", to: "2026-10-06" });
  assert.deepEqual(presetWindow("yesterday", "2026-10-06", [], ["form_leads"]), { from: "2026-10-05", to: "2026-10-05" });
  assert.deepEqual(presetWindow("last7", "2026-10-06", [], ["form_leads"]), { from: "2026-09-30", to: "2026-10-06" });
  assert.equal(presetWindow("custom", "2026-10-06", [], ["form_leads"]), null);
  // Since last check: the `to` day of the newest applied run of the same lead types, through today.
  const applied: GranotRun = { ...formRun, run_id: "applied", status: "completed", created_at: "2026-10-04T10:00:00.000Z" };
  assert.equal(sinceLastCheck([formRun, callRun], ["form_leads"], "2026-10-06"), null);
  assert.deepEqual(sinceLastCheck([applied, formRun], ["form_leads", "call_leads"], "2026-10-06"), { from: "2026-10-05", to: "2026-10-06" });
  assert.equal(sinceLastCheck([applied], ["call_leads"], "2026-10-06"), null);
  assert.equal(sinceLastCheck([{ ...applied, workflow: "preview" }], ["form_leads"], "2026-10-06"), null);
});

test("expiry and polling words", () => {
  const now = Date.parse("2026-10-05T14:14:00.000Z");
  assert.equal(expiresInWords("2026-10-06T13:14:00.000Z", now), "23 h");
  assert.equal(expiresInWords("2026-10-05T14:54:00.000Z", now), "40 min");
  assert.equal(expiresInWords("2026-10-05T14:00:00.000Z", now), "expired");
  assert.equal(expiresInWords(null, now), null);
  assert.equal(detailNeedsPolling("collecting"), true);
  assert.equal(detailNeedsPolling("applying"), true);
  assert.equal(detailNeedsPolling("awaiting_approval"), false);
  assert.equal(detailNeedsPolling("completed"), false);
  assert.equal(listNeedsPolling([formRun, { ...callRun, status: "completed" }]), true);
  assert.equal(listNeedsPolling([{ ...formRun, status: "expired" }]), false);
});

test("approvalSummary counts per field per lead type and planShortId takes eight characters", () => {
  const summary = approvalSummary([
    { operation: "form_leads", action: action(0) },
    { operation: "form_leads", action: action(1) },
    { operation: "call_leads", action: callRun.actions![0]! },
  ]);
  assert.equal(summary, "Form leads 2: cubic feet ×1, pickup zip ×1, quoted ×1, rep ×1. Call leads 1: booked call linked ×1, job details ×1.");
  assert.equal(planShortId(formRun.plan_checksum), "a1b2c3d4");
});

test("results join receipts to actions, say outcomes in words, count them and export CSV", () => {
  const applied: GranotRun = {
    ...formRun,
    status: "completed_with_errors",
    receipts: [
      { receipt_id: "r1", lifecycle_receipt_id: "r1", observation_id: "o1", decision_id: "d1", action_id: action(0).action_id, outcome: "applied", status: "applied", pending: false, applied_at: "2026-10-05T13:20:00.000Z" },
      { receipt_id: "r2", action_id: action(1).action_id, outcome: "failed", status: "failed", pending: false, error_code: "expected_mismatch" },
      { receipt_id: "r3", action_id: "unknown-action", outcome: "accepted_for_processing", status: "accepted_for_processing", pending: true },
      { receipt_id: "r4", action_id: action(4).action_id, outcome: "already_current", status: "already_current", pending: false },
    ],
  };
  const rows = resultRows([applied]);
  assert.deepEqual(rows.map((row) => [row.job_no, row.kind, row.words]), [
    ["5563337", "applied", "Applied"],
    ["5563342", "failed", "Lead changed since the check · check again"],
    [null, "pending", "Waiting to match"],
    ["5563600", "same", "Already current"],
  ]);
  assert.deepEqual(resultCounts([applied]), { applied: 1, same: 1, failed: 1, pending: 1, total: 4 });
  assert.deepEqual(applyProgress([applied]), { done: 3, total: 4 });
  assert.equal(receiptOutcomeWords({ receipt_id: "x", action_id: "x", outcome: "boom", status: "boom", pending: false, error_code: "weird_thing" }), "Could not apply · weird thing");
  assert.equal(outcomeWords(checkOf([applied])), "Applied 1 of 4 · some failed");
  const csv = resultsCsv([applied], (row) => (row.action?.lead_id === "lead-maria" ? "Maria Gómez" : row.action?.lead_id ?? ""));
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "job,lead,field,before,after,result");
  assert.equal(lines[1], "5563337,Maria Gómez,Quoted,no,yes,Applied 2026-10-05T13:20:00.000Z");
  assert.equal(lines[2], "5563337,Maria Gómez,Cubic feet,,850,Applied 2026-10-05T13:20:00.000Z");
  assert.equal(lines[3], "5563342,lead-dan,Pickup zip,,33101,Lead changed since the check · check again");
  assert.equal(lines[5], ",,,,,Waiting to match");
  // Ready rows the Owner left unticked have no receipt.
  assert.deepEqual(notSelectedActions([applied]).map((row) => row.action.action_id), []);
  assert.deepEqual(notSelectedActions([{ ...applied, receipts: [] }]).map((row) => jobNoOf(row.action)), ["5563337", "5563342"]);
});

test("outcome words per status and the history rows", () => {
  const checkingRun: GranotRun = { ...formRun, status: "collecting", run_group_id: "g-check", created_at: "2026-10-06T10:00:00.000Z" };
  const doneRun: GranotRun = { ...formRun, status: "completed", receipt_count: 21, run_group_id: "g-done", created_at: "2026-10-04T10:00:00.000Z" };
  const noneRun: GranotRun = { ...formRun, status: "completed", receipt_count: 0, run_group_id: "g-none", created_at: "2026-10-03T10:00:00.000Z" };
  const expiredRun: GranotRun = { ...formRun, status: "expired", run_group_id: "g-exp", created_at: "2026-10-02T10:00:00.000Z" };
  const failedRun: GranotRun = { ...formRun, status: "failed", run_group_id: "g-fail", created_at: "2026-10-01T10:00:00.000Z" };
  assert.equal(outcomeWords(checkOf([checkingRun])), "Checking Granot");
  assert.equal(outcomeWords(checkOf([formRun, callRun])), "Waiting for approval · 3 updates ready");
  assert.equal(outcomeWords(checkOf([doneRun])), "Applied 21 updates");
  assert.equal(outcomeWords(checkOf([noneRun])), "No updates needed");
  assert.equal(outcomeWords(checkOf([expiredRun])), "Expired (not approved)");
  assert.equal(outcomeWords(checkOf([failedRun])), "Failed");
  const runs = [checkingRun, formRun, callRun, doneRun, noneRun, expiredRun, failedRun];
  assert.deepEqual(historyRows(runs).map((row) => [row.id, row.lead_types, row.sources, row.outcome]), [
    ["g-check", "form", 3, "Checking Granot"],
    ["group-1", "form + call", 4, "Waiting for approval · 3 updates ready"],
    ["g-done", "form", 3, "Applied 21 updates"],
    ["g-none", "form", 3, "No updates needed"],
    ["g-exp", "form", 3, "Expired (not approved)"],
    ["g-fail", "form", 3, "Failed"],
  ]);
  assert.deepEqual(historyRows(runs, "waiting").map((row) => row.id), ["group-1"]);
  assert.deepEqual(historyRows(runs, "done").map((row) => row.id), ["g-done", "g-none"]);
  assert.deepEqual(historyRows(runs, "failed").map((row) => row.id), ["g-exp", "g-fail"]);
  assert.equal(historyRows(runs)[1]?.window, "Oct 3 – Oct 5");
  const summary = lastCheckSummary(runs);
  assert.equal(summary?.check.id, "g-check");
  assert.equal(lastCheckSummary([doneRun])?.applied, 21);
  assert.equal(lastCheckSummary([]), null);
});

test("collector failures become sentences and the check choices read back for Try again", () => {
  assert.equal(collectorFailureSentence("invalid_session"), "Granot rejected the sign-in; we retried once.");
  assert.equal(collectorFailureSentence("schema_drift"), "Granot changed a page layout; the check stopped safely.");
  assert.equal(collectorFailureSentence("provider_error"), "Granot did not answer.");
  assert.equal(collectorFailureSentence(undefined), "The check stopped before it finished.");
  assert.deepEqual(checkChoices(checkOf([formRun, callRun])), {
    from: "2026-10-03",
    to: "2026-10-05",
    operations: ["form_leads", "call_leads"],
    source_labels: ["Main Site Forms", "TBM Forms", "TBM Inbounds", "Top10 Forms"],
    date_factor: "OPEN",
  });
  assert.equal(checkChoices(checkOf([{ ...formRun, collection: undefined, from: undefined, to: undefined }])), null);
});
