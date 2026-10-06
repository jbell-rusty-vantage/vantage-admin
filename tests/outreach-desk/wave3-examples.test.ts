import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CONFIGURATION_TUNABLE_GROUPS,
  configurationPatchBody,
  storedTunable,
  withTunables,
} from "../../components/outreach-desk/lib/configuration-patch";
import { admissionsViewOf } from "../../components/outreach-desk/lib/enrollment";
import { channelStatus, enrollmentSourceText, freshnessChips, smsPendingText } from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { explanationLines, nextAction } from "../../components/outreach-desk/views/lead-panel";
import {
  salesOutreachAdmissionsSchema,
  salesOutreachDetailSchema,
  salesOutreachEnvelope,
  salesOutreachFreshnessSchema,
  salesOutreachTeamSchema,
  type SalesOutreachConfigurationValue,
  type SalesOutreachFreshness,
} from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import {
  SYNTHETIC_A5_OPERATIONS,
  SYNTHETIC_ADMITTED_ROW,
  SYNTHETIC_AS_OF,
  SYNTHETIC_INTAKE_GATE,
  SYNTHETIC_REVIEW_SUBJECTS,
  SYNTHETIC_SMS_PENDING,
  syntheticCommonRead,
  syntheticConfiguration,
  syntheticDetail,
  syntheticQueueRows,
  syntheticSubjectId,
} from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-6 (wave 3): the desk read against the server's wave-3 dto-examples exactly as served — byte copies
 * of server integration `6cf83e1e` (`docs/sales-outreach-desk/workspace/evidence/dto-examples/`, after B8, C7, A5, B6):
 * C7 adds `freshness.sms.pending` on every read (null while rep SMS capture is off) and `team.owner.sms-capture.json`
 * serves the counters. The SMS chip tooltip names them in words. The synthetic mock carries the same shapes, plus the
 * B8 admission hold (a held review subject with no period), the B6 automatic admission (`admission:` cohort, admissions
 * counts) and the A5 drain budget PATCH.
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;
const p = deskCopy.freshness.smsPending;
const readFiles = () => readdirSync(SERVER_FIXTURES).filter((file) => file.endsWith(".json") && /^(team|rep-days|queue|outreach)\./.test(file));
const raw = (file: string): { data: { freshness: { calls: Record<string, unknown>; sms: Record<string, unknown> } } } =>
  JSON.parse(readFileSync(path.join(SERVER_FIXTURES, file), "utf8"));

function collectUnknown<T>(run: () => T): { result: T; unknown: UnknownDeskCode[] } {
  const unknown: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => unknown.push(event));
  try {
    return { result: run(), unknown };
  } finally {
    stop();
  }
}

const smsChip = (freshness: SalesOutreachFreshness) => freshnessChips(freshness).find((chip) => chip.key === "sms")!;

// ------------------------------------------------------------------------------------------- C7 served shape

test("C7 lockstep: every served read carries freshness.sms.pending (calls never do); null exactly while SMS capture is off", () => {
  const files = readFiles();
  assert.ok(files.length >= 15, "the projection read examples are present");
  let served = 0;
  for (const file of files) {
    const { freshness } = raw(file).data;
    assert.ok("pending" in freshness.sms, `${file}: sms.pending is served`);
    assert.ok(!("pending" in freshness.calls), `${file}: calls has no pending`);
    const pending = freshness.sms.pending as { identity: number; association: number; window_days: number; mailboxes: Array<{ identity: number; association: number }> } | null;
    if (freshness.sms.state === "not_connected") assert.equal(pending, null, `${file}: capture off → null`);
    if (pending === null) continue;
    served += 1;
    assert.equal(pending.window_days, 7, file);
    // The totals are the mailbox sums (every mailbox with any is listed; the server caps the list at 100).
    assert.equal(pending.identity, pending.mailboxes.reduce((n, box) => n + box.identity, 0), file);
    assert.equal(pending.association, pending.mailboxes.reduce((n, box) => n + box.association, 0), file);
    for (const box of pending.mailboxes) assert.ok(box.identity + box.association > 0, `${file}: only mailboxes with pending texts are listed`);
  }
  assert.ok(served >= 1, "at least one example serves the counters (team.owner.sms-capture.json)");
});

