import { permanentRedirect } from "next/navigation";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";

export default async function GranotLifecycleJobRedirect({
  params,
}: {
  params: Promise<{ jobNo: string }>;
}) {
  const { jobNo } = await params;
  permanentRedirect(buildJobTimelineHref({ job: jobNo }));
}
