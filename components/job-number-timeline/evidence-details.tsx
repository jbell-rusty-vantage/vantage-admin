import { formatDate, formatDateTime } from "@/components/data-table/formatters";
import type { EnhancedJobTimelineEvent } from "@/lib/api/jobNumberTimeline";
import { relatedInActivity, safeChangedFieldGroups } from "./v2";

const EVIDENCE_DATA_KEYS = [
  "ingestion_origin",
  "command_name",
  "lead_model",
  "origin",
  "ingress",
  "purpose",
  "status",
  "skip_reason",
  "consent_basis",
  "route_event_class",
  "normalization_result",
  "outcome",
  "reason_code",
  "execution_mode",
  "attempt",
  "event",
  "state",
  "mode",
  "resource",
  "operation",
  "entity_model",
  "qualification_outcome",
] as const;

function asDetail(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  return null;
}

function clockLabel(field: string): string {
  const last = field.split(".").pop() ?? field;
  if (last === "applied_at") return "Applied at";
  if (last === "captured_at") return "Captured at";
  if (last === "decided_at") return "Decided at";
  if (last === "createdAt") return "Recorded at";
  if (last === "received_at") return "Received at";
  if (last === "delivered_at") return "Delivered at";
  if (last === "updatedAt") return "Updated at";
  if (last === "timestamp") return "Lead time";
  return last.replaceAll("_", " ");
}

function showRecordedClock(event: EnhancedJobTimelineEvent): boolean {
  if (!event.time.recorded_at || !event.time.recorded_at_field) return false;
  return !(
    event.time.recorded_at === event.time.occurred_at
    && event.time.recorded_at_field === event.time.occurred_at_field
  );
}

type FormSnapshot = {
  submitted_as?: string;
  phone_masked?: string;
  email_masked?: string;
  move_date?: string;
  move_size?: string;
  pickup?: string;
  delivery?: string;
};

function formSnapshotOf(event: EnhancedJobTimelineEvent): FormSnapshot | null {
  const value = event.data.form_snapshot;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as FormSnapshot;
  if (
    !row.submitted_as
    && !row.phone_masked
    && !row.email_masked
    && !row.move_date
    && !row.move_size
    && !row.pickup
    && !row.delivery
  ) {
    return null;
  }
  return row;
}

function ClockRow({ field, at }: { field: string; at: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-steel">{clockLabel(field)}</dt>
      <dd className="mt-0.5">
        <time dateTime={at}>{formatDateTime(at)}</time>
      </dd>
    </div>
  );
}

function FormSnapshotCard({ snapshot }: { snapshot: FormSnapshot }) {
  const rows: { key: string; text: string }[] = [];
  if (snapshot.submitted_as) rows.push({ key: "Submitted as", text: snapshot.submitted_as });
  if (snapshot.phone_masked) rows.push({ key: "Phone", text: snapshot.phone_masked });
  if (snapshot.email_masked) rows.push({ key: "Email", text: snapshot.email_masked });
  if (snapshot.move_date) rows.push({ key: "Move date", text: formatDate(snapshot.move_date) });
  if (snapshot.move_size) rows.push({ key: "Move size", text: snapshot.move_size });
  if (snapshot.pickup) rows.push({ key: "Pickup", text: snapshot.pickup });
  if (snapshot.delivery) rows.push({ key: "Delivery", text: snapshot.delivery });
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg bg-steel-100/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy">Form snapshot</p>
      <dl className="mt-2 grid gap-2">
        {rows.map((row) => (
          <div key={row.key} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-steel">{row.key}</dt>
            <dd className="mt-0.5 text-navy">{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EvidenceDetails({
  event,
  events,
}: {
  event: EnhancedJobTimelineEvent;
  events: EnhancedJobTimelineEvent[];
}) {
  const related = relatedInActivity(event, events);
  const groups = safeChangedFieldGroups(event);
  const snapshot = formSnapshotOf(event);
  const source =
    asDetail(event.data.ingress)
    ?? asDetail(event.data.origin)
    ?? asDetail(event.data.ingestion_origin);
  const command = asDetail(event.data.command_name);
  const extras: { key: string; text: string }[] = [];
  for (const key of EVIDENCE_DATA_KEYS) {
    if (key === "command_name" || key === "ingress" || key === "origin" || key === "ingestion_origin") {
      continue;
    }
    const text = asDetail(event.data[key]);
    if (text) extras.push({ key, text });
  }

  return (
    <details className="group mt-3 border-t border-steel-200 pt-3">
      <summary
        className="cursor-pointer text-xs font-semibold text-navy outline-none focus-visible:ring-2 focus-visible:ring-gold"
        aria-label={`View evidence for ${event.headline}`}
      >
        View evidence
      </summary>
      <div className="mt-3 grid gap-3 text-xs text-steel">
        {snapshot ? <FormSnapshotCard snapshot={snapshot} /> : null}
        <dl className="grid gap-2">
          <ClockRow field={event.time.occurred_at_field} at={event.time.occurred_at} />
          {showRecordedClock(event) ? (
            <ClockRow field={event.time.recorded_at_field!} at={event.time.recorded_at!} />
          ) : null}
          {source ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-steel">Source</dt>
              <dd className="mt-0.5">{source}</dd>
            </div>
          ) : null}
          {command ? (
            <div className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-steel">Command</dt>
              <dd className="mt-0.5">{command}</dd>
            </div>
          ) : null}
          {extras.map((row) => (
            <div key={row.key} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-steel">
                {row.key.replaceAll("_", " ")}
              </dt>
              <dd className="mt-0.5">{row.text}</dd>
            </div>
          ))}
        </dl>
        {groups.length > 0 ? (
          <p>
            Changed fields: {groups.join(" · ")}
          </p>
        ) : null}
        <p>{event.correlation.explanation}</p>
        {related.length > 0 ? (
          <ul className="list-disc pl-4">
            {related.map((step) => (
              <li key={step.id}>{step.headline}</li>
            ))}
          </ul>
        ) : null}
        {event.evidence.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {event.evidence.map((ref) => (
              <li
                key={`${ref.source_kind}:${ref.ref}`}
                className="rounded-full bg-steel-100 px-2 py-0.5 text-[10px] font-bold uppercase text-navy"
              >
                {ref.safe_label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
