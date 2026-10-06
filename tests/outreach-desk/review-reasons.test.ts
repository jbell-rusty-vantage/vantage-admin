import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { reviewReasonText } from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, reportUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { explanationLines, nextAction } from "../../components/outreach-desk/views/lead-panel";
import { salesOutreachDetailSchema, salesOutreachEnvelope, type SalesOutreachDetailDto } from "../../lib/api/salesOutreach";
import { SYNTHETIC_REVIEW_SUBJECTS, syntheticDetail, syntheticQueueRows, syntheticReviewDetail, syntheticSubjectId } from "./fixtures/synthetic";

/**
 * ADM-3: review reasons and explanation codes are rendered from the copy map, never raw. "Needs review: <reason>" in
 * the lead panel; an unknown code falls back to "Needs review" (or its line is dropped) and is reported (logged once
 * in development).
 */

/** Every review reason the server can store today (`subjectStatusOf`, `resolveDeskPolicy`, `evaluateDeskEligibility`,
 * enrollment `classify`/`service`) plus lane C2c's `no_contact_number`. */
const SERVER_REVIEW_REASONS = [
  "no_contact_number",
  "ambiguous_identity",
  "received_time_missing",
  "received_time_unreliable",
  "priority_needs_review",
  "malformed_priority",
  "unmapped_priority",
  "unsupported_intake_source",
  "policy_unavailable",
  "duplicate",
  "unmatched_booking_anchor",
  "legacy_closed_reopening_required",
  "number_only_unassociated",
  "lead_not_found",
];

/** Every explanation code `reads/detail.ts` explanationOf emits. */
const SERVER_EXPLANATION_CODES = [
  "projection_state",
  "cadence_shadow",
  "workflow",
  "engine_state",
  "schedule_day",
  "priority_basis",
  "priority_uncertain",
  "review",
  "quoted_date",
  "callback",
  "restriction_call",
  "restriction_sms",
  "move_date_passed",
  "move_date_unknown",
  "job_number_pending",
  "advisory_cooldown",
  "inherited_overdue",
];

const SNAKE = /\b[a-z]+_[a-z_]+\b/;

function collectUnknown<T>(run: () => T): { result: T; unknown: UnknownDeskCode[] } {
  const unknown: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => unknown.push(event));
  try {
    return { result: run(), unknown };
  } finally {
    stop();
  }
}

const withExplanation = (detail: SalesOutreachDetailDto, explanation: SalesOutreachDetailDto["policy"]["explanation"]): SalesOutreachDetailDto => ({
  ...detail,
  policy: { ...detail.policy, explanation },
});

test("every server review reason reads 'Needs review: <reason in words>'", () => {
  for (const reason of SERVER_REVIEW_REASONS) {
    const { result, unknown } = collectUnknown(() => reviewReasonText(reason));
    assert.equal(result, `Needs review: ${deskCopy.lead.reviewReasons[reason]}`, reason);
    assert.ok(deskCopy.lead.reviewReasons[reason], `copy for ${reason}`);
    assert.doesNotMatch(result, SNAKE, result);
    assert.deepEqual(unknown, [], reason);
  }
  assert.equal(reviewReasonText("no_contact_number"), "Needs review: no phone number to call");
  assert.equal(reviewReasonText("ambiguous_identity"), "Needs review: identity ambiguous — another lead has this Job Number");
});

test("an unknown or empty review reason falls back to plain 'Needs review' and is reported, never shown raw", () => {
  for (const value of ["some_future_reason", "constructor", "toString", 42]) {
    const { result, unknown } = collectUnknown(() => reviewReasonText(value));
    assert.equal(result, "Needs review");
    assert.deepEqual(unknown, [{ kind: "review_reason", code: null, value }]);
  }
  for (const value of [null, undefined, ""]) {
    const { result, unknown } = collectUnknown(() => reviewReasonText(value));
    assert.equal(result, "Needs review");
    assert.deepEqual(unknown, [], "a missing reason is not an unknown code");
  }
});

test("unknown codes are logged once in development and never in production", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = "production";
    reportUnknownDeskCode({ kind: "review_reason", code: null, value: "prod_only_reason" });
    assert.equal(warn.mock.callCount(), 0);
    env.NODE_ENV = "development";
    reportUnknownDeskCode({ kind: "review_reason", code: null, value: "dev_reason" });
    reportUnknownDeskCode({ kind: "review_reason", code: null, value: "dev_reason" });
    reportUnknownDeskCode({ kind: "explanation_value", code: "engine_state", value: "dev_state" });
    assert.equal(warn.mock.callCount(), 2);
    assert.match(String(warn.mock.calls[0]?.arguments[0]), /review reason "dev_reason"/);
    assert.match(String(warn.mock.calls[1]?.arguments[0]), /engine_state value "dev_state"/);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});

