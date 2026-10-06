import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  admissionsErrorText,
  admissionsViewOf,
  earliestAdmissionsDay,
  EnrollNotEligibleError,
  enrollErrorText,
  enrollmentEmptyText,
  enrollmentListHint,
  enrollmentRowsOf,
  enrollOneLead,
  enrollOutcomeText,
  ENROLLMENT_LISTS,
  nextEnrollmentCursor,
  ownerEnrollCohortId,
  readAdmissions,
  readEnrollmentPage,
  type EnrollmentList,
} from "../../components/outreach-desk/lib/enrollment";
import { admissionReasonText, enrollmentSourceText } from "../../components/outreach-desk/lib/format";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import {
  SALES_OUTREACH_BFF_PATH,
  SalesOutreachApiError,
  salesOutreachAdmissionsSchema,
  salesOutreachEnvelope,
  salesOutreachErrorFromBody,
  type SalesOutreachEnrollmentCandidatesDto,
} from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { SYNTHETIC_ADMITTED_ROW, syntheticDetail, syntheticEnrollmentCandidateItems, syntheticEnrollmentReport, syntheticSubjectId } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-4: the Owner's enrollment lists ("Ready to enroll" = `in_scope`, "Older", read-only "Needs
 * review"), Load more over the opaque `next_cursor`, one-click Enroll in the `owner-enroll-<date>` cohort, the
 * `admission:` cohort in the lead panel and the day's new-lead intake (`GET /enrollment/admissions`, server B8).
 * Server codes never show: every reason and status reads in words.
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;
const x = deskCopy.settingsExtra;

type Call = { method: string; path: string; body: unknown; idempotencyKey: string | null };

