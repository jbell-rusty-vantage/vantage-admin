"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/table-shell";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { floridaCalendarDateInputValue } from "@/lib/floridaTime";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  applyAdvancedCplCommand,
  applySimpleCplSchedule,
  cancelCplCorrection,
  computeSimpleCplChanges,
  createCplCorrection,
  exclusiveEndToInclusiveOwnerDate,
  fetchCplCorrection,
  fetchCplPeriods,
  fetchCplSnapshot,
  formatCplAmount,
  isCplPreviewStaleError,
  isRegistryStaleRevisionError,
  isSnapshotRateMissing,
  parseCplAmountInput,
  previewCplCorrection,
  resolveAdvancedExpectedRevision,
  snapshotCurrentAmount,
  type CplCorrectionPreviewResult,
  type CplSchedulePeriod,
  type CplSnapshotItem,
} from "@/lib/api/registryCpl";
import { fetchSourceGranularities } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryApiErrorMessage } from "./registry-api-error";

type CplMode = "simple" | "advanced" | "corrections";

const MODE_TABS: Array<{ id: CplMode; label: string }> = [
  { id: "simple", label: "Simple" },
  { id: "advanced", label: "Advanced" },
  { id: "corrections", label: "Corrections" },
];

function parseCplMode(value: string | null): CplMode {
  if (value === "advanced" || value === "corrections" || value === "simple") {
    return value;
  }
  return "simple";
}

export function CplManager({ readOnly }: { readOnly: boolean }) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<CplMode>(() => parseCplMode(searchParams.get("cpl_mode")));
  const deepLinkEntity = searchParams.get("entity");

  return (
    <div className="space-y-4">
      <FeedbackMessage tone="info">
        Ordinary schedule edits update future attribution only. They do not rewrite CPL on prior leads.
        Use Corrections to backfill historical leads when needed.
      </FeedbackMessage>

      <div
        className="flex flex-wrap gap-1 rounded-lg border bg-background p-1"
        role="tablist"
        aria-label="CPL modes"
      >
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === tab.id
                ? "bg-pale-gold/70 text-navy"
                : "text-steel hover:bg-steel-100 hover:text-navy",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {deepLinkEntity ? (
        <p className="text-xs text-muted-foreground">
          Linked entity <span className="font-mono">{deepLinkEntity}</span>
          {mode === "corrections"
            ? " — open Corrections below to preview or review jobs."
            : mode === "advanced"
              ? " — select the matching granularity in Advanced mode."
              : null}
        </p>
      ) : null}

      {mode === "simple" ? <SimpleCplPanel readOnly={readOnly} /> : null}
      {mode === "advanced" ? (
        <AdvancedCplPanel readOnly={readOnly} initialGranularityId={deepLinkEntity} />
      ) : null}
      {mode === "corrections" ? (
        <CorrectionsCplPanel readOnly={readOnly} initialJobId={deepLinkEntity} />
      ) : null}
    </div>
  );
}