test("the lead panel of a review subject says 'Needs review: <reason>' for each reason", () => {
  for (const { n, reasons, evaluated } of SYNTHETIC_REVIEW_SUBJECTS) {
    const detail = syntheticDetail({ subjectId: syntheticSubjectId(n), role: "owner" });
    assert.ok(detail, `review subject ${n}`);
    assert.doesNotThrow(() => salesOutreachEnvelope(salesOutreachDetailSchema).parse({ ok: true, data: detail }), "the synthetic review detail parses through the mirror");
    const { result, unknown } = collectUnknown(() => ({ next: nextAction(detail), lines: explanationLines(detail) }));
    const expected = reasons.map((reason) => (deskCopy.lead.reviewReasons[reason] ? `Needs review: ${deskCopy.lead.reviewReasons[reason]}` : "Needs review"));
    // Headline: the first reason, amber, with a pointer to the rest.
    assert.equal(result.next.text, expected[0]);
    assert.equal(result.next.tone, "amber");
    assert.equal(result.next.sub, reasons.length > 1 ? "1 more reason listed below" : null);
    // Schedule lines: every reason, in the server's order, and no "Pending"/projection noise in place of the reason.
    assert.deepEqual(
      result.lines.filter((line) => line.startsWith("Needs review")),
      expected,
    );
    // Not evaluated yet: "Still being evaluated"; evaluated (C2c steady state): the review hold, and no "Today" line.
    if (evaluated) {
      assert.ok(result.lines.includes("The schedule is on hold until the review is resolved"), result.lines.join(" | "));
      assert.ok(!result.lines.includes("Still being evaluated"), result.lines.join(" | "));
      assert.ok(!result.lines.some((line) => line.startsWith("Today:")), result.lines.join(" | "));
    } else {
      assert.ok(result.lines.includes("Still being evaluated"), result.lines.join(" | "));
    }
    for (const line of [result.next.text, ...result.lines]) {
      assert.doesNotMatch(line, SNAKE, `no snake_case on screen: ${line}`);
      for (const reason of reasons) assert.ok(!line.includes(reason), `raw code ${reason} on screen: ${line}`);
    }
    const unknownReasons = reasons.filter((reason) => !deskCopy.lead.reviewReasons[reason]);
    assert.deepEqual(
      unknown.map((event) => event.value),
      // explanationLines and nextAction each meet the unknown reason once.
      unknownReasons.flatMap((reason) => [reason, reason]),
    );
  }
});

test("a review subject without review explanation codes still names its reasons", () => {
  const detail = syntheticReviewDetail({ n: 901, reasons: ["no_contact_number", "received_time_missing"] });
  const bare = withExplanation(detail, [{ code: "projection_state", value: "pending" }]);
  assert.deepEqual(
    explanationLines(bare).filter((line) => line.startsWith("Needs review")),
    ["Needs review: no phone number to call", "Needs review: the time this lead came in is missing"],
  );
  assert.equal(nextAction(bare).text, "Needs review: no phone number to call");
  const empty = { ...bare, subject: { ...bare.subject, review_reasons: [] } };
  assert.deepEqual(explanationLines(empty).filter((line) => line.startsWith("Needs review")), ["Needs review"]);
  assert.equal(nextAction(empty).text, "Needs review");
});

test("an active subject's headline is unchanged by review copy", () => {
  const detail = syntheticDetail({ subjectId: syntheticSubjectId(1), role: "rep" });
  assert.ok(detail);
  assert.equal(nextAction(detail).text, "Call overdue");
  const done = { ...detail, requirements: { call: { ...detail.requirements.call, status: "not_required" as const }, sms: { ...detail.requirements.sms, status: "not_required" as const } } };
  assert.equal(nextAction(done).text, deskCopy.text.noIssue);
  assert.equal(nextAction({ ...done, policy: { ...done.policy, projection_state: "pending" } }).text, "Still being evaluated");
  assert.equal(nextAction({ ...done, policy: { ...done.policy, projection_state: "cadence_disabled" } }).text, "Cadence isn't running yet");
});

