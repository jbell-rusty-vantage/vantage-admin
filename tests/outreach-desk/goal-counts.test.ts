import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  alternateCountText,
  freshnessChips,
  goalCoverageNote,
  goalScopeCounts,
  otherOutboundFootnote,
  otherOutboundParts,
  otherOutboundTitle,
  scopeCountText,
} from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import {
  SALES_OUTREACH_ASSOCIATION_REASONS,
  SALES_OUTREACH_OTHER_OUTBOUND_BUCKETS,
  salesOutreachEnvelope,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  type SalesOutreachRepDayDto,
  type SalesOutreachRepDaysDto,
  type SalesOutreachTeamDto,
} from "../../lib/api/salesOutreach";
import { syntheticRepDays, syntheticTeam, syntheticZeroActivityRepDay } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-2: goal rows read both counts (C1b `alternate_scope` / `outbound_calls.alternate`), "Other
 * outbound" by reason (C8 `breakdown`), capture coverage in words (partial vs unknown) and the freshness reason —
 * built on the server's wave-2 dto-examples. Server codes never reach the screen.
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;
const g = deskCopy.team.goals;

function serverData<T>(file: string, schema: typeof salesOutreachRepDaysSchema | typeof salesOutreachTeamSchema): T {
  return salesOutreachEnvelope(schema).parse(JSON.parse(readFileSync(path.join(SERVER_FIXTURES, file), "utf8"))).data as T;
}
const repDays = () => serverData<SalesOutreachRepDaysDto>("rep-days.owner.json", salesOutreachRepDaysSchema);
const team = () => serverData<SalesOutreachTeamDto>("team.owner.json", salesOutreachTeamSchema);
const alice = (): SalesOutreachRepDayDto => repDays().reps!.find((row) => row.agent_name === "Alice Rep")!;

function collectUnknown<T>(run: () => T): { result: T; unknown: UnknownDeskCode[] } {
  const unknown: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => unknown.push(event));
  try {
    return { result: run(), unknown };
  } finally {
    stop();
  }
}

// ------------------------------------------------------------------------------------------- two counts

test("My goal card: headline under the configured scope, then the other count — '108 outbound · 14 to enrolled Leads'", () => {
  const row = alice();
  assert.equal(row.count_scope, "all_outbound");
  const counts = goalScopeCounts(row);
  assert.deepEqual(counts?.text, "108 outbound · 14 to enrolled Leads");
  assert.equal(counts?.title, g.scopeCountsTitle.all_outbound, "the tooltip says which count is the goal's");
  assert.doesNotMatch(counts!.text + counts!.title, SNAKE);
  // The plan's acceptance line, from the same helper.
  assert.equal(goalScopeCounts({ count_scope: "all_outbound", actual_confirmed: 97, alternate_scope: { count_scope: "eligible_new_quoted", count_scope_label: "x", actual_confirmed: 12, actual_awaiting_confirmation: 0 } })?.text, "97 outbound · 12 to enrolled Leads");
});

test("an eligible-only headline reads first and every outbound call becomes the secondary figure", () => {
  const counts = goalScopeCounts({
    count_scope: "eligible_new_quoted",
    actual_confirmed: 12,
    alternate_scope: { count_scope: "all_outbound", count_scope_label: "Outbound calls", actual_confirmed: 97, actual_awaiting_confirmation: 2 },
  });
  assert.equal(counts?.text, "12 to enrolled Leads · 97 outbound");
  assert.equal(counts?.title, g.scopeCountsTitle.eligible_new_quoted);
});