test("C7: the SMS chip tooltip names the waiting texts in words; label, tone and the other chips are unchanged", () => {
  const team = salesOutreachEnvelope(salesOutreachTeamSchema).parse(JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "team.owner.sms-capture.json"), "utf8"))).data;
  assert.ok(team.freshness.sms.pending, "the example serves the counters");
  const { result: chips, unknown } = collectUnknown(() => freshnessChips(team.freshness));
  assert.deepEqual(unknown, []);
  const sms = chips.find((chip) => chip.key === "sms")!;
  assert.equal(
    sms.title,
    "RingCentral SMS updated 4 min ago · Last 7 days: 1 text waiting for its sending rep to be confirmed, 1 text not yet matched to a lead (2 mailboxes)",
  );
  const without = freshnessChips({ ...team.freshness, sms: { ...team.freshness.sms, pending: null } });
  const plain = without.find((chip) => chip.key === "sms")!;
  assert.deepEqual([sms.label, sms.tone, sms.source], [plain.label, plain.tone, plain.source], "the counters never change the chip state");
  assert.ok(sms.title.startsWith(`${plain.title} · `), "the note is appended to the usual tooltip");
  assert.deepEqual(chips.filter((chip) => chip.key !== "sms"), without.filter((chip) => chip.key !== "sms"));
  for (const chip of chips) assert.doesNotMatch(chip.title, SNAKE, `no raw code on screen: ${chip.title}`);
  assert.ok(!sms.title.includes("109") && !sms.title.includes("101"), "extension ids never show");
});

test("C7: every served example renders its SMS chip without a note when nothing is counted (null pending)", () => {
  for (const file of readFiles()) {
    const freshness = salesOutreachFreshnessSchema.parse(raw(file).data.freshness);
    const chip = smsChip(freshness);
    if (freshness.sms.pending === null) {
      assert.ok(!chip.title.includes(" · "), `${file}: ${chip.title}`);
      assert.equal(smsPendingText(freshness.sms.pending), null);
    }
    assert.doesNotMatch(chip.title, SNAKE, `${file}: ${chip.title}`);
  }
});

test("C7: the note reads each kind on its own, singular and plural; zero counts and a pre-C7 server add nothing", () => {
  const box = (identity: number, association: number) => ({ extension_id: "1", agent_id: null, identity, association });
  assert.equal(smsPendingText({ identity: 0, association: 0, window_days: 7, mailboxes: [] }), null, "nothing waiting: no note");
  assert.equal(smsPendingText(null), null, "capture off or not counted yet");
  assert.equal(smsPendingText(undefined), null, "a server before C7 omits the field");
  assert.equal(smsPendingText({ identity: 3, association: 0, window_days: 7, mailboxes: [box(3, 0)] }), "Last 7 days: 3 texts waiting for their sending rep to be confirmed");
  assert.equal(smsPendingText({ identity: 0, association: 1, window_days: 7, mailboxes: [box(0, 1)] }), "Last 7 days: 1 text not yet matched to a lead");
  assert.equal(
    smsPendingText({ identity: 1, association: 4, window_days: 7, mailboxes: [box(1, 2), box(0, 2), box(0, 0)] }),
    "Last 7 days: 1 text waiting for its sending rep to be confirmed, 4 texts not yet matched to a lead (3 mailboxes)",
  );
  // A freshness block from a server before C7 (no `pending` key) still parses and renders as before.
  const preC7 = structuredClone(raw("team.owner.json").data.freshness) as Record<string, Record<string, unknown>>;
  delete preC7.sms!.pending;
  const parsed = salesOutreachFreshnessSchema.parse(preC7);
  assert.equal(parsed.sms.pending, undefined);
  assert.deepEqual(parsed, preC7);
  assert.ok(!smsChip(parsed).title.includes(" · "));
  for (const text of [p.identity(1), p.identity(2), p.association(1), p.association(2), p.line(7, ["x"], p.mailboxes(2))]) assert.doesNotMatch(text, SNAKE);
});

