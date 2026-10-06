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
  enrollmentRequestAfter,
  enrollmentRowsOf,
  enrollmentScanOf,
  enrollmentStoppedText,
  enrollOneLead,
  enrollOutcomeText,
  ENROLLMENT_AUTO_PAGES,
  ENROLLMENT_FIRST_REQUEST,
  ENROLLMENT_LISTS,
  nextEnrollmentCursor,
  ownerEnrollCohortId,
  readAdmissions,
  readEnrollmentPage,
  withoutEnrolledLead,
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
import {
  SYNTHETIC_ADMITTED_ROW,
  syntheticDetail,
  syntheticEnrollmentCandidateItems,
  syntheticEnrollmentCandidates,
  syntheticEnrollmentReport,
  syntheticSubjectId,
} from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-4: the Owner's enrollment lists ("Ready to enroll" = `in_scope`, "Older", read-only "Needs
 * review"), Load more over the opaque `next_cursor`, one-click Enroll in the `owner-enroll-<date>` cohort, the
 * `admission:` cohort in the lead panel and the day's new-lead intake (`GET /enrollment/admissions`, server B8).
 * Server codes never show: every reason and status reads in words.
 */

const SERVER_FIXTURES = path.join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const SNAKE = /\b[a-z]+_[a-z_]+\b/;
const x = deskCopy.settingsExtra;

/** An empty candidates page (no rows, no cursor) in the server's shape; tests set `next_cursor` and `scanned`. */
function syntheticEmptyPage(): SalesOutreachEnrollmentCandidatesDto {
  return { ...syntheticEnrollmentCandidates("in_scope"), items: [], next_cursor: null, scanned: 0 };
}

/** Today's intake as the desk mock serves it to the Owner. */
function mockAdmissionsToday() {
  const response = mockSalesOutreachResponse({ role: "owner", method: "GET", path: "enrollment/admissions" });
  return salesOutreachEnvelope(salesOutreachAdmissionsSchema).parse(response.body).data;
}

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

test("a page with no rows but a cursor is not the end: keep looking (bounded), and say 'none' only when the server is done", () => {
  // The server checks at most 1,000 Leads a page (CANDIDATE_SCAN_BUDGET), so an empty page can carry a cursor.
  const empty = (cursor: string | null): SalesOutreachEnrollmentCandidatesDto => ({ ...syntheticEmptyPage(), next_cursor: cursor, scanned: 1000 });
  const withRows = (cursor: string | null): SalesOutreachEnrollmentCandidatesDto => ({
    ...syntheticEmptyPage(),
    items: syntheticEnrollmentCandidateItems("in_scope").slice(0, 3),
    next_cursor: cursor,
    scanned: 1000,
  });
  const scanOf = (pages: SalesOutreachEnrollmentCandidatesDto[], request = ENROLLMENT_FIRST_REQUEST) => enrollmentScanOf(pages, enrollmentRowsOf(pages).length, request);

  // Page one empty with a cursor: keep looking; the empty text is not shown yet.
  assert.deepEqual(scanOf([empty("c1")]), { found: false, keepLooking: true, stoppedEmpty: false, scanned: 1000, scannedTotal: 1000 });
  // An empty page followed by one with rows: the rows show and looking stops.
  assert.equal(scanOf([empty("c1"), withRows("c2")]).keepLooking, false);
  assert.equal(scanOf([empty("c1"), withRows("c2")]).stoppedEmpty, false);
  // The bound: after ENROLLMENT_AUTO_PAGES empty pages the list stops and says how many leads were checked.
  const bound = Array.from({ length: ENROLLMENT_AUTO_PAGES }, (_, index) => empty(`c${index + 1}`));
  const stopped = scanOf(bound);
  assert.deepEqual(stopped, { found: false, keepLooking: false, stoppedEmpty: true, scanned: 10_000, scannedTotal: 10_000 });
  assert.equal(enrollmentStoppedText(0, stopped), "None found in the first 10,000 leads checked. Load more to keep looking.");
  assert.equal(scanOf(bound.slice(0, ENROLLMENT_AUTO_PAGES - 1)).keepLooking, true);
  // Load more after the bound starts a new bounded request; the note counts every lead checked so far.
  const more = scanOf([...bound, empty("c11")], { rowsBefore: 0, fromPage: ENROLLMENT_AUTO_PAGES });
  assert.deepEqual(more, { found: false, keepLooking: true, stoppedEmpty: false, scanned: 1000, scannedTotal: 11_000 });
  // The server is done (next_cursor null): neither looking nor stopped, so the plain empty text shows.
  assert.deepEqual(scanOf([empty("c1"), empty(null)]), { found: false, keepLooking: false, stoppedEmpty: false, scanned: 2000, scannedTotal: 2000 });
  assert.equal(enrollmentEmptyText("in_scope"), "No leads are waiting to be enrolled.");
  // Rows on screen, Load more brings only empty pages: keep looking, then "No more found in the next ...".
  const after = { rowsBefore: 3, fromPage: 1 };
  assert.equal(scanOf([withRows("c1"), empty("c2")], after).keepLooking, true);
  const tail = [withRows("c1"), ...Array.from({ length: ENROLLMENT_AUTO_PAGES }, (_, index) => empty(`d${index}`))];
  const tailScan = scanOf(tail, after);
  assert.equal(tailScan.stoppedEmpty, true);
  assert.equal(enrollmentStoppedText(3, tailScan), "No more found in the next 10,000 leads checked. Load more to keep looking.");
  // Rows found by the first page never trigger looking on their own (Load more stays the Owner's choice).
  assert.equal(scanOf([withRows("c1")]).keepLooking, false);
  // The list was reloaded from the top under an old request: the request counts from page one again.
  assert.equal(scanOf([empty("c1")], { rowsBefore: 3, fromPage: 4 }).keepLooking, true);
});

