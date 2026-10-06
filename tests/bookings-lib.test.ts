import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKINGS_PAGE_SIZE,
  bookingClientNarrowing,
  bookingListFilters,
  cancellationClientNarrowing,
  cancellationListFilters,
  daysBetween,
  formatCalendarDay,
  matchesBookingType,
  matchesCancellationRefund,
  readListTotals,
  type BookingFilterState,
  type CancellationFilterState,
} from "../lib/api/bookings";
import { bookingPickerFilters } from "../components/cancellations/booking-picker";
import { buildCancellationPayload, defaultRecordedBy, reviewLine } from "../components/cancellations/record-cancellation-model";

const base: BookingFilterState = {
  q: null,
  status: "active",
  source: null,
  agent: null,
  merchant: null,
  from: null,
  to: null,
  type: "any",
  local: null,
  binder: "any",
  sort: "book_desc",
};

const cancelBase: CancellationFilterState = {
  q: null,
  reason: null,
  source: null,
  agent: null,
  merchant: null,
  from: null,
  to: null,
  refund: "any",
  by: null,
  sort: "cancel_desc",
};

test("default bookings filters: active, newest first, 50 per page", () => {
  assert.deepEqual(bookingListFilters(base), { limit: BOOKINGS_PAGE_SIZE, sort: "book_date", direction: "desc", cancelled: false });
});

test("status maps to the cancelled flag and All sends no key", () => {
  assert.equal(bookingListFilters({ ...base, status: "cancelled" }).cancelled, true);
  assert.equal("cancelled" in bookingListFilters({ ...base, status: "all" }), false);
});

test("bookings sorts", () => {
  assert.deepEqual(
    [bookingListFilters({ ...base, sort: "book_asc" }).direction, bookingListFilters({ ...base, sort: "binder_desc" }).sort],
    ["asc", "total_binder_amount"],
  );
});

test("source, agent, merchant, local and binder map to their server keys", () => {
  const filters = bookingListFilters({ ...base, source: "Top10 Inbounds", agent: "Austin", merchant: "Stripe", local: "local", binder: "4k" });
  assert.equal(filters.source, "Top10 Inbounds");
  assert.equal(filters.agent, "Austin");
  assert.equal(filters.merchant, "Stripe");
  assert.equal(filters.local, "local");
  assert.equal(filters.binder_min, 4000);
  assert.equal(bookingListFilters({ ...base, binder: "2k" }).binder_min, 2000);
});

test("the book date range sends date_field and ends on the last instant of the day", () => {
  const filters = bookingListFilters({ ...base, from: "2026-10-01", to: "2026-10-05" });
  assert.equal(filters.date_field, "book_date");
  assert.equal(filters.from, "2026-10-01");
  assert.equal(filters.to, "2026-10-05T23:59:59.999Z");
  assert.equal("date_field" in bookingListFilters(base), false);
});

test("booking type: leadless is a server filter, Referral narrows the loaded cards", () => {
  assert.equal(bookingListFilters({ ...base, type: "leadless" }).leadless, true);
  assert.equal(bookingListFilters({ ...base, type: "lead" }).leadless, false);
  assert.equal("leadless" in bookingListFilters({ ...base, type: "referral" }), false);
  assert.equal(bookingClientNarrowing({ ...base, type: "referral" }), true);
  assert.equal(bookingClientNarrowing({ ...base, type: "leadless" }), false);
  assert.equal(matchesBookingType({ is_referral_booking: true }, "referral"), true);
  assert.equal(matchesBookingType({ is_referral_booking: false }, "referral"), false);
  assert.equal(matchesBookingType({ is_referral_booking: true }, "lead"), false);
  assert.equal(matchesBookingType({}, "lead"), true);
  assert.equal(matchesBookingType({ is_referral_booking: true }, "any"), true);
});

test("search: a job number sends job_no, anything else sends q", () => {
  assert.equal(bookingListFilters({ ...base, q: "P5562365" }).job_no, "5562365");
  assert.equal("q" in bookingListFilters({ ...base, q: "5562365" }), false);
  assert.equal(bookingListFilters({ ...base, q: "Steve Dority" }).q, "Steve Dority");
  // The server has no phone or email field on bookings: those still go through q (server work).
  assert.equal(bookingListFilters({ ...base, q: "(281) 900-1836" }).q, "(281) 900-1836");
  assert.equal(bookingListFilters({ ...base, q: "a@b.com" }).q, "a@b.com");
});

test("cancellation filters: default, sorts, reason, by and refund", () => {
  assert.deepEqual(cancellationListFilters(cancelBase), { limit: BOOKINGS_PAGE_SIZE, sort: "cancel_date", direction: "desc" });
  assert.deepEqual(
    [cancellationListFilters({ ...cancelBase, sort: "cancel_asc" }).direction, cancellationListFilters({ ...cancelBase, sort: "refund_desc" }).sort],
    ["asc", "refund_amount"],
  );
  const filters = cancellationListFilters({ ...cancelBase, reason: "price_too_high", by: "Rusty", agent: "Austin", merchant: "Stripe", source: "Top10", from: "2026-09-01", to: "2026-10-01", refund: "yes" });
  assert.equal(filters.reason, "price_too_high");
  assert.equal(filters.cancelled_by, "Rusty");
  assert.equal(filters.refund_min, 0.01);
  assert.equal(filters.date_field, "cancel_date");
  assert.equal(filters.to, "2026-10-01T23:59:59.999Z");
});

