import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingCard } from "../components/bookings/booking-card";
import {
  agentShares,
  binderPill,
  bookingEvidence,
  bookingName,
  bookingSourceText,
  bookingStatus,
  caseFileRouteText,
  canRecordCancellation,
  matchRuleText,
  sheetSyncStatus,
} from "../components/bookings/booking-card-model";
import type { AdminRecord, SheetContainsItem } from "../lib/api/admin";
import { visibleDetailTabs } from "../components/operational/visible-detail-tabs";

const NOW = new Date("2026-10-10T20:00:00Z");

const active: AdminRecord = {
  _id: "507f1f77bcf86cd799439011",
  customer: { full_name: "Steve Dority" },
  customer_name: "S. Dority",
  job_no: "5562365",
  book_date: "2026-10-05T00:00:00.000Z",
  total_binder_amount: 1978.4,
  deposit_amount: 578,
  merchant: "Stripe",
  source: "10best Inbounds",
  over_2000: false,
  over_4000: false,
  is_referral_booking: false,
  is_leadless_booking: false,
  lead_model: "CallLead",
  lead_ref: { _id: "507f1f77bcf86cd799439099" },
  auto_match: { rule: "call_job_no_exact" },
  booking_origin: "employee_booking",
  sheet_sync: [{ status: "synced", target: "booked", tab_name: "Booked Deals" }],
  employee_source_snapshot: { source_company_label_snapshot: "10best Inbounds", source_granularity_label_snapshot: "Calls" },
  agent_allocations: [
    { agent_name_snapshot: "Austin", binder_amount: 1200 },
    { agent_name_snapshot: "Josh", binder_amount: 778.4 },
  ],
  case_file_summary: { origin: { city: "Tucson", state: "AZ" }, destination: { city: "Sterling", state: "VA" }, pickup: "2026-10-19T00:00:00.000Z" },
};

const cancelled: AdminRecord = {
  ...active,
  _id: "507f1f77bcf86cd799439012",
  customer: { full_name: "Maria Lopez" },
  over_2000: true,
  cancelled: { _id: "507f1f77bcf86cd799439013", cancel_date: "2026-10-09T00:00:00.000Z", refund_amount: 250, reason: "booked_with_competitor" },
  case_file_summary: undefined,
  agent_allocations: [{ agent_name_snapshot: "Austin", binder_amount: 2410 }],
};

const render = (item: AdminRecord, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(BookingCard, { item, now: NOW, ...props }));

test("name falls back customer.full_name → customer_name → snapshot", () => {
  assert.equal(bookingName(active), "Steve Dority");
  assert.equal(bookingName({ customer_name: "S. Dority" }), "S. Dority");
  assert.equal(bookingName({ customer_name_snapshot: "Snap" }), "Snap");
  assert.equal(bookingName({}), "Unnamed booking");
});

test("status pill: Active, or Cancelled with the short cancel date", () => {
  assert.deepEqual(bookingStatus(active, NOW), { label: "Active", variant: "green" });
  assert.deepEqual(bookingStatus(cancelled, NOW), { label: "Cancelled Oct 9", variant: "red" });
  assert.equal(bookingStatus({ cancelled: "abc" }, NOW).label, "Cancelled");
});

test("binder pill follows the server flags, then the amount", () => {
  assert.equal(binderPill({ over_4000: true, over_2000: true }), "Over $4k");
  assert.equal(binderPill({ over_2000: true, over_4000: false }), "Over $2k");
  assert.equal(binderPill({ over_2000: false, over_4000: false, total_binder_amount: 9000 }), null);
  assert.equal(binderPill({ total_binder_amount: 4500 }), "Over $4k");
  assert.equal(binderPill({ total_binder_amount: 2500 }), "Over $2k");
  assert.equal(binderPill({ total_binder_amount: 900 }), null);
});

test("source reads company › feed from the snapshot, else the stored label", () => {
  assert.equal(bookingSourceText({ ...active, employee_source_snapshot: { source_company_label_snapshot: "Top10 Forms", source_granularity_label_snapshot: "Top10 Forms (LD)" } }), "Top10 Forms › Top10 Forms (LD)");
  assert.equal(bookingSourceText({ source: "Top10 Inbounds" }), "Top10 Inbounds");
  assert.equal(bookingSourceText({ employee_source_snapshot: { source_company_label_snapshot: "X", source_granularity_label_snapshot: "X" }, source: "Y" }), "X");
});

test("agents carry their binder share and a lone agent field is the fallback", () => {
  assert.deepEqual(agentShares(active), [
    { name: "Austin", binder: 1200 },
    { name: "Josh", binder: 778.4 },
  ]);
  assert.deepEqual(agentShares({ agent: "Austin" }), [{ name: "Austin", binder: null }]);
  assert.deepEqual(agentShares({}), []);
});

test("route comes from case_file_summary and is null until it is captured", () => {
  assert.equal(caseFileRouteText(active, NOW), "Tucson, AZ → Sterling, VA · pickup Oct 19");
  assert.equal(caseFileRouteText(cancelled, NOW), null);
  assert.equal(caseFileRouteText({ case_file_summary: { origin: "Tucson, AZ", destination: "Sterling, VA" } }), "Tucson, AZ → Sterling, VA");
});

