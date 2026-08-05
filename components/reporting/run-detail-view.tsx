"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import {
  cancelReportingRun,
  fetchReportingRun,
  type ReportingRunStatus,
} from "@/lib/api/reporting";
import { queryKeys } from "@/lib/query/keys";
import { reportingRunPollIntervalMs } from "@/lib/reporting/polling";
import { idempotencyKeyForCancelAttempt } from "@/lib/reporting/builder";
import { ExternalHref } from "@/components/reporting/reporting-links";
import { RunStatusBadge } from "@/components/reporting/reporting-status";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

const ACTIVE_STATUSES = new Set<ReportingRunStatus>([
  "queued",
  "querying",
  "writing",
  "verifying",
  "promoting",
]);

function canRequestCancellation(status: ReportingRunStatus): {
  allowed: boolean;
  safePoint: boolean;
  note?: string;
} {
  if (status === "promoting") {
    return {
      allowed: true,
      safePoint: false,
      note: "Cancellation during promotion is recorded but the worker will not interrupt rename/recovery blindly.",
    };
  }
  if (ACTIVE_STATUSES.has(status)) {
    return { allowed: true, safePoint: true };
  }
  return { allowed: false, safePoint: false };
}

export function RunDetailView({ runId }: { runId: string }) {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const pollCountRef = useRef(0);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelAttempt, setCancelAttempt] = useState<{ runId: string; key: string } | null>(
    null,
  );

  const runQuery = useQuery({
    queryKey: queryKeys.reporting.run(runId),
    queryFn: () => fetchReportingRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || !ACTIVE_STATUSES.has(status)) {
        pollCountRef.current = 0;
        return false;
      }
      const interval = reportingRunPollIntervalMs(status, pollCountRef.current);
      pollCountRef.current += 1;
      return interval;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (idempotencyKey: string) => cancelReportingRun(runId, idempotencyKey),
    onSuccess: async (result) => {
      setMessage(`Cancellation ${result.cancellation.replaceAll("_", " ")}.`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.run(runId) });
    },
    onError: (error) => setMessage(error.message),
  });

  function requestCancel() {
    const key = idempotencyKeyForCancelAttempt(cancelAttempt, runId);
    setCancelAttempt({ runId, key });
    cancelMutation.mutate(key);
  }

  const run = runQuery.data;
  const cancelPolicy = run ? canRequestCancellation(run.status) : null;
  const delivery = run?.delivery;
  const artifactUrl =
    delivery?.workbook_url && (run?.status === "completed" || delivery.status === "completed")
      ? delivery.workbook_url
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-trust-blue" href="/reporting">
            ← Reporting
          </Link>
          <h1 className="mt-2 font-mono text-lg font-semibold text-navy">{runId}</h1>
          {run ? (
            <div className="mt-2 flex items-center gap-2">
              <RunStatusBadge value={run.status} />
              {run.progress?.cancellation_requested ? (
                <span className="text-xs font-semibold text-amber-800">Cancellation requested</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => void runQuery.refetch()} disabled={runQuery.isFetching}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {message ? <FeedbackMessage>{message}</FeedbackMessage> : null}

      {runQuery.isLoading && !run ? <TableLoadingState label="Loading run…" /> : null}
      {runQuery.isError ? (
        <TableErrorState
          title="Unable to load run."
          error={runQuery.error instanceof Error ? runQuery.error.message : undefined}
          onRetry={() => void runQuery.refetch()}
        />
      ) : null}

      {run ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Run progress</CardTitle>
              <CardDescription>
                Closing this page does not cancel delivery. Polls with bounded backoff while active.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Metric label="Phase" value={run.progress?.phase ?? run.status} />
              <Metric label="Rows written" value={run.progress?.row_count ?? run.actual_rows ?? "—"} />
              <Metric label="Page" value={run.progress?.page_number ?? "—"} />
              <Metric
                label="Checksum accumulator"
                value={
                  run.progress?.checksum_accumulator ? (
                    <span className="break-all font-mono text-xs">
                      {run.progress.checksum_accumulator}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Metric label="Started" value={formatDate(run.started_at)} />
              <Metric label="Completed" value={formatDate(run.completed_at)} />
              <Metric
                label="Final checksum"
                value={
                  run.final_data_checksum ? (
                    <span className="break-all font-mono text-xs">{run.final_data_checksum}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Metric label="Revision checksum" value={run.revision_snapshot_checksum} />
            </CardContent>
          </Card>

          {delivery ? (
            <Card>
              <CardHeader>
                <CardTitle>Delivery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Strategy" value={delivery.strategy ?? "—"} />
                  <Metric label="Delivery status" value={delivery.status ?? "—"} />
                  <Metric
                    label="Rows written"
                    value={delivery.progress?.rows_written ?? "—"}
                  />
                  <Metric
                    label="Cells written"
                    value={delivery.progress?.cells_written ?? "—"}
                  />
                  <Metric
                    label="Completed batch"
                    value={delivery.progress?.completed_batch_number ?? "—"}
                  />
                  <Metric
                    label="Provider retries"
                    value={delivery.progress?.provider_retries ?? "—"}
                  />
                  <Metric
                    label="Promotion step"
                    value={delivery.progress?.promotion_step ?? "—"}
                  />
                  <Metric
                    label="Cleanup"
                    value={delivery.cleanup?.state ?? "—"}
                  />
                </div>
                {artifactUrl ? (
                  <FeedbackMessage tone="success">
                    Verified artifact: <ExternalHref href={artifactUrl}>Open workbook</ExternalHref>
                  </FeedbackMessage>
                ) : run.status === "completed" ? (
                  <FeedbackMessage tone="info">
                    Run completed; artifact link appears when delivery verification succeeds.
                  </FeedbackMessage>
                ) : null}
                {delivery.verification ? (
                  <details className="rounded border border-steel-100 p-3">
                    <summary className="cursor-pointer font-semibold text-navy">
                      Verification outcome
                    </summary>
                    <pre className="mt-2 overflow-auto text-xs">
                      {JSON.stringify(delivery.verification, null, 2)}
                    </pre>
                  </details>
                ) : null}
                {delivery.cleanup?.state === "pending" ? (
                  <FeedbackMessage tone="warning">
                    Cleanup pending
                    {delivery.cleanup.last_error_code
                      ? `: ${delivery.cleanup.last_error_code}`
                      : ""}
                    . Delivery truth is unchanged; cleanup retries separately.
                  </FeedbackMessage>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {run.failure || delivery?.failure ? (
            <Card>
              <CardHeader>
                <CardTitle>Failure & remediation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[run.failure, delivery?.failure].filter(Boolean).map((failure, index) => (
                  <FeedbackMessage key={index} tone="error">
                    <strong>{failure?.code}</strong>: {failure?.summary}
                    {failure?.metadata?.remediation ? (
                      <>
                        <br />
                        Remediation: {failure.metadata.remediation}
                      </>
                    ) : null}
                    {failure?.retryable ? (
                      <>
                        <br />
                        Transient failure — worker may retry with bounded backoff.
                      </>
                    ) : (
                      <>
                        <br />
                        Non-retryable — owner action or a new run may be required.
                      </>
                    )}
                  </FeedbackMessage>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {owner && cancelPolicy?.allowed ? (
            <Card>
              <CardHeader>
                <CardTitle>Cancellation</CardTitle>
                <CardDescription>
                  {cancelPolicy.safePoint
                    ? "Safe-point cancellation is available for this phase."
                    : (cancelPolicy.note ?? "Cancellation availability depends on the current phase.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  disabled={cancelMutation.isPending || run.progress?.cancellation_requested}
                  onClick={requestCancel}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {run.progress?.cancellation_requested ? "Cancellation requested" : "Request cancel"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!owner ? (
            <FeedbackMessage tone="info">
              Read-only admin view. Run cancellation and owner remediation actions are hidden.
            </FeedbackMessage>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-steel-100 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-steel">{label}</p>
      <p className="mt-1 wrap-break-word font-semibold text-navy">{value}</p>
    </div>
  );
}
