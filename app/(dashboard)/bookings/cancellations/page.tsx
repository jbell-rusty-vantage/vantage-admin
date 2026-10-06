import { OperationalResourcePage } from "@/components/operational/operational-resource-page";

/** Bookings → Cancellations (doc 01, doc 03). `/cancellations` redirects here; Record a cancellation stays at `/cancellations/new`. */
export default function BookingsCancellationsPage() {
  return <OperationalResourcePage resource="cancellations" />;
}
