import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  countText,
  freshnessChips,
  freshnessReasonText,
  repGoalText,
  repProgressLabel,
  repZeroActivityTitle,
} from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import {
  salesOutreachEnrollmentCandidatesSchema,
  salesOutreachEnrollmentReportSchema,
  salesOutreachEnvelope,
  salesOutreachErrorEnvelopeSchema,
  salesOutreachFreshnessSchema,
  salesOutreachRepDaysSchema,
  type SalesOutreachCaptureFreshness,
  type SalesOutreachFreshness,
  type SalesOutreachRepDayDto,
} from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { syntheticRepDays, syntheticZeroActivityRepDay } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 1): the admin consumes what the wave-1 server landings serve — A3-fresh freshness
 * (`reason`, `last_confirmation_at`, `last_webhook_at`), C0/C5 zero-activity rep-days (a real 0 once coverage is
 * complete) and B7 enrollment candidates (`in_scope` = the report's selection, opaque `next_cursor`).
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;

const granot = { state: "observed", last_observed_at: "2026-10-01T15:57:10.000Z", age_seconds: 170 } as const;
const sms: SalesOutreachCaptureFreshness = {
  state: "not_connected",
  last_updated_at: null,
  known_complete_through: null,
  age_seconds: null,
  reason: "rep_sms_capture_disabled",
  last_confirmation_at: null,
  last_webhook_at: null,
};
const calls = (patch: Partial<SalesOutreachCaptureFreshness>): SalesOutreachCaptureFreshness => ({
  state: "delayed",
  last_updated_at: "2026-10-01T15:40:00.000Z",
  known_complete_through: "2026-10-01T15:20:00.000Z",
  age_seconds: 1200,
  reason: null,
  last_confirmation_at: "2026-10-01T15:40:00.000Z",
  last_webhook_at: "2026-10-01T15:58:00.000Z",
  ...patch,
});
const chipsFor = (value: SalesOutreachCaptureFreshness, smsValue: SalesOutreachCaptureFreshness = sms) =>
  freshnessChips({ calls: value, sms: smsValue, granot } as SalesOutreachFreshness);

function collectUnknown<T>(run: () => T): { result: T; unknown: UnknownDeskCode[] } {
  const unknown: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => unknown.push(event));
  try {
    return { result: run(), unknown };
  } finally {
    stop();
  }
}

test("freshness: each A3-fresh reason reads in words in the delayed calls chip tooltip", () => {
  const expected: Record<string, string> = {
    confirmation_stale: deskCopy.freshness.reasons.confirmation_stale!,
    coverage_behind: deskCopy.freshness.reasons.coverage_behind!,
    webhook_silent: deskCopy.freshness.reasons.webhook_silent!,
  };
  for (const [code, words] of Object.entries(expected)) {
    const { result, unknown } = collectUnknown(() => chipsFor(calls({ reason: code })));
    const chip = result.find((one) => one.key === "calls")!;
    assert.equal(chip.label, "Delayed");
    assert.equal(chip.tone, "amber");
    assert.ok(chip.title.startsWith("RingCentral calls is complete through "), chip.title);
    assert.ok(chip.title.endsWith(` — ${words}`), chip.title);
    assert.doesNotMatch(chip.title, SNAKE, `${code} never reaches the screen`);
    assert.deepEqual(unknown, []);
  }
});

test("freshness: an unknown or RingCentral error code reads as the fallback and is reported, never raw", () => {
  const { result, unknown } = collectUnknown(() => chipsFor(calls({ reason: "RateLimited" })));
  const chip = result.find((one) => one.key === "calls")!;
  assert.equal(chip.title.endsWith(` — ${deskCopy.freshness.reasonFallback}`), true, chip.title);
  assert.doesNotMatch(chip.title, /RateLimited/);
  assert.deepEqual(unknown, [{ kind: "freshness_reason", code: null, value: "RateLimited" }]);
  assert.equal(freshnessReasonText(null), null);
  assert.equal(freshnessReasonText(""), null);
});

test("freshness: a fresh source shows its age only; not-connected and unknown sources say why", () => {
  const fresh = chipsFor(calls({ state: "fresh", age_seconds: 40, reason: "confirmation_stale" }));
  assert.equal(fresh.find((one) => one.key === "calls")!.title, "RingCentral calls updated just now", "a fresh chip carries no reason");
  const smsChip = chipsFor(calls({})).find((one) => one.key === "sms")!;
  assert.equal(smsChip.title, `RingCentral SMS is not connected — ${deskCopy.freshness.reasons.rep_sms_capture_disabled}`);
  const unknownChip = chipsFor(calls({ state: "unknown", known_complete_through: null, reason: "no_capture_state" })).find((one) => one.key === "calls")!;
  assert.equal(unknownChip.label, "Unknown");
  assert.equal(unknownChip.title, `RingCentral calls status is unknown — ${deskCopy.freshness.reasons.no_capture_state}`);
  const delayedNoReason = chipsFor(calls({ known_complete_through: null })).find((one) => one.key === "calls")!;
  assert.equal(delayedNoReason.title, "RingCentral calls is delayed");
});

