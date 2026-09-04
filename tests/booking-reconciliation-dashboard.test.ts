import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

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
});
