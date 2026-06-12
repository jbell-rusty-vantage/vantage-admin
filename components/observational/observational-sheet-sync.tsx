"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackMessage } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/side-panel";
import { DataTable } from "@/components/data-table/table-shell";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { PaginationControls } from "@/components/data-table/pagination-controls";
import { StatusBadge } from "@/components/data-table/status-badge";
import { formatDateTime } from "@/components/data-table/formatters";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { DetailSection } from "@/components/record-detail/detail-section";
import {
  fetchOperationalIncidents,
  fetchSheetSyncHealth,
  fetchSheetSyncJobs,
  fetchSheetSyncRunDetail,
  fetchSheetSyncRuns,
  retrySheetSyncJobs,
  type OperationalIncident,
  type SheetSyncJob,
  type SheetSyncRun,
} from "@/lib/api/admin";
import type { SelectOption } from "@/lib/api/types";
import { useUrlTableState } from "@/lib/api/url-state";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { formatDurationMs, humanizeKey, pickApiFilters } from "./entity-link";
import { IncidentStatusBadge, SeverityBadge } from "./severity-badge";
import { JsonBlock } from "./shared";

const JOB_STATUS_OPTIONS: SelectOption[] = [
  "pending",
  "retrying",
  "processing",
  "synced",
  "failed",
  "cancelled",
].map((status) => ({ value: status, label: humanizeKey(status) }));

const RESOURCE_OPTIONS: SelectOption[] = [
  "source_lead",
  "booked_lead",
  "booking_chain",
  "cancellation_chain",
  "delete_source_lead",
  "delete_booked_lead",
  "delete_cancelled_lead",
].map((resource) => ({ value: resource, label: humanizeKey(resource) }));

function jobStatusTone(status: string): "success" | "destructive" | "warning" | "muted" {
  if (status === "synced") return "success";
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "muted";
  return "warning";
}

function runStatusTone(status: string): "success" | "destructive" | "warning" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "partial_failure") return "destructive";
  return "warning";
}