test("auto_match.rule reads in plain words", () => {
  assert.equal(matchRuleText("call_job_no_exact"), "Matched by job number");
  assert.equal(matchRuleText("form_job_no_exact"), "Matched by job number");
  assert.equal(matchRuleText("form_lid_exact"), "Matched by Granot LID");
  assert.equal(matchRuleText("form_contact_triple_exact"), "Matched by contact details");
  assert.equal(matchRuleText("form_email_phone_exact"), "Matched by contact details");
  assert.equal(matchRuleText("channel_phone_exact"), "Matched by phone");
  assert.equal(matchRuleText(undefined), null);
});

test("sheet sync: failed beats pending beats synced", () => {
  assert.equal(sheetSyncStatus({ sheet_sync: [{ status: "synced" }, { status: "pending" }] }), "pending");
  assert.equal(sheetSyncStatus({ sheet_sync: [{ status: "synced" }, { status: "failed" }] }), "failed");
  assert.equal(sheetSyncStatus({ sheet_sync: [{ status: "synced" }] }), "synced");
  assert.equal(sheetSyncStatus({ sheet_sync: [] }), null);
});

test("evidence: lead kind, match, sheet and booking form; Leadless and Referral replace the lead chip", () => {
  assert.deepEqual(
    bookingEvidence(active).map((chip) => chip.text),
    ["Lead attached · Call", "Matched by job number", "Master Booked · synced", "Employee booking form"],
  );
  assert.deepEqual(bookingEvidence({ is_leadless_booking: true }).map((chip) => chip.text), ["Leadless"]);
  assert.deepEqual(bookingEvidence({ is_referral_booking: true, is_leadless_booking: true }).map((chip) => chip.text), ["Referral"]);
  assert.equal(bookingEvidence({ ...active, auto_match: undefined }).some((chip) => chip.key === "match"), false);
});

test("Record cancellation is for an active, non-referral booking only", () => {
  assert.equal(canRecordCancellation(active), true);
  assert.equal(canRecordCancellation(cancelled), false);
  assert.equal(canRecordCancellation({ ...active, is_referral_booking: true }), false);
});

test("active booking card: green check, doc 03 zones and Record cancellation", () => {
  const html = render(active);
  assert.match(html, /crm-badge--green/);
  assert.match(html, /Steve Dority/);
  assert.match(html, />Active</);
  assert.match(html, /10best Inbounds › Calls/);
  assert.match(html, /Job 5562365/);
  assert.match(html, /Tucson, AZ → Sterling, VA · pickup Oct 19/);
  assert.match(html, /Booked Oct 5/);
  assert.match(html, /\$1,978\.40/);
  assert.match(html, /\$578\.00/);
  assert.match(html, />Merchant</);
  assert.match(html, /Stripe/);
  assert.match(html, /Austin/);
  assert.match(html, /\$1,200\.00/);
  assert.match(html, /\$778\.40/);
  assert.match(html, />split</);
  assert.match(html, /Lead attached · Call/);
  assert.match(html, /Matched by job number/);
  assert.match(html, /Master Booked · synced/);
  assert.match(html, /Employee booking form/);
  assert.match(html, /href="\/cancellations\/new\?booked_lead=507f1f77bcf86cd799439011"/);
  assert.doesNotMatch(html, /View cancellation/);
});

test("cancelled booking card: red cross, Refund replaces Merchant, no route yet, View cancellation, no Record button", () => {
  const html = render(cancelled);
  assert.match(html, /crm-badge--red/);
  assert.match(html, /Cancelled Oct 9/);
  assert.match(html, /Over \$2k/);
  assert.match(html, />Refund</);
  assert.match(html, /\$250\.00/);
  assert.doesNotMatch(html, />Merchant</);
  assert.match(html, /Route not captured yet/);
  assert.match(html, /View cancellation/);
  assert.doesNotMatch(html, /Record cancellation/);
});

test("a verdict becomes a Master Booked chip and select mode shows the checkbox", () => {
  const verdict: SheetContainsItem = {
    id: "x",
    entity_model: "BookedLead",
    label: "Booking",
    verdict: "found",
    expected_tabs: ["Booked Deals"],
    missing_expected_tabs: [],
    found: [{ workbook: "Master Booked", workbook_key: "k", spreadsheet_id: "s", target: "t", role: "expected", evidence: [], tab_name: "Booked Deals", row_number: 812 }],
    sheet_sync_hint: [],
  };
  const html = render(active, { verdict, selectMode: true, selected: true });
  assert.match(html, /Booked Deals row 812/);
  assert.match(html, /crm-record__check/);
  assert.match(html, /aria-label="Select Steve Dority"/);
});

test("a cancelled booking's panel gains the Cancellation tab; an active one does not", () => {
  const ctx = { readOnly: false, canDelete: false, productionEditAllowed: true };
  assert.deepEqual(visibleDetailTabs("bookings", cancelled, ctx), ["summary", "contact", "cancellation", "actions", "production", "source"]);
  assert.deepEqual(visibleDetailTabs("bookings", active, ctx), ["summary", "contact", "actions", "production", "source"]);
  assert.deepEqual(visibleDetailTabs("cancellations", cancelled, ctx), ["summary", "contact", "production", "source"]);
});
