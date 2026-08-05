import { DestinationDetailView } from "@/components/reporting/destination-detail-view";

export default async function ReportingDestinationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DestinationDetailView destinationId={id} />;
}
