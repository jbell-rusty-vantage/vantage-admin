"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/components/data-table/formatters";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchBookingIntakeCreatingObservation,
  type BookingIntakeCreatingObservation,
  type BookingPriorityPairingProjection,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import {
  creatingObservationSummary,
  creatingObservationTitle,
  intakeJobHref,
  intakePairingClassLabel,
} from "./intake-copy";

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function PriorityPairingSection({
  pairing,
  normalizedJobNo,
}: {
  pairing: BookingPriorityPairingProjection | null | undefined;
  normalizedJobNo?: string;
}) {
  if (!pairing) return null;
  const warning = pairing.pairing === "booked_without_priority_5";
  return (
    <section aria-labelledby="priority-pairing-heading" className="space-y-2">
      <h3 id="priority-pairing-heading" className="text-sm font-semibold text-navy">
        Priority pairing
      </h3>
      <p className={warning ? "text-sm font-medium text-amber-800" : "text-sm"}>
        {intakePairingClassLabel(pairing.pairing)}
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Creating Booked Priority</dt>
          <dd>
            {pairing.creating_booked.priority_valid
              ? pairing.creating_booked.priority_canonical ?? "—"
              : "invalid or missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Creating Booked Observation</dt>
          <dd className="break-all font-mono text-xs">{pairing.creating_booked.observation_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Preceding Priority 5</dt>
          <dd>
            {pairing.preceding_priority_5
              ? `${formatDateTime(pairing.preceding_priority_5.captured_at)} · ${pairing.preceding_priority_5.observation_id}`
              : "None"}
          </dd>
        </div>
        {pairing.later_priority_5 ? (
          <div>
            <dt className="text-xs text-muted-foreground">Later Priority 5</dt>
            <dd>
              {formatDateTime(pairing.later_priority_5.captured_at)} · {pairing.later_priority_5.observation_id}
            </dd>
          </div>
        ) : null}
      </dl>
      {normalizedJobNo ? (
        <p className="text-xs">
          <a className="text-trust-blue hover:underline" href={intakeJobHref(normalizedJobNo)}>
            Open job timeline
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function CreatingObservationView({
  data,
}: {
  data: BookingIntakeCreatingObservation;
}) {
  return (
    <div className="space-y-4">
      <PriorityPairingSection
        pairing={data.priority_pairing}
        normalizedJobNo={data.normalized_job_no}
      />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Captured</dt>
          <dd>{data.captured_at ? formatDateTime(data.captured_at) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Selection</dt>
          <dd>{creatingObservationTitle(data.selection)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Observation</dt>
          <dd className="break-all font-mono text-xs">{data.observation_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Receipt</dt>
          <dd className="break-all font-mono text-xs">{data.receipt_id}</dd>
        </div>
      </dl>
      <section aria-labelledby={`creating-observation-statement-${data.case_id}`}>
        <h3
          id={`creating-observation-statement-${data.case_id}`}
          className="text-sm font-semibold text-navy"
        >
          Granot statement
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Credential-redacted payload that created this booking intake. Prefer the latest
          booking_status_changed Booked body when one exists.
        </p>
        <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-steel-100 p-3 text-xs leading-5">
          {formatJson(data.granot_statement)}
        </pre>
      </section>
      <section aria-labelledby={`creating-observation-normalized-${data.case_id}`}>
        <h3
          id={`creating-observation-normalized-${data.case_id}`}
          className="text-sm font-semibold text-navy"
        >
          Normalized Granot Observation
        </h3>
        <pre className="mt-2 max-h-80 overflow-auto rounded-md border bg-white p-3 text-xs leading-5">
          {formatJson(data.observation)}
        </pre>
      </section>
    </div>
  );
}

export function CreatingObservationAccordion({
  caseId,
  loadOn = "open",
}: {
  caseId: string;
  loadOn?: "open" | "mount";
}) {
  const [open, setOpen] = useState(false);
  const enabled = Boolean(caseId) && (loadOn === "mount" || open);
  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.creatingObservation(caseId),
    queryFn: () => fetchBookingIntakeCreatingObservation(caseId),
    enabled,
  });
  const title = creatingObservationTitle(query.data?.selection);
  const summary = query.data
    ? creatingObservationSummary(query.data)
    : "Latest payload that created this booking intake";

  return (
    <details
      className="rounded-lg border bg-background"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
        {title}
        <span className="ml-2 font-normal text-muted-foreground">{summary}</span>
      </summary>
      <div className="border-t px-4 py-4">
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading Granot observation payload…
          </p>
        ) : null}
        {query.isError ? (
          <FeedbackMessage tone="error">
            {query.error instanceof Error
              ? query.error.message
              : "Unable to load the Granot observation payload."}
          </FeedbackMessage>
        ) : null}
        {query.data ? <CreatingObservationView data={query.data} /> : null}
      </div>
    </details>
  );
}
