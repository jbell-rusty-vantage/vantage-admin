import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  cadenceMetricText,
  channelStatus,
  durationWords,
  goalCoverageNote,
  goalScopeCounts,
  isUnverified,
  isVerifiedOverdue,
  otherOutboundFootnote,
  otherOutboundTitle,
  overdueByText,
  rowIssue,
  rowOverdue,
  verificationNote,
} from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { explanationLines, nextAction } from "../../components/outreach-desk/views/lead-panel";
import {
  salesOutreachDetailSchema,
  salesOutreachEnvelope,
  salesOutreachQueueSchema,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  type SalesOutreachChannelDto,
  type SalesOutreachDetailDto,
  type SalesOutreachQueueRowDto,
  type SalesOutreachRepDayDto,
  type SalesOutreachTeamDto,
} from "../../lib/api/salesOutreach";
import { SYNTHETIC_AS_OF, SYNTHETIC_REVIEW_SUBJECTS, syntheticDetail, syntheticQueueRows, syntheticSubjectId } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 2): the desk read against the server's wave-2 dto-examples exactly as served — byte copies
 * of server integration `9e940c41` (`docs/sales-outreach-desk/workspace/evidence/dto-examples/`): A2 `verification` on
 * every channel, `coverage_incomplete`, C1b `alternate_scope`, C8 `other_outbound.breakdown`. Every queue row, attention
 * row, lead detail and goal row in every example is rendered here, and the server semantics the copy depends on are
 * pinned, so a server change that breaks them turns this test red before the desk shows something wrong. The synthetic
 * mock data is checked to have the same shapes.
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;
const t = deskCopy.text;
const examples = (pattern: RegExp) => readdirSync(SERVER_FIXTURES).filter((file) => pattern.test(file) && file.endsWith(".json"));
const raw = (file: string): { data: Record<string, unknown> } => JSON.parse(readFileSync(path.join(SERVER_FIXTURES, file), "utf8"));

type Lead = { file: string; asOf: string; id: string; call: SalesOutreachChannelDto; sms: SalesOutreachChannelDto; row: SalesOutreachQueueRowDto | null };

/** Every queue row, team attention row and lead detail requirement in the examples, parsed through the mirror. */
function servedLeads(): Lead[] {
  const out: Lead[] = [];
  for (const file of examples(/^queue\./)) {
    const data = salesOutreachEnvelope(salesOutreachQueueSchema).parse(raw(file)).data;
    for (const row of data.rows) out.push({ file, asOf: data.as_of, id: row.subject_id, call: row.call, sms: row.sms, row });
  }
  for (const file of examples(/^team\./)) {
    const data = salesOutreachEnvelope(salesOutreachTeamSchema).parse(raw(file)).data;
    for (const row of data.leads_needing_attention.rows ?? []) out.push({ file, asOf: data.as_of, id: row.subject_id, call: row.call, sms: row.sms, row });
  }
  for (const file of examples(/^outreach\./)) {
    const data = salesOutreachEnvelope(salesOutreachDetailSchema).parse(raw(file)).data;
    out.push({ file, asOf: data.as_of, id: data.subject.subject_id, call: data.requirements.call, sms: data.requirements.sms, row: null });
  }
  return out;
}

const goalFiles = () => examples(/^(rep-days|team)\./);
function goalRows(file: string): { asOf: string; rows: SalesOutreachRepDayDto[]; team: SalesOutreachTeamDto | null } {
  if (file.startsWith("team.")) {
    const team = salesOutreachEnvelope(salesOutreachTeamSchema).parse(raw(file)).data;
    return { asOf: team.as_of, rows: team.daily_call_goals ?? [], team };
  }
  const repDays = salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(raw(file)).data;
  return { asOf: repDays.as_of, rows: repDays.reps ?? [], team: null };
}

function collectUnknown<T>(run: () => T): { result: T; unknown: UnknownDeskCode[] } {
  const unknown: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => unknown.push(event));
  try {
    return { result: run(), unknown };
  } finally {
    stop();
  }
}

const sum = (values: Record<string, unknown>) => Object.values(values).reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0);

// ------------------------------------------------------------------------------------------- A2 verification