/** Routes the BFF calls of `lib/enrollment` to the desk mock as the Owner, recording each call. */
async function throughMock<T>(run: (calls: Call[]) => Promise<T>, override?: (call: Call) => Response | null): Promise<T> {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const full = String(url);
    assert.ok(full.startsWith(`${SALES_OUTREACH_BFF_PATH}/`), full);
    const relative = full.slice(SALES_OUTREACH_BFF_PATH.length + 1);
    const headers = new Headers(init?.headers);
    const call: Call = { method: init?.method ?? "GET", path: relative, body: init?.body ? JSON.parse(String(init.body)) : undefined, idempotencyKey: headers.get("Idempotency-Key") };
    calls.push(call);
    const overridden = override?.(call);
    if (overridden) return overridden;
    const answer = mockSalesOutreachResponse({ role: "owner", method: call.method, path: relative, body: call.body });
    return Response.json(answer.body, { status: answer.status });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
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

async function allPages(list: EnrollmentList): Promise<SalesOutreachEnrollmentCandidatesDto[]> {
  const pages: SalesOutreachEnrollmentCandidatesDto[] = [];
  let cursor: string | null = null;
  do {
    const page = await readEnrollmentPage(list, cursor);
    pages.push(page);
    cursor = nextEnrollmentCursor(page) ?? null;
  } while (cursor);
  return pages;
}

test("the three lists are Ready to enroll (in_scope), Older and a read-only Needs review", () => {
  assert.deepEqual([...ENROLLMENT_LISTS], ["in_scope", "older", "review"]);
  assert.deepEqual(ENROLLMENT_LISTS.map((list) => x.enrollmentTabs[list]), ["Ready to enroll", "Older", "Needs review"]);
  for (const list of ENROLLMENT_LISTS) {
    assert.doesNotMatch(enrollmentEmptyText(list), SNAKE);
    assert.doesNotMatch(enrollmentListHint(list, null), SNAKE);
  }
});

test("Ready to enroll rows can be enrolled and say why they are ready; Needs review rows are read-only with the reason in words", async () => {
  await throughMock(async (calls) => {
    const ready = enrollmentRowsOf(await allPages("in_scope"));
    assert.equal(calls[0]!.path, "enrollment/candidates?partition=in_scope&limit=25");
    assert.deepEqual(
      ready.map((row) => row.lead),
      syntheticEnrollmentReport().lead_refs,
      "the Ready list is the report's selection",
    );
    assert.ok(ready.every((row) => row.canEnroll));
    assert.deepEqual(ready.map((row) => row.reason), ["Received recently", "Received recently", "Upcoming move"]);
    assert.deepEqual(ready.map((row) => row.workflow), ["New", "Quoted", "New"]);

    const older = enrollmentRowsOf(await allPages("older"));
    assert.ok(older.length > 0 && older.every((row) => row.canEnroll && row.reason === null), "older rows need no reason (the hint says why)");

    const reviewRows = enrollmentRowsOf(await allPages("review"));
    assert.equal(reviewRows.length, 1);
    assert.equal(reviewRows[0]!.canEnroll, false, "Needs review is read-only");
    assert.equal(reviewRows[0]!.reason, "Needs review: the time this lead came in is missing");
    assert.equal(reviewRows[0]!.received, deskCopy.text.unknown);
    for (const row of [...ready, ...older, ...reviewRows]) {
      for (const text of [row.job, row.received, row.workflow, row.reason ?? ""]) assert.doesNotMatch(text, SNAKE, text);
    }
  });
});

test("a review reason or ready reason the copy does not know reads safely and is reported", () => {
  const base = syntheticEnrollmentCandidateItems("review")[0]!;
  const { result, unknown } = collectUnknown(() =>
    enrollmentRowsOf([
      {
        contract_version: "sod-v1",
        as_of: "2026-10-01T16:00:00.000Z",
        partition: "review",
        scope: { mode: "backfill_scope", today: "2026-10-01" },
        items: [
          { ...base, reason: "brand_new_reason" },
          { ...base, lead: { model: "FormLead", id: syntheticSubjectId(1299) }, partition: "in_scope", reason: "another_new_reason" },
        ],
        next_cursor: null,
        scanned: 2,
      },
    ]),
  );
  assert.equal(result[0]!.reason, "Needs review");
  assert.equal(result[1]!.reason, null);
  assert.deepEqual(
    unknown.map((event) => [event.kind, event.value]),
    [
      ["review_reason", "brand_new_reason"],
      ["enrollment_reason", "another_new_reason"],
    ],
  );
});

test("Load more follows the opaque next_cursor to the end; an expired cursor is CURSOR_EXPIRED; rows never repeat", async () => {
  // Two pages of one Lead each, the second repeating the first (a list that shifted): shown once.
  const items = syntheticEnrollmentCandidateItems("in_scope");
  const page = (cursor: string | null, index: number): SalesOutreachEnrollmentCandidatesDto => ({
    contract_version: "sod-v1",
    as_of: "2026-10-01T16:00:00.000Z",
    partition: "in_scope",
    scope: { mode: "backfill_scope", today: "2026-10-01", cutoff_date: "2026-07-03", lookback_days: 90, include_upcoming_moves: true },
    items: [items[index]!],
    next_cursor: cursor,
    scanned: 1,
  });
  await throughMock(
    async (calls) => {
      const pages = await allPages("in_scope");
      assert.deepEqual(
        calls.map((call) => call.path),
        ["enrollment/candidates?partition=in_scope&limit=25", "enrollment/candidates?partition=in_scope&limit=25&cursor=eyJtIjoidyJ9", "enrollment/candidates?partition=in_scope&limit=25&cursor=c2Vjb25k"],
      );
      assert.equal(pages.length, 3);
      assert.equal(enrollmentRowsOf(pages).length, 2, "the Lead on two pages shows once");
      assert.equal(nextEnrollmentCursor(pages[2]!), undefined);
      const expired = await readEnrollmentPage("in_scope", "expired").catch((error: unknown) => error);
      assert.ok(expired instanceof SalesOutreachApiError && expired.code === "CURSOR_EXPIRED");
    },
    (call) => {
      if (call.path.endsWith("cursor=expired")) return Response.json({ ok: false, code: "CURSOR_EXPIRED", error: "x", issues: [{ path: "cursor", code: "invalid" }] }, { status: 409 });
      if (call.path.endsWith("cursor=c2Vjb25k")) return Response.json({ ok: true, data: page(null, 0) });
      if (call.path.endsWith("cursor=eyJtIjoidyJ9")) return Response.json({ ok: true, data: page("c2Vjb25k", 1) });
      return Response.json({ ok: true, data: page("eyJtIjoidyJ9", 0) });
    },
  );
});

test("hints read the server's scope", () => {
  const scope = { mode: "backfill_scope" as const, today: "2026-10-01", cutoff_date: "2026-07-03", lookback_days: 90, include_upcoming_moves: true };
  assert.equal(enrollmentListHint("in_scope", scope), "Eligible and not on the desk yet: received in the last 90 days, or moving from today on.");
  assert.equal(enrollmentListHint("in_scope", { ...scope, include_upcoming_moves: false }), "Eligible and not on the desk yet: received in the last 90 days.");
  assert.equal(enrollmentListHint("older", scope), "Not enrolled — older than 90 days, with no upcoming move.");
  assert.equal(enrollmentListHint("review", scope), x.reviewHint);
});

test("one-click Enroll reports the one Lead in the owner-enroll cohort, then applies exactly that manifest", async () => {
  const now = new Date("2026-10-02T02:30:00.000Z"); // still Oct 1 in New York
  assert.equal(ownerEnrollCohortId(now), "owner-enroll-2026-10-01");
  const lead = syntheticEnrollmentCandidateItems("in_scope")[1]!.lead;
  await throughMock(async (calls) => {
    const error = await enrollOneLead(lead, now).catch((caught: unknown) => caught);
    const [report, apply] = calls;
    assert.equal(report!.method, "POST");
    assert.equal(report!.path, "enrollment/report");
    assert.deepEqual(report!.body, { selection: { mode: "selected", lead_refs: [lead] }, kind: "expansion", cohort_id: "owner-enroll-2026-10-01" });
    assert.match(report!.idempotencyKey ?? "", /^enroll-report-/);
    assert.equal(apply!.path, "enrollment/apply");
    assert.deepEqual(apply!.body, { kind: "expansion", cohort_id: "owner-enroll-2026-10-01", lead_refs: [lead], manifest_hash: "a".repeat(64) });
    assert.match(apply!.idempotencyKey ?? "", /^enroll-apply-/);
    // The mock's migration is paused: the refusal reads by code.
    assert.equal(enrollErrorText(error), x.migrationPaused);
  });
  // An older Lead enrolls the same way; a review Lead is not eligible and nothing is applied.
  await throughMock(async (calls) => {
    const reviewLead = syntheticEnrollmentCandidateItems("review")[0]!.lead;
    const error = await enrollOneLead(reviewLead, now).catch((caught: unknown) => caught);
    assert.ok(error instanceof EnrollNotEligibleError);
    assert.equal(enrollErrorText(error), x.notEligible);
    assert.deepEqual(calls.map((call) => call.path), ["enrollment/report"], "no apply after an empty report");
  });
  await throughMock(
    async (calls) => {
      const applied = await enrollOneLead(syntheticEnrollmentCandidateItems("older")[0]!.lead, now);
      assert.equal(applied.status, "completed");
      assert.equal(enrollOutcomeText(applied.status), "Enrolled — the lead is on the desk now.");
      assert.equal(calls.length, 2);
    },
    (call) =>
      call.path === "enrollment/apply"
        ? Response.json({
            ok: true,
            data: { contract_version: "sod-v1", mode: "apply", run_key: "k", status: "completed", activation_at: now.toISOString(), manifest_hash: "a".repeat(64), selected: 1, next_index: 1, batches_this_call: 1, counts: { enrolled: 1 }, pause_reason: null, replayed: false },
          })
        : null,
  );
});

test("apply statuses and refusals read in words, never the server's text", () => {
  for (const status of ["completed", "running", "paused", "lease_held", "failed", "something_new"]) {
    const text = enrollOutcomeText(status);
    assert.doesNotMatch(text, SNAKE, text);
    assert.notEqual(text, status);
    assert.match(text, /^[A-Z].*\.$/, text);
  }
  assert.equal(enrollOutcomeText("something_new"), x.enrolledOther);
  assert.equal(enrollErrorText(new SalesOutreachApiError(403, "FORBIDDEN", "server text")), deskCopy.errors.forbidden);
  assert.equal(enrollErrorText(new SalesOutreachApiError(500, "INTERNAL", "server text")), deskCopy.errors.failed(null));
});

test("admissions: the server example reads as counts, refusals by reason and the newest refusals, all in words", () => {
  const example = salesOutreachEnvelope(salesOutreachAdmissionsSchema).parse(JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "enrollment-admissions.owner.json"), "utf8"))).data;
  const { result: view, unknown } = collectUnknown(() => admissionsViewOf(example));
  assert.deepEqual(unknown, [], "every reason in the server example has copy");
  assert.deepEqual(
    view.tiles.map((tile) => [tile.label, tile.value]),
    [
      ["Added to the desk", 2],
      ["Added for review", 1],
      ["Added later (automatic admission)", 0],
      ["Waiting to be decided", 0],
      ["Not added", 3],
    ],
  );
  assert.deepEqual(
    view.byReason.map((row) => [row.text, row.count]),
    [
      ["Its priority closes it", 1],
      ["Marked as a duplicate lead", 1],
      ["The lead's source has no default schedule", 1],
    ],
  );
  assert.deepEqual(
    view.refusals.map((row) => [row.lead, row.reason]),
    [
      ["Form lead …183a06", "The lead's source has no default schedule"],
      ["Call lead …183a05", "Marked as a duplicate lead"],
      ["Form lead …183a04", "Its priority closes it"],
    ],
  );
  assert.equal(view.refusals[0]!.leadTitle, "6650a1b2c3d4e5f607183a06");
  assert.match(view.asOf, /Kept 14 days\.$/);
  for (const text of [...view.tiles.map((tile) => tile.label), ...view.byReason.map((row) => row.text), ...view.refusals.flatMap((row) => [row.lead, row.reason, row.when])]) {
    assert.doesNotMatch(text, SNAKE, text);
    assert.ok(!text.includes(":") || /\d:\d/.test(text), `no code prefix: ${text}`);
  }
});

