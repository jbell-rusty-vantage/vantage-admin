"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveGranotRun,
  createGranotAutomationSource,
  createGranotRunGroup,
  fetchGranotAutomationSources,
  fetchGranotRun,
  fetchGranotRuns,
  GranotAutomationApiError,
  type GranotAction,
  type GranotOperation,
  type GranotRun,
  type GranotWorkflow,
} from "@/lib/api/granotAutomation";
import {
  compatibleGranotSources,
  DEFAULT_GRANOT_OPERATIONS,
  granotSubmitLabel,
  submittedGranotSourceIds,
} from "@/lib/granotAutomationSelection";
import { queryKeys } from "@/lib/query/keys";

const TERMINAL_STATUSES = new Set(["completed", "completed_with_errors", "failed", "expired"]);
const APPROVAL_STATUS = "awaiting_approval";

function localDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value ? value : fallback;
}

function number(value: unknown) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function actionIsSyncable(action: GranotAction) {
  return action.syncable === true;
}

function statusTone(status: string): string {
  if (status === "completed" || status === "applied") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "failed" || status === "conflict" || status === "completed_with_errors") {
    return "bg-red-100 text-red-800";
  }
  if (status === APPROVAL_STATUS) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-blue-100 text-blue-800";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function errorMessage(error: unknown) {
  if (
    error instanceof GranotAutomationApiError &&
    error.code === "GRANOT_SOURCE_ALREADY_EXISTS"
  ) {
    return "That exact Granot source already exists.";
  }
  if (
    error instanceof GranotAutomationApiError &&
    error.code === "GRANOT_SOURCE_CATALOG_FULL"
  ) {
    return error.message;
  }
  if (error instanceof GranotAutomationApiError && error.status === 409) {
    return "This plan changed or was already approved. Refresh the run and review its checksum and actions again.";
  }
  return error instanceof Error ? error.message : "Unexpected Granot workflow error.";
}

