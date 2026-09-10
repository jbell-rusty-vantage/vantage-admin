import { ReportingDashboard } from "@/components/reporting/reporting-dashboard";

export default async function EditReportingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportingDashboard definitionId={id} mode="edit" />;
}