test("admission reasons: every intake-gate code, closed:/excluded:/review: prefixes; unknown reads 'Another reason' and is reported", () => {
  const codes = [
    "intake_disabled",
    "created_before_intake",
    "received_before_intake",
    "historical_import",
    "policy_unavailable",
    "closed_priority",
    "unsupported_intake_source",
    "closed:official_booking",
    "closed:official_cancellation",
    "closed:bad_lead",
    "excluded:duplicate",
    "excluded:unmatched_booking_anchor",
    "review:legacy_closed_reopening_required",
    "review:number_only_unassociated",
    "unknown",
  ];
  const { result, unknown } = collectUnknown(() => codes.map((code) => admissionReasonText(code)));
  assert.deepEqual(unknown, []);
  for (const text of result) {
    assert.doesNotMatch(text, SNAKE, text);
    assert.match(text, /^[A-Z]/, text);
  }
  assert.equal(admissionReasonText("review:number_only_unassociated"), "Needs review first: phone number not linked to a lead");
  const odd = collectUnknown(() => [admissionReasonText("closed:something_else"), admissionReasonText("review:brand_new"), admissionReasonText(null)]);
  assert.deepEqual(odd.result, ["Another reason", "Another reason", "Another reason"]);
  assert.deepEqual(
    odd.unknown.map((event) => [event.kind, event.value]),
    [
      ["admission_reason", "closed:something_else"],
      ["admission_reason", "review:brand_new"],
      ["admission_reason", null],
    ],
  );
  // Two codes that read the same merge into one line.
  const merged = collectUnknown(() =>
    admissionsViewOf({
      contract_version: "sod-v1",
      business_day: "2026-10-01",
      as_of: "2026-10-01T16:00:00.000Z",
      timezone: "America/New_York",
      retention_days: 14,
      counts: { admitted_intake: 0, admitted_review: 0, admitted_expansion: 0, deferred: 0, not_admitted: { mystery_a: 2, mystery_b: 1, closed_priority: 1 } },
      recent_refusals: [],
    }),
  ).result;
  assert.deepEqual(merged.byReason.map((row) => [row.text, row.count]), [["Another reason", 3], ["Its priority closes it", 1]]);
});

