import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  cadenceMetricText,
  callsTodayText,
  channelStatus,
  isUnverified,
  isVerifiedOverdue,
  knownThroughTime,
  overdueByText,
  rowIssue,
  rowOverdue,
  unassignedCaption,
  verificationNote,
} from "../../components/outreach-desk/lib/format";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { nextAction } from "../../components/outreach-desk/views/lead-panel";
import {
  SALES_OUTREACH_CADENCE_UNKNOWN_REASONS,
  SALES_OUTREACH_DUE_TODAY_UNKNOWN_REASONS,
  SALES_OUTREACH_TOLERATED_ENUMS,
  onSalesOutreachUnknownValue,
  salesOutreachEnvelope,
  salesOutreachQueueSchema,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  type SalesOutreachChannelDto,
  type SalesOutreachQueueRowDto,
  type SalesOutreachRepDayDto,
  type SalesOutreachUnknownValue,
} from "../../lib/api/salesOutreach";
import {
  SYNTHETIC_AS_OF,
  SYNTHETIC_UNVERIFIED_DUE,
  SYNTHETIC_UNVERIFIED_THROUGH,
  syntheticDetail,
  syntheticQueueRows,
  syntheticSubjectId,
  syntheticTeam,
} from "./fixtures/synthetic";

/**
 * ADM-1 (lifecycle repair, ahead of server A2): a channel whose deadline has passed but RingCentral capture can't prove
 * it yet carries `verification.state: "unverified"` and reads "Due — not yet verified (activity known through …)" —
 * never "overdue", never red and never a negative countdown. `pending` is evidence uncertainty with its own copy (not
 * "Needs review"); `coverage_incomplete` is a known cadence unknown reason; `unassigned.overdue` is shown on the
 * Overdue card. Since ADM-6 (wave 2) the mirror and rendering tests read the server's A2 dto-examples as served
 * (`tests/outreach-desk/fixtures/server/`, byte copies); `wave2-examples.test.ts` sweeps every example. The hand-built
 * channels below (`unverified()`, `verifiedOverdue()`) remain only for cases the examples don't carry: no capture
 * coverage at all, an `overdue` that arrives unverified, an unknown state, and team-level `coverage_incomplete`.
 */

const AS_OF = SYNTHETIC_AS_OF; // 12:00 PM New York, Oct 1
const t = deskCopy.text;
const readServerExample = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server", name), "utf8")) as Record<string, unknown>;

const channel = (patch: Partial<SalesOutreachChannelDto>): SalesOutreachChannelDto => ({
  required: 3,
  verified_completed: 1,
  remaining: 2,
  due_at: null,
  oldest_actionable_due_at: null,
  status: "due",
  completion_kind: null,
  coverage: { state: "complete", known_complete_through: null, gaps: [] },
  blocked_reason: null,
  ...patch,
});

/** A synthetic A2 unverified channel: the 11:00 AM deadline passed; capture covers 10:43 AM. */
const unverified = (patch: Partial<SalesOutreachChannelDto> = {}): SalesOutreachChannelDto =>
  channel({
    due_at: SYNTHETIC_UNVERIFIED_DUE,
    coverage: { state: "partial", known_complete_through: SYNTHETIC_UNVERIFIED_THROUGH, gaps: [] },
    verification: { state: "unverified", verified_through: SYNTHETIC_UNVERIFIED_THROUGH, unverified_since: SYNTHETIC_UNVERIFIED_DUE },
    ...patch,
  });
const verifiedOverdue = (patch: Partial<SalesOutreachChannelDto> = {}): SalesOutreachChannelDto =>
  channel({
    status: "overdue",
    due_at: "2026-10-02T00:00:00.000Z",
    oldest_actionable_due_at: "2026-09-29T16:00:00.000Z",
    verification: { state: "verified", verified_through: "2026-10-01T15:59:00.000Z", unverified_since: null },
    ...patch,
  });

function collectUnknown<T>(run: () => T): { result: T; events: SalesOutreachUnknownValue[] } {
  const events: SalesOutreachUnknownValue[] = [];
  const stop = onSalesOutreachUnknownValue((event) => events.push(event));
  try {
    return { result: run(), events };
  } finally {
    stop();
  }
}

/** No rendered string for an unverified channel may say overdue, "due now", or carry a negative duration. */
function assertNotOverdueCopy(text: string | null | undefined, label: string) {
  if (!text) return;
  assert.doesNotMatch(text, /overdue/i, `${label}: ${text}`);
  assert.doesNotMatch(text, /due now/i, `${label}: ${text}`);
  assert.doesNotMatch(text, /-\s*\d/, `${label}: no negative countdown: ${text}`);
}

