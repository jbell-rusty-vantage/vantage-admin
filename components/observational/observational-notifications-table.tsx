"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/side-panel";
import { DataTable } from "@/components/data-table/table-shell";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { PaginationControls } from "@/components/data-table/pagination-controls";
import { formatDateTime } from "@/components/data-table/formatters";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { SelectFilter } from "@/components/filters/select-filter";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import {
  deleteObservabilityRecord,
  deleteObservabilityRecords,
  fetchNotificationDeliveries,
  type NotificationDelivery,
} from "@/lib/api/admin";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey, pickApiFilters } from "./entity-link";
import {
  confirmDeleteRecords,
  formatDeleteResult,
  SelectionCheckbox,
} from "./observational-delete-controls";
import { NotificationStatusBadge } from "./severity-badge";
import { FacetsErrorNotice, JsonBlock, toSelectOptions, useObservabilityFacets } from "./shared";

const NOTIFICATION_FILTER_KEYS = [
  "from",
  "to",
  "status",
  "purpose",
  "recipient_type",
  "provider",
  "incident_id",
  "report_run_id",
  "q",
] as const;

export function ObservationalNotificationsTable() {
  const queryClient = useQueryClient();
  const { filters, update, setPage, setLimit, reset } = useUrlTableState({ limit: 50 });
  const facets = useObservabilityFacets();
  const [selected, setSelected] = useState<NotificationDelivery | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const apiFilters = useMemo(
    () => ({
      ...pickApiFilters(filters, NOTIFICATION_FILTER_KEYS),
      page: filters.page,
      limit: filters.limit,
    }),
    [filters],
  );

  const deliveriesQuery = useQuery({
    queryKey: queryKeys.observability.notifications(apiFilters),
    queryFn: () => fetchNotificationDeliveries(apiFilters),
    placeholderData: keepPreviousData,
  });

  function textValue(key: string): string {
    const value = filters[key];
    return typeof value === "string" ? value : "";
  }

  const data = deliveriesQuery.data;
  const currentPageIds = useMemo(() => data?.items.map((delivery) => delivery._id) ?? [], [data]);
  const selectedCount = selectedIds.size;
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteObservabilityRecords("notifications", ids),
    onSuccess: async (result) => {
      setSelectedIds(new Set());
      setFeedback({
        tone: result.skipped.length > 0 ? "error" : "success",
        message: formatDeleteResult(result),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.observability.all });
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Delete failed.",
      });
    },
  });

  const singleDeleteMutation = useMutation({
    mutationFn: (id: string) => deleteObservabilityRecord("notifications", id),
    onSuccess: async (result) => {
      setSelected(null);
      setFeedback({ tone: "success", message: formatDeleteResult(result) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.observability.all });
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Delete failed.",
      });
    },
  });

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleCurrentPage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of currentPageIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0 || !confirmDeleteRecords("notification", ids.length)) {
      return;
    }
    batchDeleteMutation.mutate(ids);
  }

  return (
    <div className="space-y-4">
      {facets.isError ? <FacetsErrorNotice error={facets.error} /> : null}
      <FilterBar onReset={reset}>
        <FilterField label="Search subject" className="md:col-span-2">
          <Input
            value={textValue("q")}
            onChange={(event) => update({ q: event.target.value })}
          />
        </FilterField>
        <FilterField label="Date range" className="md:col-span-2">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update({ from: range.from ?? null, to: range.to ?? null })}
          />
        </FilterField>
        <FilterField label="Status">
          <SelectFilter
            value={textValue("status")}
            options={toSelectOptions(facets.values.notification_statuses)}
            onChange={(value) => update({ status: value })}
          />
        </FilterField>
        <FilterField label="Purpose">
          <SelectFilter
            value={textValue("purpose")}
            options={toSelectOptions(facets.values.notification_purposes, { humanize: true })}
            onChange={(value) => update({ purpose: value })}
          />
        </FilterField>
        <FilterField label="Recipient type">
          <SelectFilter
            value={textValue("recipient_type")}
            options={toSelectOptions(facets.values.notification_recipient_types, { humanize: true })}
            onChange={(value) => update({ recipient_type: value })}
          />
        </FilterField>
        <FilterField label="Incident ID">
          <Input
            value={textValue("incident_id")}
            onChange={(event) => update({ incident_id: event.target.value })}
          />
        </FilterField>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typeof data?.total === "number"
            ? `${data.total} notifications match these filters.${selectedCount > 0 ? ` ${selectedCount} selected.` : ""}`
            : null}
        </p>
        <Button
          variant="outline"
          onClick={deleteSelected}
          disabled={selectedCount === 0 || batchDeleteMutation.isPending}
        >
          Delete selected
        </Button>
      </div>

      {feedback ? <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage> : null}

      {deliveriesQuery.isPending ? (
        <TableLoadingState label="Loading notification deliveries..." />
      ) : deliveriesQuery.isError ? (
        <TableErrorState
          title="Unable to load notification deliveries."
          error={deliveriesQuery.error instanceof Error ? deliveriesQuery.error.message : undefined}
          onRetry={() => deliveriesQuery.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <TableEmptyState label="No notification deliveries match these filters." />
      ) : (
        <>
          <DataTable<NotificationDelivery>
            items={data.items}
            getRowKey={(delivery) => delivery._id}
            onRowClick={(delivery) => setSelected(delivery)}
            stickyHeader
            columns={[
              {
                key: "select",
                header: (
                  <SelectionCheckbox
                    label="Select all notifications on this page"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPage}
                  />
                ),
                cell: (delivery) => (
                  <SelectionCheckbox
                    label={`Select notification ${delivery.subject ?? delivery._id}`}
                    checked={selectedIds.has(delivery._id)}
                    onChange={(checked) => toggleSelected(delivery._id, checked)}
                  />
                ),
              },
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
                key: "recipient_type",
                header: "Recipient Type",
                cell: (delivery) => humanizeKey(delivery.recipient_type),
              },
              {
                key: "subject",
                header: "Subject",
                truncate: true,
                cell: (delivery) => delivery.subject ?? "-",
              },
              { key: "provider", header: "Provider", cell: (delivery) => delivery.provider ?? "-" },
              {
                key: "attempt_count",
                header: "Attempts",
                cell: (delivery) => delivery.attempt_count ?? 0,
              },
              {
                key: "sent_at",
                header: "Sent At",
                cell: (delivery) => formatDateTime(delivery.sent_at),
              },
              {
                key: "error_message",
                header: "Error",
                truncate: true,
                cell: (delivery) => delivery.error_message ?? "-",
              },
            ]}
          />
          <PaginationControls
            page={data.page}
            limit={data.limit}
            total={data.total}
            hasNextPage={data.has_next_page}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      )}

      {selected ? (
        <SidePanel
          title={selected.subject || "Notification delivery"}
          description={`${humanizeKey(selected.purpose)} via ${selected.provider ?? "unknown provider"}`}
          open
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4">
            <DetailSection title="Delivery">
              <div className="mb-3 flex items-center gap-2">
                <NotificationStatusBadge status={selected.status} />
                <Button
                  variant="outline"
                  className="ml-auto h-8 px-3 text-xs"
                  disabled={singleDeleteMutation.isPending}
                  onClick={() => {
                    if (confirmDeleteRecords("notification", 1)) {
                      singleDeleteMutation.mutate(selected._id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
              <DetailGrid>
                <DetailItem label="Created" value={formatDateTime(selected.createdAt)} />
                <DetailItem label="Sent at" value={formatDateTime(selected.sent_at)} />
                <DetailItem label="Recipient type" value={humanizeKey(selected.recipient_type)} />
                <DetailItem label="To" value={selected.to?.join(", ") ?? "-"} />
                <DetailItem label="From" value={selected.from ?? "-"} />
                <DetailItem label="Attempts" value={selected.attempt_count ?? 0} />
                <DetailItem
                  label="Next attempt"
                  value={formatDateTime(selected.next_attempt_at)}
                />
                <DetailItem
                  label="Provider message ID"
                  value={selected.provider_message_id ?? "-"}
                />
              </DetailGrid>
            </DetailSection>

            {selected.error_message ? (
              <DetailSection title="Error">
                <p className="text-sm text-destructive">{selected.error_message}</p>
              </DetailSection>
            ) : null}

            <DetailSection title="Body preview">
              <p className="whitespace-pre-wrap text-sm">
                {selected.body_text_preview || "No preview recorded."}
              </p>
            </DetailSection>

            {selected.incident_id || selected.event_id || selected.report_run_id ? (
              <DetailSection title="Linked records">
                <ul className="space-y-1 text-sm">
                  {selected.incident_id ? (
                    <li>
                      <Link
                        href={`/observational?tab=incidents&record=${selected.incident_id}`}
                        className="text-primary hover:underline"
                      >
                        Linked incident
                      </Link>
                    </li>
                  ) : null}
                  {selected.event_id ? (
                    <li>
                      <Link
                        href={`/observational?tab=events&record=${selected.event_id}`}
                        className="text-primary hover:underline"
                      >
                        Linked event
                      </Link>
                    </li>
                  ) : null}
                  {selected.report_run_id ? (
                    <li>
                      <Link
                        href={`/observational?tab=reports&record=${selected.report_run_id}`}
                        className="text-primary hover:underline"
                      >
                        Linked report run
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </DetailSection>
            ) : null}

            {selected.provider_response ? (
              <DetailSection title="Provider response">
                <JsonBlock value={selected.provider_response} />
              </DetailSection>
            ) : null}
          </div>
        </SidePanel>
      ) : null}
    </div>
  );
}