test("No refund narrows the loaded cancellations in the browser", () => {
  assert.equal("refund_min" in cancellationListFilters({ ...cancelBase, refund: "no" }), false);
  assert.equal(cancellationClientNarrowing({ ...cancelBase, refund: "no" }), true);
  assert.equal(cancellationClientNarrowing({ ...cancelBase, refund: "yes" }), false);
  assert.equal(matchesCancellationRefund({ refund_amount: 0 }, "no"), true);
  assert.equal(matchesCancellationRefund({ refund_amount: 250 }, "no"), false);
  assert.equal(matchesCancellationRefund({ refund_amount: 250 }, "any"), true);
});

test("list totals read the server's totals object and never sum the loaded page", () => {
  assert.deepEqual(readListTotals({ total: 120 }), { count: 120, binder: null, deposit: null, refund: null, cancelled: null });
  const page = { total: 120, totals: { total_binder_amount: 250000, total_deposit_amount: 70000, total_refund_amount: 1200, cancelled_count: 9 } } as { total: number };
  assert.deepEqual(readListTotals(page), { count: 120, binder: 250000, deposit: 70000, refund: 1200, cancelled: 9 });
  assert.deepEqual(readListTotals(undefined), { count: null, binder: null, deposit: null, refund: null, cancelled: null });
});

test("stored calendar dates show in UTC and the days between never go negative", () => {
  assert.equal(formatCalendarDay("2026-10-09T00:00:00.000Z", new Date("2026-10-20T12:00:00Z")), "Oct 9");
  assert.equal(formatCalendarDay("2025-10-09T00:00:00.000Z", new Date("2026-10-20T12:00:00Z")), "Oct 9, 2025");
  assert.equal(formatCalendarDay(null), null);
  assert.equal(daysBetween("2026-09-28T00:00:00Z", "2026-10-09T00:00:00Z"), 11);
  assert.equal(daysBetween("2026-10-09T00:00:00Z", "2026-10-09T00:00:00Z"), 0);
  assert.equal(daysBetween("2026-10-09T00:00:00Z", "2026-09-28T00:00:00Z"), 0);
  assert.equal(daysBetween(undefined, "2026-09-28T00:00:00Z"), null);
});

test("the booking picker lists active bookings, ten at a time, with the same search classifier", () => {
  assert.deepEqual(bookingPickerFilters(null), { cancelled: false, limit: 10, page: 1, sort: "book_date", direction: "desc" });
  assert.equal(bookingPickerFilters("5562365").job_no, "5562365");
  assert.equal(bookingPickerFilters("Dority").q, "Dority");
});

test("the cancellation payload matches the retired form's body for a booking-selected cancellation", () => {
  const built = buildCancellationPayload({ bookingId: "b1", cancelDate: "2026-10-09", refund: "$250.00", reason: "booked_with_competitor", by: "Rusty", notes: "  found cheaper  " });
  assert.deepEqual(built, {
    ok: true,
    payload: { booked_lead: "b1", cancel_date: "2026-10-09", refund_amount: 250, reason: "booked_with_competitor", cancelled_by: "Rusty", notes: "found cheaper" },
  });
  assert.equal(buildCancellationPayload({ bookingId: "b1", cancelDate: "", refund: "0", reason: "other", by: "", notes: "" }).ok, true);
  const empty = buildCancellationPayload({ bookingId: "b1", cancelDate: "", refund: "0", reason: "other", by: "", notes: "" });
  assert.equal(empty.ok && empty.payload.cancel_date, undefined);
  assert.equal(buildCancellationPayload({ bookingId: "b1", cancelDate: "", refund: "", reason: "other", by: "", notes: "" }).ok, false);
  assert.equal(buildCancellationPayload({ bookingId: "b1", cancelDate: "", refund: "abc", reason: "other", by: "", notes: "" }).ok, false);
  assert.equal(buildCancellationPayload({ bookingId: "b1", cancelDate: "", refund: "10", reason: "", by: "", notes: "" }).ok, false);
});

test("the review line and the Recorded by default", () => {
  assert.equal(reviewLine({ refund: "250", reason: "booked_with_competitor" }), "Cancellation · $250.00 refund · Booked with competitor");
  assert.equal(reviewLine({ refund: "", reason: "" }), "Cancellation · — refund · no reason chosen yet");
  assert.equal(defaultRecordedBy("rusty@vantagemovers.com", ["Austin", "Rusty"]), "Rusty");
  assert.equal(defaultRecordedBy("Rusty.Smith@x.com", ["Austin", "Rusty"]), "Rusty");
  assert.equal(defaultRecordedBy("owner@x.com", ["Austin", "Rusty"]), "");
  assert.equal(defaultRecordedBy(null, ["Rusty"]), "");
});
