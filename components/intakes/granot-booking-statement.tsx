"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatDateTime } from "@/components/data-table/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchBookingIntakeCreatingObservation,
  type BookingIntakeCreatingObservation,
  type BookingPriorityPairingProjection,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import {
  granotStatementIsBare,
  readGranotStatement,
  type GranotStatement,
} from "./granot-statement-reading";
import {
  BOOKING_INTAKE_STORY,
  creatingObservationSelectionHint,
  creatingObservationSummary,
  creatingObservationTitle,
  granotStatementEmptyMessage,
  granotStatementHeadline,
  intakeJobHref,
  priorityPairingStory,
} from "./intake-copy";

function asPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StatementFact({ label, value }: { label: string; value?: string | number | null }) {
  const shown = typeof value === "number" ? String(value) : value?.trim();
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{shown ? shown : "Not sent"}</dd>
    </div>
  );
}

function StatementGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-background p-3">
      <h4 className="text-sm font-semibold text-navy">{heading}</h4>
      <dl className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function RawDrawer({ title, hint, value }: { title: string; hint: string; value: unknown }) {
  return (
    <details className="rounded-md border bg-background">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{hint}</span>
      </summary>
      <pre className="max-h-96 overflow-auto border-t bg-steel-100 p-3 text-xs leading-5">
        {asPrettyJson(value)}
      </pre>
    </details>
  );
}

/** The Priority 5 audit for one job, stated as a sentence rather than a table. */
export function PriorityPairingStory({
  pairing,
  normalizedJobNo,
}: {
  pairing: BookingPriorityPairingProjection | null | undefined;
  normalizedJobNo?: string;
}) {
  if (!pairing) return null;
  const story = priorityPairingStory(pairing.pairing);
  const preceding = pairing.preceding_priority_5;
  const later = pairing.later_priority_5;
  return (
    <section aria-labelledby="priority-pairing-heading" className="space-y-2">
      <h4 id="priority-pairing-heading" className="sr-only">
        Priority history
      </h4>
      <p
        id="priority-pairing-story"
        className={cn(
          "text-sm",
          story.tone === "warning" ? "font-medium text-amber-800" : "text-muted-foreground",
        )}
      >
        {story.sentence}
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {preceding ? (
          <li>Priority 5 flagged {formatDateTime(preceding.captured_at)}.</li>
        ) : null}
        {later ? (
          <li>Granot flagged priority 5 again on {formatDateTime(later.captured_at)}, after the booking.</li>
        ) : null}
        {normalizedJobNo ? (
          <li>
            <a className="text-trust-blue hover:underline" href={intakeJobHref(normalizedJobNo)}>
              {BOOKING_INTAKE_STORY.jobLifecycleTimeline.title}
            </a>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function GranotStatementFacts({ statement }: { statement: GranotStatement }) {
  if (granotStatementIsBare(statement)) {
    return <FeedbackMessage>{granotStatementEmptyMessage()}</FeedbackMessage>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <StatementGroup heading="Customer">
        <StatementFact label="Name" value={statement.customer.name} />
        <StatementFact label="Phone" value={statement.customer.phone} />
        <StatementFact label="Email" value={statement.customer.email} />
      </StatementGroup>
      <StatementGroup heading="Move">
        <StatementFact label="Move date" value={statement.move.date ? formatDate(statement.move.date) : undefined} />
        <StatementFact label="Cubic feet" value={statement.move.cubicFeet} />
        <StatementFact label="Moving from" value={statement.move.from} />
        <StatementFact label="Moving to" value={statement.move.to} />
      </StatementGroup>
      <StatementGroup heading="Money Granot shows">
        <StatementFact label="Estimate" value={statement.money.estimate} />
        <StatementFact label="Paid so far" value={statement.money.payment} />
        <StatementFact label="Balance" value={statement.money.balance} />
        <p className="text-xs text-muted-foreground sm:col-span-2">
          These are Granot&apos;s numbers. They are never copied into the official booking.
        </p>
      </StatementGroup>
    </div>
  );
}

export function GranotBookingStatementView({
  data,
}: {
  data: BookingIntakeCreatingObservation;
}) {
  const statement = readGranotStatement(data.observation);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-navy">
          {granotStatementHeadline({
            jobNo: data.job_no || statement.jobNumber,
            whatGranotCalledIt:
              data.payload_event_type_raw ?? statement.whatGranotCalledIt ?? data.booking_action,
            capturedAt: data.captured_at || statement.capturedAt,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {creatingObservationSelectionHint(data.selection)}
        </p>
        <PriorityPairingStory
          pairing={data.priority_pairing}
          normalizedJobNo={data.normalized_job_no}
        />
      </div>

      <GranotStatementFacts statement={statement} />

      <p className="text-xs text-muted-foreground">
        {[
          statement.granotUser ? `Entered in Granot by ${statement.granotUser}` : undefined,
          statement.sourceName ? `Lead source ${statement.sourceName}` : undefined,
          statement.reference ? `Reference ${statement.reference}` : undefined,
          statement.granotPriority ? `Granot priority ${statement.granotPriority}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ") || "Granot sent no source or agent details with this update."}
      </p>

      <div className="space-y-2">
        <RawDrawer
          title="The exact message Granot sent"
          hint="Word for word, with passwords and keys removed."
          value={data.granot_statement}
        />
        <RawDrawer
          title="How Vantage read that message"
          hint="Only for checking why a field above looks wrong."
          value={data.observation}
        />
      </div>
    </div>
  );
}

function useGranotBookingStatement(caseId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.granotLifecycle.creatingObservation(caseId),
    queryFn: () => fetchBookingIntakeCreatingObservation(caseId),
    enabled: Boolean(caseId) && enabled,
  });
}

function StatementLoadingOrError({
  pending,
  error,
}: {
  pending: boolean;
  error: unknown;
}) {
  if (pending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading the update Granot sent…
      </p>
    );
  }
  if (error) {
    return (
      <FeedbackMessage tone="error">
        {error instanceof Error ? error.message : "Unable to load the update Granot sent."}
      </FeedbackMessage>
    );
  }
  return null;
}

/** Act one of the intake: the update that opened this booking. */
export function GranotBookingStatementCard({ caseId }: { caseId: string }) {
  const statement = useGranotBookingStatement(caseId, true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{BOOKING_INTAKE_STORY.whatGranotSent.title}</CardTitle>
        <CardDescription>{BOOKING_INTAKE_STORY.whatGranotSent.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatementLoadingOrError pending={statement.isPending} error={statement.error} />
        {statement.data ? <GranotBookingStatementView data={statement.data} /> : null}
      </CardContent>
    </Card>
  );
}

/**
 * The same update, folded into one row of the waiting list. It stays closed —
 * and unfetched — until the Owner asks for it.
 */
export function GranotBookingStatementAccordion({ caseId }: { caseId: string }) {
  const [opened, setOpened] = useState(false);
  const statement = useGranotBookingStatement(caseId, opened);
  const title = creatingObservationTitle(statement.data?.selection);
  const summary = statement.data
    ? creatingObservationSummary(statement.data)
    : "Latest payload that created this booking intake";

  return (
    <details
      className="rounded-lg border bg-background"
      onToggle={(event) => setOpened(event.currentTarget.open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{summary}</span>
      </summary>
      <div className="border-t px-4 py-4">
        {opened ? (
          <StatementLoadingOrError pending={statement.isPending} error={statement.error} />
        ) : null}
        {statement.data ? <GranotBookingStatementView data={statement.data} /> : null}
      </div>
    </details>
  );
}
