import { Suspense } from "react";
import { GranotJobTimelinePage } from "@/components/granot-lifecycle/job-timeline";

export default async function GranotLifecycleJobPage({
  params,
}: {
  params: Promise<{ jobNo: string }>;
}) {
  const { jobNo } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Job timeline…</p>}>
      <GranotJobTimelinePage jobNo={jobNo} />
    </Suspense>
  );
}