test("A2 lockstep: every served channel carries verification, and its state follows the server's read rule", () => {
  const leads = servedLeads();
  assert.ok(leads.length >= 20, "the wave-2 examples carry queue, attention and detail channels");
  const seen = new Set<string>();
  for (const lead of leads) {
    for (const [kind, ch] of [["call", lead.call], ["sms", lead.sms]] as const) {
      const where = `${lead.file} ${lead.id.slice(-4)} ${kind}`;
      assert.ok("verification" in ch, `${where}: an A2 server sends verification on every channel (null included)`);
      const v = ch.verification ?? null;
      seen.add(v?.state ?? "null");
      if (v === null) continue;
      if (v.state === "unverified") {
        // A stored due row past its deadline that coverage can't prove: still due, never overdue, deadline as the start.
        assert.equal(ch.status, "due", where);
        assert.ok(ch.due_at && Date.parse(ch.due_at) <= Date.parse(lead.asOf), `${where}: the deadline has passed`);
        assert.equal(v.unverified_since, ch.due_at, where);
        assert.ok(v.verified_through === null || Date.parse(v.verified_through) < Date.parse(ch.due_at!), `${where}: coverage is behind the deadline`);
      } else {
        assert.equal(v.state, "verified", where);
        assert.equal(ch.status, "overdue", `${where}: only a proved overdue is verified`);
        assert.equal(v.unverified_since, null, where);
      }
    }
    if (lead.row) {
      // The row flag is the verified overdue: an unverified channel never sets it.
      assert.equal(lead.row.status_flags.overdue, isVerifiedOverdue(lead.call) || isVerifiedOverdue(lead.sms), `${lead.file} ${lead.id}`);
    }
  }
  assert.deepEqual([...seen].sort(), ["null", "unverified", "verified"], "the examples exercise all three states");
});

test("every served channel renders by its verification: verified overdue red with a duration, unverified amber with the coverage time", () => {
  for (const lead of servedLeads()) {
    for (const [kind, ch] of [["call", lead.call], ["sms", lead.sms]] as const) {
      const where = `${lead.file} ${lead.id.slice(-4)} ${kind}`;
      const cell = channelStatus(ch, lead.asOf, kind);
      if (ch.verification?.state === "unverified") {
        assert.equal(cell.tone, "amber", where);
        assert.equal(cell.text, t.notYetVerified, where);
        assert.equal(overdueByText(ch, lead.asOf), null, `${where}: no overdue duration`);
        const note = verificationNote(ch, lead.asOf)!;
        assert.match(note.text, /^Due — not yet verified \(activity known through \d{1,2}:\d{2} [AP]M\)$/, where);
        assert.doesNotMatch(note.text, /overdue/i, where);
      } else if (ch.status === "overdue") {
        assert.deepEqual(cell, { text: t.overdue, tone: "red" }, where);
        assert.match(overdueByText(ch, lead.asOf) ?? "", /overdue$/, `${where}: a proved overdue shows how long`);
        assert.equal(verificationNote(ch, lead.asOf), null, where);
      } else {
        assert.notEqual(cell.tone, "red", where);
        assert.equal(verificationNote(ch, lead.asOf), null, where);
      }
      for (const text of [cell.text, cell.title ?? ""]) assert.doesNotMatch(text, SNAKE, `${where}: ${text}`);
    }
  }
});

test("the served queue and attention rows: a row is red only when a channel is proved overdue", () => {
  const issues = new Map<string, string>();
  for (const lead of servedLeads()) {
    if (!lead.row) continue;
    const issue = rowIssue(lead.row, lead.asOf);
    assert.equal(rowOverdue(lead.row), lead.row.status_flags.overdue, `${lead.file} ${lead.id}`);
    if (rowOverdue(lead.row)) assert.equal(issue.tone, "red", `${lead.file} ${lead.id}: ${issue.text}`);
    else assert.notEqual(issue.tone, "red", `${lead.file} ${lead.id}: ${issue.text}`);
    assert.doesNotMatch(issue.text, SNAKE);
    issues.set(`${lead.file} ${lead.id.slice(-4)}`, issue.text);
  }
  // 11:00 AM New York (as_of 15:00Z): capture through 10:43 AM, cadence coverage 10:41 AM (2-minute allowance).
  assert.equal(issues.get("queue.owner.awaiting-capture.json 2a05"), "Call due — not yet verified");
  assert.equal(issues.get("queue.owner.awaiting-capture.json 2a03"), "Call due — not yet verified");
  assert.match(issues.get("queue.owner.awaiting-capture.json 2a01") ?? "", /^Call overdue/);
  assert.match(issues.get("team.owner.cadence-enforcement.json 2a04") ?? "", /^Call overdue/);
  assert.equal(issues.get("team.owner.cadence-enforcement.json 2a05"), "Call due — not yet verified");
  const queue = salesOutreachEnvelope(salesOutreachQueueSchema).parse(raw("queue.owner.awaiting-capture.json")).data;
  const pending = queue.rows.find((row) => row.subject_id.endsWith("2a05"))!;
  assert.equal(verificationNote(pending.call, queue.as_of)?.text, "Due — not yet verified (activity known through 10:41 AM)");
  const page2 = salesOutreachEnvelope(salesOutreachQueueSchema).parse(raw("queue.owner.page-2.json")).data;
  assert.equal(verificationNote(page2.rows[0]!.call, page2.as_of)?.text, "Due — not yet verified (activity known through 10:55 AM)");
});

