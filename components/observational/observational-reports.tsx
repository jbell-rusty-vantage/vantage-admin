"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  deleteObservabilityRecords,
  fetchOperationalReports,
  runOperationalReport,
  type OperationalReportRun,
} from "@/lib/api/admin";
import { getDatePresetRange } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { exclusiveEndDate, humanizeKey, pickApiFilters } from "./entity-link";
import {
  confirmDeleteRecords,
  formatDeleteResult,
  SelectionCheckbox,
} from "./observational-delete-controls";
import { ObservationalReportResult } from "./observational-report-result";
import { FacetsErrorNotice, toSelectOptions, useObservabilityFacets } from "./shared";

function reportRunStatusTone(status: string): "success" | "destructive" | "warning" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  return "warning";
}

export function ObservationalReports() {
  const queryClient = useQueryClient();
  const facets = useObservabilityFacets();
  const { filters, update, setPage, setLimit } = useUrlTableState({ limit: 25 });
  const [runError, setRunError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Builder state lives in the URL so a report configuration is shareable.
  const defaultRange = useMemo(() => getDatePresetRange("last_7_days"), []);
  const reportKey =
    typeof filters.report_key === "string" && filters.report_key
      ? filters.report_key
      : "daily-owner-operational-summary";
  const builderFrom = typeof filters.from === "string" && filters.from ? filters.from : defaultRange.from;
  const builderTo = typeof filters.to === "string" && filters.to ? filters.to : defaultRange.to;

  const selectedRunId = typeof filters.record === "string" ? filters.record : undefined;

  const runsFilters = useMemo(
    () => ({
      ...pickApiFilters(filters, ["report_key", "run_status"], { exclusiveTo: false }),
      page: filters.page,
      limit: filters.limit,
    }),
    [filters],
  );
  const runsApiFilters = useMemo(() => {
    const out: Record<string, string | number | boolean> = { ...runsFilters };
    // The backend lists runs by `status`; the URL uses `run_status` to avoid
    // clashing with incident status when sharing links across tabs.
    if (typeof out.run_status === "string") {
      out.status = out.run_status;
      delete out.run_status;
    }
    return out;
  }, [runsFilters]);

  const runsQuery = useQuery({
    queryKey: queryKeys.observability.reports(runsApiFilters),
    queryFn: () => fetchOperationalReports(runsApiFilters),
    placeholderData: keepPreviousData,
  });
  const currentPageIds = useMemo(() => runsQuery.data?.items.map((run) => run._id) ?? [], [
    runsQuery.data,
  ]);
  const selectedCount = selectedIds.size;
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  const runMutation = useMutation({
    mutationFn: () =>
      runOperationalReport({
        report_key: reportKey,
        from: builderFrom ? `${builderFrom}T00:00:00.000Z` : new Date().toISOString(),
        to: builderTo
          ? `${exclusiveEndDate(builderTo)}T00:00:00.000Z`
          : new Date().toISOString(),
        timezone: "America/New_York",
        ...(typeof filters.level === "string" && filters.level ? { level: filters.level as never } : {}),
        ...(typeof filters.category === "string" && filters.category ? { category: filters.category } : {}),
        ...(typeof filters.workflow === "string" && filters.workflow ? { workflow: filters.workflow } : {}),
        ...(typeof filters.source_company === "string" && filters.source_company
          ? { source_company: filters.source_company }
          : {}),
        ...(filters.include_resolved === "true" ? { include_resolved: true } : {}),
        requested_by: "admin",
      }),
    onSuccess: async (run) => {
      setRunError(null);
      // The POST response already contains the full run (including result),
      // so seed the detail cache: the result panel opens instantly and does
      // not depend on a follow-up GET round trip.
      queryClient.setQueryData(queryKeys.observability.reportRun(run._id), run);
      await queryClient.invalidateQueries({ queryKey: queryKeys.observability.reports() });
      update({ record: run._id }, { resetPage: false });
    },
    onError: (error) => {
      setRunError(error instanceof Error ? error.message : "Report run failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteObservabilityRecords("report-runs", ids),
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
    if (ids.length === 0 || !confirmDeleteRecords("report run", ids.length)) {
      return;
    }
    deleteMutation.mutate(ids);
  }

  const data = runsQuery.data;

  return (
    <div className="space-y-4">
      {facets.isError ? <FacetsErrorNotice error={facets.error} /> : null}
      <div className="rounded-lg border bg-background p-4">
        <h3 className="mb-1 text-sm font-semibold">Report builder</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Reports are deterministic: the same report, period, and filters over the same data
          produce the same result hash.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Report">
            <SelectFilter
              value={reportKey}
              options={toSelectOptions(facets.values.report_keys, { humanize: true })}
              placeholder="Choose a report"
              onChange={(value) => update({ report_key: value }, { resetPage: false })}
            />
          </FilterField>
          <FilterField label="Period">
            <DateRangeFilter
              from={builderFrom}
              to={builderTo}
              onChange={(range) =>
                update({ from: range.from ?? null, to: range.to ?? null }, { resetPage: false })
              }
            />
          </FilterField>
          <FilterField label="Level">
            <SelectFilter
              value={textValue("level")}
              options={toSelectOptions(facets.values.levels)}
              onChange={(value) => update({ level: value }, { resetPage: false })}
            />
          </FilterField>
          <FilterField label="Category">
            <SelectFilter
              value={textValue("category")}
              options={toSelectOptions(facets.values.categories, { humanize: true })}
              onChange={(value) => update({ category: value }, { resetPage: false })}
            />
          </FilterField>
          <FilterField label="Workflow">
            <SelectFilter
              value={textValue("workflow")}
              options={toSelectOptions(facets.values.workflows, { humanize: true })}
              onChange={(value) => update({ workflow: value }, { resetPage: false })}
            />
          </FilterField>
          <FilterField label="Source company">
            <SelectFilter
              value={textValue("source_company")}
              options={toSelectOptions(facets.values.source_companies)}
              onChange={(value) => update({ source_company: value }, { resetPage: false })}
            />
          </FilterField>
          <FilterField label="Resolved incidents">
            <SelectFilter
              value={textValue("include_resolved")}
              options={[{ value: "true", label: "Include resolved" }]}
              placeholder="Open / acknowledged only"
              onChange={(value) => update({ include_resolved: value }, { resetPage: false })}
            />
          </FilterField>
          <div className="flex items-end">
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              <Play className="mr-2 h-4 w-4" />
              {runMutation.isPending ? "Running..." : "Run report"}
            </Button>
          </div>
        </div>
        {runError ? (
          <FeedbackMessage tone="error" className="mt-3">
            {runError}
          </FeedbackMessage>
        ) : null}
      </div>

      <FilterBar>
        <FilterField label="History: report">
          <SelectFilter
            value={textValue("report_key")}
            options={toSelectOptions(facets.values.report_keys, { humanize: true })}
            onChange={(value) => update({ report_key: value })}
          />
        </FilterField>
        <FilterField label="History: status">
          <SelectFilter
            value={textValue("run_status")}
            options={toSelectOptions(facets.values.report_run_statuses, { humanize: true })}
            onChange={(value) => update({ run_status: value })}
          />
        </FilterField>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {typeof data?.total === "number"
            ? `${data.total} report runs match these filters.${selectedCount > 0 ? ` ${selectedCount} selected.` : ""}`
            : null}
        </p>
        <Button
          variant="outline"
          onClick={deleteSelected}
          disabled={selectedCount === 0 || deleteMutation.isPending}
        >
          Delete selected
        </Button>
      </div>

      {feedback ? <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage> : null}

      {runsQuery.isPending ? (
        <TableLoadingState label="Loading report runs..." />
      ) : runsQuery.isError ? (
        <TableErrorState
          title="Unable to load report runs."
          error={runsQuery.error instanceof Error ? runsQuery.error.message : undefined}
          onRetry={() => runsQuery.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <TableEmptyState label="No report runs yet. Run a report above to create one." />
      ) : (
        <>
          <DataTable<OperationalReportRun>
            items={data.items}
            getRowKey={(run) => run._id}
            onRowClick={(run) => update({ record: run._id }, { resetPage: false })}
            columns={[
              {
                key: "select",
                header: (
                  <SelectionCheckbox
                    label="Select all report runs on this page"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPage}
                  />
                ),
                cell: (run) => (
                  <SelectionCheckbox
                    label={`Select report run ${run.report_key}`}
                    checked={selectedIds.has(run._id)}
                    onChange={(checked) => toggleSelected(run._id, checked)}
                  />
                ),
              },
              {
                key: "started_at",
                header: "Started",
                cell: (run) => formatDateTime(run.started_at),
              },
              {
                key: "report_key",
                header: "Report",
                cell: (run) => humanizeKey(run.report_key),
              },
              {
                key: "status",
                header: "Status",
                cell: (run) => (
                  <StatusBadge tone={reportRunStatusTone(run.status)}>{run.status}</StatusBadge>
                ),
              },
              {
                key: "period",
                header: "Period",
                cell: (run) =>
                  run.period
                    ? `${formatDateTime(run.period.from)} – ${formatDateTime(run.period.to)}`
                    : "-",
              },
              {
                key: "requested_by",
                header: "Requested By",
                cell: (run) => run.requested_by ?? "-",
              },
              {
                key: "result_hash",
                header: "Result Hash",
                truncate: true,
                cell: (run) => (run.result_hash ? run.result_hash.slice(0, 16) : "-"),
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

      <ObservationalReportResult
        runId={selectedRunId}
        onClose={() => update({ record: null }, { resetPage: false })}
        onDeleted={async () => {
          update({ record: null }, { resetPage: false });
          await queryClient.invalidateQueries({ queryKey: queryKeys.observability.all });
        }}
      />
    </div>
  );
}