test("C7 synthetic: the mock serves the counters while SMS capture is on, null while it is off, in the served shape", () => {
  const served = raw("team.owner.sms-capture.json").data.freshness.sms.pending as Record<string, unknown>;
  const desk = syntheticCommonRead("owner", null, "desk").freshness;
  const m1 = syntheticCommonRead("owner", null, "m1").freshness;
  assert.deepEqual(Object.keys(desk.sms.pending!).sort(), Object.keys(served).sort());
  assert.deepEqual(Object.keys(desk.sms.pending!.mailboxes[0]!).sort(), Object.keys((served.mailboxes as object[])[0]!).sort());
  assert.deepEqual(desk.sms.pending, SYNTHETIC_SMS_PENDING);
  assert.equal(desk.sms.state, "fresh");
  assert.equal(m1.sms.state, "not_connected");
  assert.equal(m1.sms.pending, null);
  assert.deepEqual(salesOutreachFreshnessSchema.parse(desk), desk);
  const response = mockSalesOutreachResponse({ role: "owner", method: "GET", path: "team" });
  const team = salesOutreachEnvelope(salesOutreachTeamSchema).parse(response.body).data;
  assert.match(smsChip(team.freshness).title, / · Last 7 days: 1 text waiting for its sending rep to be confirmed, 1 text not yet matched to a lead \(2 mailboxes\)$/);
});

// ------------------------------------------------------------------------------------------- B8 admission hold

test("B8 hold: a held review subject has no period, an intake cohort and its received-time facts; it reads its reason, never a schedule", () => {
  const held = SYNTHETIC_REVIEW_SUBJECTS.filter((subject) => subject.hold);
  assert.deepEqual(
    held.map((subject) => subject.n),
    [902, 906],
  );
  for (const spec of held) {
    const detail = syntheticDetail({ subjectId: syntheticSubjectId(spec.n), role: "owner", variant: "desk" })!;
    assert.deepEqual(salesOutreachEnvelope(salesOutreachDetailSchema).parse({ ok: true, data: detail }).data, detail, `${spec.n} round-trips the mirror`);
    assert.equal(detail.subject.status, "review");
    assert.equal(detail.policy.period, null, `${spec.n}: no period while held`);
    assert.equal(detail.policy.schedule_day, null);
    assert.equal(detail.subject.enrollment.kind, "intake");
    assert.equal(detail.subject.enrollment.cohort_id, `intake:${SYNTHETIC_INTAKE_GATE}`);
    assert.equal(enrollmentSourceText(detail.subject.enrollment), deskCopy.lead.enrollment.intake(spec.n === 906 ? "Sep 30" : "Oct 1"), "the intake line, never the cohort id");
    assert.equal(detail.status_flags.needs_contact, false);
    assert.equal(detail.status_flags.overdue, false);
    const next = nextAction(detail);
    assert.equal(next.tone, "amber");
    assert.equal(next.text, `Needs review: ${deskCopy.lead.reviewReasons[spec.reasons[0]!]}`);
    const lines = explanationLines(detail);
    // No schedule day without a period. (Before the evaluator runs, the pending channels read "Today: calls pending …",
    // as the server serves them; once evaluated nothing is due.)
    assert.ok(!lines.some((line) => line.startsWith("New lead") || line.startsWith("Quoted")), lines.join(" | "));
    if (spec.evaluated) assert.ok(!lines.some((line) => line.startsWith("Today:")), lines.join(" | "));
    for (const line of [next.text, ...lines]) assert.doesNotMatch(line, SNAKE, `${spec.n}: ${line}`);
  }
  // 906: missing received time → no instant, quality missing, enrolled at the gate; evaluated → dateless review (A4).
  const missing = syntheticDetail({ subjectId: syntheticSubjectId(906), role: "owner", variant: "desk" })!;
  assert.deepEqual([missing.subject.received_at, missing.subject.received_date, missing.subject.received_quality], [null, null, "missing"]);
  assert.equal(missing.subject.enrollment.enrolled_at, SYNTHETIC_INTAKE_GATE);
  assert.deepEqual([missing.policy.projection_state, missing.policy.workflow, missing.policy.engine_state], ["current", null, "review"]);
  assert.ok(!missing.policy.explanation.some((item) => item.code === "workflow"), "no period, no workflow explanation");
  assert.deepEqual(
    [channelStatus(missing.requirements.call, SYNTHETIC_AS_OF, "call").text, channelStatus(missing.requirements.sms, SYNTHETIC_AS_OF, "sms").text],
    [deskCopy.text.notRequired, deskCopy.text.notRequired],
  );
  assert.ok(explanationLines(missing).includes("The schedule is on hold until the review is resolved"));
  // 902: unreliable received time keeps its instant; not evaluated yet → pending channels, "Still being evaluated".
  const unreliable = syntheticDetail({ subjectId: syntheticSubjectId(902), role: "owner", variant: "desk" })!;
  assert.equal(unreliable.subject.received_quality, "unreliable");
  assert.notEqual(unreliable.subject.received_at, null);
  assert.equal(unreliable.subject.enrollment.enrolled_at, unreliable.subject.received_at);
  assert.ok(explanationLines(unreliable).includes("Still being evaluated"));
});