test("admissions: today by default, a chosen day by business_day; retention and future-day refusals read by code", async () => {
  await throughMock(async (calls) => {
    const today = await readAdmissions(null);
    assert.equal(calls[0]!.path, "enrollment/admissions");
    assert.equal(today.business_day, "2026-10-01");
    assert.ok(admissionsViewOf(today).refusals.length > 0);
    const earlier = await readAdmissions("2026-09-25");
    assert.equal(calls[1]!.path, "enrollment/admissions?business_day=2026-09-25");
    assert.equal(admissionsViewOf(earlier).refusals.length, 0);
    const old = await readAdmissions("2026-09-17").catch((error: unknown) => error);
    assert.equal(admissionsErrorText(old, 14), "Only the last 14 days are kept. Choose a later day.");
    const future = await readAdmissions("2026-10-02").catch((error: unknown) => error);
    assert.equal(admissionsErrorText(future, 14), x.admissions.futureDay);
  });
  assert.equal(earliestAdmissionsDay("2026-10-01", 14), "2026-09-18");
  const example = JSON.parse(readFileSync(path.join(SERVER_FIXTURES, "error.admissions-retention-exceeded.json"), "utf8"));
  const refused = salesOutreachErrorFromBody(400, example, "READ_FAILED");
  const text = admissionsErrorText(refused, 14);
  assert.equal(text, "Only the last 14 days are kept. Choose a later day.");
  assert.ok(!text.includes("completed jobs"), "the server's message is not shown");
  assert.equal(admissionsErrorText(new SalesOutreachApiError(500, "INTERNAL", "server text"), 14), deskCopy.errors.failed(null));
});

