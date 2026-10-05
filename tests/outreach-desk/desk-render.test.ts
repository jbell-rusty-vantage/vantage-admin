import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  absoluteTime,
  addDays,
  businessDateLabel,
  cadenceMetricText,
  cadenceSummaryLines,
  callsTodayText,
  channelStatus,
  countText,
  fillPercent,
  freshnessChips,
  leadAgeText,
  moveDateRange,
  nyDate,
  overdueByText,
  percentText,
  priorityPill,
  relativeDay,
  repGoalText,
  repProgressLabel,
  rowIssue,
} from "../../components/outreach-desk/lib/format";
import { explanationLines, nextAction } from "../../components/outreach-desk/views/lead-panel";
import { isoToNewYorkLocal, newYorkLocalToIso } from "../../components/outreach-desk/data/use-desk-commands";
import { msUntilNewYorkMidnight, parseDeskFrame } from "../../components/outreach-desk/data/use-desk-live";
import { outreachDeskMockVariant } from "../../server/outreach-desk-mock";
import {
  salesOutreachErrorFromBody,
  type SalesOutreachCapabilitiesDto,
  type SalesOutreachChannelDto,
  type SalesOutreachQueueRowDto,
  type SalesOutreachRepDaysDto,
} from "../../lib/api/salesOutreach";

const readServerExample = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server", name), "utf8"));
import { syntheticDetail, syntheticQueueRows, syntheticTeam, syntheticSubjectId } from "./fixtures/synthetic";

/**
 * Desk rendering rules (server handoff): null is pending, never 0; cadence_disabled/cadence_shadow are unavailable;
 * 108/100 reads as goal reached with a capped bar; zero-goal reps say "No goal today"; nothing here computes overdue —
 * statuses come from the server and only display text is interpolated from `as_of`.
 */

const AS_OF = "2026-10-01T16:00:00.000Z";
const channel = (patch: Partial<SalesOutreachChannelDto>): SalesOutreachChannelDto => ({
  required: 3,
  verified_completed: 0,
  remaining: 3,
  due_at: null,
  oldest_actionable_due_at: null,
  status: "due",
  completion_kind: null,
  coverage: { state: "complete", known_complete_through: null, gaps: [] },
  blocked_reason: null,
  ...patch,
});

