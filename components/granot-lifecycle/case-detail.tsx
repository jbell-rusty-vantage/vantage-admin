"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatMoney } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { fetchGranotLifecycleCase, type GranotLifecycleCaseDetail } from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { JobTimeline } from "./job-timeline";
import { LeadCandidateBrowser } from "./lead-candidate-browser";

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

export function CaseDetail({
  detail,
  candidateBrowser,
}: {
  detail: GranotLifecycleCaseDetail;
  candidateBrowser?: ReactNode;
}) {
  const booking = detail.official_current.booking;
  const cancellation = detail.official_current.cancellation;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Granot lifecycle case</p>
          <h1 className="text-2xl font-semibold text-navy">
            {detail.kind} #{detail.sequence_number} · {detail.job_no}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{detail.case_id}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={detail.state === "open" ? "warning" : "muted"}>{detail.state}</StatusBadge>
          <StatusBadge>{detail.mode.replaceAll("_", " ")}</StatusBadge>
          <StatusBadge tone="muted">case rev {detail.case_revision}</StatusBadge>
          <StatusBadge tone="muted">evidence rev {detail.evidence_revision}</StatusBadge>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detail.observed_context.section_label}</CardTitle>
            <CardDescription>Immutable observations for review. These values do not change official records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ContactBlock title="Observed Granot contact" contact={detail.observed_context.contact} />
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Move date</dt><dd>{detail.observed_context.move_date ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Cubic feet</dt><dd>{detail.observed_context.estimated_cubic_feet ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Estimate</dt><dd>{detail.observed_context.estimate ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Payment</dt><dd>{detail.observed_context.payment ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Balance</dt><dd>{detail.observed_context.balance ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Priority</dt><dd>{detail.observed_context.granot_priority ?? "—"}</dd></div>
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              <ContactBlock title="Submitted / ingested contact" contact={detail.contacts.submitted_or_ingested} />
              <ContactBlock title="Accepted Granot contact" contact={detail.contacts.accepted_granot} />
            </div>
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence history ({detail.evidence.length})</CardTitle>
          <CardDescription>Each captured action remains an individual append-only entry.</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.evidence.length === 0 ? <p className="text-sm text-muted-foreground">No evidence summaries.</p> : (
            <ol className="space-y-2">
              {detail.evidence.map((evidence) => (
                <li key={`${evidence.observation_id}:${evidence.decision_id}`} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{evidence.action.replaceAll("_", " ")}</strong>
                    <time dateTime={evidence.captured_at}>{formatDateTime(evidence.captured_at)}</time>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Observation {evidence.observation_id} · Decision {evidence.decision_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {evidence.normalization_result ?? "normalization unavailable"} · {evidence.decision_outcome ?? "decision unavailable"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {detail.suggestion ? (
        <Card>
          <CardHeader><CardTitle>Current server suggestion</CardTitle><CardDescription>Suggestion only; no Lead is attached from this screen.</CardDescription></CardHeader>
          <CardContent className="text-sm">
            <p>{detail.suggestion.lead_ref.model} · <span className="font-mono text-xs">{detail.suggestion.lead_ref.id}</span></p>
            <p>{detail.suggestion.confidence} confidence via {detail.suggestion.match_method}</p>
            <p className="text-muted-foreground">{detail.suggestion.reason_codes.join(", ")}</p>
          </CardContent>
        </Card>
      ) : null}

      {detail.employee_booking_lead_reconciliation ? (
        <FeedbackMessage tone="warning">
          This Booking has no Lead. Continue in the separate Employee Booking Lead Reconciliation workflow: {" "}
          <Link className="font-semibold underline" href={detail.employee_booking_lead_reconciliation.href}>
            open case {detail.employee_booking_lead_reconciliation.case_id}
          </Link>
          {" "}({detail.employee_booking_lead_reconciliation.status}).
        </FeedbackMessage>
      ) : null}

      <JobTimeline page={detail.timeline} />
      {detail.candidate_search.available && !detail.capabilities.referral ? candidateBrowser : null}
    </div>
  );
}

export function GranotLifecycleCasePage({ caseId }: { caseId: string }) {
  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.caseDetail(caseId),
    queryFn: () => fetchGranotLifecycleCase(caseId),
    refetchInterval: 15_000,
  });

  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading lifecycle case…</p>;
  if (query.isError) {
    return <FeedbackMessage tone="error">{query.error instanceof Error ? query.error.message : "Unable to load lifecycle case."}</FeedbackMessage>;
  }
  return <CaseDetail detail={query.data} candidateBrowser={<LeadCandidateBrowser caseId={caseId} />} />;
}

