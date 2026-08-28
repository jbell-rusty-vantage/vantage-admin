import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BOOKINGS_CONNECT_COPY } from "../components/bookings/bookings-copy";
import {
  canConnectBookingToLead,
  isLeadlessNonReferralBooking,
  storedLeadChip,
} from "../components/bookings/booking-stored-lead";
import { StoredLeadChip } from "../components/bookings/booking-stored-lead-section";
import type { AdminRecord } from "../lib/api/admin";

const forbidden = [
  "ingested_contact_snapshot",
  "granot_contact_snapshot",
  "differs_from_ingested",
  "is_leadless_booking",
  "lead_ref",
  "synced to the sheet",
  "already updated",
];

test("Bookings Connect copy uses owner words and never claims the sheet already updated", () => {
  const blob = JSON.stringify(BOOKINGS_CONNECT_COPY);
  for (const word of forbidden) {
    assert.equal(blob.includes(word), false, word);
  }
  assert.match(BOOKINGS_CONNECT_COPY.success, /Master Leads/);
  assert.match(BOOKINGS_CONNECT_COPY.success, /Master Booked/);
  assert.doesNotMatch(BOOKINGS_CONNECT_COPY.success, /synced|already/i);
});

test("Leadless non-referral rows get No stored lead; Referral never gets Connect", () => {
  const leadless: AdminRecord = { is_leadless_booking: true, is_referral_booking: false };
  const referral: AdminRecord = { is_referral_booking: true, is_leadless_booking: false };
  const cancelled: AdminRecord = { is_leadless_booking: true, cancelled: "2026-08-01" };
  const attached: AdminRecord = { lead_ref: "a".repeat(24), lead_model: "FormLead" };

  assert.equal(isLeadlessNonReferralBooking(leadless), true);
  assert.equal(canConnectBookingToLead(leadless), true);
  assert.deepEqual(storedLeadChip(leadless), { label: "No stored lead", tone: "warning" });

  assert.equal(canConnectBookingToLead(referral), false);
  assert.deepEqual(storedLeadChip(referral), { label: "Referral", tone: "muted" });

  assert.equal(canConnectBookingToLead(cancelled), false);
  assert.deepEqual(storedLeadChip(cancelled), { label: "No stored lead", tone: "warning" });

  assert.equal(canConnectBookingToLead(attached), false);
  assert.equal(storedLeadChip(attached), null);
});

test("Stored lead table chip renders owner labels without Lead IDs", () => {
  const leadless = renderToStaticMarkup(createElement(StoredLeadChip, {
    record: { is_leadless_booking: true },
  }));
  assert.match(leadless, /No stored lead/);
  assert.doesNotMatch(leadless, /is_leadless_booking|lead_ref|[a-f0-9]{24}/);

  const referral = renderToStaticMarkup(createElement(StoredLeadChip, {
    record: { is_referral_booking: true },
  }));
  assert.match(referral, /Referral/);
  assert.doesNotMatch(referral, /Connect/);
});

test("Bookings operational page mounts Stored lead after Summary and keeps reconciliation out of the file", () => {
  const page = readFileSync(
    path.join(process.cwd(), "components/operational/operational-resource-page.tsx"),
    "utf8",
  );
  assert.match(page, /stored_lead/);
  assert.match(page, /BookingStoredLeadSection/);
  assert.match(page, /startConnect/);
  assert.match(page, /readOnly=\{readOnly\}/);
  assert.doesNotMatch(page, /bookingLeadReconciliation/);
  const bookingsPage = readFileSync(
    path.join(process.cwd(), "app/(dashboard)/bookings/reconciliation/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(bookingsPage, /Connect a lead|connect-lead|BookingStoredLeadSection/);
});