test("the mock refuses enrollment admissions to a Manager, as the server does", () => {
  const refused = mockSalesOutreachResponse({ role: "manager", method: "GET", path: "enrollment/admissions" });
  assert.equal(refused.status, 403);
});

test("the lead panel says how the lead joined the desk; the cohort id never shows", () => {
  const at = "2026-09-28T17:10:00.000Z";
  const cases: Array<[{ cohort_id: string; kind: string }, string]> = [
    [{ cohort_id: "admission:2026-09-28", kind: "expansion" }, "Added automatically on Sep 28, when it became eligible (automatic admission is on)"],
    [{ cohort_id: "owner-enroll-2026-09-28", kind: "expansion" }, "Enrolled by the Owner on Sep 28"],
    [{ cohort_id: "owner-older-2026-09-28", kind: "expansion" }, "Enrolled by the Owner on Sep 28"],
    [{ cohort_id: "intake:2026-09-01T00:00:00Z", kind: "intake" }, "Added when it came in (Sep 28)"],
    [{ cohort_id: "p2-pilot", kind: "pilot" }, "Enrolled in the pilot on Sep 28"],
    [{ cohort_id: "backfill:2026-09-30", kind: "expansion" }, "Enrolled on Sep 28"],
  ];
  for (const [enrollment, expected] of cases) {
    const text = enrollmentSourceText({ ...enrollment, enrolled_at: at });
    assert.equal(text, expected);
    assert.ok(!text.includes(enrollment.cohort_id), text);
  }
  const admitted = syntheticDetail({ subjectId: syntheticSubjectId(SYNTHETIC_ADMITTED_ROW), role: "owner" })!;
  assert.match(enrollmentSourceText(admitted.subject.enrollment), /^Added automatically on Sep 28/);
});
