"use client";

import type { ReactNode } from "react";
import { formatDateTime, formatMoney } from "@/components/data-table/formatters";
import { FeedbackMessage } from "@/components/ui/feedback";
import { JobTimeline } from "@/components/granot-lifecycle/job-timeline";
import { JobTimelineDeepLink } from "@/components/job-number-timeline/job-timeline-deep-link";
import type {
  GranotLifecycleCaseDetail,
  GranotTimelinePage,
} from "@/lib/api/granotLifecycle";
import {
  BOOKING_INTAKE_STORY,
  granotUpdateActionLabel,
  granotUpdateReadingLabel,
} from "./intake-copy";

/**
 * Everything below the work the Owner came to do. Each drawer stays shut until
 * he asks a question it answers.
 */
export function IntakeReferenceDrawer({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-lg border bg-background" open={defaultOpen}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{hint}</span>
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}

export function WhatVantageAlreadyHasOnThisJob({
  official,
}: {
  official: GranotLifecycleCaseDetail["official_current"];
}) {
  const booking = official?.booking;
  const cancellation = official?.cancellation;
  return (
    <div className="space-y-4">
      {booking ? (
        <section aria-labelledby="vantage-booking-heading" className="rounded-md border p-3">
          <h4 id="vantage-booking-heading" className="font-semibold text-navy">
            Vantage booking on this job
          </h4>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{booking.customer_name ?? "Not recorded"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Booked on</dt><dd>{formatDateTime(booking.book_date)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Lead source</dt><dd>{booking.source}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Merchant</dt><dd>{booking.merchant}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Deposit</dt><dd>{formatMoney(booking.deposit_amount)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Binder</dt><dd>{formatMoney(booking.total_binder_amount)}</dd></div>
          </dl>
          <h5 className="mt-3 text-sm font-medium">Agents on the binder</h5>
          <ul className="mt-1 space-y-1 text-sm">
            {booking.agent_allocations.length === 0 ? (
              <li className="text-muted-foreground">No agents on this booking.</li>
            ) : (
              booking.agent_allocations.map((allocation) => (
                <li key={allocation.agent_id}>
                  {allocation.agent_name}: {formatMoney(allocation.binder_amount)}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : (
        <FeedbackMessage>
          Vantage has no booking on this job yet. That is what this intake is asking you to create.
        </FeedbackMessage>
      )}
      {cancellation ? (
        <section aria-labelledby="vantage-cancellation-heading" className="rounded-md border p-3">
          <h4 id="vantage-cancellation-heading" className="font-semibold text-navy">
            Vantage cancellation on this job
          </h4>
          <p className="mt-1 text-sm">Cancelled {formatDateTime(cancellation.cancel_date)}.</p>
          <p className="text-sm">Refunded {formatMoney(cancellation.refund_amount)}.</p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">This job has not been cancelled in Vantage.</p>
      )}
    </div>
  );
}

export function GranotUpdateHistory({
  updates,
}: {
  updates: GranotLifecycleCaseDetail["evidence"];
}) {
  if (!updates || updates.length === 0) {
    return <p className="text-sm text-muted-foreground">No updates have been recorded on this job.</p>;
  }
  return (
    <ol className="space-y-2">
      {updates.map((update) => (
        <li
          key={`${update.observation_id}:${update.decision_id}`}
          className="rounded-md border p-3 text-sm"
        >
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="text-navy">{granotUpdateActionLabel(update.action)}</strong>
            <time dateTime={update.captured_at} className="text-muted-foreground">
              {formatDateTime(update.captured_at)}
            </time>
          </div>
          <p className="mt-1 text-muted-foreground">
            {granotUpdateReadingLabel(update.normalization_result)}.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            If you need help with this one, quote {update.observation_id}.
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The three drawers every intake carries, in the order the Owner would reach for them. */
export function IntakeReferenceDrawers({
  job,
  official,
  updates,
  timeline,
  defaultOpen,
}: {
  job?: string | null;
  official: GranotLifecycleCaseDetail["official_current"];
  updates: GranotLifecycleCaseDetail["evidence"];
  timeline?: GranotTimelinePage;
  defaultOpen?: boolean;
}) {
  return (
    <div className="space-y-3">
      <IntakeReferenceDrawer
        title={BOOKING_INTAKE_STORY.whatVantageAlreadyHas.title}
        hint={BOOKING_INTAKE_STORY.whatVantageAlreadyHas.hint}
        defaultOpen={defaultOpen}
      >
        <WhatVantageAlreadyHasOnThisJob official={official} />
      </IntakeReferenceDrawer>

      <IntakeReferenceDrawer
        title={`${BOOKING_INTAKE_STORY.granotUpdateHistory.title} (${updates?.length ?? 0})`}
        hint={BOOKING_INTAKE_STORY.granotUpdateHistory.hint}
        defaultOpen={defaultOpen}
      >
        <GranotUpdateHistory updates={updates} />
      </IntakeReferenceDrawer>

      <IntakeReferenceDrawer
        title={BOOKING_INTAKE_STORY.jobLifecycleTimeline.title}
        hint={BOOKING_INTAKE_STORY.jobLifecycleTimeline.hint}
        defaultOpen={defaultOpen}
      >
        {job ? (
          <p className="mb-3 text-sm">
            <JobTimelineDeepLink job={job}>Open Job timeline</JobTimelineDeepLink>
            {" "}in addition to this forensic drawer.
          </p>
        ) : null}
        <JobTimeline page={timeline} />
      </IntakeReferenceDrawer>
    </div>
  );
}
