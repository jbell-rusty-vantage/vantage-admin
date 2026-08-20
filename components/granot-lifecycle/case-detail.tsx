"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatDateTime, formatMoney } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchGranotLifecycleCase,
  type GranotLifecycleCaseDetail,
  type GranotTimelinePage,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { intakeCaseHowToFinish, isAllowedIntakeReturn } from "@/components/intakes/intake-copy";
import { JobTimeline } from "./job-timeline";
import { LeadCandidateBrowser } from "./lead-candidate-browser";
import { BookingOwnerActions } from "./booking-owner-actions";
import { ReleaseOwnerActions } from "./release-owner-actions";

function ContactBlock({
  title,
  contact,
}: {
  title: string;
  contact?: { name?: string; phone_number?: string; email?: string };
}) {
  return (
    <div className="rounded-md border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {contact ? (
        <dl className="mt-2 space-y-1 text-sm">
          <div><dt className="inline text-muted-foreground">Name: </dt><dd className="inline">{contact.name ?? "—"}</dd></div>
          <div><dt className="inline text-muted-foreground">Phone: </dt><dd className="inline">{contact.phone_number ?? "—"}</dd></div>
          <div><dt className="inline text-muted-foreground">Email: </dt><dd className="inline">{contact.email ?? "—"}</dd></div>
        </dl>
      ) : <p className="mt-2 text-sm text-muted-foreground">Not available.</p>}
    </div>
  );
}

const EMPTY_TIMELINE: GranotTimelinePage = {
  items: [],
  next_cursor: null,
  current: {},
  capabilities: {
    booking_cases: false,
    release_cases: false,
    discrepancies: false,
    official_facts: true,
  },
};

function ReferenceSection({
  title,
  description,
  open,
  children,
}: {
  title: string;
  description: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="rounded-lg border bg-background" open={open}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{description}</span>
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  );
}