// ------------------------------------------------------------------------------------------- B6 automatic admission

test("B6: the admissions mock counts an automatic admission and a deferral; the admitted lead reads its admission day", () => {
  const response = mockSalesOutreachResponse({ role: "owner", method: "GET", path: "enrollment/admissions" });
  const dto = salesOutreachEnvelope(salesOutreachAdmissionsSchema).parse(response.body).data;
  const { result: view, unknown } = collectUnknown(() => admissionsViewOf(dto));
  assert.deepEqual(unknown, []);
  const tile = (key: string) => view.tiles.find((one) => one.key === key)!;
  assert.deepEqual([tile("admitted_expansion").value, tile("admitted_expansion").label], [1, "Added later (automatic admission)"]);
  assert.deepEqual([tile("deferred").value, tile("deferred").label], [1, "Waiting to be decided"]);
  assert.equal(tile("admitted_review").value, 1, "the B8 holds count as added for review");
  // A deferral is never a refusal (the server lists only not_admitted outcomes).
  assert.ok(!view.refusals.some((row) => /waiting/i.test(row.reason)));
  for (const row of view.byReason) assert.doesNotMatch(row.text, SNAKE);

  const admitted = syntheticQueueRows("desk").find((row) => row.subject_id === syntheticSubjectId(SYNTHETIC_ADMITTED_ROW));
  assert.ok(admitted, "the admitted lead is on the queue");
  const detail = syntheticDetail({ subjectId: admitted.subject_id, role: "owner", variant: "desk" })!;
  assert.equal(detail.subject.enrollment.cohort_id, "admission:2026-09-28");
  assert.equal(detail.subject.enrollment.kind, "expansion");
  assert.equal(enrollmentSourceText(detail.subject.enrollment), deskCopy.lead.enrollment.admission("Sep 28"));
});

// ------------------------------------------------------------------------------------------- A5 drain budget

test("A5: the proposed drain budget is inside the editor's bounds, reads as set, and the PATCH changes only operations", () => {
  const drain = CONFIGURATION_TUNABLE_GROUPS.drain;
  const config = syntheticConfiguration("desk");
  const stored = config.value as SalesOutreachConfigurationValue;
  assert.equal("operations" in stored, false, "production has no operations namespace: every drain tunable reads its default");
  for (const t of drain) assert.equal(storedTunable(stored, t), null, t.field);
  const patched = withTunables(
    stored,
    drain.map((t) => [t, SYNTHETIC_A5_OPERATIONS[t.field as keyof typeof SYNTHETIC_A5_OPERATIONS]] as const),
  );
  for (const t of drain) {
    const value = storedTunable(patched, t)!;
    assert.equal(value, SYNTHETIC_A5_OPERATIONS[t.field as keyof typeof SYNTHETIC_A5_OPERATIONS]);
    assert.ok(value >= t.min && value <= t.max, `${t.field} ${value} within ${t.min}–${t.max}`);
  }
  const body = configurationPatchBody(config, patched);
  const { operations, ...rest } = body.value as Record<string, unknown>;
  assert.deepEqual(operations, { ...SYNTHETIC_A5_OPERATIONS });
  assert.deepEqual(rest, JSON.parse(JSON.stringify(stored)), "every other key goes back as stored");
});
