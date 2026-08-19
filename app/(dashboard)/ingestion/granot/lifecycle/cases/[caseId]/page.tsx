import { GranotLifecycleCasePage } from "@/components/granot-lifecycle/case-detail";

export default async function GranotLifecycleCaseRoute({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <GranotLifecycleCasePage caseId={caseId} />;
}