test("every explanation code the server emits has copy or a deliberate silent branch", () => {
  const base = syntheticDetail({ subjectId: syntheticSubjectId(5), role: "owner" }) as SalesOutreachDetailDto;
  assert.ok(base.subject);
  const values: Record<string, Array<string | number | null>> = {
    projection_state: ["current", "pending", "stale_policy", "cadence_disabled", "policy_unavailable"],
    engine_state: ["closed", "review", "no_routine_cadence", "no_policy_configured"],
    priority_basis: ["accepted_observation", "intake_default", "none"],
    workflow: ["new", "quoted", "discretion", "none", "closed"],
    schedule_day: [1, 12],
    review: SERVER_REVIEW_REASONS,
    quoted_date: ["2026-10-05", null],
    callback: ["pending", null],
    restriction_call: ["2026-10-09T00:00:00.000Z", null],
    restriction_sms: [null],
    move_date_passed: ["2026-09-30"],
  };
  for (const code of SERVER_EXPLANATION_CODES) {
    for (const value of values[code] ?? [null]) {
      const { result, unknown } = collectUnknown<string[]>(() => explanationLines(withExplanation(base, [{ code, value }])));
      assert.deepEqual(unknown, [], `${code}=${String(value)}`);
      for (const line of result) assert.doesNotMatch(line, SNAKE, `${code}: ${line}`);
    }
  }
  const lines = (code: string, value: string | null): string[] => explanationLines(withExplanation(base, [{ code, value }]));
  assert.ok(lines("engine_state", "no_routine_cadence").includes("This priority has no routine schedule"));
  assert.ok(lines("engine_state", "no_policy_configured").includes("No schedule is set up for this priority yet"));
  assert.ok(lines("projection_state", "pending").includes("Still being evaluated"));
  assert.ok(!lines("engine_state", "closed").includes(deskCopy.lead.explanation.engine_state as string), "the bare 'Schedule state' label is gone");
});

test("an unknown explanation code or value is dropped (or falls back) and reported, never shown raw", () => {
  const base = syntheticDetail({ subjectId: syntheticSubjectId(5), role: "owner" }) as SalesOutreachDetailDto;
  assert.ok(base.subject);
  const baseline = explanationLines(withExplanation(base, []));
  const cases: Array<{ item: { code: string; value: string | null }; expected: string[]; report: UnknownDeskCode }> = [
    { item: { code: "brand_new_code", value: "x" }, expected: [], report: { kind: "explanation_code", code: null, value: "brand_new_code" } },
    { item: { code: "constructor", value: null }, expected: [], report: { kind: "explanation_code", code: null, value: "constructor" } },
    { item: { code: "engine_state", value: "hibernating" }, expected: [], report: { kind: "explanation_value", code: "engine_state", value: "hibernating" } },
    { item: { code: "priority_basis", value: "guessed" }, expected: [], report: { kind: "explanation_value", code: "priority_basis", value: "guessed" } },
    { item: { code: "projection_state", value: "rebuilding" }, expected: [deskCopy.text.pending], report: { kind: "explanation_value", code: "projection_state", value: "rebuilding" } },
    { item: { code: "review", value: "brand_new_reason" }, expected: ["Needs review"], report: { kind: "review_reason", code: null, value: "brand_new_reason" } },
  ];
  for (const { item, expected, report } of cases) {
    const { result, unknown } = collectUnknown<string[]>(() => explanationLines(withExplanation(base, [item])));
    assert.deepEqual(result, [...baseline, ...expected], item.code);
    assert.deepEqual(unknown, [report], item.code);
  }
});

test("server examples and the synthetic desk report no unknown explanation code", () => {
  for (const name of ["outreach.owner.overdue.json", "outreach.rep.due.json"]) {
    const body = JSON.parse(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server", name), "utf8"));
    const detail = salesOutreachEnvelope(salesOutreachDetailSchema).parse(body).data;
    const { unknown } = collectUnknown(() => [nextAction(detail), explanationLines(detail)]);
    assert.deepEqual(unknown, [], name);
  }
  for (const variant of ["desk", "m1"] as const) {
    for (const row of syntheticQueueRows(variant)) {
      const detail = syntheticDetail({ subjectId: row.subject_id, role: "owner", variant });
      assert.ok(detail);
      const { unknown } = collectUnknown(() => [nextAction(detail), explanationLines(detail)]);
      assert.deepEqual(unknown, [], `${variant} ${row.subject_id}`);
    }
  }
});
