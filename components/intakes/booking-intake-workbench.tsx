"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { BookingOwnerActions } from "@/components/granot-lifecycle/booking-owner-actions";
import { useMatchedLead } from "@/components/granot-lifecycle/use-matched-lead";
import type { GranotLifecycleCaseDetail } from "@/lib/api/granotLifecycle";
import { GranotBookingStatementCard } from "./granot-booking-statement";
import { MatchedCustomerSection } from "./matched-lead-panel";
import { IntakeReferenceDrawers } from "./intake-reference";
import { intakeCaseHowToFinish, intakeStatusLabel } from "./intake-copy";

function BookingIntakeHeadline({
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
            Booking intake
          </p>
          <h1 className="text-2xl font-semibold text-navy">Job {detail.job_no}</h1>
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
 * One booking intake, read top to bottom as a story:
 *
 *   1. what Granot sent us
 *   2. who this booking is for — and the search that changes the answer
 *   3. finish the booking, or resolve it without changing anything
 *   4. the paper trail, folded away until it is needed
 */
export function BookingIntakeWorkbench({
  detail,
  backHref,
  backLabel,
}: {
  detail: GranotLifecycleCaseDetail;
  backHref?: string;
  backLabel?: string;
}) {
  const bookingNeedsACustomer =
    detail.mode === "create_missing_booking" && detail.candidate_search.available;
  const matched = useMatchedLead(detail.case_id, { askable: bookingNeedsACustomer });
  const ownerCanFinishIt = detail.capabilities.commands && detail.state === "open";
  const howToFinish = intakeCaseHowToFinish({
    kind: detail.kind,
    mode: detail.mode,
    state: detail.state,
    commandsAvailable: detail.capabilities.commands,
  });

  return (
    <div className="space-y-5">
      <BookingIntakeHeadline detail={detail} backHref={backHref} backLabel={backLabel} />

      {howToFinish ? (
        <Card className="border-trust-blue/40">
          <CardHeader>
            <CardTitle>{howToFinish.title}</CardTitle>
            <CardDescription>{howToFinish.body}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {detail.employee_booking_lead_reconciliation ? (
        <FeedbackMessage tone="warning">
          This booking has no customer attached. Finish it in the separate booking reconciliation
          workflow:{" "}
          <Link className="font-semibold underline" href={detail.employee_booking_lead_reconciliation.href}>
            open it there
          </Link>
          {" "}({detail.employee_booking_lead_reconciliation.status}).
        </FeedbackMessage>
      ) : null}

      <GranotBookingStatementCard caseId={detail.case_id} />

      {bookingNeedsACustomer ? (
        <MatchedCustomerSection caseId={detail.case_id} matched={matched} />
      ) : null}

      <BookingOwnerActions detail={detail} matchedLead={matched.lead} />

      {!ownerCanFinishIt && detail.state === "open" ? (
        <FeedbackMessage tone="warning">
          Vantage is not ready to file bookings from this screen yet. Nothing is being lost — this
          intake keeps waiting, and everything Granot sent is recorded below.
        </FeedbackMessage>
      ) : null}

      <IntakeReferenceDrawers
        official={detail.official_current}
        updates={detail.evidence}
        timeline={detail.timeline}
        defaultOpen={!ownerCanFinishIt}
      />
    </div>
  );
}
