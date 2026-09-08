import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BOOKING_RECONCILIATION_COPY,
  bookingReconciliationOriginLabel,
} from "../components/reconciliation/booking-reconciliation-copy";

test("reconciliation dashboard honors intake deep links and shows known contacts", () => {
  const dashboard = readFileSync(
    path.join(process.cwd(), "components/reconciliation/booking-reconciliation-dashboard.tsx"),
    "utf8",
  );
  const browser = readFileSync(
    path.join(process.cwd(), "components/reconciliation/booking-lead-browser.tsx"),
    "utf8",
  );
  const page = readFileSync(
    path.join(process.cwd(), "app/(dashboard)/bookings/reconciliation/page.tsx"),
    "utf8",
  );

  assert.match(dashboard, /readBookingReconciliationCaseId/);
  assert.match(dashboard, /nextSelectedBookingReconciliationCaseId/);
  assert.match(dashboard, /ReconciliationLeadContacts/);
  assert.match(browser, /ReconciliationLeadContacts/);
  assert.match(page, /Suspense/);
  assert.match(dashboard, /BOOKING_RECONCILIATION_COPY\.dismissButton/);
  assert.match(dashboard, /BOOKING_RECONCILIATION_COPY\.dismissConfirm/);
  assert.match(dashboard, /action: "dismiss"/);
  assert.match(dashboard, /value="owner_booking"/);
  assert.match(dashboard, /bookingReconciliationOriginLabel/);
  assert.doesNotMatch(dashboard, /Dismiss this pending reconciliation case/);
});

test("reconciliation origin labels stay Owner-visible and never print internal origin names", () => {
  assert.equal(bookingReconciliationOriginLabel("owner_booking"), "Precise Booking Form");
  assert.equal(bookingReconciliationOriginLabel("employee_booking"), "Employee booking");
  assert.equal(bookingReconciliationOriginLabel("external_sheet_ingestion"), "External sheet");

  const ownerVisible = [
    BOOKING_RECONCILIATION_COPY.pageHint,
    BOOKING_RECONCILIATION_COPY.dismissButton,
    BOOKING_RECONCILIATION_COPY.dismissConfirm,
    BOOKING_RECONCILIATION_COPY.dismissHelper,
    ...Object.values(BOOKING_RECONCILIATION_COPY.origin),
  ].join(" ");
  assert.equal(ownerVisible.includes("owner_booking"), false);
  assert.equal(ownerVisible.includes("is_leadless_booking"), false);
  assert.equal(ownerVisible.includes("created_on_unmatched"), false);
  assert.match(BOOKING_RECONCILIATION_COPY.dismissButton, /Keep without a lead/);
  assert.match(BOOKING_RECONCILIATION_COPY.dismissConfirm, /booking stays filed/);
  assert.doesNotMatch(BOOKING_RECONCILIATION_COPY.dismissConfirm, /abandon|failed match/i);
});
