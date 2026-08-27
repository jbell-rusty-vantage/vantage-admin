import { formatDateTime } from "@/components/data-table/formatters";
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

export function EvidenceDetails({
  event,
  events,
}: {
  event: EnhancedJobTimelineEvent;
  events: EnhancedJobTimelineEvent[];
}) {
  const related = relatedInActivity(event, events);
  const groups = safeChangedFieldGroups(event);
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
      <summary className="cursor-pointer text-xs font-semibold text-navy outline-none focus-visible:ring-2 focus-visible:ring-gold">
        View evidence
      </summary>
      <div className="mt-3 grid gap-3 text-xs text-steel">
        <dl className="grid grid-cols-[minmax(7rem,10rem)_1fr] gap-x-3 gap-y-1">
          <dt className="font-bold uppercase tracking-wide">{event.time.occurred_at_field}</dt>
          <dd>
            <time dateTime={event.time.occurred_at}>{formatDateTime(event.time.occurred_at)}</time>
          </dd>
          {event.time.recorded_at && event.time.recorded_at_field ? (
            <>
              <dt className="font-bold uppercase tracking-wide">{event.time.recorded_at_field}</dt>
              <dd>
                <time dateTime={event.time.recorded_at}>{formatDateTime(event.time.recorded_at)}</time>
              </dd>
            </>
          ) : null}
          {source ? (
            <>
              <dt className="font-bold uppercase tracking-wide">Source</dt>
              <dd>{source}</dd>
            </>
          ) : null}
          {command ? (
            <>
              <dt className="font-bold uppercase tracking-wide">Command</dt>
              <dd>{command}</dd>
            </>
          ) : null}
          {extras.map((row) => (
            <span key={row.key} className="contents">
              <dt className="font-bold uppercase tracking-wide">{row.key.replaceAll("_", " ")}</dt>
              <dd>{row.text}</dd>
            </span>
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