test("a pending count reads Pending (never 0) and a missing other scope shows nothing", () => {
  const pending = goalScopeCounts({
    count_scope: "all_outbound",
    actual_confirmed: null,
    alternate_scope: { count_scope: "eligible_new_quoted", count_scope_label: "x", actual_confirmed: null, actual_awaiting_confirmation: null },
  });
  assert.equal(pending?.text, "Pending outbound · Pending to enrolled Leads");
  assert.doesNotMatch(pending!.text, /\b0\b/);
  // A row written before both counts were stored (null) and an older server without the field (undefined).
  assert.equal(goalScopeCounts({ count_scope: "all_outbound", actual_confirmed: 40, alternate_scope: null }), null);
  assert.equal(goalScopeCounts({ count_scope: "all_outbound", actual_confirmed: 40 }), null);
  assert.equal(alternateCountText("all_outbound", null), null);
  assert.equal(alternateCountText("all_outbound", undefined), null);
});

test("a scope the desk has no words for reads neutrally, never as another scope's words", () => {
  assert.equal(scopeCountText("eligible_booked_only", 5), "5 in the other count");
  const alt = alternateCountText("eligible_booked_only", { count_scope: "eligible_booked_only", actual: 5 });
  assert.equal(alt?.text, "5 in the other count");
  assert.equal(alt?.title, g.scopeCountsTitleFallback);
  // The mirror keeps the unknown scope as text (it does not read as `all_outbound`).
  const body = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "rep-days.owner.json"), "utf8"));
  body.data.reps[0].alternate_scope.count_scope = "eligible_booked_only";
  const parsed = salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(body).data;
  assert.equal(parsed.reps![0]!.alternate_scope?.count_scope, "eligible_booked_only");
});

test("team card 1 and Daily call goals rows: the other scope's count from the server examples", () => {
  const data = team();
  assert.deepEqual(alternateCountText(data.goals!.count_scope, data.goals!.outbound_calls.alternate), {
    text: "60 to enrolled Leads",
    title: g.scopeCountsTitle.all_outbound,
  });
  const rows = data.daily_call_goals!;
  const texts = rows.map((row) => alternateCountText(row.count_scope, row.alternate_scope ? { count_scope: row.alternate_scope.count_scope, actual: row.alternate_scope.actual_confirmed } : null)?.text);
  assert.deepEqual(texts, ["14 to enrolled Leads", "0 to enrolled Leads", "18 to enrolled Leads", "25 to enrolled Leads", "3 to enrolled Leads", "0 to enrolled Leads"]);
  // A team alternate whose sum is unknown (a rep's alternate pending) reads Pending, never a partial sum.
  assert.equal(alternateCountText("all_outbound", { count_scope: "eligible_new_quoted", actual: null })?.text, "Pending to enrolled Leads");
});

test("an older server without the wave-2 fields still parses (the fields are optional)", () => {
  const body = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "team.owner.json"), "utf8"));
  delete body.data.goals.outbound_calls.alternate;
  delete body.data.goals.other_outbound_breakdown;
  for (const row of body.data.daily_call_goals) {
    delete row.alternate_scope;
    delete row.other_outbound.breakdown;
  }
  const parsed = salesOutreachEnvelope(salesOutreachTeamSchema).parse(body).data;
  assert.equal(alternateCountText(parsed.goals!.count_scope, parsed.goals!.outbound_calls.alternate), null);
  assert.equal(goalScopeCounts(parsed.daily_call_goals![0]!), null);
  assert.equal(otherOutboundFootnote(parsed.goals!.count_scope, parsed.goals!.other_outbound_total, parsed.goals!.other_outbound_breakdown), g.otherFootnoteByScope.all_outbound);
});

// ------------------------------------------------------------------------------------------- Other outbound

test("every association reason and breakdown bucket has its own words, with no snake_case", () => {
  const seen = new Set<string>();
  for (const reason of [...SALES_OUTREACH_ASSOCIATION_REASONS, ...SALES_OUTREACH_OTHER_OUTBOUND_BUCKETS]) {
    const words = g.otherReasons[reason];
    assert.ok(words, `copy for ${reason}`);
    assert.doesNotMatch(words, SNAKE, reason);
    seen.add(words);
  }
  assert.equal(seen.size, new Set([...SALES_OUTREACH_ASSOCIATION_REASONS, ...SALES_OUTREACH_OTHER_OUTBOUND_BUCKETS]).size, "no two reasons share words");
});

