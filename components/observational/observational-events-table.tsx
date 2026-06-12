"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
  fetchOperationalEvents,
  observabilityEventsExportUrl,
  type OperationalEvent,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import type { SelectOption } from "@/lib/api/types";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey, pickApiFilters } from "./entity-link";
import { ObservationalEventDetail } from "./observational-event-detail";
import { LevelBadge } from "./severity-badge";
import { toSelectOptions, useObservabilityFacets } from "./shared";

const EVENT_FILTER_KEYS = [
  "from",
  "to",
  "level",
  "category",
  "workflow",
  "event_key",
  "source_company",
  "lead_name",
  "lead_phone",
  "lead_email",
  "route",
  "entity_type",
  "entity_id",
  "run_id",
  "request_id",
  "reportable",
  "q",
] as const;

const REPORTABLE_OPTIONS: SelectOption[] = [
  { value: "true", label: "Reportable only" },
  { value: "false", label: "Internal only" },
];

export function ObservationalEventsTable() {
  const { filters, update, setPage, setLimit, reset } = useUrlTableState({ limit: 50 });
  const facets = useObservabilityFacets();
  const [exportError, setExportError] = useState<string | null>(null);

  const apiFilters = useMemo(() => {
    const picked = pickApiFilters(filters, EVENT_FILTER_KEYS);
    return {
      ...picked,
      page: filters.page,
      limit: filters.limit,
      ...(filters.sort ? { sort: filters.sort, direction: filters.direction } : {}),
    };
  }, [filters]);

  const eventsQuery = useQuery({
    queryKey: queryKeys.observability.events(apiFilters),
    queryFn: () => fetchOperationalEvents(apiFilters),
    placeholderData: keepPreviousData,
  });

  const selectedId = typeof filters.record === "string" ? filters.record : undefined;

  function textValue(key: string): string {
    const value = filters[key];
    return typeof value === "string" ? value : "";
  }

  function openEvent(id: string) {
    update({ record: id }, { resetPage: false });
  }

  function closeDetail() {
    update({ record: null }, { resetPage: false });
  }

  /** Pivot filters from the detail panel: apply and return to the table. */
  function applyPivotFilter(next: Record<string, string>) {
    update({ ...next, record: null });
  }

  async function exportCsv() {
    setExportError(null);
    try {
      const exportFilters = { ...apiFilters };
      delete (exportFilters as Record<string, unknown>).page;
      delete (exportFilters as Record<string, unknown>).limit;
      await downloadCsvFromProxy(
        observabilityEventsExportUrl(exportFilters),
        "operational-events.csv",
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  const data = eventsQuery.data;

  return (
    <div className="space-y-4">
      <FilterBar onReset={reset}>
        <FilterField label="Search" className="md:col-span-2">
          <Input
            value={textValue("q")}
            placeholder="Full-text: summary, event key, lead, job #..."
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
        <FilterField label="Level">
          <SelectFilter
            value={textValue("level")}
            options={toSelectOptions(facets.data?.levels)}
            onChange={(value) => update({ level: value })}
          />
        </FilterField>
        <FilterField label="Category">
          <SelectFilter
            value={textValue("category")}
            options={toSelectOptions(facets.data?.categories, { humanize: true })}
            onChange={(value) => update({ category: value })}
          />
        </FilterField>
        <FilterField label="Workflow">
          <SelectFilter
            value={textValue("workflow")}
            options={toSelectOptions(facets.data?.workflows, { humanize: true })}
            onChange={(value) => update({ workflow: value })}
          />
        </FilterField>
        <FilterField label="Event key">
          <SelectFilter
            value={textValue("event_key")}
            options={toSelectOptions(facets.data?.event_keys)}
            onChange={(value) => update({ event_key: value })}
          />
        </FilterField>
        <FilterField label="Source company">
          <SelectFilter
            value={textValue("source_company")}
            options={toSelectOptions(facets.data?.source_companies)}
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
        <FilterField label="Entity type">
          <SelectFilter
            value={textValue("entity_type")}
            options={toSelectOptions(facets.data?.entity_types, { humanize: true })}
            onChange={(value) => update({ entity_type: value })}
          />
        </FilterField>
        <FilterField label="Entity ID">
          <Input
            value={textValue("entity_id")}
            onChange={(event) => update({ entity_id: event.target.value })}
          />
        </FilterField>
        <FilterField label="Route">
          <SelectFilter
            value={textValue("route")}
            options={toSelectOptions(facets.data?.routes)}
            onChange={(value) => update({ route: value })}
          />
        </FilterField>
        <FilterField label="Run ID">
          <Input
            value={textValue("run_id")}
            onChange={(event) => update({ run_id: event.target.value })}
          />
        </FilterField>
        <FilterField label="Request ID">
          <Input
            value={textValue("request_id")}
            onChange={(event) => update({ request_id: event.target.value })}
          />
        </FilterField>
        <FilterField label="Reportable">
          <SelectFilter
            value={textValue("reportable")}
            options={REPORTABLE_OPTIONS}
            placeholder="All events"
            onChange={(value) => update({ reportable: value })}
          />
        </FilterField>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typeof data?.total === "number" ? `${data.total} events match these filters.` : null}
        </p>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {exportError ? <FeedbackMessage tone="error">{exportError}</FeedbackMessage> : null}

      {eventsQuery.isPending ? (
        <TableLoadingState label="Loading operational events..." />
      ) : eventsQuery.isError ? (
        <TableErrorState
          title="Unable to load operational events."
          error={eventsQuery.error instanceof Error ? eventsQuery.error.message : undefined}
          onRetry={() => eventsQuery.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <TableEmptyState label="No operational events match these filters." />
      ) : (
        <>
          <DataTable<OperationalEvent>
            items={data.items}
            getRowKey={(event) => event._id}
            onRowClick={(event) => openEvent(event._id)}
            stickyHeader
            horizontalControls
            columns={[
              {
                key: "occurred_at",
                header: "Occurred",
                cell: (event) => formatDateTime(event.occurred_at),
                sticky: "left",
              },
              { key: "level", header: "Level", cell: (event) => <LevelBadge level={event.level} /> },
              { key: "event_key", header: "Event", cell: (event) => event.event_key },
              {
                key: "workflow",
                header: "Workflow",
                cell: (event) => humanizeKey(event.workflow),
              },
              {
                key: "category",
                header: "Category",
                cell: (event) => humanizeKey(event.category),
              },
              { key: "summary", header: "Summary", truncate: true, cell: (event) => event.summary },
              { key: "source_company", header: "Source", cell: (event) => event.source_company ?? "-" },
              { key: "lead_name", header: "Lead Name", cell: (event) => event.lead_name ?? "-" },
              { key: "lead_phone", header: "Phone", cell: (event) => event.lead_phone ?? "-" },
              { key: "lead_email", header: "Email", truncate: true, cell: (event) => event.lead_email ?? "-" },
              {
                key: "entity",
                header: "Entity",
                truncate: true,
                cell: (event) =>
                  event.entity_type ? `${humanizeKey(event.entity_type)} ${event.entity_id ?? ""}` : "-",
              },
              { key: "route", header: "Route", truncate: true, cell: (event) => event.route ?? "-" },
              {
                key: "incident",
                header: "Incident",
                cell: (event) => (event.incident_id ? "Linked" : "-"),
              },
              {
                key: "reportable",
                header: "Reportable",
                cell: (event) => (event.reportable === false ? "No" : "Yes"),
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

      <ObservationalEventDetail
        eventId={selectedId}
        onClose={closeDetail}
        onApplyFilter={applyPivotFilter}
      />
    </div>
  );
}
