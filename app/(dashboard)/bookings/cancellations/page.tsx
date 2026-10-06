import { Suspense } from "react";
import { CancellationsWorkspace } from "@/components/cancellations/cancellations-workspace";

/** Bookings → Cancellations (doc 01, doc 03). `/cancellations` redirects here; Record a cancellation stays at `/cancellations/new`. */
export default function BookingsCancellationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading cancellations…</p>}>
      <CancellationsWorkspace />
    </Suspense>
  );
}
