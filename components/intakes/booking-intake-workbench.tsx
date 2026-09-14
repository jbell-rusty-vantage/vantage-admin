"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { BookingOwnerActions } from "@/components/granot-lifecycle/booking-owner-actions";
import { useMatchedLead } from "@/components/granot-lifecycle/use-matched-lead";
import type { GranotLifecycleCaseDetail, SafeBookingProjection } from "@/lib/api/granotLifecycle";
import { JobTimelineDeepLink } from "@/components/job-number-timeline/job-timeline-deep-link";
import { GranotBookingStatementCard } from "./granot-booking-statement";
import { MatchedCustomerSection } from "./matched-lead-panel";
import { IntakeReferenceDrawers } from "./intake-reference";
import { formatDateTime, formatMoney } from "@/components/data-table/formatters";
import {
  INTAKE_COMMANDS_OFF,
  intakeCaseHowToFinish,
  intakePublicCancelHref,
  intakeReleaseHeadline,
  intakeStatusLabel,
  intakeWorkbenchShowsPublicCancel,
} from "./intake-copy";

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
 * One booking intake, read top to bottom as a story:
 *
 *   1. what Granot sent us
 *   2. who this booking is for — and the search that changes the answer
 *   3. finalize or review the booking, or resolve it without changing anything
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
    latest_action: detail.latest_action,
  });
  const releaseHeadline = intakeReleaseHeadline({
    latest_action: detail.latest_action ?? "booked",
    deterministic_booking: { present: Boolean(detail.official_current.booking) },
    mode: detail.mode,
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

      {releaseHeadline ? (
        <p className="text-sm text-navy">{releaseHeadline}</p>
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

      {detail.official_current.booking ? (
        <OfficialBookingNowStrip
          booking={detail.official_current.booking}
          referral={detail.capabilities.referral}
        />
      ) : null}

      <BookingOwnerActions detail={detail} matchedLead={matched.lead} surface="intakes" />

      {intakeWorkbenchShowsPublicCancel(detail) && detail.official_current.booking?.id
        ? (
          <p>
            <Link
              className="text-sm font-medium text-muted-foreground hover:underline"
              href={intakePublicCancelHref(detail.official_current.booking.id)}
            >
              Cancel this booking
            </Link>
          </p>
        )
        : null}

      {!ownerCanFinishIt && detail.state === "open" ? (
        <FeedbackMessage tone="warning">{INTAKE_COMMANDS_OFF}</FeedbackMessage>
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

function OfficialBookingNowStrip({
  booking,
  referral,
}: {
  booking: SafeBookingProjection;
  referral?: boolean;
}) {
  const attachment = booking.lead_ref
    ? "Lead"
    : referral
      ? "Referral Booking"
      : "Leadless Booking";
  return (
    <section aria-labelledby="official-booking-now" className="rounded-lg border bg-muted/40 p-4">
      <h2 id="official-booking-now" className="text-sm font-semibold text-navy">
        Official Booking now
      </h2>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Book Date</dt>
          <dd>{formatDateTime(booking.book_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Binder</dt>
          <dd>{formatMoney(booking.total_binder_amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Deposit</dt>
          <dd>{formatMoney(booking.deposit_amount)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Merchant</dt>
          <dd>{booking.merchant}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Agents</dt>
          <dd>
            {booking.agent_allocations.length
              ? booking.agent_allocations.map((allocation) => allocation.agent_name).join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{attachment === "Lead" ? "Lead" : attachment}</dt>
          <dd>{attachment === "Lead" ? "Attached" : attachment}</dd>
        </div>
      </dl>
    </section>
  );
}