test("the served lead details: the overdue lead's next action is red with its duration; the due lead's is not", () => {
  const overdue = salesOutreachEnvelope(salesOutreachDetailSchema).parse(raw("outreach.owner.overdue.json")).data;
  assert.equal(overdue.requirements.call.verification?.state, "verified");
  const next = nextAction(overdue);
  assert.deepEqual([next.text, next.tone], [deskCopy.lead.callOverdue, "red"]);
  // Oldest unmet deadline 10:30 AM, as_of 11:00 AM.
  assert.equal(next.sub, t.overdueBy(durationWords(30 * 60_000)));
  const due = salesOutreachEnvelope(salesOutreachDetailSchema).parse(raw("outreach.rep.due.json")).data;
  assert.equal(due.requirements.call.verification, null, "a future deadline carries no verification");
  assert.notEqual(nextAction(due).tone, "red");
  for (const detail of [overdue, due] as SalesOutreachDetailDto[]) {
    const { result, unknown } = collectUnknown(() => [nextAction(detail).text, ...explanationLines(detail)]);
    assert.deepEqual(unknown, []);
    for (const line of result) assert.doesNotMatch(line, SNAKE, line);
  }
});

test("coverage_wait is stored, not served: no example carries it (the served counterpart is verification.unverified_since)", () => {
  for (const file of readdirSync(SERVER_FIXTURES).filter((name) => name.endsWith(".json"))) {
    assert.doesNotMatch(readFileSync(path.join(SERVER_FIXTURES, file), "utf8"), /coverage_wait/, file);
  }
});

// ------------------------------------------------------------------------------------------- goal rows

test("every served goal row: both counts, Other outbound by reason and coverage read in words", () => {
  let alternates = 0;
  let breakdowns = 0;
  for (const file of goalFiles()) {
    const { rows, team } = goalRows(file);
    for (const row of rows) {
      const where = `${file} ${row.agent_name ?? row.agent_id}`;
      const { result, unknown } = collectUnknown(() => ({
        counts: goalScopeCounts(row),
        other: otherOutboundTitle(row.other_outbound, row.count_scope),
        coverage: goalCoverageNote(row.coverage),
        due: [cadenceMetricText(row.calls_due_today), cadenceMetricText(row.sms_due_today), cadenceMetricText(row.overdue_leads)],
      }));
      assert.deepEqual(unknown, [], where);
      if (row.alternate_scope) {
        alternates += 1;
        assert.ok(result.counts, where);
        assert.doesNotMatch(result.counts.text, /null|undefined|NaN/, where);
        assert.doesNotMatch(result.counts.text, SNAKE, `${where}: ${result.counts.text}`);
      }
      const breakdown = row.other_outbound.breakdown;
      if (breakdown && row.other_outbound.count !== null) {
        breakdowns += 1;
        assert.equal(sum(breakdown), row.other_outbound.count, `${where}: the reasons add up to Other outbound`);
      }
      // Under all_outbound the headline is the eligible count plus Other outbound (why the footnote says they count).
      const alt = row.alternate_scope;
      if (row.count_scope === "all_outbound" && alt?.count_scope === "eligible_new_quoted" && row.actual_confirmed !== null && alt.actual_confirmed !== null && row.other_outbound.count !== null) {
        assert.equal(row.actual_confirmed, alt.actual_confirmed + row.other_outbound.count, where);
      }
      for (const text of [result.other, result.coverage?.text ?? "", result.coverage?.title ?? "", ...result.due.map((d) => d.reason ?? d.text)]) {
        assert.doesNotMatch(text, SNAKE, `${where}: ${text}`);
      }
    }
    if (team?.goals) {
      const goals = team.goals;
      if (goals.other_outbound_breakdown && goals.other_outbound_total !== null) {
        assert.equal(sum(goals.other_outbound_breakdown), goals.other_outbound_total, `${file}: team reasons add up`);
      }
      const alternate = goals.outbound_calls.alternate;
      if (goals.count_scope === "all_outbound" && alternate?.actual != null && goals.outbound_calls.actual !== null && goals.other_outbound_total !== null) {
        assert.equal(goals.outbound_calls.actual, alternate.actual + goals.other_outbound_total, `${file}: team headline = eligible + Other outbound`);
      }
      const foot = otherOutboundFootnote(goals.count_scope, goals.other_outbound_total, goals.other_outbound_breakdown);
      if (foot) assert.doesNotMatch(foot, SNAKE, `${file}: ${foot}`);
    }
  }
  assert.ok(alternates >= 10, `the examples serve alternate_scope on goal rows (${alternates})`);
  assert.ok(breakdowns >= 10, `the examples serve the Other outbound breakdown (${breakdowns})`);
});

