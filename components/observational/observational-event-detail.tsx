"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { formatDateTime } from "@/components/data-table/formatters";
import { fetchOperationalEventDetail } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { entityHref, formatDurationMs, humanizeKey } from "./entity-link";
import { IncidentStatusBadge, LevelBadge, SeverityBadge } from "./severity-badge";
import { JsonBlock } from "./shared";

export function ObservationalEventDetail({
  eventId,
  onClose,
  onApplyFilter,
}: {
  eventId?: string;
  onClose: () => void;
  onApplyFilter: (next: Record<string, string>) => void;
}) {
  const detailQuery = useQuery({
    queryKey: queryKeys.observability.eventDetail(eventId ?? ""),
    queryFn: () => fetchOperationalEventDetail(eventId ?? ""),
    enabled: Boolean(eventId),
  });

  if (!eventId) {
    return null;
  }

  const event = detailQuery.data?.event;
  const incident = detailQuery.data?.incident;
  const recordHref = event ? entityHref(event.entity_type, event.entity_id) : null;

  const pivots: Array<{ label: string; filter: Record<string, string> }> = [];
  if (event?.lead_phone) {
    pivots.push({ label: `Events for ${event.lead_phone}`, filter: { lead_phone: event.lead_phone } });
  }
  if (event?.lead_email) {
    pivots.push({ label: `Events for ${event.lead_email}`, filter: { lead_email: event.lead_email } });
  }
  if (event?.run_id) {
    pivots.push({ label: "Events in this run", filter: { run_id: event.run_id } });
  }
  if (event?.request_id) {
    pivots.push({ label: "Events in this request", filter: { request_id: event.request_id } });
  }
  if (event?.event_key) {
    pivots.push({ label: "Same event key", filter: { event_key: event.event_key } });
  }
  if (event?.entity_id && event.entity_type) {
    pivots.push({
      label: "Events for this entity",
      filter: { entity_type: event.entity_type, entity_id: event.entity_id },
    });
  }

  return (
    <SidePanel
      title={event ? event.event_key : "Operational event"}
      description={event ? `${humanizeKey(event.category)} / ${humanizeKey(event.workflow)}` : undefined}
      open
      onClose={onClose}
    >
      {detailQuery.isPending ? (
        <TableLoadingState label="Loading event detail..." />
      ) : detailQuery.isError ? (
        <TableErrorState
          title="Unable to load this event."
          error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
          onRetry={() => detailQuery.refetch()}
        />
      ) : event ? (
        <div className="space-y-4">
          <DetailSection title="Summary">
            <div className="mb-3 flex items-center gap-2">
              <LevelBadge level={event.level} />
              {event.reportable === false ? (
                <span className="text-xs text-muted-foreground">Internal (not reportable)</span>
              ) : null}
            </div>
            <p className="text-sm">{event.summary}</p>
            <DetailGrid>
              <DetailItem label="Occurred" value={formatDateTime(event.occurred_at)} />
              <DetailItem label="Environment" value={event.environment ?? "-"} />
              <DetailItem label="Workflow" value={humanizeKey(event.workflow)} />
              <DetailItem label="Category" value={humanizeKey(event.category)} />
              <DetailItem label="Route" value={event.route ?? "-"} />
              <DetailItem label="Method / Status" value={
                event.method || event.status_code
                  ? `${event.method ?? "-"} ${event.status_code ?? ""}`.trim()
                  : "-"
              } />
              <DetailItem label="Duration" value={formatDurationMs(event.duration_ms)} />
              <DetailItem label="Request ID" value={event.request_id ?? "-"} />
              <DetailItem label="Run ID" value={event.run_id ?? "-"} />
              <DetailItem label="Fingerprint" value={event.fingerprint ?? "-"} />
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Lead / Entity">
            <DetailGrid>
              <DetailItem label="Lead name" value={event.lead_name ?? "-"} />
              <DetailItem label="Lead phone" value={event.lead_phone ?? "-"} />
              <DetailItem label="Lead email" value={event.lead_email ?? "-"} />
              <DetailItem label="Source company" value={event.source_company ?? "-"} />
              <DetailItem label="Job #" value={event.job_no ?? "-"} />
              <DetailItem
                label="Entity"
                value={
                  event.entity_type ? (
                    recordHref ? (
                      <Link href={recordHref} className="text-primary hover:underline">
                        {humanizeKey(event.entity_type)} {event.entity_id}
                      </Link>
                    ) : (
                      `${humanizeKey(event.entity_type)} ${event.entity_id ?? ""}`
                    )
                  ) : (
                    "-"
                  )
                }
              />
            </DetailGrid>
          </DetailSection>

          {pivots.length > 0 ? (
            <DetailSection title="Pivot" description="Filter the events table by this event's identifiers.">
              <div className="flex flex-wrap gap-2">
                {pivots.map((pivot) => (
                  <Button
                    key={pivot.label}
                    variant="outline"
                    className="h-8 px-3 text-xs normal-case tracking-normal"
                    onClick={() => onApplyFilter(pivot.filter)}
                  >
                    {pivot.label}
                  </Button>
                ))}
              </div>
            </DetailSection>
          ) : null}

          {incident ? (
            <DetailSection title="Linked incident">
              <div className="mb-3 flex items-center gap-2">
                <SeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
              </div>
              <p className="text-sm font-medium">{incident.title}</p>
              <DetailGrid>
                <DetailItem label="First seen" value={formatDateTime(incident.first_seen_at)} />
                <DetailItem label="Last seen" value={formatDateTime(incident.last_seen_at)} />
                <DetailItem label="Count" value={incident.count ?? 1} />
                <DetailItem
                  label="Incident"
                  value={
                    <Link
                      href={`/observational?tab=incidents&record=${incident._id}`}
                      className="text-primary hover:underline"
                    >
                      Open incident detail
                    </Link>
                  }
                />
              </DetailGrid>
            </DetailSection>
          ) : null}

          <DetailSection title="Details">
            <JsonBlock value={event.details} />
          </DetailSection>

          {event.trace ? (
            <DetailSection title="Trace">
              <JsonBlock value={event.trace} />
            </DetailSection>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