export function GranotAutomationDashboard() {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [operations, setOperations] = useState<GranotOperation[]>([
    ...DEFAULT_GRANOT_OPERATIONS,
  ]);
  const [workflow, setWorkflow] = useState<GranotWorkflow>("apply");
  const [from, setFrom] = useState(localDate(7));
  const [to, setTo] = useState(localDate());
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[] | null>(null);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newSourceOperations, setNewSourceOperations] = useState<GranotOperation[]>([
    "form_leads",
    "call_leads",
  ]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunGroup, setSelectedRunGroup] = useState<{
    id: string;
    runIds: string[];
  } | null>(null);
  const [selectionByRun, setSelectionByRun] = useState<Record<string, string[]>>({});
  const [confirmedChecksum, setConfirmedChecksum] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  const runsQuery = useQuery({
    queryKey: queryKeys.granotAutomation.runs(),
    queryFn: fetchGranotRuns,
    enabled: owner,
    refetchInterval: (query) =>
      query.state.data?.some((run) => !TERMINAL_STATUSES.has(run.status)) ? 5_000 : false,
  });
  const sourceCatalogQuery = useQuery({
    queryKey: queryKeys.granotAutomation.sources(),
    queryFn: () => fetchGranotAutomationSources(),
    enabled: owner,
  });
  const runQuery = useQuery({
    queryKey: queryKeys.granotAutomation.run(selectedRunId ?? "none"),
    queryFn: () => fetchGranotRun(selectedRunId!),
    enabled: owner && Boolean(selectedRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && status !== APPROVAL_STATUS && !TERMINAL_STATUSES.has(status) ? 2_500 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: createGranotRunGroup,
    onSuccess: async (group) => {
      setSelectedRunId(null);
      setSelectedRunGroup({
        id: group.run_group_id,
        runIds: group.runs.map((run) => run.run_id),
      });
      setConfirmedChecksum(null);
      setMessage({
        tone: "success",
        text:
          group.runs.length === 2
            ? `Created two independent durable plans in group ${group.run_group_id}.`
            : `Created durable plan ${group.runs[0]?.run_id ?? ""}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runs() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.granotAutomation.runGroup(group.run_group_id),
        }),
      ]);
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });
  const createSourceMutation = useMutation({
    mutationFn: createGranotAutomationSource,
    onSuccess: async (source) => {
      setNewSourceLabel("");
      setSelectedSourceIds((current) =>
        current === null ||
        !source.supported_operations.some((operation) =>
          operations.includes(operation),
        )
          ? current
          : [...new Set([...current, source.id])],
      );
      setMessage({ tone: "success", text: `Added Granot source “${source.label}”.` });
      await queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.sources() });
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });
  const approveMutation = useMutation({
    mutationFn: approveGranotRun,
    onSuccess: async (ack) => {
      setConfirmedChecksum(null);
      setMessage({
        tone: "success",
        text: ack.local_worker?.status
          ? `Approval accepted for ${ack.run_id}; worker status: ${ack.local_worker.status}.`
          : `Approval accepted for ${ack.run_id}; application is queued or in progress.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runs() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.run(ack.run_id) }),
      ]);
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });

  const run = runQuery.data;
  const catalogSources = sourceCatalogQuery.data ?? [];
  const compatibleSources = compatibleGranotSources(
    catalogSources,
    operations,
  );
  const submittedSourceIds = submittedGranotSourceIds(
    catalogSources,
    operations,
    selectedSourceIds,
  );
  const syncableIds = useMemo(
    () => (run?.actions ?? []).filter(actionIsSyncable).map((action) => action.action_id).filter(Boolean),
    [run],
  );
  const selectedActionIds = run
    ? (selectionByRun[run.run_id] ?? syncableIds).filter((id) => syncableIds.includes(id))
    : [];
  const invalidWindow = Boolean(from && to && from > to);
  const missingOperations = operations.length === 0;
  const operationWithoutSources = operations.some(
    (operation) =>
      !catalogSources.some(
        (source) =>
          submittedSourceIds.includes(source.id) &&
          source.supported_operations.includes(operation),
      ),
  );
  const missingSourceIds = submittedSourceIds.length === 0 || operationWithoutSources;
  const allSourcesSelected =
    compatibleSources.length > 0 &&
    compatibleSources.every((source) => submittedSourceIds.includes(source.id));

  function selectRun(runId: string) {
    setSelectedRunGroup(null);
    setSelectedRunId(runId);
    setConfirmedChecksum(null);
    setMessage(null);
  }

  function setActionSelected(actionId: string, checked: boolean) {
    if (!run) {
      return;
    }
    const current = selectionByRun[run.run_id] ?? syncableIds;
    setSelectionByRun({
      ...selectionByRun,
      [run.run_id]: checked
        ? [...new Set([...current, actionId])]
        : current.filter((id) => id !== actionId),
    });
    setConfirmedChecksum(null);
  }

  function submitRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    createMutation.mutate({
      from,
      to,
      operations,
      workflow,
      source_ids: [...new Set(submittedSourceIds)],
    });
  }

  function setSourceSelected(id: string, checked: boolean) {
    setSelectedSourceIds(
      checked
        ? [...new Set([...submittedSourceIds, id])]
        : submittedSourceIds.filter((value) => value !== id),
    );
  }

  function addSource() {
    const label = newSourceLabel.trim();
    if (!label || newSourceOperations.length === 0 || createSourceMutation.isPending) return;
    setMessage(null);
    createSourceMutation.mutate({
      label,
      supported_operations: newSourceOperations,
    });
  }

  function approveSelected() {
    if (!run?.plan_checksum) {
      return;
    }
    setMessage(null);
    approveMutation.mutate({
      runId: run.run_id,
      plan_checksum: run.plan_checksum,
      selected_action_ids: selectedActionIds,
    });
  }

  if (!owner) {
    return (
      <FeedbackMessage tone="error">
        This Granot workflow is owner-only. Admin users cannot read plans, actions, conflicts, or
        receipts and cannot create or approve runs.
      </FeedbackMessage>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust-blue">Ingestion</p>
        <h1 className="text-2xl font-semibold text-navy">Granot lead workflow</h1>
        <p className="mt-1 max-w-3xl text-sm text-steel">
          Owner-only, review-before-write synchronization. Collection and planning are read-only;
          only explicitly selected actions from the displayed checksum can be applied.
        </p>
      </header>

      <FeedbackMessage tone="warning">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Granot credentials and the Vantage API secret stay on the server. The browser uses the
          authenticated proxy and never receives either credential.
        </span>
      </FeedbackMessage>
      {message ? (
        <div aria-live="polite">
          <FeedbackMessage tone={message.tone}>{message.text}</FeedbackMessage>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create Granot plans</CardTitle>
          <CardDescription>
            Select Lead workflows and their compatible exact, case-sensitive Granot sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={submitRun}>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-navy">1. Lead workflows</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["form_leads", "call_leads"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-start gap-2 rounded-md border border-steel-100 p-3 text-sm text-navy"
                  >
                    <input
                      className="mt-0.5"
                      type="checkbox"
                      value={value}
                      checked={operations.includes(value)}
                      onChange={(event) =>
                        setOperations((current) =>
                          event.target.checked
                            ? [...new Set([...current, value])]
                            : current.filter((operation) => operation !== value),
                        )
                      }
                    />
                    <span>
                      <span className="block font-medium">
                        {value === "form_leads"
                          ? "Form Lead enrichment"
                          : "Call Lead enrichment and booked-call reconciliation"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-steel">
                Selecting both creates two separate reviewable plans. Nothing is updated until you
                approve actions from each plan.
              </p>
              {missingOperations ? (
                <p className="text-sm text-red-700">Select at least one Lead workflow.</p>
              ) : null}
            </fieldset>
            <fieldset className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <legend className="text-sm font-semibold text-navy">2. Granot sources</legend>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={compatibleSources.length === 0 || allSourcesSelected}
                    onClick={() => setSelectedSourceIds(null)}
                  >
                    Select all compatible sources
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submittedSourceIds.length === 0}
                    onClick={() => setSelectedSourceIds([])}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
              {sourceCatalogQuery.isLoading ? (
                <p className="text-sm text-steel">Loading Granot sources…</p>
              ) : null}
              {sourceCatalogQuery.isError ? (
                <FeedbackMessage tone="error">{errorMessage(sourceCatalogQuery.error)}</FeedbackMessage>
              ) : null}
              {sourceCatalogQuery.isSuccess && catalogSources.length === 0 ? (
                <FeedbackMessage tone="warning">
                  No Granot sources exist yet. Add the first exact label below.
                </FeedbackMessage>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                {(["form_leads", "call_leads"] as const)
                  .filter((operation) => operations.includes(operation))
                  .map((operation) => {
                    const sources = catalogSources.filter((source) =>
                      source.supported_operations.includes(operation),
                    );
                    const selectedCount = sources.filter((source) =>
                      submittedSourceIds.includes(source.id),
                    ).length;
                    return (
                      <div key={operation} className="rounded-md border border-input bg-white p-3">
                        <h3 className="text-sm font-semibold text-navy">
                          {operation === "form_leads"
                            ? "Form Lead sources"
                            : "Call Lead sources"}
                        </h3>
                        <p className="mt-1 text-xs text-steel">
                          {selectedCount} of {sources.length} selected
                        </p>
                        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto">
                          {sources.map((source) => (
                            <label
                              key={`${operation}-${source.id}`}
                              className="flex items-start gap-2 text-sm text-navy"
                            >
                              <input
                                className="mt-0.5"
                                type="checkbox"
                                checked={submittedSourceIds.includes(source.id)}
                                onChange={(event) =>
                                  setSourceSelected(source.id, event.target.checked)
                                }
                              />
                              <span>{source.label}</span>
                            </label>
                          ))}
                          {sources.length === 0 ? (
                            <p className="text-sm text-steel">
                              No classified sources support this workflow.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {missingSourceIds && !missingOperations ? (
                <p className="text-sm text-red-700">
                  Select at least one compatible source for each selected workflow.
                </p>
              ) : null}
              <div className="rounded-md border border-steel-100 bg-steel-50 p-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <Label htmlFor="granot-new-source">Add an exact Granot source</Label>
                    <Input
                      id="granot-new-source"
                      className="mt-2 bg-white"
                      value={newSourceLabel}
                      maxLength={200}
                      placeholder="New Granot source label"
                      onChange={(event) => setNewSourceLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSource();
                        }
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-4">
                      {(["form_leads", "call_leads"] as const).map((operation) => (
                        <label key={operation} className="flex items-center gap-2 text-sm text-navy">
                          <input
                            type="checkbox"
                            checked={newSourceOperations.includes(operation)}
                            onChange={(event) =>
                              setNewSourceOperations((current) =>
                                event.target.checked
                                  ? [...new Set([...current, operation])]
                                  : current.filter((value) => value !== operation),
                              )
                            }
                          />
                          {operation === "form_leads"
                            ? "Used for Form Leads"
                            : "Used for Call Leads"}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="lg:self-end"
                    type="button"
                    variant="outline"
                    disabled={
                      !newSourceLabel.trim() ||
                      newSourceOperations.length === 0 ||
                      createSourceMutation.isPending
                    }
                    onClick={addSource}
                  >
                    {createSourceMutation.isPending ? "Adding…" : "Add source"}
                  </Button>
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-navy">3. Date window and run mode</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="granot-from">From</Label>
                  <Input
                    id="granot-from"
                    className="mt-2"
                    type="date"
                    value={from}
                    max={to}
                    required
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="granot-to">To</Label>
                  <Input
                    id="granot-to"
                    className="mt-2"
                    type="date"
                    value={to}
                    min={from}
                    required
                    onChange={(event) => setTo(event.target.value)}
                  />
                </div>
                {invalidWindow ? (
                  <p className="text-sm text-red-700 sm:col-span-2">From must not be after To.</p>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["preview", "apply"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-start gap-2 rounded-md border border-steel-100 p-3 text-sm text-navy"
                  >
                    <input
                      className="mt-0.5"
                      type="radio"
                      name="workflow"
                      checked={workflow === value}
                      onChange={() => setWorkflow(value)}
                    />
                    <span>
                      <span className="block font-medium">
                        {value === "preview"
                          ? "Preview only"
                          : "Preview, then allow approved updates"}
                      </span>
                      <span className="mt-1 block text-xs text-steel">
                        {value === "preview"
                          ? "Creates plans and performs no writes."
                          : "Still requires checksum-bound owner approval before any write."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  invalidWindow ||
                  missingOperations ||
                  missingSourceIds
                }
              >
                {createMutation.isPending
                  ? "Creating…"
                  : granotSubmitLabel(operations)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Run history</CardTitle>
            <CardDescription>Select a run to review its immutable plan and progress.</CardDescription>
          </div>
          <Button
            variant="outline"
            disabled={runsQuery.isFetching}
            onClick={() => void runsQuery.refetch()}
            aria-label="Refresh Granot runs"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {runsQuery.isLoading ? <p className="text-sm text-steel">Loading runs…</p> : null}
          {runsQuery.isError ? (
            <FeedbackMessage tone="error">{errorMessage(runsQuery.error)}</FeedbackMessage>
          ) : null}
          {!runsQuery.isLoading && (runsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-steel">No Granot runs yet.</p>
          ) : null}
          {(runsQuery.data?.length ?? 0) > 0 ? (
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="text-xs uppercase text-steel">
                <tr>
                  <th className="py-2">Created</th>
                  <th>Lead type</th>
                  <th>Workflow</th>
                  <th>Window</th>
                  <th>Status</th>
                  <th>Run group</th>
                  <th>Checksum</th>
                  <th className="text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {runsQuery.data?.map((item) => (
                  <tr key={item.run_id} className="border-t border-steel-100">
                    <td className="py-3">{formatDate(item.created_at)}</td>
                    <td>{item.operation?.replaceAll("_", " ") ?? "—"}</td>
                    <td>{item.workflow ?? "—"}</td>
                    <td>{item.from && item.to ? `${item.from} – ${item.to}` : "—"}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="font-mono text-xs">
                      {item.run_group_id ? (
                        <div className="space-y-1">
                          <span>{item.run_group_id.slice(0, 8)}…</span>
                          {runsQuery.data?.some(
                            (candidate) =>
                              candidate.run_group_id === item.run_group_id &&
                              candidate.run_id !== item.run_id,
                          ) ? (
                            <button
                              type="button"
                              className="block text-trust-blue underline"
                              onClick={() => {
                                const related = runsQuery.data
                                  ?.filter(
                                    (candidate) =>
                                      candidate.run_group_id === item.run_group_id,
                                  )
                                  .map((candidate) => candidate.run_id) ?? [];
                                setSelectedRunId(null);
                                setSelectedRunGroup({
                                  id: item.run_group_id!,
                                  runIds: related,
                                });
                              }}
                            >
                              View related run
                            </button>
                          ) : null}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="font-mono text-xs">
                      {item.plan_checksum ? `${item.plan_checksum.slice(0, 12)}…` : "—"}
                    </td>
                    <td className="text-right">
                      <Button
                        variant={selectedRunId === item.run_id ? "default" : "outline"}
                        onClick={() => selectRun(item.run_id)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </CardContent>
      </Card>

      {selectedRunGroup ? (
        <section className="space-y-4" aria-labelledby="granot-run-group-title">
          <div>
            <h2 id="granot-run-group-title" className="text-lg font-semibold text-navy">
              Run group
            </h2>
            <p className="font-mono text-xs text-steel">{selectedRunGroup.id}</p>
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {selectedRunGroup.runIds.map((runId) => (
              <GroupedRunReview key={runId} runId={runId} />
            ))}
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <RunDetail
          run={run}
          loading={runQuery.isLoading}
          fetching={runQuery.isFetching}
          error={runQuery.error}
          selectedActionIds={selectedActionIds}
          confirmedChecksum={confirmedChecksum}
          approving={approveMutation.isPending}
          onRefresh={() => void runQuery.refetch()}
          onToggleAction={setActionSelected}
          onToggleAll={(checked) => {
            if (!run) return;
            setSelectionByRun({ ...selectionByRun, [run.run_id]: checked ? syncableIds : [] });
            setConfirmedChecksum(null);
          }}
          onConfirmChecksum={(checked) =>
            setConfirmedChecksum(checked ? (run?.plan_checksum ?? null) : null)
          }
          onApprove={approveSelected}
        />
      ) : null}
    </div>
  );
}

function GroupedRunReview({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const [selectedActionIds, setSelectedActionIds] = useState<string[] | null>(null);
  const [confirmedChecksum, setConfirmedChecksum] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<unknown>(null);
  const runQuery = useQuery({
    queryKey: queryKeys.granotAutomation.run(runId),
    queryFn: () => fetchGranotRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && status !== APPROVAL_STATUS && !TERMINAL_STATUSES.has(status)
        ? 2_500
        : false;
    },
  });
  const run = runQuery.data;
  const syncableIds = useMemo(
    () =>
      (run?.actions ?? [])
        .filter(actionIsSyncable)
        .map((action) => action.action_id)
        .filter(Boolean),
    [run],
  );
  const selected = (selectedActionIds ?? syncableIds).filter((id) =>
    syncableIds.includes(id),
  );
  const approveMutation = useMutation({
    mutationFn: approveGranotRun,
    onSuccess: async () => {
      setConfirmedChecksum(null);
      setApprovalError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.runs() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.granotAutomation.run(runId) }),
      ]);
    },
    onError: (error) => setApprovalError(error),
  });

  return (
    <div className="min-w-0 rounded-lg border border-steel-100 p-4">
      {approvalError ? (
        <FeedbackMessage tone="error" className="mb-4">
          {errorMessage(approvalError)}
        </FeedbackMessage>
      ) : null}
      <RunDetail
        run={run}
        loading={runQuery.isLoading}
        fetching={runQuery.isFetching}
        error={runQuery.error}
        selectedActionIds={selected}
        confirmedChecksum={confirmedChecksum}
        approving={approveMutation.isPending}
        onRefresh={() => void runQuery.refetch()}
        onToggleAction={(actionId, checked) => {
          setSelectedActionIds(
            checked
              ? [...new Set([...selected, actionId])]
              : selected.filter((id) => id !== actionId),
          );
          setConfirmedChecksum(null);
        }}
        onToggleAll={(checked) => {
          setSelectedActionIds(checked ? syncableIds : []);
          setConfirmedChecksum(null);
        }}
        onConfirmChecksum={(checked) =>
          setConfirmedChecksum(checked ? (run?.plan_checksum ?? null) : null)
        }
        onApprove={() => {
          if (!run?.plan_checksum) return;
          setApprovalError(null);
          approveMutation.mutate({
            runId,
            plan_checksum: run.plan_checksum,
            selected_action_ids: selected,
          });
        }}
      />
    </div>
  );
}

function RunDetail({
  run,
  loading,
  fetching,
  error,
  selectedActionIds,
  confirmedChecksum,
  approving,
  onRefresh,
  onToggleAction,
  onToggleAll,
  onConfirmChecksum,
  onApprove,
}: {
  run?: GranotRun;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  selectedActionIds: string[];
  confirmedChecksum: string | null;
  approving: boolean;
  onRefresh: () => void;
  onToggleAction: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onConfirmChecksum: (checked: boolean) => void;
  onApprove: () => void;
}) {
  if (loading && !run) return <p className="text-sm text-steel">Loading run detail…</p>;
  if (error) return <FeedbackMessage tone="error">{errorMessage(error)}</FeedbackMessage>;
  if (!run) return null;

  const syncable = (run.actions ?? []).filter(actionIsSyncable);
  const canApprove =
    run.status === APPROVAL_STATUS &&
    Boolean(run.plan_checksum) &&
    selectedActionIds.length > 0 &&
    confirmedChecksum === run.plan_checksum;

  return (
    <section className="space-y-6" aria-labelledby="granot-run-detail-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="granot-run-detail-title" className="font-mono text-lg font-semibold text-navy">
            {run.run_id}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            {!TERMINAL_STATUSES.has(run.status) && run.status !== APPROVAL_STATUS ? (
              <span className="text-xs text-steel" aria-live="polite">Polling for progress…</span>
            ) : null}
          </div>
        </div>
        <Button variant="outline" disabled={fetching} onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh detail
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan evidence and progress</CardTitle>
          <CardDescription>
            The checksum binds approval to this exact plan. Any server-side change requires a fresh
            review and approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Status" value={run.status} />
          <Metric label="Lead type" value={run.operation?.replaceAll("_", " ") ?? "—"} />
          <Metric label="Workflow" value={run.workflow ?? "—"} />
          <Metric label="Plan expires" value={formatDate(run.expires_at)} />
          <Metric label="Created" value={formatDate(run.created_at)} />
          <Metric label="Updated" value={formatDate(run.updated_at)} />
          <Metric label="Phase" value={run.checkpoint?.phase ?? run.status} />
          <Metric label="Completed units" value={run.checkpoint?.completed_units ?? "—"} />
          <Metric label="Receipt count" value={run.receipt_count} />
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-wide text-steel">Plan checksum</p>
            <p className="mt-1 break-all font-mono text-xs text-navy">{run.plan_checksum ?? "Not planned yet"}</p>
          </div>
          {Object.entries(run.operation_status_counts ?? {}).map(([key, value]) => (
            <Metric key={key} label={key.replaceAll("_", " ")} value={value} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source collections</CardTitle>
          <CardDescription>Counts and hashes captured during read-only collection.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(run.collection?.not_observed_source_labels.length ?? 0) > 0 ? (
            <FeedbackMessage tone="warning" className="mb-4">
              Requested but not observed: {run.collection?.not_observed_source_labels.join(", ")}
            </FeedbackMessage>
          ) : null}
          {(run.collection_summaries?.length ?? 0) === 0 ? (
            <p className="text-sm text-steel">No collection summaries reported yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-steel">
                <tr><th className="py-2">Source</th><th>Booked jobs</th><th>Follow-up estimates</th><th>Total rows</th><th>Content hash</th></tr>
              </thead>
              <tbody>
                {run.collection_summaries?.map((summary, index) => (
                  <tr key={`${summary.source_label}-${index}`} className="border-t border-steel-100">
                    <td className="py-3">{text(summary.source_label)}</td>
                    <td>{number(summary.booked_jobs)}</td>
                    <td>{number(summary.follow_up_estimates)}</td>
                    <td>{number(summary.row_count)}</td>
                    <td className="max-w-xs break-all font-mono text-xs">{text(summary.content_hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Planned row actions</CardTitle>
            <CardDescription>
              Select only actions you intend to synchronize. Conflicted or blocked actions cannot
              be selected.
            </CardDescription>
          </div>
          {syncable.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-navy">
              <input
                type="checkbox"
                checked={selectedActionIds.length === syncable.length}
                onChange={(event) => onToggleAll(event.target.checked)}
              />
              Select all syncable
            </label>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(run.actions?.length ?? 0) === 0 ? (
            <p className="text-sm text-steel">No row actions reported yet.</p>
          ) : (
            <table className="w-full min-w-4xl text-left text-sm">
              <thead className="text-xs uppercase text-steel">
                <tr><th className="py-2">Sync</th><th>Operation</th><th>Status</th><th>Source</th><th>Row / target</th><th>Summary</th></tr>
              </thead>
              <tbody>
                {run.actions?.map((action, index) => {
                  const syncableAction = actionIsSyncable(action) && Boolean(action.action_id);
                  return (
                    <tr key={action.action_id || `action-${index}`} className="border-t border-steel-100">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select action ${action.action_id || index + 1}`}
                          disabled={!syncableAction || run.status !== APPROVAL_STATUS}
                          checked={syncableAction && selectedActionIds.includes(action.action_id)}
                          onChange={(event) => onToggleAction(action.action_id, event.target.checked)}
                        />
                      </td>
                      <td>{text(action.operation)}</td>
                      <td>{action.status ? <StatusBadge status={action.status} /> : "—"}</td>
                      <td>{text(action.source_label)}</td>
                      <td className="font-mono text-xs">{text(action.source_row_id ?? action.target_id)}</td>
                      <td>{text(action.summary ?? action.reason)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {(run.conflicts?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
            <CardDescription>Conflicts are visible for review and excluded from synchronization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {run.conflicts?.map((conflict, index) => (
              <div key={conflict.conflict_id || `conflict-${index}`} className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-navy">{text(conflict.type, "Conflict")}</p>
                  <p className="text-sm text-steel">{text(conflict.summary ?? conflict.reason)}</p>
                  <p className="mt-1 font-mono text-xs text-steel">{conflict.conflict_id}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {run.status === APPROVAL_STATUS ? (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle>Approve exact plan</CardTitle>
            <CardDescription>
              This is the write boundary. Approval submits {selectedActionIds.length} selected action
              {selectedActionIds.length === 1 ? "" : "s"} with the checksum below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 rounded-md border border-steel-200 p-3 text-sm text-navy">
              <input
                className="mt-0.5"
                type="checkbox"
                checked={Boolean(run.plan_checksum) && confirmedChecksum === run.plan_checksum}
                onChange={(event) => onConfirmChecksum(event.target.checked)}
              />
              <span>
                I reviewed the selected actions and approve only plan checksum{" "}
                <span className="break-all font-mono text-xs">{run.plan_checksum}</span>.
              </span>
            </label>
            <Button variant="gold" disabled={!canApprove || approving} onClick={onApprove}>
              {approving ? "Submitting approval…" : `Approve ${selectedActionIds.length} selected actions`}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(run.receipts?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Application receipts</CardTitle>
            <CardDescription>Durable per-action write results returned by the server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {run.receipts?.map((receipt, index) => (
              <div key={receipt.receipt_id || `receipt-${index}`} className="flex items-start gap-3 rounded-md border border-steel-100 p-3">
                {receipt.outcome === "applied" || receipt.outcome === "already_applied" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">
                    Action {receipt.action_id} · {text(receipt.outcome)}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-steel">
                    {formatDate(receipt.applied_at)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-steel-100 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-steel">{label}</p>
      <div className="mt-1 text-sm font-semibold text-navy">{value}</div>
    </div>
  );
}
