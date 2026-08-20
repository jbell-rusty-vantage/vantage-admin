import { GranotLifecycleCasePage } from "@/components/granot-lifecycle/case-detail";

export default async function GranotLifecycleCaseRoute({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const { caseId } = await params;
  const query = await searchParams;
  return <GranotLifecycleCasePage caseId={caseId} returnTo={query.return} />;
}
