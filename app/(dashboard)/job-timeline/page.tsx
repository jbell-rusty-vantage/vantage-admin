import { Suspense } from "react";
import { JobTimelineDashboard } from "@/components/job-number-timeline/job-timeline-dashboard";

export default function JobTimelinePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Job timeline…</p>}>
      <JobTimelineDashboard />
    </Suspense>
  );
}
