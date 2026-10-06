import { Suspense } from "react";
import { BookingsWorkspace } from "@/components/bookings/bookings-workspace";

/** All bookings (doc 03): every booking, newest first. Status, source and agent are the filters; cards replace the table. */
export default function BookingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading bookings…</p>}>
      <BookingsWorkspace />
    </Suspense>
  );
}
