import { Suspense } from "react";
import { ToFinishPage } from "@/components/intakes/to-finish-page";

/** Bookings → To finish. The route stays `/intakes` (the sidebar badge, Today and old links point here). */
export default function IntakesPage() {
  return (
    <Suspense fallback={<p className="crm-subtitle">Loading bookings to finish…</p>}>
      <ToFinishPage />
    </Suspense>
  );
}
