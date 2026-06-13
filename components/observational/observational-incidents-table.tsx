"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackMessage } from "@/components/ui/feedback";
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
import {
  fetchOperationalIncidents,
  observabilityIncidentsExportUrl,
  deleteObservabilityRecords,
  updateOperationalIncidentStatuses,
  type OperationalIncident,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import type { SelectOption } from "@/lib/api/types";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey, pickApiFilters } from "./entity-link";
import { ObservationalIncidentDetail } from "./observational-incident-detail";
import {
  confirmDeleteRecords,
  formatDeleteResult,
  SelectionCheckbox,
} from "./observational-delete-controls";
import { IncidentStatusBadge, SeverityBadge } from "./severity-badge";
import { FacetsErrorNotice, toSelectOptions, useObservabilityFacets } from "./shared";

const INCIDENT_FILTER_KEYS = [
  "from",
  "to",
  "status",
  "severity",
  "category",
  "workflow",
  "event_key",
  "source_company",
  "lead_name",
  "lead_phone",
  "lead_email",
  "entity_type",
  "entity_id",
  "owner_visible",
  "q",
] as const;

const OWNER_VISIBLE_OPTIONS: SelectOption[] = [
  { value: "true", label: "Owner visible" },
  { value: "false", label: "Internal only" },
];

