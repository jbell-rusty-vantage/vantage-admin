"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { ReleaseOwnerActions } from "@/components/granot-lifecycle/release-owner-actions";
import type { GranotLifecycleCaseDetail } from "@/lib/api/granotLifecycle";
import { JobTimelineDeepLink } from "@/components/job-number-timeline/job-timeline-deep-link";
import { GranotBookingStatementCard } from "./granot-booking-statement";
import { IntakeReferenceDrawers } from "./intake-reference";
import { intakeCaseHowToFinish, intakeStatusLabel } from "./intake-copy";

function CancellationIntakeHeadline({
  detail,
  backHref,
  backLabel,
}: {
  detail: GranotLifecycleCaseDetail;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-4">
      {backHref ? (
        <Link className="inline-flex h-10 items-center text-sm font-medium underline" href={backHref}>
          {backLabel ?? "Back to waiting intakes"}
        </Link>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">
            Cancellation intake
          </p>
          <h1 className="text-2xl font-semibold text-navy">
            <JobTimelineDeepLink job={detail.job_no}>Job {detail.job_no}</JobTimelineDeepLink>
          </h1>
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={detail.state === "open" ? "warning" : "muted"}>
            {intakeStatusLabel(detail.state)}
          </StatusBadge>
          {detail.source?.label ? (
            <StatusBadge tone="muted">From {detail.source.label}</StatusBadge>
          ) : null}
        </div>
      </header>
    </div>
  );
}

/**
 * One cancellation intake, read top to bottom as a story:
 *
 *   1. what Granot sent us
 *   2. finish the cancellation, or resolve it without changing anything
 *   3. the paper trail, folded away until it is needed
 */
export function CancellationIntakeWorkbench({
  detail,
  backHref,
  backLabel,
}: {
  detail: GranotLifecycleCaseDetail;
  backHref?: string;
  backLabel?: string;
}) {
  const ownerCanFinishIt = detail.capabilities.commands && detail.state === "open";
  const howToFinish = intakeCaseHowToFinish({
    kind: detail.kind,
    mode: detail.mode,
    state: detail.state,
    commandsAvailable: detail.capabilities.commands,
  });

  return (
    <div className="space-y-5">
      <CancellationIntakeHeadline detail={detail} backHref={backHref} backLabel={backLabel} />

      {howToFinish ? (
        <Card className="border-trust-blue/40">
          <CardHeader>
            <CardTitle>{howToFinish.title}</CardTitle>
            <CardDescription>{howToFinish.body}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <GranotBookingStatementCard caseId={detail.case_id} kind="cancellation" />

      <ReleaseOwnerActions detail={detail} />

      {!ownerCanFinishIt && detail.state === "open" ? (
        <FeedbackMessage tone="warning">
          Vantage is not ready to file cancellations from this screen yet. Nothing is being lost —
          this intake keeps waiting, and everything Granot sent is recorded below.
        </FeedbackMessage>
      ) : null}

      <IntakeReferenceDrawers
        job={detail.job_no}
        official={detail.official_current}
        updates={detail.evidence}
        timeline={detail.timeline}
        defaultOpen={!ownerCanFinishIt}
      />
    </div>
  );
}