// ---------------------------------------------------------------------------------------------- the mirror

test("the mirror knows the A2 enum values: coverage_incomplete on every cadence metric, verified/unverified", () => {
  assert.ok((SALES_OUTREACH_CADENCE_UNKNOWN_REASONS as readonly string[]).includes("coverage_incomplete"));
  assert.ok((SALES_OUTREACH_DUE_TODAY_UNKNOWN_REASONS as readonly string[]).includes("coverage_incomplete"));
  assert.equal(new Set(SALES_OUTREACH_DUE_TODAY_UNKNOWN_REASONS).size, SALES_OUTREACH_DUE_TODAY_UNKNOWN_REASONS.length, "no duplicate reason");
  const entry = SALES_OUTREACH_TOLERATED_ENUMS.find((candidate) => candidate.field.startsWith("channel verification.state"));
  assert.ok(entry, "verification.state is a tolerated read enum");
  assert.deepEqual([...entry.values], ["verified", "unverified"]);
  assert.equal(entry.fallback, "unverified", "an unknown verification state reads on the safe side");
});

test("the server's A2 queue example round-trips as served (verified, unverified and null verification), and a pre-A2 copy still parses", () => {
  // queue.owner.awaiting-capture.json as served: two verified overdue calls, two unverified due calls, SMS null.
  const body = readServerExample("queue.owner.awaiting-capture.json");
  const { result, events } = collectUnknown(() => salesOutreachEnvelope(salesOutreachQueueSchema).parse(body));
  assert.deepEqual(events, []);
  assert.deepEqual(result, body, "verification is kept exactly as served");
  assert.deepEqual(
    result.data.rows.map((row) => [row.call.verification?.state ?? null, row.sms.verification?.state ?? null]),
    [["verified", null], ["verified", null], ["unverified", null], ["unverified", null], [null, null]],
  );
  // A server before A2 sent no `verification` key: the same rows still parse, nothing is invented.
  const preA2 = structuredClone(body);
  for (const row of (preA2.data as { rows: Record<string, Record<string, unknown>>[] }).rows) {
    delete row.call!.verification;
    delete row.sms!.verification;
  }
  const parsed = salesOutreachEnvelope(salesOutreachQueueSchema).parse(preA2);
  assert.deepEqual(parsed, preA2, "absent stays absent");
  assert.ok(parsed.data.rows.every((row) => !("verification" in row.call) && !("verification" in row.sms)));
});

test("an unknown verification state reads as unverified (amber, never overdue) and is reported", () => {
  const body = readServerExample("queue.owner.page-1.json");
  const row = (body.data as { rows: Record<string, unknown>[] }).rows[0]!;
  row.call = { ...(row.call as object), status: "overdue", verification: { state: "settling", verified_through: null, unverified_since: "2026-10-05T14:50:00.000Z" } };
  const { result, events } = collectUnknown(() => salesOutreachEnvelope(salesOutreachQueueSchema).parse(body));
  assert.equal(events.length, 1);
  assert.equal(events[0]!.value, "settling");
  const parsed = result.data.rows[0]!;
  assert.equal(parsed.call.verification?.state, "unverified");
  assert.equal(channelStatus(parsed.call, result.data.as_of, "call").tone, "amber");
  assert.equal(overdueByText(parsed.call, result.data.as_of), null);
  // A malformed verification block still fails the read (tolerance is for new string values only).
  row.call = { ...(row.call as object), verification: { state: 3 } };
  assert.equal(salesOutreachEnvelope(salesOutreachQueueSchema).safeParse(body).success, false);
});

