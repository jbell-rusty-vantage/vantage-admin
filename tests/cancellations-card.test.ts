import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CancellationCard } from "../components/cancellations/cancellation-card";
import {
  bookingPanelHref,
  cancellationJob,
  cancellationLead,
  cancellationName,
  cancellationSourceText,
  datesText,
  isQuietSinceAugust,
  notesFirstLine,
  topReason,
} from "../components/cancellations/cancellation-card-model";
import { CANCELLATION_REASON_LABELS, reasonLabel } from "../components/cancellations/cancellations-copy";
import { CANCELLATION_REASONS } from "../lib/constants/domain";
import type { AdminRecord } from "../lib/api/admin";

const NOW = new Date("2026-10-20T20:00:00Z");

const cancellation: AdminRecord = {
  _id: "507f1f77bcf86cd799439021",
  customer_name: "Maria Lopez",
  job_no: "5561200",
  job_no_snapshot: "5561200",
  reason: "booked_with_competitor",
  source: "Top10 Forms",
  agent: "Austin",
  merchant: "Stripe",
  cancelled_by: "Rusty",
  book_date: "2026-09-28T00:00:00.000Z",
  cancel_date: "2026-10-09T00:00:00.000Z",
  refund_amount: 250,
  notes: "Customer found a cheaper local mover and asked for the deposit back.\nSecond line.",
  lead_model: "FormLead",
  lead_ref: { _id: "507f1f77bcf86cd799439031" },
  sheet_sync: [{ status: "pending" }],
  booked_lead: {
    _id: "507f1f77bcf86cd799439041",
    deposit_amount: 578,
    total_binder_amount: 2410,
    employee_source_snapshot: { source_company_label_snapshot: "Top10 Forms", source_granularity_label_snapshot: "Forms (LD)" },
  },
};

const render = (item: AdminRecord, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(CancellationCard, { item, now: NOW, ...props }));

test("every stored reason has an Owner label; an unknown one shows as stored", () => {
  for (const reason of CANCELLATION_REASONS) assert.ok(CANCELLATION_REASON_LABELS[reason], reason);
  assert.equal(reasonLabel("price_too_high"), "Price too high");
  assert.equal(reasonLabel("legacy_reason"), "legacy_reason");
  assert.equal(reasonLabel(""), null);
});

test("name, job and source fall back through the booking", () => {
  assert.equal(cancellationName(cancellation), "Maria Lopez");
  assert.equal(cancellationName({ customer: { full_name: "C" } }), "C");
  assert.equal(cancellationName({ booked_lead: { customer_name: "B" } }), "B");
  assert.equal(cancellationJob({ job_no: "1", booked_lead: { job_no: "2" } }), "1");
  assert.equal(cancellationJob({ job_no_snapshot: "9", job_no: "1" }), "9");
  assert.equal(cancellationJob({ booked_lead: { job_no: "2" } }), "2");
  assert.equal(cancellationSourceText(cancellation), "Top10 Forms › Forms (LD)");
  assert.equal(cancellationSourceText({ source: "Top10 Forms" }), "Top10 Forms");
});

test("dates read booked → cancelled with the days between", () => {
  assert.equal(datesText(cancellation, NOW), "booked Sep 28 → cancelled Oct 9 · 11 days");
  assert.equal(datesText({ ...cancellation, book_date: "2026-10-08T00:00:00Z" }, NOW), "booked Oct 8 → cancelled Oct 9 · 1 day");
  assert.equal(datesText({ cancel_date: "2026-10-09T00:00:00Z" }, NOW), "cancelled Oct 9");
  assert.equal(datesText({ ...cancellation, book_date: undefined, booked_lead: { book_date: "2026-10-01T00:00:00Z" } }, NOW), "booked Oct 1 → cancelled Oct 9 · 8 days");
});

test("notes show the first line, the full text for the hover", () => {
  const notes = notesFirstLine(cancellation);
  assert.equal(notes?.first, "Customer found a cheaper local mover and asked for the deposit back.");
  assert.match(notes?.full ?? "", /Second line/);
  assert.equal(notesFirstLine({}), null);
});

test("the lead link uses the live lead, else the snapshot taken at cancel time", () => {
  assert.deepEqual(cancellationLead(cancellation), { kind: "form", id: "507f1f77bcf86cd799439031" });
  assert.deepEqual(cancellationLead({ lead_ref_snapshot: { model: "CallLead", id: "abc" } }), { kind: "call", id: "abc" });
  assert.equal(cancellationLead({}), null);
});

test("top reason counts the loaded rows", () => {
  assert.deepEqual(topReason([{ reason: "other" }, { reason: "price_too_high" }, { reason: "price_too_high" }]), { reason: "price_too_high", count: 2 });
  assert.equal(topReason([{}]), null);
});

test("the Aug 2026 quiet message: empty without filters, or a newest row before 2026-08-01", () => {
  const newestFirst = { filtered: false, newestFirst: true };
  assert.equal(isQuietSinceAugust([], newestFirst), true);
  assert.equal(isQuietSinceAugust([{ cancel_date: "2026-07-30T00:00:00Z" }], newestFirst), true);
  assert.equal(isQuietSinceAugust([{ cancel_date: "2026-08-01T00:00:00Z" }], newestFirst), false);
  assert.equal(isQuietSinceAugust([{ cancel_date: "2026-10-09T00:00:00Z" }], newestFirst), false);
  // With a filter the ordinary empty state applies, and another sort cannot know the newest row.
  assert.equal(isQuietSinceAugust([], { filtered: true, newestFirst: true }), false);
  assert.equal(isQuietSinceAugust([{ cancel_date: "2026-07-30T00:00:00Z" }], { filtered: false, newestFirst: false }), false);
});

test("cancellation card: red cross and the doc 03 zones", () => {
  const html = render(cancellation);
  assert.match(html, /crm-badge--red/);
  assert.match(html, /Maria Lopez/);
  assert.match(html, />Booked with competitor</);
  assert.match(html, /Top10 Forms › Forms \(LD\)/);
  assert.match(html, /Job 5561200/);
  assert.match(html, /booked Sep 28 → cancelled Oct 9 · 11 days/);
  assert.match(html, /Austin/);
  assert.match(html, />Refund</);
  assert.match(html, /\$250\.00/);
  assert.match(html, /\$578\.00/);
  assert.match(html, /\$2,410\.00/);
  assert.match(html, /Stripe · recorded by Rusty/);
  assert.match(html, /title="Customer found a cheaper local mover and asked for the deposit back\.\nSecond line\."/);
  assert.match(html, /Master Cancelled · pending/);
  assert.match(html, /href="\/bookings\?record=507f1f77bcf86cd799439041&amp;panel=cancellation"/);
  assert.match(html, /href="\/leads\?lead=507f1f77bcf86cd799439031&amp;lk=form"/);
});

test("the card click goes to the booking's Cancellation tab, else the cancellations panel", () => {
  assert.equal(bookingPanelHref("b1"), "/bookings?record=b1&panel=cancellation");
  const calls: string[] = [];
  // Rendering is static, so exercise the handlers through the pure rule the card uses.
  const withBooking = cancellation.booked_lead as { _id: string } | undefined;
  assert.ok(withBooking?._id);
  calls.push(bookingPanelHref(withBooking._id));
  assert.deepEqual(calls, ["/bookings?record=507f1f77bcf86cd799439041&panel=cancellation"]);
  // Without a populated booking there is no Booking link: the fallback panel is the only way in.
  const html = render({ ...cancellation, booked_lead: undefined });
  assert.doesNotMatch(html, /Booking ›/);
  assert.match(html, /\$250\.00/);
});
