import { GranotJobTimelinePage } from "@/components/granot-lifecycle/job-timeline";

export default async function GranotLifecycleJobPage({
  params,
}: {
  params: Promise<{ jobNo: string }>;
}) {
  const { jobNo } = await params;
  return <GranotJobTimelinePage jobNo={jobNo} />;
}

