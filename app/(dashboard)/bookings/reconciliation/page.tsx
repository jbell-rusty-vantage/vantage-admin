import { Suspense } from "react";
import { BookingReconciliationDashboard } from "@/components/reconciliation/booking-reconciliation-dashboard";

export default function BookingReconciliationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reconciliation…</p>}>
      <BookingReconciliationDashboard />
    </Suspense>
  );
}