test("the Other outbound tooltip lists the reasons largest first, zero buckets left out, adding up to the count", () => {
  const row = alice();
  const { result: parts, unknown } = collectUnknown(() => otherOutboundParts(row.other_outbound.breakdown));
  assert.deepEqual(unknown, []);
  assert.deepEqual(
    parts.map((part) => [part.reason, part.count]),
    [
      ["lead_not_enrolled", 51],
      ["before_activation", 30],
      ["no_lead", 11],
      ["lead_closed", 1],
      ["not_new_quoted", 1],
    ],
  );
  assert.equal(parts.reduce((sum, part) => sum + part.count, 0), row.other_outbound.count);
  const title = otherOutboundTitle(row.other_outbound, row.count_scope);
  assert.equal(
    title,
    [
      "Other outbound by reason:",
      "51 lead not on the desk",
      "30 before the desk started on the lead",
      "11 no lead for the number",
      "1 lead already closed",
      "1 lead not New or Quoted",
      "",
      g.otherFootnoteByScope.all_outbound,
    ].join("\n"),
  );
  assert.doesNotMatch(title, SNAKE);
  assert.doesNotMatch(title, /ambiguous|unknown/i, "zero buckets are not listed");
});

test("Other outbound without a breakdown (a row written before reasons were stored) says so instead of listing nothing", () => {
  const row = repDays().reps!.find((one) => one.goal_state === "not_on_roster")!;
  assert.equal(row.other_outbound.breakdown, null);
  assert.equal(otherOutboundTitle(row.other_outbound, row.count_scope), `${g.otherFootnoteByScope.all_outbound}\n${g.otherBreakdownPending}`);
});

test("under each headline scope the footnote says whether Other outbound counts toward the goal", () => {
  assert.match(g.otherFootnoteByScope.all_outbound!, /still count toward/);
  assert.match(g.otherFootnoteByScope.eligible_new_quoted!, /don't count toward the goal/);
  assert.notEqual(otherOutboundTitle({ count: 0, breakdown: null }, "eligible_new_quoted"), otherOutboundTitle({ count: 0, breakdown: null }, "all_outbound"));
  assert.equal(otherOutboundTitle({ count: 0, breakdown: null }, "mixed"), g.otherFootnote);
});

test("the Daily call goals footnote carries the team breakdown in words; no Other outbound, no footnote part", () => {
  const goals = team().goals!;
  const foot = otherOutboundFootnote(goals.count_scope, goals.other_outbound_total, goals.other_outbound_breakdown);
  assert.equal(
    foot,
    `${g.otherFootnoteByScope.all_outbound} Other outbound by reason: 64 lead not on the desk, 38 before the desk started on the lead, 16 no lead for the number, 1 lead already closed, 1 lead not New or Quoted.`,
  );
  assert.doesNotMatch(foot!, SNAKE);
  assert.equal(otherOutboundFootnote("all_outbound", 0, goals.other_outbound_breakdown), null);
  assert.equal(otherOutboundFootnote("all_outbound", null, null), null);
});

test("a breakdown bucket this desk doesn't know is kept, reads 'another reason' and is reported — never the raw code", () => {
  const body = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "rep-days.owner.json"), "utf8"));
  body.data.reps[0].other_outbound.breakdown.voicemail_only = 3;
  const row = salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(body).data.reps![0]!;
  assert.equal(row.other_outbound.breakdown?.voicemail_only, 3, "kept by the mirror (catchall)");
  const { result: title, unknown } = collectUnknown(() => otherOutboundTitle(row.other_outbound, row.count_scope));
  assert.match(title, /\n3 another reason\n/);
  assert.doesNotMatch(title, /voicemail/);
  assert.deepEqual(unknown, [{ kind: "association_reason", code: null, value: "voicemail_only" }]);
});