export function ObservationalIncidentsTable() {
  const queryClient = useQueryClient();
  const { filters, update, setPage, setLimit, reset } = useUrlTableState({ limit: 50 });
  const facets = useObservabilityFacets();
  const [exportError, setExportError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const apiFilters = useMemo(() => {
    const picked = pickApiFilters(filters, INCIDENT_FILTER_KEYS);
    return {
      ...picked,
      page: filters.page,
      limit: filters.limit,
      ...(filters.sort ? { sort: filters.sort, direction: filters.direction } : {}),
    };
  }, [filters]);

  const incidentsQuery = useQuery({
    queryKey: queryKeys.observability.incidents(apiFilters),
    queryFn: () => fetchOperationalIncidents(apiFilters),
    placeholderData: keepPreviousData,
  });

  const selectedId = typeof filters.record === "string" ? filters.record : undefined;
  const currentPageIds = useMemo(() => incidentsQuery.data?.items.map((incident) => incident._id) ?? [], [
    incidentsQuery.data,
  ]);
  const selectedCount = selectedIds.size;
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  const resolveMutation = useMutation({
    mutationFn: () =>
      updateOperationalIncidentStatuses({
        ids: [...selectedIds],
        status: "resolved",
      }),
    onSuccess: async (result) => {
      setSelectedIds(new Set());
      setFeedback({
        tone: result.skipped.length > 0 ? "error" : "success",
        message:
          result.skipped.length > 0
            ? `Resolved ${result.updated} incident(s); skipped ${result.skipped.length}.`
            : `Resolved ${result.updated} incident(s).`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.observability.all });
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Bulk resolve failed.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteObservabilityRecords("incidents", ids),
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

  function textValue(key: string): string {
    const value = filters[key];
    return typeof value === "string" ? value : "";
  }

  async function exportCsv() {
    setExportError(null);
    try {
      const exportFilters = { ...apiFilters };
      delete (exportFilters as Record<string, unknown>).page;
      delete (exportFilters as Record<string, unknown>).limit;
      await downloadCsvFromProxy(
        observabilityIncidentsExportUrl(exportFilters),
        "operational-incidents.csv",
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

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
    if (ids.length === 0 || !confirmDeleteRecords("incident", ids.length)) {
      return;
    }
    deleteMutation.mutate(ids);
  }

  const data = incidentsQuery.data;

  return (
    <div className="space-y-4">
      {facets.isError ? <FacetsErrorNotice error={facets.error} /> : null}
      <FilterBar onReset={reset}>
        <FilterField label="Search" className="md:col-span-2">
          <Input
            value={textValue("q")}
            placeholder="Title, summary, event key, lead..."
            onChange={(event) => update({ q: event.target.value })}
          />
        </FilterField>
        <FilterField label="Last seen range" className="md:col-span-2">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update({ from: range.from ?? null, to: range.to ?? null })}
          />
        </FilterField>
        <FilterField label="Status">
          <SelectFilter
            value={textValue("status")}
            options={toSelectOptions(facets.values.incident_statuses, { humanize: true })}
            onChange={(value) => update({ status: value })}
          />
        </FilterField>
        <FilterField label="Severity">
          <SelectFilter
            value={textValue("severity")}
            options={toSelectOptions(facets.values.incident_severities)}
            onChange={(value) => update({ severity: value })}
          />
        </FilterField>
        <FilterField label="Category">
          <SelectFilter
            value={textValue("category")}
            options={toSelectOptions(facets.values.categories, { humanize: true })}
            onChange={(value) => update({ category: value })}
          />
        </FilterField>
        <FilterField label="Workflow">
          <SelectFilter
            value={textValue("workflow")}
            options={toSelectOptions(facets.values.workflows, { humanize: true })}
            onChange={(value) => update({ workflow: value })}
          />
        </FilterField>
        <FilterField label="Event key">
          <SelectFilter
            value={textValue("event_key")}
            options={toSelectOptions(facets.values.event_keys)}
            onChange={(value) => update({ event_key: value })}
          />
        </FilterField>
        <FilterField label="Source company">
          <SelectFilter
            value={textValue("source_company")}
            options={toSelectOptions(facets.values.source_companies)}
            onChange={(value) => update({ source_company: value })}
          />
        </FilterField>
        <FilterField label="Lead name">
          <Input
            value={textValue("lead_name")}
            placeholder="Partial match"
            onChange={(event) => update({ lead_name: event.target.value })}
          />
        </FilterField>
        <FilterField label="Lead phone">
          <Input
            value={textValue("lead_phone")}
            placeholder="Digits, any format"
            onChange={(event) => update({ lead_phone: event.target.value })}
          />
        </FilterField>
        <FilterField label="Lead email">
          <Input
            value={textValue("lead_email")}
            placeholder="Partial match"
            onChange={(event) => update({ lead_email: event.target.value })}
          />
        </FilterField>
        <FilterField label="Owner visible">
          <SelectFilter
            value={textValue("owner_visible")}
            options={OWNER_VISIBLE_OPTIONS}
            placeholder="All incidents"
            onChange={(value) => update({ owner_visible: value })}
          />
        </FilterField>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typeof data?.total === "number"
            ? `${data.total} incidents match these filters.${selectedCount > 0 ? ` ${selectedCount} selected.` : ""}`
            : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => resolveMutation.mutate()}
            disabled={selectedCount === 0 || resolveMutation.isPending || deleteMutation.isPending}
          >
            Resolve selected
          </Button>
          <Button
            variant="outline"
            onClick={deleteSelected}
            disabled={selectedCount === 0 || resolveMutation.isPending || deleteMutation.isPending}
          >
            Delete selected
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {exportError ? <FeedbackMessage tone="error">{exportError}</FeedbackMessage> : null}
      {feedback ? <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage> : null}

      {incidentsQuery.isPending ? (
        <TableLoadingState label="Loading incidents..." />
      ) : incidentsQuery.isError ? (
        <TableErrorState
          title="Unable to load incidents."
          error={incidentsQuery.error instanceof Error ? incidentsQuery.error.message : undefined}
          onRetry={() => incidentsQuery.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <TableEmptyState label="No incidents match these filters." />
      ) : (
        <>
          <DataTable<OperationalIncident>
            items={data.items}
            getRowKey={(incident) => incident._id}
            onRowClick={(incident) => update({ record: incident._id }, { resetPage: false })}
            stickyHeader
            horizontalControls
            columns={[
              {
                key: "select",
                header: (
                  <SelectionCheckbox
                    label="Select all incidents on this page"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPage}
                  />
                ),
                cell: (incident) => (
                  <SelectionCheckbox
                    label={`Select incident ${incident.title}`}
                    checked={selectedIds.has(incident._id)}
                    onChange={(checked) => toggleSelected(incident._id, checked)}
                  />
                ),
              },
              {
                key: "last_seen_at",
                header: "Last Seen",
                cell: (incident) => formatDateTime(incident.last_seen_at),
                sticky: "left",
              },
              {
                key: "severity",
                header: "Severity",
                cell: (incident) => <SeverityBadge severity={incident.severity} />,
              },
              {
                key: "status",
                header: "Status",
                cell: (incident) => <IncidentStatusBadge status={incident.status} />,
              },
              { key: "title", header: "Title", truncate: true, cell: (incident) => incident.title },
              {
                key: "workflow",
                header: "Workflow",
                cell: (incident) => humanizeKey(incident.workflow),
              },
              {
                key: "source_company",
                header: "Source",
                cell: (incident) => incident.source_company ?? "-",
              },
              {
                key: "lead",
                header: "Lead",
                truncate: true,
                cell: (incident) =>
                  incident.lead_name || incident.lead_phone
                    ? [incident.lead_name, incident.lead_phone].filter(Boolean).join(" / ")
                    : "-",
              },
              { key: "count", header: "Count", cell: (incident) => incident.count ?? 1 },
              {
                key: "owner_visible",
                header: "Owner Visible",
                cell: (incident) => (incident.owner_visible === false ? "No" : "Yes"),
              },
              {
                key: "notifications",
                header: "Notifications",
                cell: (incident) => {
                  const state = incident.notification_state;
                  if (!state) return "-";
                  if (state.immediate_sent_at) return `Alerted ${formatDateTime(state.immediate_sent_at)}`;
                  if (state.digest_sent_at) return `Digest ${formatDateTime(state.digest_sent_at)}`;
                  if (state.suppressed_count) return `${state.suppressed_count} suppressed`;
                  return "-";
                },
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

      <ObservationalIncidentDetail
        incidentId={selectedId}
        onClose={() => update({ record: null }, { resetPage: false })}
        onDeleted={async () => {
          update({ record: null }, { resetPage: false });
          await queryClient.invalidateQueries({ queryKey: queryKeys.observability.all });
        }}
      />
    </div>
  );
}
