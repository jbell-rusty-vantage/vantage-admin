"use client";

import { useQuery } from "@tanstack/react-query";
import { FeedbackMessage } from "@/components/ui/feedback";
import { CaseDetail } from "@/components/granot-lifecycle/case-detail";
import { ReleaseOwnerActions } from "@/components/granot-lifecycle/release-owner-actions";
import { fetchGranotLifecycleCase } from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { BookingIntakeWorkbench } from "./booking-intake-workbench";
import { isAllowedIntakeReturn } from "./intake-copy";

const REFRESH_WHILE_OPEN_MS = 15_000;

/**
 * One intake, opened in place from the waiting list. A booking intake gets the
 * owner workbench; a cancellation intake keeps the shared case view until it
 * gets a story of its own.
 */
export function IntakeCasePage({
  caseId,
  returnTo,
  backLabel,
}: {
  caseId: string;
  returnTo?: string;
  backLabel?: string;
}) {
  const intake = useQuery({
    queryKey: queryKeys.granotLifecycle.caseDetail(caseId),
    queryFn: () => fetchGranotLifecycleCase(caseId),
    refetchInterval: REFRESH_WHILE_OPEN_MS,
  });

  if (intake.isPending) {
    return <p role="status" className="text-sm text-muted-foreground">Loading this intake…</p>;
  }
  if (intake.isError || !intake.data) {
    return (
      <FeedbackMessage tone="error">
        {intake.error instanceof Error ? intake.error.message : "Unable to load this intake."}
      </FeedbackMessage>
    );
  }

  const backHref = isAllowedIntakeReturn(returnTo) ? returnTo : undefined;
  const backTo = backHref ? (backLabel ?? "Back to waiting intakes") : undefined;

  if (intake.data.kind === "booking") {
    return <BookingIntakeWorkbench detail={intake.data} backHref={backHref} backLabel={backTo} />;
  }

  return (
    <CaseDetail
      detail={intake.data}
      backHref={backHref}
      backLabel={backTo}
      ownerWork={<ReleaseOwnerActions detail={intake.data} />}
    />
  );
}
