import { DiscrepancyDetailPage } from "@/components/granot-lifecycle/discrepancy-detail";
export default async function GranotDiscrepancyDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiscrepancyDetailPage discrepancyId={id} />;
}