export function CaseDetail({
  detail,
  candidateBrowser,
  commandForm,
  backHref,
  backLabel,
}: {
  detail: GranotLifecycleCaseDetail;
  candidateBrowser?: ReactNode;
  commandForm?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const official = detail.official_current ?? {};
  const booking = official.booking;
  const cancellation = official.cancellation;
  const observed = detail.observed_context ?? {
    section_label: "Granot evidence — not official Vantage values",
  };
  const contacts = detail.contacts ?? {};
  const evidence = detail.evidence ?? [];
  const timeline = detail.timeline ?? EMPTY_TIMELINE;
  const candidateSearch = detail.candidate_search ?? {
    available: false,
    default_scope: "source" as const,
    all_scope_warning: false,
  };
  const capabilities = detail.capabilities ?? {
    commands: false as const,
    referral: false,
    release_cases: false,
    discrepancies: false,
  };
  const ownerAction = capabilities.commands
    ? commandForm
    : candidateSearch.available && !capabilities.referral
      ? candidateBrowser
      : null;
  const howToFinish = intakeCaseHowToFinish({
    kind: detail.kind,
    mode: detail.mode,
    state: detail.state,
    commandsAvailable: capabilities.commands,
  });
  const referenceOpen = !capabilities.commands;

  return (
    <div className="space-y-5">
      {backHref ? (
        <Link className="inline-flex h-10 items-center text-sm font-medium underline" href={backHref}>
          {backLabel ?? "Back"}
        </Link>
      ) : null}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {detail.kind === "release" ? "Cancellation intake" : "Booking intake"}
          </p>
          <h1 className="text-2xl font-semibold text-navy">
            {detail.kind} #{detail.sequence_number} · {detail.job_no}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{detail.case_id}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={detail.state === "open" ? "warning" : "muted"}>{detail.state}</StatusBadge>
          <StatusBadge>{String(detail.mode ?? "").replaceAll("_", " ")}</StatusBadge>
          <StatusBadge tone="muted">case rev {detail.case_revision}</StatusBadge>
          <StatusBadge tone="muted">evidence rev {detail.evidence_revision}</StatusBadge>
          {detail.source?.label ? <StatusBadge tone="muted">source {detail.source.label}</StatusBadge> : null}
        </div>
      </header>

      {howToFinish ? (
        <Card className="border-trust-blue/40">
          <CardHeader>
            <CardTitle>{howToFinish.title}</CardTitle>
            <CardDescription>{howToFinish.body}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {ownerAction}

      {detail.employee_booking_lead_reconciliation ? (
        <FeedbackMessage tone="warning">
          This Booking has no Lead. Continue in the separate Employee Booking Lead Reconciliation workflow: {" "}
          <Link className="font-semibold underline" href={detail.employee_booking_lead_reconciliation.href}>
            open case {detail.employee_booking_lead_reconciliation.case_id}
          </Link>
          {" "}({detail.employee_booking_lead_reconciliation.status}).
        </FeedbackMessage>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Official current Vantage facts</CardTitle>
          <CardDescription>Live Booking and Cancellation facts are separate from Granot evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {booking ? (
            <section aria-labelledby="official-booking-heading" className="rounded-md border p-3">
              <h3 id="official-booking-heading" className="font-semibold">Current Booking</h3>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Booking ID</dt><dd className="break-all font-mono text-xs">{booking.id}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Revision</dt><dd>{booking.domain_revision}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Book date</dt><dd>{formatDateTime(booking.book_date)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{booking.customer_name ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{booking.source}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Merchant</dt><dd>{booking.merchant}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Deposit</dt><dd>{formatMoney(booking.deposit_amount)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Binder total</dt><dd>{formatMoney(booking.total_binder_amount)}</dd></div>
              </dl>
              <div className="mt-3"><h4 className="text-sm font-medium">Agent allocations</h4><ul className="mt-1 space-y-1 text-sm">{booking.agent_allocations.map((allocation) => <li key={allocation.agent_id}>{allocation.agent_name}: {formatMoney(allocation.binder_amount)}</li>)}</ul></div>
            </section>
          ) : (
            <FeedbackMessage>
              No official Booking exists. Official create fields remain blank; Granot evidence is not used as a default.
            </FeedbackMessage>
          )}
          {cancellation ? (
            <section aria-labelledby="official-cancellation-heading" className="rounded-md border p-3">
              <h3 id="official-cancellation-heading" className="font-semibold">Current Cancellation</h3>
              <p className="mt-1 text-sm">Cancelled {formatDateTime(cancellation.cancel_date)} · revision {cancellation.domain_revision}</p>
              <p className="text-sm">Refund: {formatMoney(cancellation.refund_amount)}</p>
            </section>
          ) : <p className="text-sm text-muted-foreground">No official Cancellation fact.</p>}
        </CardContent>
      </Card>

      {detail.suggestion && !capabilities.commands ? (
        <Card>
          <CardHeader><CardTitle>Current server suggestion</CardTitle><CardDescription>Suggestion only; no Lead is attached from this screen.</CardDescription></CardHeader>
          <CardContent className="text-sm">
            <p>{detail.suggestion.lead_ref.model} · <span className="font-mono text-xs">{detail.suggestion.lead_ref.id}</span></p>
            <p>{detail.suggestion.confidence} confidence via {detail.suggestion.match_method}</p>
            <p className="text-muted-foreground">{(detail.suggestion.reason_codes ?? []).join(", ")}</p>
          </CardContent>
        </Card>
      ) : null}

      <ReferenceSection
        title={observed.section_label}
        description="Reference only — these values do not change official records."
        open={referenceOpen}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Immutable observations for review. These values do not change official records.</p>
          <ContactBlock title="Observed Granot contact" contact={observed.contact} />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Move date</dt><dd>{observed.move_date ? formatDate(observed.move_date) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Cubic feet</dt><dd>{observed.estimated_cubic_feet ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Estimate</dt><dd>{observed.estimate ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Payment</dt><dd>{observed.payment ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Balance</dt><dd>{observed.balance ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Priority</dt><dd>{observed.granot_priority ?? "—"}</dd></div>
          </dl>
          <div className="grid gap-3 md:grid-cols-2">
            <ContactBlock title="Submitted / ingested contact" contact={contacts.submitted_or_ingested} />
            <ContactBlock title="Accepted Granot contact" contact={contacts.accepted_granot} />
          </div>
        </div>
      </ReferenceSection>

      <ReferenceSection
        title={`Evidence history (${evidence.length})`}
        description="Each captured action remains an individual append-only entry."
        open={referenceOpen}
      >
        {evidence.length === 0 ? <p className="text-sm text-muted-foreground">No evidence summaries.</p> : (
          <ol className="space-y-2">
            {evidence.map((item) => (
              <li key={`${item.observation_id}:${item.decision_id}`} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{String(item.action ?? "").replaceAll("_", " ")}</strong>
                  <time dateTime={item.captured_at}>{formatDateTime(item.captured_at)}</time>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Observation {item.observation_id} · Decision {item.decision_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.normalization_result ?? "normalization unavailable"} · {item.decision_outcome ?? "decision unavailable"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </ReferenceSection>

      <ReferenceSection
        title="Job lifecycle timeline"
        description="Technical history for this job. Open only if you need it."
        open={referenceOpen}
      >
        <JobTimeline page={timeline} />
      </ReferenceSection>
    </div>
  );
}

export function GranotLifecycleCasePage({
  caseId,
  returnTo,
  backLabel,
}: {
  caseId: string;
  returnTo?: string;
  backLabel?: string;
}) {
  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.caseDetail(caseId),
    queryFn: () => fetchGranotLifecycleCase(caseId),
    refetchInterval: 15_000,
  });

  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading lifecycle case…</p>;
  if (query.isError) {
    return <FeedbackMessage tone="error">{query.error instanceof Error ? query.error.message : "Unable to load lifecycle case."}</FeedbackMessage>;
  }
  if (!query.data) {
    return <FeedbackMessage tone="error">Unable to load lifecycle case.</FeedbackMessage>;
  }
  return <CaseDetail
    detail={query.data}
    backHref={isAllowedIntakeReturn(returnTo) ? returnTo : undefined}
    backLabel={isAllowedIntakeReturn(returnTo) ? (backLabel ?? "Back to Intakes") : undefined}
    candidateBrowser={<LeadCandidateBrowser caseId={caseId} />}
    commandForm={query.data.kind === "release"
      ? <ReleaseOwnerActions detail={query.data} />
      : <BookingOwnerActions detail={query.data} />}
  />;
}