test("coverage_incomplete on team and rep-day cadence metrics parses silently and reads as unavailable with its reason", () => {
  // As served (A2 examples): `sms_due_today` is coverage_incomplete while SMS capture has no coverage.
  for (const name of ["team.owner.cadence-enforcement.json", "rep-days.owner.cadence-enforcement.json", "rep-days.rep.cadence-enforcement.json"]) {
    const body = readServerExample(name);
    const schema = name.startsWith("team.") ? salesOutreachTeamSchema : salesOutreachRepDaysSchema;
    const served = collectUnknown(() => salesOutreachEnvelope(schema).parse(body));
    assert.deepEqual(served.events, [], name);
    const data = served.result.data as { reps?: SalesOutreachRepDayDto[] | null; daily_call_goals?: SalesOutreachRepDayDto[] };
    const rows = (data.reps ?? data.daily_call_goals ?? []).filter((row) => row.sms_due_today.unknown_reason === "coverage_incomplete");
    assert.ok(rows.length > 0, `${name} serves a coverage_incomplete metric`);
    for (const row of rows) {
      assert.deepEqual(cadenceMetricText(row.sms_due_today), { text: t.unavailable, available: false, reason: "Waiting for RingCentral capture coverage" });
    }
  }
  // Not in any example yet: every overdue metric unknown (call coverage unknown). Built on the served team example.
  const team = readServerExample("team.owner.cadence-enforcement.json");
  const data = team.data as Record<string, unknown>;
  const incomplete = { value: null, unknown_reason: "coverage_incomplete" };
  data.distinct_overdue_leads = incomplete;
  data.quoted_overdue_leads = incomplete;
  data.unassigned = { count: 1, overdue: incomplete };
  data.leads_needing_attention = { rows: null, limit: 10, unknown_reason: "coverage_incomplete" };
  for (const row of data.daily_call_goals as Record<string, unknown>[]) row.overdue_leads = incomplete;
  const { result, events } = collectUnknown(() => salesOutreachEnvelope(salesOutreachTeamSchema).parse(team));
  assert.deepEqual(events, [], "coverage_incomplete is a known value");
  assert.deepEqual(result, team);
  assert.deepEqual(cadenceMetricText(result.data.distinct_overdue_leads), { text: t.unavailable, available: false, reason: deskCopy.unknownReasons.coverage_incomplete });
  assert.equal(unassignedCaption(result.data.unassigned), "1 unassigned", "an unknown unassigned overdue is left out, never 0");

  const repDays = readServerExample("rep-days.owner.cadence-enforcement.json");
  for (const row of (repDays.data as { reps: Record<string, unknown>[] }).reps) row.overdue_leads = incomplete;
  const parsedRepDays = collectUnknown(() => salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(repDays));
  assert.deepEqual(parsedRepDays.events, []);
  assert.equal(parsedRepDays.result.data.reps?.[0]?.overdue_leads.unknown_reason, "coverage_incomplete");
});

// ---------------------------------------------------------------------------------------------- channel cells

test("an unverified channel reads 'Due — not yet verified (activity known through …)', amber, with no overdue duration", () => {
  const call = unverified();
  assert.equal(isUnverified(call), true);
  assert.equal(isVerifiedOverdue(call), false);
  assert.deepEqual(channelStatus(call, AS_OF, "call"), {
    text: "Due — not yet verified",
    tone: "amber",
    title: "This deadline has passed, but RingCentral capture only covers activity through 10:43 AM. It isn't counted as overdue until capture catches up.",
  });
  assert.deepEqual(verificationNote(call, AS_OF), {
    text: "Due — not yet verified (activity known through 10:43 AM)",
    title: "This deadline has passed, but RingCentral capture only covers activity through 10:43 AM. It isn't counted as overdue until capture catches up.",
  });
  assert.equal(overdueByText(call, AS_OF), null);
  assert.equal(callsTodayText(call), "1 / 3", "the call count is unchanged");
  // No capture coverage at all: still "not yet verified", with no invented time.
  const blind = unverified({ verification: { state: "unverified", verified_through: null, unverified_since: SYNTHETIC_UNVERIFIED_DUE } });
  assert.equal(verificationNote(blind, AS_OF)?.text, "Due — not yet verified (waiting for RingCentral capture)");
  // Coverage from an earlier day names the day.
  assert.equal(knownThroughTime("2026-09-30T23:58:00.000Z", AS_OF), "Sep 30, 7:58 PM");
  assert.equal(knownThroughTime(null, AS_OF), null);
});

test("an unverified channel is never overdue or red, even if the status arrives as overdue", () => {
  for (const status of ["due", "overdue"] as const) {
    const call = unverified({ status, oldest_actionable_due_at: "2026-09-29T16:00:00.000Z" });
    const cell = channelStatus(call, AS_OF, "call");
    assert.notEqual(cell.tone, "red", status);
    assertNotOverdueCopy(cell.text, `cell (${status})`);
    assert.equal(overdueByText(call, AS_OF), null, `${status}: no "N days overdue"`);
    const note = verificationNote(call, AS_OF);
    assert.ok(note);
    assertNotOverdueCopy(note.text, `note (${status})`);
  }
  // A verified overdue (or one from a server before A2, without verification) is still red with its duration.
  assert.deepEqual(channelStatus(verifiedOverdue(), AS_OF, "sms"), { text: "Overdue", tone: "red" });
  assert.equal(overdueByText(verifiedOverdue(), AS_OF), "2 days overdue");
  assert.equal(overdueByText(verifiedOverdue({ verification: undefined }), AS_OF), "2 days overdue");
  assert.equal(verificationNote(verifiedOverdue(), AS_OF), null);
  // A future due with no verification keeps its plain copy.
  assert.deepEqual(channelStatus(channel({ due_at: "2026-10-02T00:00:00.000Z", verification: null }), AS_OF, "call"), { text: "Due today", tone: "amber" });
});