test("dates are New York business dates and relative times interpolate from as_of only", () => {
  assert.equal(nyDate("2026-10-02T03:30:00.000Z"), "2026-10-01");
  assert.equal(businessDateLabel("2026-10-01"), "Thursday, Oct 1");
  assert.equal(relativeDay("2026-10-01T13:10:00.000Z", AS_OF), "Today, 9:10 AM");
  assert.equal(relativeDay("2026-09-30T20:00:00.000Z", AS_OF), "Yesterday");
  assert.equal(relativeDay("2026-09-29T18:40:00.000Z", AS_OF), "2 days ago");
  assert.equal(relativeDay("2026-09-20T18:40:00.000Z", AS_OF), "Sep 20");
  assert.equal(relativeDay(null, AS_OF), "Never");
  assert.match(absoluteTime("2026-10-01T13:10:00.000Z"), /Oct 1, 2026.*9:10 AM EDT/);
  assert.equal(leadAgeText({ received_at: "2026-09-29T14:00:00.000Z", schedule_day: null }, AS_OF), "Day 3");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("Lead age is the server's schedule_day when the row has one, else New York calendar age (S4)", () => {
  // The stored schedule day wins even when it disagrees with the calendar (closures shift the cadence day).
  assert.equal(leadAgeText({ received_at: "2026-09-29T14:00:00.000Z", schedule_day: 2 }, AS_OF), "Day 2");
  assert.equal(leadAgeText({ received_at: null, schedule_day: null }, AS_OF), "Unknown");
  const queue = readServerExample("queue.owner.page-1.json") as { data: { rows: SalesOutreachQueueRowDto[]; as_of: string } };
  for (const row of queue.data.rows) {
    if (row.schedule_day !== null) assert.equal(leadAgeText(row, queue.data.as_of), `Day ${row.schedule_day}`);
  }
});

test("the New lead schedule renders the capabilities' cadence summary 1:1, nothing when unconfigured (S4)", () => {
  const enforced = readServerExample("capabilities.rep.cadence-enforcement.json") as { data: SalesOutreachCapabilitiesDto };
  assert.deepEqual(cadenceSummaryLines(enforced.data.cadence_summary), [
    "Days 1–3: 2 calls required, 1 optional",
    "Days 1–5: 2 calls a day",
    "Day 6 on: 1 call a day",
    "SMS: Days 1, 2, 3, then every 3 days from Day 6",
  ]);
  const unconfigured = readServerExample("capabilities.rep.json") as { data: SalesOutreachCapabilitiesDto };
  assert.deepEqual(cadenceSummaryLines(unconfigured.data.cadence_summary), []);
  assert.deepEqual(cadenceSummaryLines(null), []);
});

test("rep due counts: coverage_incomplete reads as unavailable with its reason, never a partial sum (S4)", () => {
  const repDays = readServerExample("rep-days.rep.cadence-enforcement.json") as { data: SalesOutreachRepDaysDto };
  const rep = repDays.data.reps![0]!;
  assert.equal(cadenceMetricText(rep.overdue_leads).text, String(rep.overdue_leads.value));
  assert.equal(cadenceMetricText(rep.calls_due_today).text, String(rep.calls_due_today.value));
  assert.deepEqual(cadenceMetricText({ value: null, unknown_reason: "coverage_incomplete" }), {
    text: "Unavailable",
    available: false,
    reason: "Waiting for RingCentral capture coverage",
  });
});

test("pending counts are never zero; progress is capped", () => {
  assert.equal(countText(null), "Pending");
  assert.equal(countText(0), "0");
  assert.equal(percentText(1.08), "100%");
  assert.equal(fillPercent(1.5), 100);
  assert.equal(fillPercent(null), 0);
  assert.equal(repGoalText({ actual_confirmed: 108, goal: 100, goal_label: null, goal_state: "goal" }), "108 / 100");
  assert.equal(repGoalText({ actual_confirmed: null, goal: 100, goal_label: null, goal_state: "goal" }), "Pending / 100");
  assert.equal(repGoalText({ actual_confirmed: 4, goal: 0, goal_label: "No goal today", goal_state: "no_goal_today" }), "No goal today");
  assert.deepEqual(repProgressLabel({ progress: 1, goal_reached: true, goal_state: "goal" }), { text: "Goal reached", tone: "green" });
  assert.deepEqual(repProgressLabel({ progress: null, goal_reached: null, goal_state: "goal" }), { text: "Pending", tone: "muted" });
});

test("cadence metrics: cadence_disabled and cadence_shadow read as unavailable, never 0 (M1)", () => {
  assert.deepEqual(cadenceMetricText({ value: 18, unknown_reason: null }), { text: "18", available: true, reason: null });
  assert.deepEqual(cadenceMetricText({ value: null, unknown_reason: "cadence_disabled" }), { text: "Unavailable", available: false, reason: "Cadence isn't running yet" });
  assert.equal(cadenceMetricText({ value: null, unknown_reason: "cadence_shadow" }).available, false);
  const m1 = syntheticTeam({ role: "owner", variant: "m1" });
  assert.equal(cadenceMetricText(m1.distinct_overdue_leads).available, false);
  assert.equal(m1.leads_needing_attention.rows, null);
});

test("freshness chips follow capture state, not the stream", () => {
  const chips = freshnessChips({
    calls: { state: "delayed", last_updated_at: null, known_complete_through: "2026-10-01T15:00:00.000Z", age_seconds: 3600, reason: null },
    sms: { state: "not_connected", last_updated_at: null, known_complete_through: null, age_seconds: null, reason: "rep_sms_capture_disabled" },
    granot: { state: "observed", last_observed_at: AS_OF, age_seconds: 240 },
  });
  assert.deepEqual(chips.map((chip) => [chip.key, chip.label, chip.tone]), [
    ["granot", "Synced", "green"],
    ["calls", "Delayed", "amber"],
    ["sms", "Not connected", "gray"],
  ]);
  assert.equal(chips[0]?.title, "Moving software observed 4 min ago");
});

test("channel cells render the server status; overdue duration is display interpolation", () => {
  assert.deepEqual(channelStatus(channel({ status: "overdue" }), AS_OF, "sms"), { text: "Overdue", tone: "red" });
  assert.deepEqual(channelStatus(channel({ status: "scheduled", due_at: "2026-10-02T14:00:00.000Z" }), AS_OF, "sms"), { text: "Due tomorrow", tone: "muted" });
  assert.deepEqual(channelStatus(channel({ status: "completed" }), AS_OF, "sms"), { text: "Sent", tone: "green" });
  assert.equal(callsTodayText(channel({ required: 3, verified_completed: null })), "Pending / 3");
  assert.equal(callsTodayText(channel({ status: "not_required" })), "—");
  assert.equal(overdueByText(channel({ status: "overdue", oldest_actionable_due_at: "2026-09-29T16:00:00.000Z" }), AS_OF), "2 days overdue");
  // A due (not overdue) requirement never reads as overdue, whatever its deadline.
  assert.equal(overdueByText(channel({ status: "due", oldest_actionable_due_at: "2026-09-29T16:00:00.000Z" }), AS_OF), null);
});

test("attention issues and priority pills come from server statuses and codes", () => {
  const rows = syntheticQueueRows("desk");
  const base = rows[0] as SalesOutreachQueueRowDto;
  assert.equal(rowIssue({ ...base, call: channel({ status: "overdue", oldest_actionable_due_at: "2026-10-01T14:00:00.000Z" }), sms: channel({ status: "due" }) }, AS_OF).text, "Call overdue by 2 hours");
  assert.equal(rowIssue({ ...base, call: channel({ status: "completed" }), sms: channel({ status: "overdue" }) }, AS_OF).text, "SMS overdue");
  assert.deepEqual(priorityPill({ workflow: "new", priority_raw: "0" }), { text: "New", variant: "new" });
  assert.deepEqual(priorityPill({ workflow: "quoted", priority_raw: "1" }), { text: "Quoted", variant: "quoted" });
  assert.deepEqual(priorityPill({ workflow: "none", priority_raw: "9" }), { text: "Priority 9", variant: "neutral" });
  assert.deepEqual(priorityPill({ workflow: null, priority_raw: null }), { text: "Unknown", variant: "neutral" });
});

test("move-date presets become server filters from the server's business date", () => {
  assert.deepEqual(moveDateRange("upcoming", "2026-10-01"), { move_date_from: "2026-10-01" });
  assert.deepEqual(moveDateRange("next7", "2026-10-01"), { move_date_from: "2026-10-01", move_date_to: "2026-10-07" });
  assert.deepEqual(moveDateRange("past", "2026-10-01"), { move_date_to: "2026-09-30" });
  assert.deepEqual(moveDateRange("unknown", "2026-10-01"), { move_date_unknown: "only" });
  assert.deepEqual(moveDateRange(null, "2026-10-01"), {});
});

test("the lead panel's next action and schedule lines are the server's facts", () => {
  const detail = syntheticDetail({ subjectId: syntheticSubjectId(1), role: "rep", variant: "desk" });
  assert.ok(detail);
  const next = nextAction(detail);
  assert.equal(next.tone, "red");
  const lines = explanationLines(detail);
  assert.ok(lines.some((line) => line.startsWith("New lead")), lines.join(" | "));
  assert.ok(lines.some((line) => line.startsWith("Today:")), lines.join(" | "));
  for (const line of lines) assert.doesNotMatch(line, /_[a-z]/, `no snake_case on screen: ${line}`);
});

test("callback times convert New York wall time across DST", () => {
  assert.equal(newYorkLocalToIso("2026-10-01T15:30"), "2026-10-01T19:30:00.000Z");
  assert.equal(newYorkLocalToIso("2026-12-01T15:30"), "2026-12-01T20:30:00.000Z");
  assert.equal(newYorkLocalToIso("2026-11-01T01:30") !== null, true);
  assert.equal(newYorkLocalToIso("not a time"), null);
  assert.equal(isoToNewYorkLocal("2026-10-01T19:30:00.000Z"), "2026-10-01T15:30");
});

test("live frames parse leniently; NY midnight is in the future", () => {
  assert.deepEqual(parseDeskFrame("not json"), { reason: "reconnect", refetch: "all", topics: [], changes: [] });
  const frame = parseDeskFrame(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server/live.change.json"), "utf8"));
  assert.equal(frame.reason, "change");
  const ms = msUntilNewYorkMidnight(new Date("2026-10-01T16:00:00.000Z"));
  assert.ok(ms > 0 && ms <= 86_401_000);
});

test("the BFF carries the server code: a registry_code body still yields CURSOR_EXPIRED", () => {
  const error = salesOutreachErrorFromBody(409, { ok: false, error: "cursor", registry_code: "CURSOR_EXPIRED", request_id: "r1" }, "READ_FAILED");
  assert.equal(error.code, "CURSOR_EXPIRED");
  assert.equal(salesOutreachErrorFromBody(403, { ok: false, code: "REP_NOT_LINKED", error: "x", request_id: "r" }, "READ_FAILED").code, "REP_NOT_LINKED");
});

test("mock mode is local only: refused on Vercel production whatever the value", () => {
  assert.equal(outreachDeskMockVariant({ OUTREACH_DESK_MOCK: "desk" }), "desk");
  assert.equal(outreachDeskMockVariant({ OUTREACH_DESK_MOCK: "m1" }), "m1");
  assert.equal(outreachDeskMockVariant({ OUTREACH_DESK_MOCK: "desk", VERCEL_ENV: "production" }), null);
  assert.equal(outreachDeskMockVariant({ OUTREACH_DESK_MOCK: "yes" }), null);
  assert.equal(outreachDeskMockVariant({}), null);
});

test("every owner-visible copy string avoids snake_case identifiers", () => {
  const source = readFileSync(path.join(process.cwd(), "components/outreach-desk/outreach-desk-copy.ts"), "utf8");
  const strings = [...source.matchAll(/"([^"\n]*)"/g)].map((match) => match[1] ?? "").filter((value) => /\s/.test(value));
  for (const value of strings) assert.doesNotMatch(value, /\b[a-z]+_[a-z_]+\b/, value);
});