test("after an Enroll the list does not page on its own: a request that found rows stays done, and the row leaves the cache", () => {
  const page = (items: SalesOutreachEnrollmentCandidatesDto["items"], cursor: string | null): SalesOutreachEnrollmentCandidatesDto => ({
    ...syntheticEnrollmentCandidates("in_scope"),
    items,
    next_cursor: cursor,
    scanned: 1000,
  });
  const items = syntheticEnrollmentCandidateItems("in_scope");
  // Page 1: 3 rows and a cursor; the Owner's Load more brings page 2 with 2 more rows (5 shown).
  const p1 = page(items.slice(0, 3), "c2");
  const p2 = page([{ ...items[0]!, lead: { ...items[0]!.lead, id: "a".repeat(24) } }, { ...items[1]!, lead: { ...items[1]!.lead, id: "b".repeat(24) } }], "c3");
  let request = { rowsBefore: 3, fromPage: 1 };
  let scan = enrollmentScanOf([p1, p2], 5, request);
  assert.equal(scan.found, true);
  assert.equal(scan.keepLooking, false);
  const settled = enrollmentRequestAfter(request, scan, 2);
  assert.deepEqual(settled, { rowsBefore: 3, fromPage: 1, found: true });
  assert.equal(enrollmentRequestAfter(settled, enrollmentScanOf([p1, p2], 5, settled), 2), settled, "no change, same object");
  // The Owner enrolls the two rows page 2 brought: they leave the cache, the row count drops under rowsBefore …
  let data: { pages: SalesOutreachEnrollmentCandidatesDto[]; pageParams: (string | null)[] } | undefined = { pages: [p1, p2], pageParams: [null, "c2"] };
  data = withoutEnrolledLead(data, p2.items[0]!.lead);
  data = withoutEnrolledLead(data, { ...p2.items[1]!.lead, id: p2.items[1]!.lead.id.toUpperCase() });
  assert.deepEqual(data!.pages.map((one) => one.items.length), [3, 0]);
  assert.deepEqual(data!.pageParams, [null, "c2"]);
  assert.equal(withoutEnrolledLead(undefined, p1.items[0]!.lead), undefined);
  const rows = enrollmentRowsOf(data!.pages).length;
  assert.equal(rows, 3);
  // … but the request that found them stays done: no paging on its own, no "No more found" note.
  scan = enrollmentScanOf(data!.pages, rows, settled);
  assert.deepEqual([scan.found, scan.keepLooking, scan.stoppedEmpty], [true, false, false]);
  // Without the sticky mark (the defect), the same pages would page on their own.
  assert.equal(enrollmentScanOf(data!.pages, rows, request).keepLooking, true);
  // A request that stopped at the bound with nothing found keeps its note after an Enroll of an earlier row.
  const bound = [p1, ...Array.from({ length: ENROLLMENT_AUTO_PAGES }, (_, index) => page([], `e${index}`))];
  request = { rowsBefore: 3, fromPage: 1 };
  const before = enrollmentScanOf(bound, 3, request);
  assert.equal(before.stoppedEmpty, true);
  assert.equal(enrollmentRequestAfter(request, before, bound.length), request);
  const afterEnroll = enrollmentScanOf(bound, 2, request);
  assert.deepEqual([afterEnroll.keepLooking, afterEnroll.stoppedEmpty], [false, true]);
  // Pages dropped under a sticky request (a reset): read as the first request again.
  assert.equal(enrollmentScanOf([page([], "c2")], 0, { rowsBefore: 3, fromPage: 4, found: true }).keepLooking, true);
  assert.equal(enrollmentRequestAfter({ rowsBefore: 3, fromPage: 4 }, { found: true }, 1).found, undefined);
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
    "closed:granot_booked",
    "closed:crm_bad_disposition",
    "closed:crm_dead_disposition",
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

test("automatic-admission refusals (olr B6 expansion:*) read in words, apart from intake refusals", () => {
  const cases: Array<[string, string]> = [
    ["expansion:admission_disabled", "Automatic admission — automatic admission was off"],
    ["expansion:migration_paused", "Automatic admission — enrollment is paused in the configuration"],
    ["expansion:policy_unavailable", "Automatic admission — the schedule policy isn't set up"],
    ["expansion:older:outside_backfill_scope", "Automatic admission — outside the backfill window"],
    ["expansion:review:received_time_unreliable", "Automatic admission — needs review first: the time this lead came in isn't reliable"],
    ["expansion:review:received_time_missing", "Automatic admission — needs review first: the time this lead came in is missing"],
    ["expansion:review:ambiguous_identity", "Automatic admission — needs review first: identity ambiguous — another lead has this Job Number"],
    ["expansion:review:unmapped_priority", "Automatic admission — needs review first: this priority code has no schedule set up"],
    ["expansion:review:legacy_closed_reopening_required", "Automatic admission — needs review first: closed in the old Outreach; reopening needs a decision"],
    ["expansion:closed:official_booking", "Automatic admission — already booked"],
    ["expansion:closed:official_cancellation", "Automatic admission — already cancelled"],
    ["expansion:closed:bad_lead", "Automatic admission — marked as a bad lead"],
    ["expansion:closed:closed_priority", "Automatic admission — its priority closes it"],
    // Priority-map closures (closure_reason for codes 5, 7, 8): the classifier returns closed:<closure_reason>.
    ["expansion:closed:granot_booked", "Automatic admission — booked in Granot"],
    ["expansion:closed:crm_bad_disposition", "Automatic admission — marked a bad lead in Granot"],
    ["expansion:closed:crm_dead_disposition", "Automatic admission — marked a dead lead in Granot"],
    ["expansion:excluded:duplicate", "Automatic admission — marked as a duplicate lead"],
    ["expansion:excluded:unmatched_booking_anchor", "Automatic admission — created from a booking that matched no lead"],
    ["expansion:not_new_or_quoted:priority_discretion", "Automatic admission — its priority leaves follow-up to the rep"],
    ["expansion:already_enrolled:subject_exists", "Automatic admission — already on the desk"],
  ];
  const { result, unknown } = collectUnknown(() => cases.map(([code]) => admissionReasonText(code)));
  assert.deepEqual(unknown, [], "every expansion refusal has copy");
  assert.deepEqual(result, cases.map(([, text]) => text));
  for (const text of result) {
    assert.doesNotMatch(text, SNAKE, text);
    assert.ok(!text.includes("expansion"), text);
  }
  // Every closure the priority map can carry reads in words, at intake and in automatic admission, and never as
  // "Another reason" (the server's priority map: granot_booked, crm_bad_disposition, crm_dead_disposition).
  const closures = Object.keys(deskCopy.configEditor.priorityMap.closures);
  assert.deepEqual(closures.sort(), ["crm_bad_disposition", "crm_dead_disposition", "granot_booked"]);
  const closed = collectUnknown(() => closures.flatMap((code) => [admissionReasonText(`closed:${code}`), admissionReasonText(`expansion:closed:${code}`)]));
  assert.deepEqual(closed.unknown, []);
  assert.ok(closed.result.every((text) => text !== "Another reason" && !SNAKE.test(text)), closed.result.join(" | "));
  assert.equal(admissionReasonText("closed:granot_booked"), "Booked in Granot");
  // A booked-in-Granot refusal from automatic admission groups on its own line, apart from unknown refusals.
  const booked = collectUnknown(() =>
    admissionsViewOf({
      ...mockAdmissionsToday(),
      counts: { admitted_intake: 0, admitted_review: 0, admitted_expansion: 0, deferred: 0, not_admitted: { "expansion:closed:granot_booked": 4, mystery: 1 } },
      recent_refusals: [],
    }),
  );
  assert.deepEqual(booked.result.byReason.map((row) => [row.text, row.count]), [["Automatic admission — booked in Granot", 4], ["Another reason", 1]]);
  // An expansion refusal never reads the same as the intake refusal of the same cause, so the counts stay apart.
  assert.notEqual(admissionReasonText("expansion:closed:official_booking"), admissionReasonText("closed:official_booking"));
  const odd = collectUnknown(() => [admissionReasonText("expansion:older:brand_new"), admissionReasonText("expansion:"), admissionReasonText("expansion:review:brand_new")]);
  assert.deepEqual(odd.result, ["Another reason", "Another reason", "Another reason"]);
  assert.deepEqual(
    odd.unknown.map((event) => event.value),
    ["expansion:older:brand_new", "expansion:", "expansion:review:brand_new"],
  );
  // The mock's intake day carries one; it groups on its own line.
  const view = collectUnknown(() => admissionsViewOf(mockAdmissionsToday()));
  assert.deepEqual(view.unknown, []);
  assert.ok(view.result.byReason.some((row) => row.text === "Automatic admission — outside the backfill window" && row.count === 1));
  assert.ok(view.result.refusals.some((row) => row.reason === "Automatic admission — outside the backfill window"));
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
    [{ cohort_id: "admission:2026-09-28", kind: "expansion" }, "Added automatically on Sep 28, when it became eligible (automatic admission)"],
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