test("pending is evidence uncertainty with its own copy, never 'Needs review'", () => {
  const cell = channelStatus(channel({ status: "pending", required: null, verified_completed: null, remaining: null }), AS_OF, "sms");
  assert.deepEqual(cell, { text: "Pending", tone: "muted", title: "Waiting on RingCentral call or SMS records before this can be checked." });
  const base = syntheticQueueRows()[4] as SalesOutreachQueueRowDto; // an active, on-track due row
  const pendingRow: SalesOutreachQueueRowDto = {
    ...base,
    call: channel({ status: "pending" }),
    sms: channel({ status: "not_required" }),
    status_flags: { ...base.status_flags, pending: true, needs_contact: false },
  };
  const issue = rowIssue(pendingRow, AS_OF);
  assert.equal(issue.text, "Pending — checking call and SMS records");
  assert.equal(issue.tone, "muted");
  assert.notEqual(issue.text, t.needsReview);
  assert.equal(rowIssue({ ...pendingRow, subject_status: "review" }, AS_OF).text, t.needsReview, "a review subject still reads Needs review");
});

// ---------------------------------------------------------------------------------------------- rows

test("attention issues: unverified channels read 'due — not yet verified'; a verified overdue still wins", () => {
  const base = syntheticQueueRows()[4] as SalesOutreachQueueRowDto;
  const callOnly = rowIssue({ ...base, call: unverified(), sms: channel({ status: "not_required" }) }, AS_OF);
  assert.equal(callOnly.text, "Call due — not yet verified");
  assert.equal(callOnly.tone, "amber");
  assert.match(callOnly.title ?? "", /10:43 AM/);
  assert.equal(rowIssue({ ...base, call: channel({ status: "completed" }), sms: unverified() }, AS_OF).text, "SMS due — not yet verified");
  assert.equal(rowIssue({ ...base, call: unverified(), sms: unverified() }, AS_OF).text, "Call and SMS due — not yet verified");
  // The server keeps the overdue flag false while it can't verify; if it arrives true, the row still isn't red.
  const flagged = { ...base, call: unverified(), sms: channel({ status: "not_required" }), status_flags: { ...base.status_flags, overdue: true } };
  assert.notEqual(rowIssue(flagged, AS_OF).tone, "red");
  assert.equal(rowOverdue(flagged), false);
  // A proved overdue on the other channel is real: red.
  const mixed = { ...base, call: unverified(), sms: verifiedOverdue(), status_flags: { ...base.status_flags, overdue: true } };
  assert.equal(rowIssue(mixed, AS_OF).text, "SMS overdue");
  assert.equal(rowOverdue(mixed), true);
  // Before A2 (no verification): unchanged.
  assert.equal(rowIssue({ ...base, call: verifiedOverdue({ verification: undefined, oldest_actionable_due_at: "2026-10-01T14:00:00.000Z" }) }, AS_OF).text, "Call overdue by 2 hours");
  assert.equal(rowOverdue({ ...base, status_flags: { ...base.status_flags, overdue: true } }), true);
});

test("the synthetic desk carries one unverified row (row 9) and every view helper keeps it amber", () => {
  const rows = syntheticQueueRows();
  const row = rows.find((candidate) => candidate.subject_id === syntheticSubjectId(9))!;
  assert.equal(row.call.status, "due");
  assert.equal(row.call.verification?.state, "unverified");
  assert.equal(row.status_flags.overdue, false);
  assert.equal(rowOverdue(row), false);
  assert.equal(rowIssue(row, AS_OF).text, "Call due — not yet verified");
  assert.equal(verificationNote(row.call, AS_OF)?.text, "Due — not yet verified (activity known through 10:43 AM)");
  for (const other of rows) if (other.call.status === "overdue") assert.equal(other.call.verification?.state, "verified", other.subject_id);
  const team = syntheticTeam({ role: "owner" });
  assert.ok(team.leads_needing_attention.rows?.some((candidate) => candidate.subject_id === row.subject_id), "row 9 is on the team attention list");
});

