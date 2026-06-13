"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { SidePanel } from "@/components/ui/side-panel";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DataTable } from "@/components/data-table/table-shell";
import { StatusBadge } from "@/components/data-table/status-badge";
import { formatDateTime } from "@/components/data-table/formatters";
import {
  deleteObservabilityRecord,
  fetchOperationalReportRun,
  observabilityReportExportUrl,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey } from "./entity-link";
import { confirmDeleteRecords } from "./observational-delete-controls";
import { JsonBlock } from "./shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Grouped reports return `{ rows: [...] }`; summary reports return scalars. */
function splitResult(result: Record<string, unknown> | undefined): {
  rows: Record<string, unknown>[];
  scalars: Record<string, unknown>;
  extras: Record<string, unknown>;
} {
  if (!result) {
    return { rows: [], scalars: {}, extras: {} };
  }
  const rows = Array.isArray(result.rows)
    ? (result.rows.filter(isRecord) as Record<string, unknown>[])
    : [];
  const scalars: Record<string, unknown> = {};
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key === "rows") continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      scalars[key] = value;
    } else {
      extras[key] = value;
    }
  }
  return { rows, scalars, extras };
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDateTime(value);
  }
  if (typeof value === "number") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function ObservationalReportResult({
  runId,
  onClose,
  onDeleted,
}: {
  runId?: string;
  onClose: () => void;
  onDeleted?: () => void | Promise<void>;
}) {
  const [exportError, setExportError] = useState<string | null>(null);
  const runQuery = useQuery({
    queryKey: queryKeys.observability.reportRun(runId ?? ""),
    queryFn: () => fetchOperationalReportRun(runId ?? ""),
    enabled: Boolean(runId),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteObservabilityRecord("report-runs", runId ?? ""),
    onSuccess: async () => {
      await onDeleted?.();
    },
    onError: (error) => {
      setExportError(error instanceof Error ? error.message : "Delete failed.");
    },
  });

  if (!runId) {
    return null;
  }

  const run = runQuery.data;
  const { rows, scalars, extras } = splitResult(run?.result);
  const rowColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

  async function exportCsv() {
    setExportError(null);
    try {
      await downloadCsvFromProxy(
        observabilityReportExportUrl(runId ?? ""),
        `${run?.report_key ?? "report"}.csv`,
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <SidePanel
      title={run ? humanizeKey(run.report_key) : "Report run"}
      description={
        run?.period
          ? `${formatDateTime(run.period.from)} – ${formatDateTime(run.period.to)} (${run.period.timezone})`
          : undefined
      }
      open
      onClose={onClose}
    >
      {/* Render data first: a freshly-run report is seeded into the cache,
          and a failed background refetch must not hide an already-loaded
          result. */}
      {run ? null : runQuery.isError ? (
        <TableErrorState
          title="Unable to load this report run."
          error={runQuery.error instanceof Error ? runQuery.error.message : undefined}
          onRetry={() => runQuery.refetch()}
        />
      ) : (
        <TableLoadingState label="Loading report run..." />
      )}
      {run ? (
        <div className="space-y-4">
          <DetailSection title="Run metadata">
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge
                tone={
                  run.status === "completed"
                    ? "success"
                    : run.status === "failed"
                      ? "destructive"
                      : "warning"
                }
              >
                {run.status}
              </StatusBadge>
              <Button
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={exportCsv}
                disabled={run.status !== "completed"}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                className="h-8 px-3 text-xs"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirmDeleteRecords("report run", 1)) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Delete
              </Button>
            </div>
            {exportError ? (
              <FeedbackMessage tone="error" className="mb-3">
                {exportError}
              </FeedbackMessage>
            ) : null}
            {run.error_message ? (
              <FeedbackMessage tone="error" className="mb-3">
                {run.error_message}
              </FeedbackMessage>
            ) : null}
            <DetailGrid>
              <DetailItem label="Report version" value={run.report_version} />
              <DetailItem label="Requested by" value={run.requested_by ?? "-"} />
              <DetailItem label="Started" value={formatDateTime(run.started_at)} />
              <DetailItem label="Finished" value={formatDateTime(run.finished_at)} />
              <DetailItem
                label="Result hash"
                value={<span className="break-all font-mono text-xs">{run.result_hash ?? "-"}</span>}
              />
              <DetailItem
                label="Input watermark"
                value={
                  run.input_watermark
                    ? `${run.input_watermark.events_count ?? 0} events / ${run.input_watermark.incidents_count ?? 0} incidents`
                    : "-"
                }
              />
            </DetailGrid>
          </DetailSection>

          {run.filters && Object.keys(run.filters).length > 0 ? (
            <DetailSection title="Filters">
              <JsonBlock value={run.filters} />
            </DetailSection>
          ) : null}

          {Object.keys(scalars).length > 0 ? (
            <DetailSection title="Summary">
              <DetailGrid>
                {Object.entries(scalars).map(([key, value]) => (
                  <DetailItem key={key} label={humanizeKey(key)} value={formatCell(value)} />
                ))}
              </DetailGrid>
            </DetailSection>
          ) : null}

          {rows.length > 0 ? (
            <DetailSection title={`Rows (${rows.length})`}>
              <DataTable<Record<string, unknown>>
                items={rows}
                getRowKey={(row) => rowColumns.map((column) => String(row[column])).join("|")}
                compact
                columns={rowColumns.map((column) => ({
                  key: column,
                  header: humanizeKey(column),
                  cell: (row) => formatCell(row[column]),
                }))}
              />
            </DetailSection>
          ) : null}

          {Object.keys(extras).length > 0 ? (
            <DetailSection title="Additional data">
              <JsonBlock value={extras} />
            </DetailSection>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
