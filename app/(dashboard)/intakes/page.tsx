import { Suspense } from "react";
import { IntakesDashboard } from "@/components/intakes/intakes-dashboard";

export default function IntakesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading intakes…</p>}>
      <IntakesDashboard />
    </Suspense>
  );
}