test("a goal-metrics-disabled day serves no rows and nothing to render", () => {
  const { rows } = goalRows("rep-days.goal-metrics-disabled.json");
  assert.deepEqual(rows, []);
});

// ------------------------------------------------------------------------------------------- synthetic shapes

test("the synthetic unverified row has the served A2 shape: due, live coverage block, cadence coverage behind capture", () => {
  const served = salesOutreachEnvelope(salesOutreachQueueSchema).parse(raw("queue.owner.awaiting-capture.json")).data.rows.find((row) => row.subject_id.endsWith("2a05"))!.call;
  const synthetic = syntheticQueueRows().find((row) => row.subject_id === syntheticSubjectId(9))!.call;
  assert.deepEqual(Object.keys(synthetic).sort(), Object.keys(served).sort(), "same channel keys");
  for (const ch of [served, synthetic]) {
    assert.equal(ch.status, "due");
    assert.equal(ch.verification?.state, "unverified");
    assert.equal(ch.verification?.unverified_since, ch.due_at);
    // The coverage block is the live capture watermark (complete within the today tolerance), not the verdict.
    assert.equal(ch.coverage?.state, "complete");
    assert.equal(Date.parse(ch.coverage!.known_complete_through!) - Date.parse(ch.verification!.verified_through!), 2 * 60_000);
  }
  // Every synthetic overdue is verified, every other status carries null — as served.
  for (const row of syntheticQueueRows()) {
    for (const ch of [row.call, row.sms]) {
      if (ch.status === "overdue") assert.equal(ch.verification?.state, "verified", row.subject_id);
      else if (!isUnverified(ch)) assert.equal(ch.verification, null, row.subject_id);
    }
  }
});

test("review no_contact_number (C2c): the evaluated review subject reads its reason and the hold, with nothing due", () => {
  const spec = SYNTHETIC_REVIEW_SUBJECTS.find((subject) => subject.reasons.includes("no_contact_number"))!;
  assert.equal(spec.evaluated, true, "901 is the C2c steady state");
  const detail = syntheticDetail({ subjectId: syntheticSubjectId(spec.n), role: "owner", variant: "desk" })!;
  assert.doesNotThrow(() => salesOutreachEnvelope(salesOutreachDetailSchema).parse({ ok: true, data: detail }));
  assert.equal(detail.policy.projection_state, "current");
  assert.equal(detail.policy.engine_state, "review");
  assert.deepEqual([detail.requirements.call.status, detail.requirements.sms.status], ["not_required", "not_required"]);
  assert.equal(detail.status_flags.needs_contact, false);
  const next = nextAction(detail);
  assert.deepEqual([next.text, next.tone], ["Needs review: no phone number to call", "amber"]);
  const lines = explanationLines(detail);
  assert.ok(lines.includes("The schedule is on hold until the review is resolved"), lines.join(" | "));
  assert.ok(!lines.some((line) => line.startsWith("Today:")), lines.join(" | "));
  assert.deepEqual(
    [channelStatus(detail.requirements.call, SYNTHETIC_AS_OF, "call").text, channelStatus(detail.requirements.sms, SYNTHETIC_AS_OF, "sms").text],
    [t.notRequired, t.notRequired],
  );
  // A review subject the evaluator hasn't reached yet carries the server's pending channels.
  const unevaluated = syntheticDetail({ subjectId: syntheticSubjectId(902), role: "owner", variant: "desk" })!;
  assert.deepEqual(
    [unevaluated.requirements.call.status, unevaluated.requirements.call.completion_kind, unevaluated.requirements.call.required, unevaluated.status_flags.pending],
    ["pending", "evidence_pending", null, true],
  );
  assert.match(nextAction(unevaluated).text, /^Needs review: /);
});
