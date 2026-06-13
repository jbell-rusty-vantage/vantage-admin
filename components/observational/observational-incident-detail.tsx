"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/side-panel";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DataTable } from "@/components/data-table/table-shell";
import { formatDateTime } from "@/components/data-table/formatters";
import {
  deleteObservabilityRecord,
  fetchOperationalIncidentDetail,
  updateOperationalIncidentStatus,
  type IncidentStatus,
  type NotificationDelivery,
  type OperationalEvent,
} from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { entityHref, humanizeKey } from "./entity-link";
import { confirmDeleteRecords } from "./observational-delete-controls";
import {
  IncidentStatusBadge,
  LevelBadge,
  NotificationStatusBadge,
  SeverityBadge,
} from "./severity-badge";
import { JsonBlock } from "./shared";

/** Mirrors the backend's allowed transitions so invalid buttons never render. */
const STATUS_ACTIONS: Record<IncidentStatus, Array<{ to: IncidentStatus; label: string }>> = {
  open: [
    { to: "acknowledged", label: "Acknowledge" },
    { to: "resolved", label: "Resolve" },
    { to: "ignored", label: "Ignore" },
  ],
  acknowledged: [
    { to: "resolved", label: "Resolve" },
    { to: "ignored", label: "Ignore" },
  ],
  resolved: [{ to: "open", label: "Reopen" }],
  auto_resolved: [{ to: "open", label: "Reopen" }],
  ignored: [{ to: "open", label: "Reopen" }],
};

export function ObservationalIncidentDetail({
  incidentId,
  onClose,
  onDeleted,
}: {
  incidentId?: string;
  onClose: () => void;
  onDeleted?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  const detailQuery = useQuery({
    queryKey: queryKeys.observability.incidentDetail(incidentId ?? ""),
    queryFn: () => fetchOperationalIncidentDetail(incidentId ?? ""),
    enabled: Boolean(incidentId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: IncidentStatus) =>
      updateOperationalIncidentStatus(incidentId ?? "", {
        status,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async (_, status) => {
      setFeedback({ tone: "success", message: `Incident marked ${status.replace(/_/g, " ")}.` });
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.observability.all }),
      ]);
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Status update failed.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteObservabilityRecord("incidents", incidentId ?? ""),
    onSuccess: async () => {
      await onDeleted?.();
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Delete failed.",
      });
    },
  });

  if (!incidentId) {
    return null;
  }

  const detail = detailQuery.data;
  const incident = detail?.incident;
  const recordHref = incident ? entityHref(incident.entity_type, incident.entity_id) : null;
  const actions = incident ? (STATUS_ACTIONS[incident.status] ?? []) : [];

  return (
    <SidePanel
      title={incident ? incident.title : "Operational incident"}
      description={
        incident ? `${humanizeKey(incident.category)} / ${humanizeKey(incident.workflow)}` : undefined
      }
      open
      onClose={onClose}
    >
      {detailQuery.isPending ? (
        <TableLoadingState label="Loading incident detail..." />
      ) : detailQuery.isError ? (
        <TableErrorState
          title="Unable to load this incident."
          error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
          onRetry={() => detailQuery.refetch()}
        />
      ) : incident && detail ? (
        <div className="space-y-4">
          {feedback ? <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage> : null}

          <DetailSection title="Status">
            <div className="mb-3 flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
              <span className="text-xs text-muted-foreground">
                Seen {incident.count ?? 1} time{(incident.count ?? 1) === 1 ? "" : "s"}
              </span>
              <Button
                variant="outline"
                className="ml-auto h-8 px-3 text-xs"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirmDeleteRecords("incident", 1)) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Delete
              </Button>
            </div>
            {incident.summary ? <p className="mb-3 text-sm">{incident.summary}</p> : null}
            <DetailGrid>
              <DetailItem label="First seen" value={formatDateTime(incident.first_seen_at)} />
              <DetailItem label="Last seen" value={formatDateTime(incident.last_seen_at)} />
              <DetailItem label="Acknowledged" value={
                incident.acknowledged_at
                  ? `${formatDateTime(incident.acknowledged_at)}${incident.acknowledged_by ? ` by ${incident.acknowledged_by}` : ""}`
                  : "-"
              } />
              <DetailItem label="Resolved" value={formatDateTime(incident.resolved_at)} />
              <DetailItem label="Event key" value={incident.event_key} />
              <DetailItem label="Fingerprint" value={incident.fingerprint ?? "-"} />
            </DetailGrid>
            {actions.length > 0 ? (
              <div className="mt-4 space-y-2">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note for the audit trail"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button
                      key={action.to}
                      variant={action.to === "resolved" ? "default" : "outline"}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate(action.to)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </DetailSection>

          <DetailSection title="Suggested action">
            <p className="text-sm">{detail.suggested_action}</p>
          </DetailSection>

          <DetailSection title="Lead / Entity">
            <DetailGrid>
              <DetailItem label="Lead name" value={incident.lead_name ?? "-"} />
              <DetailItem label="Lead phone" value={incident.lead_phone ?? "-"} />
              <DetailItem label="Lead email" value={incident.lead_email ?? "-"} />
              <DetailItem label="Source company" value={incident.source_company ?? "-"} />
              <DetailItem label="Route" value={incident.route ?? "-"} />
              <DetailItem
                label="Entity"
                value={
                  incident.entity_type ? (
                    recordHref ? (
                      <Link href={recordHref} className="text-primary hover:underline">
                        {humanizeKey(incident.entity_type)} {incident.entity_id}
                      </Link>
                    ) : (
                      `${humanizeKey(incident.entity_type)} ${incident.entity_id ?? ""}`
                    )
                  ) : (
                    "-"
                  )
                }
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection
            title={`Latest events (${detail.events.length})`}
            description="Most recent events linked to this incident."
          >
            {detail.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked events.</p>
            ) : (
              <DataTable<OperationalEvent>
                items={detail.events}
                getRowKey={(event) => event._id}
                compact
                columns={[
                  {
                    key: "occurred_at",
                    header: "Occurred",
                    cell: (event) => formatDateTime(event.occurred_at),
                  },
                  { key: "level", header: "Level", cell: (event) => <LevelBadge level={event.level} /> },
                  {
                    key: "summary",
                    header: "Summary",
                    truncate: true,
                    cell: (event) => event.summary,
                  },
                  {
                    key: "open",
                    header: "",
                    cell: (event) => (
                      <Link
                        href={`/observational?tab=events&record=${event._id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    ),
                  },
                ]}
              />
            )}
          </DetailSection>

          <DetailSection title={`Notifications (${detail.notifications.length})`}>
            {detail.notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notification deliveries for this incident.
              </p>
            ) : (
              <DataTable<NotificationDelivery>
                items={detail.notifications}
                getRowKey={(delivery) => delivery._id}
                compact
                columns={[
                  {
                    key: "createdAt",
                    header: "Created",
                    cell: (delivery) => formatDateTime(delivery.createdAt),
                  },
                  {
                    key: "purpose",
                    header: "Purpose",
                    cell: (delivery) => humanizeKey(delivery.purpose),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (delivery) => <NotificationStatusBadge status={delivery.status} />,
                  },
                  {
                    key: "subject",
                    header: "Subject",
                    truncate: true,
                    cell: (delivery) => delivery.subject ?? "-",
                  },
                ]}
              />
            )}
          </DetailSection>

          {incident.last_details ? (
            <DetailSection title="Last event details">
              <JsonBlock value={incident.last_details} />
            </DetailSection>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
