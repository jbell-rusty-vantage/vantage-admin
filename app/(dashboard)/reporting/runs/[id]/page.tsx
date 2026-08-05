import { RunDetailView } from "@/components/reporting/run-detail-view";

export default async function ReportingRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RunDetailView runId={id} />;
}