test("freshness: every copied server example parses with the A3-fresh diagnostics and renders without raw codes", () => {
  const files = readdirSync(SERVER_FIXTURES).filter((file) => /^(capabilities|rep-days|team|queue|outreach)\./.test(file) && file.endsWith(".json"));
  let withDiagnostics = 0;
  for (const file of files) {
    const body = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, file), "utf8")) as { data: { freshness?: unknown } };
    if (!body.data.freshness) continue;
    const freshness = salesOutreachFreshnessSchema.parse(body.data.freshness);
    if (freshness.calls.last_confirmation_at !== undefined) withDiagnostics += 1;
    assert.equal(freshness.sms.last_confirmation_at ?? null, null, `${file}: SMS has no confirmation instant`);
    const { result, unknown } = collectUnknown(() => freshnessChips(freshness));
    for (const chip of result) assert.doesNotMatch(chip.title, SNAKE, `${file} ${chip.key}: ${chip.title}`);
    assert.deepEqual(unknown, [], `${file}: every served reason has copy`);
  }
  assert.ok(withDiagnostics >= 10, `the wave-1 examples carry last_confirmation_at (${withDiagnostics})`);
});

test("zero activity: a complete-coverage rep with no calls reads a real 0 with its tooltip, never Pending", () => {
  const zero = syntheticZeroActivityRepDay();
  salesOutreachRepDaysSchema.parse({ ...syntheticRepDays({ role: "owner" }), reps: [zero] });
  assert.equal(zero.actual_basis, "no_activity_recorded");
  assert.equal(zero.coverage.state, "complete");
  assert.equal(countText(zero.actual_confirmed), "0");
  assert.equal(repGoalText(zero), "0 / 100");
  assert.deepEqual(repProgressLabel(zero), { text: "0%", tone: "muted" });
  assert.equal(zero.remaining, 100);
  assert.equal(repZeroActivityTitle(zero), deskCopy.team.goals.noActivityTitle);

  const pending: SalesOutreachRepDayDto = {
    ...zero,
    actual_confirmed: null,
    actual_awaiting_confirmation: null,
    actual_basis: "pending",
    remaining: null,
    progress: null,
    goal_reached: null,
    coverage: { ...zero.coverage, state: "partial" },
    unknown_reason: "coverage_incomplete",
  };
  assert.equal(repGoalText(pending), "Pending / 100");
  assert.equal(repZeroActivityTitle(pending), undefined, "a pending count is never called a real 0");
  const counted: SalesOutreachRepDayDto = { ...zero, actual_confirmed: 0, actual_basis: "projection" };
  assert.equal(repZeroActivityTitle(counted), undefined, "only the server's no_activity_recorded basis gets the note");
});

const mock = (query: string, method = "GET", body?: unknown) =>
  mockSalesOutreachResponse({ role: "owner", method, path: `enrollment/${method === "GET" ? `candidates?${query}` : query}`, body });

test("enrollment (B7): in_scope is the report's selection inside the backfill scope; review matches the report", () => {
  const candidates = salesOutreachEnvelope(salesOutreachEnrollmentCandidatesSchema);
  const report = salesOutreachEnvelope(salesOutreachEnrollmentReportSchema).parse(mock("report", "POST", { selection: { mode: "backfill_scope" } }).body).data;
  const inScope = candidates.parse(mock("partition=in_scope&limit=100").body).data;
  assert.deepEqual(inScope.items.map((item) => item.lead), report.lead_refs);
  assert.equal(inScope.items.length, report.counts.in_scope);
  for (const item of inScope.items) {
    assert.equal(item.partition, "in_scope");
    assert.ok(["received_window", "upcoming_move", "selected"].includes(item.reason), item.reason);
    const inWindow = item.received_date !== null && item.received_date >= inScope.scope.cutoff_date!;
    const upcoming = item.move_date !== null && item.move_date >= inScope.scope.today;
    assert.ok(inWindow || upcoming, `${item.job_no} is inside the backfill scope`);
  }
  const review = candidates.parse(mock("partition=review").body).data;
  assert.equal(review.items.length, report.counts.review);
  assert.deepEqual(review.items, report.review);
  const older = candidates.parse(mock("partition=older").body).data;
  assert.ok(older.items.every((item) => item.reason === "outside_backfill_scope" && item.received_date! < older.scope.cutoff_date!));
  assert.deepEqual(candidates.parse(mock("partition=closed").body).data.items, []);
});

test("enrollment (B7): next_cursor pages to the end; a malformed or foreign cursor is CURSOR_EXPIRED", () => {
  const candidates = salesOutreachEnvelope(salesOutreachEnrollmentCandidatesSchema);
  const first = candidates.parse(mock("partition=in_scope&limit=2").body).data;
  assert.equal(first.items.length, 2);
  assert.equal(typeof first.next_cursor, "string");
  const second = candidates.parse(mock(`partition=in_scope&limit=2&cursor=${encodeURIComponent(first.next_cursor!)}`).body).data;
  assert.equal(second.items.length, 1);
  assert.equal(second.next_cursor, null);
  assert.notDeepEqual(second.items[0]!.lead, first.items[0]!.lead);
  // A malformed cursor, and an in_scope cursor replayed on the older list.
  for (const [partition, cursor] of [["in_scope", "garbage"], ["older", first.next_cursor!]] as const) {
    const refused = mock(`partition=${partition}&cursor=${encodeURIComponent(cursor)}`);
    assert.equal(refused.status, 409);
    assert.equal(salesOutreachErrorEnvelopeSchema.parse(refused.body).code, "CURSOR_EXPIRED");
  }
  assert.equal(candidates.parse(mock("partition=older").body).data.items.length, 2, "the default page holds the whole older list");
});
