import { Suspense } from "react";
import { LifecycleDashboard } from "@/components/granot-lifecycle/lifecycle-dashboard";

export default function GranotLifecyclePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Granot lifecycle…</p>}>
      <LifecycleDashboard />
    </Suspense>
  );
}

