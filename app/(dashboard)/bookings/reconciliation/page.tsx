import { Suspense } from "react";
import { ConnectBookingEntry } from "@/components/manual/connect-booking-entry";
import { BookingReconciliationDashboard } from "@/components/reconciliation/booking-reconciliation-dashboard";

/** Bookings → Reconciliation. `?connect=1` (the old Manual → Connect tab) opens the Connect Booking to Lead section first. */
export default function BookingReconciliationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reconciliation…</p>}>
      <ConnectBookingEntry />
      <BookingReconciliationDashboard />
    </Suspense>
  );
}