function SimpleCplPanel({ readOnly }: { readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [effectiveDate, setEffectiveDate] = useState(floridaCalendarDateInputValue());
  const [reason, setReason] = useState("");
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.operationsRegistry.cplSnapshot(),
    queryFn: fetchCplSnapshot,
  });

  const snapshot = query.data;
  const changes = useMemo(
    () => (snapshot ? computeSimpleCplChanges(snapshot, drafts) : []),
    [snapshot, drafts],
  );

  const updateMutation = useMutation({
    mutationFn: applySimpleCplSchedule,
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setDrafts({});
      setMutationError(null);
      setMessage("CPL schedule updated.");
    },
    onError: async (error) => {
      setMutationError(error);
      setMessage(null);
      // Keep drafts; refresh revisions so retry uses current expected_revisions.
      if (isRegistryStaleRevisionError(error)) {
        await query.refetch();
      }
    },
  });

  if (query.isPending) {
    return <TableLoadingState label="Loading CPL snapshot..." />;
  }
  if (query.isError) {
    return (
      <TableErrorState
        title="Unable to load CPL snapshot."
        error={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }

  const items = snapshot!.items;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple CPL editor</CardTitle>
        <CardDescription>
          Edit current amounts across granularities. Missing rates are distinct from $0.00.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}

        {items.length === 0 ? (
          <TableEmptyState label="No CPL snapshot rows." />
        ) : (
          <DataTable
            items={items}
            getRowKey={(item) => item.source_granularity.id}
            compact
            columns={[
              {
                key: "company",
                header: "Company",
                cell: (item) => item.source_granularity.source_company,
              },
              {
                key: "granularity",
                header: "Granularity",
                cell: (item) => (
                  <span>
                    {item.source_granularity.granularity_key}
                    <span className="block text-xs text-muted-foreground">
                      {item.source_granularity.owner_label} · {item.source_granularity.channel}
                    </span>
                  </span>
                ),
              },
              {
                key: "current",
                header: "Current",
                cell: (item) => <CurrentRateDisplay item={item} />,
              },
              {
                key: "amount",
                header: "New amount",
                cell: (item) => {
                  const id = item.source_granularity.id;
                  const baseline = snapshotCurrentAmount(item.current_rate);
                  const value =
                    drafts[id] ?? (baseline === null ? "" : String(baseline));
                  return (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={value}
                      disabled={readOnly}
                      placeholder={isSnapshotRateMissing(item.current_rate) ? "Missing" : undefined}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [id]: event.target.value }))
                      }
                      className="max-w-[120px]"
                    />
                  );
                },
              },
            ]}
          />
        )}

        {!readOnly ? (
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Effective date (NY business)">
              <Input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </FilterField>
            <FilterField label="Reason (optional)" className="min-w-[200px]">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
            </FilterField>
            <Button
              disabled={changes.length === 0 || updateMutation.isPending || !effectiveDate}
              onClick={() => {
                const expected_revisions: Record<string, number> = {};
                for (const change of changes) {
                  expected_revisions[change.source_granularity_id] = change.schedule_revision;
                }
                updateMutation.mutate({
                  effective_date: effectiveDate,
                  expected_revisions,
                  changes: changes.map(({ source_granularity_id, amount }) => ({
                    source_granularity_id,
                    amount,
                  })),
                  ...(reason ? { reason } : {}),
                });
              }}
            >
              Update {changes.length > 0 ? `(${changes.length})` : ""}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CurrentRateDisplay({ item }: { item: CplSnapshotItem }) {
  if (isSnapshotRateMissing(item.current_rate)) {
    return <span className="font-medium text-amber-700">Missing</span>;
  }
  const amount = snapshotCurrentAmount(item.current_rate);
  return <span>{amount === null ? "-" : formatCplAmount(amount)}</span>;
}

type AdvancedCommand = "add_future" | "split" | "correct_period" | "replace_schedule";

const ADVANCED_COMMAND_HELP: Record<
  AdvancedCommand,
  { label: string; summary: string; details: string[] }
> = {
  add_future: {
    label: "add_future — close current open period, start a new rate",
    summary:
      "Ends the open-ended final period on the day before your effective date, then opens a new period at that amount from the effective date onward.",
    details: [
      "Requires an open-ended final period (shown as “– open” under Future/Current).",
      "Effective date must be after that final period’s start.",
      "Does not rewrite CPL already stamped on historical leads.",
    ],
  },
  split: {
    label: "split — cut one period into two at a date",
    summary:
      "Splits a chosen period at the effective date: the left piece keeps the old amount; the right piece starts at the new amount and keeps the original end (or stays open).",
    details: [
      "Period ID is required — copy it from the Past / Current / Future lists above.",
      "Effective date must fall strictly inside that period.",
      "Useful for mid-period rate changes without rebuilding the whole schedule.",
      "Does not rewrite CPL already stamped on historical leads.",
    ],
  },
  correct_period: {
    label: "correct_period — change amount on an existing period",
    summary:
      "Replaces the amount on one period in place (same date range). This only fixes the schedule timeline.",
    details: [
      "Period ID is required. Reason is strongly recommended (defaults to “Correction”).",
      "Schedule-only: leads that already have a CPL snapshot are unchanged until you run Corrections.",
      "Use this when a period’s rate was entered wrong; then backfill leads via the Corrections tab if needed.",
    ],
  },
  replace_schedule: {
    label: "replace_schedule — rebuild the full timeline",
    summary:
      "Archives the current periods and installs a brand-new contiguous schedule from the JSON array you provide.",
    details: [
      'Each entry: { "effective_from_date": "YYYY-MM-DD", "amount": number, "effective_until_date"?: "YYYY-MM-DD" }.',
      "Omit effective_until_date on the last period to leave it open-ended.",
      "Highest-impact command — prefer add_future / split / correct_period for routine edits.",
      "Does not rewrite CPL already stamped on historical leads.",
    ],
  },
};

function AdvancedCplPanel({
  readOnly,
  initialGranularityId,
}: {
  readOnly: boolean;
  initialGranularityId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [granularityId, setGranularityId] = useState(initialGranularityId ?? "");
  const [effectiveDate, setEffectiveDate] = useState(floridaCalendarDateInputValue());
  const [amount, setAmount] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [reason, setReason] = useState("");
  const [command, setCommand] = useState<AdvancedCommand>("add_future");
  const [replacePeriodsText, setReplacePeriodsText] = useState(
    '[{"effective_from_date":"2026-01-01","amount":195}]',
  );
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const commandHelp = ADVANCED_COMMAND_HELP[command];

  const granularitiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: false }),
    queryFn: () => fetchSourceGranularities({ includeInactive: false }),
  });

  const effectiveGranularityId =
    granularityId || granularitiesQuery.data?.[0]?.id || "";

  const periodsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.cplPeriods(effectiveGranularityId),
    queryFn: () => fetchCplPeriods(effectiveGranularityId),
    enabled: Boolean(effectiveGranularityId),
  });

  const commandMutation = useMutation({
    mutationFn: (body: Parameters<typeof applyAdvancedCplCommand>[1]) =>
      applyAdvancedCplCommand(effectiveGranularityId, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      await periodsQuery.refetch();
      setMutationError(null);
      setMessage("Schedule command applied.");
    },
    onError: async (error) => {
      setMutationError(error);
      setMessage(null);
      if (isRegistryStaleRevisionError(error)) {
        await periodsQuery.refetch();
      }
    },
  });

  const today = floridaCalendarDateInputValue();
  const periods = periodsQuery.data?.periods ?? [];
  const classified = classifyPeriods(periods, today);
  const expectedRevision = resolveAdvancedExpectedRevision(
    periodsQuery.isSuccess,
    periodsQuery.data?.revision,
  );
  const parsedAmount = parseCplAmountInput(amount);
  const amountRequired = command !== "replace_schedule";
  const periodIdRequired = command === "split" || command === "correct_period";
  const canRunCommand =
    Boolean(effectiveGranularityId) &&
    expectedRevision !== null &&
    (!amountRequired || parsedAmount !== null) &&
    (!periodIdRequired || Boolean(periodId.trim())) &&
    !commandMutation.isPending;

  function runCommand() {
    if (expectedRevision === null) {
      setMutationError(new Error("Load the CPL periods for this granularity before running a command."));
      return;
    }
    if (command === "add_future") {
      if (parsedAmount === null) {
        setMutationError(new Error("Enter a valid non-negative amount."));
        return;
      }
      commandMutation.mutate({
        operation: "add_future",
        expected_revision: expectedRevision,
        effective_date: effectiveDate,
        amount: parsedAmount,
        ...(reason ? { reason } : {}),
      });
      return;
    }
    if (command === "split") {
      if (parsedAmount === null) {
        setMutationError(new Error("Enter a valid non-negative amount."));
        return;
      }
      if (!periodId.trim()) {
        setMutationError(new Error("Period ID is required for split."));
        return;
      }
      commandMutation.mutate({
        operation: "split",
        expected_revision: expectedRevision,
        period_id: periodId.trim(),
        effective_date: effectiveDate,
        amount: parsedAmount,
        ...(reason ? { reason } : {}),
      });
      return;
    }
    if (command === "correct_period") {
      if (parsedAmount === null) {
        setMutationError(new Error("Enter a valid non-negative amount."));
        return;
      }
      if (!periodId.trim()) {
        setMutationError(new Error("Period ID is required for correct_period."));
        return;
      }
      commandMutation.mutate({
        operation: "correct_period",
        expected_revision: expectedRevision,
        period_id: periodId.trim(),
        amount: parsedAmount,
        reason: reason || "Correction",
      });
      return;
    }
    if (command === "replace_schedule") {
      try {
        const replacementPeriods = JSON.parse(replacePeriodsText) as Array<{
          effective_from_date: string;
          effective_until_date?: string;
          amount: number;
        }>;
        if (!Array.isArray(replacementPeriods) || replacementPeriods.length === 0) {
          setMutationError(new Error("replace_schedule requires a non-empty periods array."));
          return;
        }
        commandMutation.mutate({
          operation: "replace_schedule",
          expected_revision: expectedRevision,
          periods: replacementPeriods,
          ...(reason ? { reason } : {}),
        });
      } catch {
        setMutationError(
          new Error(
            'replace_schedule JSON must be an array of { effective_from_date, effective_until_date?, amount }.',
          ),
        );
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced schedule commands</CardTitle>
        <CardDescription>
          Per-granularity timeline surgery. Pick one source granularity, inspect its Past /
          Current / Future periods, then run a single command against that schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FeedbackMessage tone="info">
          Advanced edits change the schedule used for future attribution only — same rule as
          Simple. Dates are NY business dates; lists show inclusive owner end dates (stored ends
          are exclusive). Commands use optimistic locking via the loaded schedule revision.
        </FeedbackMessage>

        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}

        <FilterField label="Granularity">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={effectiveGranularityId}
            onChange={(event) => setGranularityId(event.target.value)}
          >
            {(granularitiesQuery.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.granularity_key} · {g.owner_label} ({g.channel})
              </option>
            ))}
          </select>
        </FilterField>

        {periodsQuery.isPending ? <TableLoadingState label="Loading periods..." /> : null}
        {periodsQuery.isError ? (
          <TableErrorState
            title="Unable to load CPL periods."
            error={periodsQuery.error instanceof Error ? periodsQuery.error.message : undefined}
            onRetry={() => periodsQuery.refetch()}
          />
        ) : null}

        {periodsQuery.data ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <PeriodGroup title="Past" periods={classified.past} />
            <PeriodGroup title="Current" periods={classified.current} />
            <PeriodGroup title="Future" periods={classified.future} />
          </div>
        ) : null}

        {!readOnly ? (
          <div className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-2">
            <FilterField label="Command" className="md:col-span-2">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={command}
                onChange={(event) =>
                  setCommand(event.target.value as AdvancedCommand)
                }
              >
                {(Object.keys(ADVANCED_COMMAND_HELP) as AdvancedCommand[]).map((id) => (
                  <option key={id} value={id}>
                    {ADVANCED_COMMAND_HELP[id].label}
                  </option>
                ))}
              </select>
            </FilterField>

            <div className="md:col-span-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm">
              <p className="font-medium text-navy">{commandHelp.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {commandHelp.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            {command === "replace_schedule" ? (
              <FilterField label="Replacement periods (JSON)" className="md:col-span-2">
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                  value={replacePeriodsText}
                  onChange={(e) => setReplacePeriodsText(e.target.value)}
                />
              </FilterField>
            ) : (
              <>
                {command === "add_future" || command === "split" ? (
                  <FilterField label="Effective date">
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </FilterField>
                ) : null}
                <FilterField label="Amount">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </FilterField>
              </>
            )}
            {command === "split" || command === "correct_period" ? (
              <FilterField label="Period ID">
                <Input value={periodId} onChange={(e) => setPeriodId(e.target.value)} />
              </FilterField>
            ) : null}
            <FilterField label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </FilterField>
            <FilterField label="&nbsp;">
              <Button disabled={!canRunCommand} onClick={runCommand}>
                Run command
              </Button>
            </FilterField>
            {expectedRevision === null && effectiveGranularityId ? (
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Waiting for a loaded schedule revision before commands can run.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PeriodGroup({ title, periods }: { title: string; periods: CplSchedulePeriod[] }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {periods.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="mt-2 space-y-2 text-xs">
          {periods.map((period) => (
            <li key={period.id ?? `${period.effective_from_date}-${period.amount_cents}`}>
              <span className="font-medium">{formatCplAmount(period.amount_cents / 100)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {period.effective_from_date}
                {period.effective_until_date_exclusive
                  ? ` – ${exclusiveEndToInclusiveOwnerDate(period.effective_until_date_exclusive)}`
                  : " – open"}
              </span>
              {period.id ? <span className="block text-muted-foreground">ID: {period.id}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function classifyPeriods(periods: CplSchedulePeriod[], today: string) {
  const past: CplSchedulePeriod[] = [];
  const current: CplSchedulePeriod[] = [];
  const future: CplSchedulePeriod[] = [];

  for (const period of periods) {
    const from = period.effective_from_date;
    const untilExclusive = period.effective_until_date_exclusive;
    const untilInclusive = exclusiveEndToInclusiveOwnerDate(untilExclusive);
    if (from > today) {
      future.push(period);
    } else if (untilInclusive && untilInclusive < today) {
      past.push(period);
    } else {
      current.push(period);
    }
  }

  return { past, current, future };
}

function CorrectionsCplPanel({
  readOnly,
  initialJobId,
}: {
  readOnly: boolean;
  initialJobId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [granularityId, setGranularityId] = useState("");
  const [windowFrom, setWindowFrom] = useState("");
  const [windowUntil, setWindowUntil] = useState("");
  const [preview, setPreview] = useState<CplCorrectionPreviewResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const granularitiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: false }),
    queryFn: () => fetchSourceGranularities({ includeInactive: false }),
  });

  const jobQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.cplCorrection(jobId ?? "none"),
    queryFn: () => fetchCplCorrection(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 2000;
    },
  });

  const effectiveCorrectionGranularityId =
    granularityId || granularitiesQuery.data?.[0]?.id || "";
  const job = jobQuery.data ?? null;

  async function handlePreview() {
    setError(null);
    try {
      setPreview(
        await previewCplCorrection({
          source_granularity_id: effectiveCorrectionGranularityId,
          window_from: windowFrom,
          window_until: windowUntil,
        }),
      );
    } catch (previewError) {
      if (isCplPreviewStaleError(previewError)) {
        setPreview(null);
      }
      setError(previewError);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setError(null);
    try {
      const created = await createCplCorrection({
        source_granularity_id: effectiveCorrectionGranularityId,
        window_from: windowFrom,
        window_until: windowUntil,
        target_schedule_revision: preview.target_schedule_revision,
        preview_hash: preview.preview_hash,
        confirm: true,
        ...(reason ? { reason } : {}),
      });
      setJobId(created.id);
      await invalidateRegistryQueries(queryClient);
      setMessage("Correction job started.");
    } catch (confirmError) {
      setError(confirmError);
    }
  }

  async function handleCancel() {
    if (!job) return;
    setError(null);
    try {
      await cancelCplCorrection(job.id, reason ? { reason } : {});
      setMessage("Correction job cancelled.");
    } catch (cancelError) {
      setError(cancelError);
    }
  }

  const canCancel =
    job && (job.status === "pending" || job.status === "processing");

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPL corrections</CardTitle>
        <CardDescription>
          Backfill CPL already stamped on historical leads for one granularity and date window.
          Unlike Simple / Advanced, this rewrites lead CPL snapshots — not just the schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FeedbackMessage tone="info">
          Typical flow: fix the schedule first (Simple or Advanced, e.g. correct_period), then
          Preview → Confirm here so existing form/call leads in the window pick up the target
          rates from that schedule revision. Confirm freezes the preview hash + revision; if the
          schedule changes afterward, re-preview. Windows are capped server-side (366 inclusive
          business days / 250 reviewed leads) — split larger backfills into multiple jobs.
        </FeedbackMessage>

        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {error ? <RegistryApiErrorMessage error={error} /> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <FilterField label="Granularity">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={effectiveCorrectionGranularityId}
              onChange={(event) => setGranularityId(event.target.value)}
            >
              {(granularitiesQuery.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.granularity_key} · {g.owner_label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Window from">
            <Input type="date" value={windowFrom} onChange={(e) => setWindowFrom(e.target.value)} />
          </FilterField>
          <FilterField label="Window until">
            <Input type="date" value={windowUntil} onChange={(e) => setWindowUntil(e.target.value)} />
          </FilterField>
          <FilterField label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </FilterField>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!effectiveCorrectionGranularityId || !windowFrom || !windowUntil}
              onClick={() => void handlePreview()}
            >
              Preview impact
            </Button>
            <Button disabled={!preview} onClick={() => void handleConfirm()}>
              Confirm correction
            </Button>
            {canCancel ? (
              <Button variant="destructive" onClick={() => void handleCancel()}>
                Cancel job
              </Button>
            ) : null}
            {isCplPreviewStaleError(error) ? (
              <Button variant="outline" onClick={() => void handlePreview()}>
                Recover stale preview
              </Button>
            ) : null}
          </div>
        ) : null}

        {preview ? (
          <div className="rounded-md border bg-background p-3 text-sm">
            <p className="font-medium">Preview impact</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Matched: {preview.impact.matched_count}</li>
              <li>Would change: {preview.impact.would_change_count}</li>
              <li>Would no-op: {preview.impact.would_no_op_count}</li>
              <li>Form leads: {preview.impact.form_lead_count}</li>
              <li>Call leads: {preview.impact.call_lead_count}</li>
            </ul>
            {preview.impact.sample.length > 0 ? (
              <div className="mt-3">
                <p className="font-medium">Sample</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {preview.impact.sample.slice(0, 5).map((row) => (
                    <li key={`${row.lead_model}-${row.lead_id}`}>
                      {row.lead_model}/{row.lead_id}: {formatCplAmount(row.current_cpl)} →{" "}
                      {formatCplAmount(row.target_cpl)}
                      {row.would_change ? "" : " (no-op)"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {job ? (
          <div className="rounded-md border bg-background p-3 text-sm">
            <p className="font-medium">Job {job.id}</p>
            <p className="text-muted-foreground">Status: {job.status}</p>
            <p className="text-muted-foreground">
              Changed {job.changed_count} · No-op {job.no_op_count} · Failed {job.failed_count}
            </p>
            {job.last_error ? <p className="text-destructive">{job.last_error}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