// ------------------------------------------------------------------------------------------- coverage and freshness

test("coverage in words: complete says nothing, partial and unknown read differently", () => {
  assert.equal(goalCoverageNote({ state: "complete", known_complete_through: "2026-10-05T14:55:00.000Z" }), null);
  const partial = goalCoverageNote({ state: "partial", known_complete_through: "2026-10-05T14:55:00.000Z" })!;
  assert.equal(partial.text, "Call capture catching up");
  assert.match(partial.title, /complete through Mon, Oct 5, 2026, 10:55 AM EDT\. Calls after that may still arrive/);
  assert.equal(goalCoverageNote({ state: "partial", known_complete_through: null })?.title, g.coverageStates.partialTitle(null));
  const unknown = goalCoverageNote({ state: "unknown", known_complete_through: null })!;
  assert.equal(unknown.text, "Call capture not reported yet");
  assert.notEqual(unknown.text, partial.text);
  assert.notEqual(unknown.title, partial.title);
  for (const note of [partial, unknown]) assert.doesNotMatch(note.text + note.title, SNAKE);
});

test("freshness chips on every wave-2 server example name the reason in words (no snake_case in any tooltip)", () => {
  const files = readdirSync(SERVER_FIXTURES).filter((file) => /^(rep-days|team|queue|capabilities|outreach)\./.test(file));
  assert.ok(files.length >= 15);
  for (const file of files) {
    const body = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, file), "utf8"));
    const freshness = body.data?.freshness;
    if (!freshness) continue;
    for (const chip of freshnessChips(freshness)) assert.doesNotMatch(`${chip.label} ${chip.title}`, SNAKE, `${file} ${chip.key}`);
  }
  // The A3-fresh calls reasons the server emits each read in words.
  for (const reason of ["confirmation_stale", "coverage_behind", "webhook_silent"]) {
    const [, calls] = freshnessChips({
      granot: { state: "observed", last_observed_at: null, age_seconds: null },
      calls: { state: "delayed", last_updated_at: null, known_complete_through: null, age_seconds: null, reason },
      sms: { state: "fresh", last_updated_at: null, known_complete_through: null, age_seconds: 10, reason: null },
    });
    assert.ok(calls!.title.endsWith(deskCopy.freshness.reasons[reason]!), reason);
  }
});

// ------------------------------------------------------------------------------------------- synthetic desk (mock mode)

test("the synthetic desk serves both counts and the breakdown the way the server composes them", () => {
  const data = syntheticTeam({ role: "owner" });
  const rows = data.daily_call_goals!;
  for (const row of rows) {
    const breakdown = row.other_outbound.breakdown!;
    assert.equal(Object.values(breakdown).reduce((sum, value) => sum + value, 0), row.other_outbound.count, row.agent_name ?? "");
    assert.equal(row.alternate_scope!.actual_confirmed, row.actual_confirmed! - row.other_outbound.count!, "eligible = all − Other outbound");
  }
  assert.equal(data.goals!.outbound_calls.actual, 277, "the reference headline is unchanged");
  assert.deepEqual(data.goals!.outbound_calls.alternate, { count_scope: "eligible_new_quoted", actual: 246 });
  assert.equal(data.goals!.other_outbound_total, 31);
  assert.equal(Object.values(data.goals!.other_outbound_breakdown!).reduce((sum, value) => sum + value, 0), 31);
  const alex = syntheticRepDays({ role: "rep" }).reps![0]!;
  assert.equal(goalScopeCounts(alex)?.text, "64 outbound · 52 to enrolled Leads");
  const zero = syntheticZeroActivityRepDay();
  assert.equal(goalScopeCounts(zero)?.text, "0 outbound · 0 to enrolled Leads");
  assert.equal(zero.other_outbound.count, 0);
});