export function ObservationalSheetSync() {
  const queryClient = useQueryClient();
  const { filters, update, setPage, setLimit, reset } = useUrlTableState({ limit: 50 });
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    null,
  );

  const healthQuery = useQuery({
    queryKey: queryKeys.observability.sheetSync.health(),
    queryFn: fetchSheetSyncHealth,
    refetchInterval: 60_000,
  });

  const jobFilters = useMemo(
    () => ({
      ...pickApiFilters(filters, ["status", "resource", "entity_id", "job_id"], {
        exclusiveTo: false,
      }),
      page: filters.page,
      limit: filters.limit,
    }),
    [filters],
  );

  const jobsQuery = useQuery({
    queryKey: queryKeys.observability.sheetSync.jobs(jobFilters),
    queryFn: () => fetchSheetSyncJobs(jobFilters),
    placeholderData: keepPreviousData,
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.observability.sheetSync.runs({ limit: 10 }),
    queryFn: () => fetchSheetSyncRuns({ limit: 10, page: 1 }),
  });

  const incidentsQuery = useQuery({
    queryKey: queryKeys.observability.incidents({
      category: "sheet_sync",
      status: "open",
      limit: 10,
    }),
    queryFn: () =>
      fetchOperationalIncidents({ category: "sheet_sync", status: "open", limit: 10, page: 1 }),
  });

  const selectedRunId = typeof filters.run_id === "string" ? filters.run_id : undefined;
  const runDetailQuery = useQuery({
    queryKey: queryKeys.observability.sheetSync.runDetail(selectedRunId ?? ""),
    queryFn: () => fetchSheetSyncRunDetail(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
  });

  const retryMutation = useMutation({
    mutationFn: () => retrySheetSyncJobs({}),
    onSuccess: async (result) => {
      setFeedback({
        tone: "success",
        message: `Retry queued: ${JSON.stringify(result)}`,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.observability.sheetSync.all });
    },
    onError: (error) => {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Retry failed.",
      });
    },
  });

  const health = (healthQuery.data ?? {}) as Record<string, unknown>;
  const jobsByStatus = (health.jobs_by_status ?? {}) as Record<string, number>;
  const lastRun = (health.last_run ?? null) as Record<string, unknown> | null;
  const failedCount = typeof health.failed === "number" ? health.failed : 0;

  function textValue(key: string): string {
    const value = filters[key];
    return typeof value === "string" ? value : "";
  }

  const jobs = jobsQuery.data;

  return (
    <div className="space-y-6">
      {feedback ? <FeedbackMessage tone={feedback.tone}>{feedback.message}</FeedbackMessage> : null}

      <div className="rounded-lg border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Sheet sync health</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => healthQuery.refetch()}
              disabled={healthQuery.isFetching}
            >
              <RefreshCw
                className={cn("mr-2 h-3.5 w-3.5", healthQuery.isFetching ? "animate-spin" : undefined)}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending || failedCount === 0}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Retry failed jobs
            </Button>
          </div>
        </div>
        {healthQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading health...</p>
        ) : healthQuery.isError ? (
          <p className="text-sm text-destructive">Unable to load sheet sync health.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
              <p className="mt-1 text-sm font-medium">{String(health.mode ?? "-")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Backlog age</p>
              <p className="mt-1 text-sm font-medium">
                {formatDurationMs(typeof health.backlog_age_ms === "number" ? health.backlog_age_ms : null)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Jobs by status</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.keys(jobsByStatus).length === 0 ? (
                  <span className="text-sm font-medium">None</span>
                ) : (
                  Object.entries(jobsByStatus).map(([status, count]) => (
                    <StatusBadge key={status} tone={jobStatusTone(status)}>
                      {status}: {count}
                    </StatusBadge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last run</p>
              <p className="mt-1 text-sm font-medium">
                {lastRun
                  ? `${String(lastRun.status ?? "-")} at ${formatDateTime(
                      typeof lastRun.started_at === "string" ? lastRun.started_at : undefined,
                    )}`
                  : "-"}
              </p>
            </div>
          </div>
        )}
      </div>

      {incidentsQuery.data && incidentsQuery.data.items.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-destructive">Open sheet sync incidents</h3>
            <Link
              href="/observational?tab=incidents&category=sheet_sync&status=open"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {incidentsQuery.data.items.map((incident: OperationalIncident) => (
              <li key={incident._id} className="flex flex-wrap items-center gap-2 text-sm">
                <SeverityBadge severity={incident.severity} />
                <IncidentStatusBadge status={incident.status} />
                <Link
                  href={`/observational?tab=incidents&record=${incident._id}`}
                  className="text-primary hover:underline"
                >
                  {incident.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  x{incident.count ?? 1}, last {formatDateTime(incident.last_seen_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Jobs</h3>
        <FilterBar onReset={reset}>
          <FilterField label="Status">
            <SelectFilter
              value={textValue("status")}
              options={JOB_STATUS_OPTIONS}
              onChange={(value) => update({ status: value })}
            />
          </FilterField>
          <FilterField label="Resource">
            <SelectFilter
              value={textValue("resource")}
              options={RESOURCE_OPTIONS}
              onChange={(value) => update({ resource: value })}
            />
          </FilterField>
          <FilterField label="Entity ID">
            <Input
              value={textValue("entity_id")}
              onChange={(event) => update({ entity_id: event.target.value })}
            />
          </FilterField>
          <FilterField label="Job ID">
            <Input
              value={textValue("job_id")}
              onChange={(event) => update({ job_id: event.target.value })}
            />
          </FilterField>
        </FilterBar>

        {jobsQuery.isPending ? (
          <TableLoadingState label="Loading sheet sync jobs..." />
        ) : jobsQuery.isError ? (
          <TableErrorState
            title="Unable to load sheet sync jobs."
            error={jobsQuery.error instanceof Error ? jobsQuery.error.message : undefined}
            onRetry={() => jobsQuery.refetch()}
          />
        ) : !jobs || jobs.items.length === 0 ? (
          <TableEmptyState label="No sheet sync jobs match these filters." />
        ) : (
          <>
            <DataTable<SheetSyncJob>
              items={jobs.items}
              getRowKey={(job) => job._id}
              compact
              horizontalControls
              columns={[
                {
                  key: "due_at",
                  header: "Due",
                  cell: (job) =>
                    formatDateTime(typeof job.due_at === "string" ? job.due_at : undefined),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (job) => (
                    <StatusBadge tone={jobStatusTone(job.status)}>{job.status}</StatusBadge>
                  ),
                },
                {
                  key: "resource",
                  header: "Resource",
                  cell: (job) => humanizeKey(job.resource ?? "-"),
                },
                { key: "operation", header: "Operation", cell: (job) => job.operation ?? "-" },
                { key: "entity_id", header: "Entity", truncate: true, cell: (job) => job.entity_id ?? "-" },
                { key: "attempts", header: "Attempts", cell: (job) => job.attempts ?? 0 },
                {
                  key: "last_error",
                  header: "Last Error",
                  truncate: true,
                  cell: (job) =>
                    typeof job.last_error === "string" && job.last_error ? job.last_error : "-",
                },
              ]}
            />
            <PaginationControls
              page={jobs.page}
              limit={jobs.limit}
              total={jobs.total}
              hasNextPage={jobs.has_next_page}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Recent runs</h3>
        {runsQuery.isPending ? (
          <TableLoadingState label="Loading runs..." />
        ) : runsQuery.isError ? (
          <TableErrorState
            title="Unable to load sheet sync runs."
            error={runsQuery.error instanceof Error ? runsQuery.error.message : undefined}
            onRetry={() => runsQuery.refetch()}
          />
        ) : !runsQuery.data || runsQuery.data.items.length === 0 ? (
          <TableEmptyState label="No sheet sync runs recorded yet." />
        ) : (
          <DataTable<SheetSyncRun>
            items={runsQuery.data.items}
            getRowKey={(run) => run._id}
            onRowClick={(run) => update({ run_id: run._id }, { resetPage: false })}
            compact
            columns={[
              {
                key: "started_at",
                header: "Started",
                cell: (run) => formatDateTime(run.started_at),
              },
              {
                key: "status",
                header: "Status",
                cell: (run) => (
                  <StatusBadge tone={runStatusTone(run.status)}>
                    {humanizeKey(run.status)}
                  </StatusBadge>
                ),
              },
              {
                key: "trigger",
                header: "Trigger",
                cell: (run) => humanizeKey(typeof run.trigger === "string" ? run.trigger : "-"),
              },
              { key: "claimed", header: "Claimed", cell: (run) => run.claimed_job_count ?? 0 },
              { key: "synced", header: "Synced", cell: (run) => run.synced_job_count ?? 0 },
              { key: "failed", header: "Failed", cell: (run) => run.failed_job_count ?? 0 },
              { key: "deferred", header: "Deferred", cell: (run) => run.deferred_job_count ?? 0 },
            ]}
          />
        )}
      </div>

      {selectedRunId ? (
        <SidePanel
          title="Sheet sync run"
          open
          onClose={() => update({ run_id: null }, { resetPage: false })}
        >
          {runDetailQuery.isPending ? (
            <TableLoadingState label="Loading run detail..." />
          ) : runDetailQuery.isError ? (
            <TableErrorState
              title="Unable to load this run."
              error={runDetailQuery.error instanceof Error ? runDetailQuery.error.message : undefined}
              onRetry={() => runDetailQuery.refetch()}
            />
          ) : (
            <DetailSection title="Run detail">
              <JsonBlock value={runDetailQuery.data} />
            </DetailSection>
          )}
        </SidePanel>
      ) : null}
    </div>
  );
}