// ---------------------------------------------------------------------------------------------- lead panel

test("the lead panel's next action for an unverified call is amber 'Call due — not yet verified' with the coverage time", () => {
  const detail = syntheticDetail({ subjectId: syntheticSubjectId(9), role: "rep", variant: "desk" });
  assert.ok(detail);
  assert.equal(detail.requirements.call.verification?.state, "unverified");
  const next = nextAction(detail);
  assert.equal(next.text, "Call due — not yet verified");
  assert.equal(next.sub, "Activity known through 10:43 AM");
  assert.equal(next.tone, "amber");
  assertNotOverdueCopy(next.text, "next");
  assertNotOverdueCopy(next.sub, "next sub");

  const withRequirements = (call: SalesOutreachChannelDto, sms: SalesOutreachChannelDto) => ({ ...detail, requirements: { call, sms } });
  // Even an "overdue" status that arrives unverified is not shown red or "Next call due now".
  const forced = nextAction(withRequirements(unverified({ status: "overdue", oldest_actionable_due_at: "2026-09-29T16:00:00.000Z" }), channel({ status: "not_required" })));
  assert.equal(forced.tone, "amber");
  assertNotOverdueCopy(forced.text, "forced");
  assertNotOverdueCopy(forced.sub, "forced sub");
  // SMS unverified with no coverage yet.
  const sms = nextAction(
    withRequirements(channel({ status: "completed" }), unverified({ verification: { state: "unverified", verified_through: null, unverified_since: SYNTHETIC_UNVERIFIED_DUE } })),
  );
  assert.deepEqual([sms.text, sms.sub, sms.tone], ["SMS due — not yet verified", "Waiting for RingCentral capture", "amber"]);
  // A verified overdue on the other channel is real and wins.
  const mixed = nextAction(withRequirements(unverified(), verifiedOverdue()));
  assert.deepEqual([mixed.text, mixed.tone], ["SMS overdue", "red"]);
  // A passed deadline with no verification (shadow, or a server before A2) keeps today's behaviour.
  assert.equal(nextAction(withRequirements(channel({ due_at: SYNTHETIC_UNVERIFIED_DUE, verification: null }), channel({ status: "not_required" }))).text, "Next call due now");
});

// ---------------------------------------------------------------------------------------------- team cards

test("the Overdue card names unassigned overdue leads when the server knows them", () => {
  assert.equal(unassignedCaption({ count: 3, overdue: { value: 1, unknown_reason: null } }), "3 unassigned · 1 overdue");
  assert.equal(unassignedCaption({ count: 3, overdue: { value: 0, unknown_reason: null } }), "3 unassigned");
  assert.equal(unassignedCaption({ count: 3, overdue: { value: null, unknown_reason: "coverage_incomplete" } }), "3 unassigned");
  assert.equal(unassignedCaption({ count: 0, overdue: { value: 0, unknown_reason: null } }), null);
  assert.equal(unassignedCaption({ count: null, overdue: { value: 2, unknown_reason: null } }), null);
  // The A2 server example (1 unassigned, 0 overdue once coverage proves it) reads the count alone; with an overdue it
  // names both.
  const team = salesOutreachEnvelope(salesOutreachTeamSchema).parse(readServerExample("team.owner.cadence-enforcement.json"));
  assert.deepEqual(team.data.unassigned, { count: 1, overdue: { value: 0, unknown_reason: null } });
  assert.equal(unassignedCaption(team.data.unassigned), "1 unassigned");
  assert.equal(unassignedCaption({ ...team.data.unassigned, overdue: { value: 1, unknown_reason: null } }), "1 unassigned · 1 overdue");
});

test("the server's awaiting-capture queue example: verified overdue rows read red, unverified ones amber 'not yet verified'", () => {
  const queue = salesOutreachEnvelope(salesOutreachQueueSchema).parse(readServerExample("queue.owner.awaiting-capture.json")).data;
  const tones = queue.rows.map((row) => channelStatus(row.call, queue.as_of, "call").tone);
  assert.deepEqual(tones.slice(0, 2), ["red", "red"], "verified overdue");
  assert.deepEqual(tones.slice(2, 4), ["amber", "amber"], "unverified due");
  for (const row of queue.rows.slice(2, 4)) {
    assert.equal(isUnverified(row.call), true);
    assert.equal(overdueByText(row.call, queue.as_of), null, "no overdue duration while unverified");
    assert.match(verificationNote(row.call, queue.as_of)!.text, /^Due — not yet verified \(activity known through /);
  }
});
