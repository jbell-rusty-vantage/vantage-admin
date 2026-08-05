"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FilePlus2,
  LockKeyhole,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { DestinationSelector } from "@/components/reporting/destination-selector";
import { GoogleSettingsPanel } from "@/components/reporting/google-settings-panel";
import { InternalReportingLink } from "@/components/reporting/reporting-links";
import { RunStatusBadge } from "@/components/reporting/reporting-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveReportingDefinition,
  confirmReportingRun,
  createReportingDefinition,
  createReportingRevision,
  fetchReportingCatalog,
  fetchReportingDefinition,
  fetchReportingDefinitions,
  fetchReportingRuns,
  prepareReportingRun,
  previewReportingDraft,
  type ReportingCatalogDataset,
  type ReportingDefinitionDraft,
  type ReportingExplicitDateWindowSpec,
  type ReportingPreview,
  type ReportingRollingDateWindowSpec,
  type ReportingRunConfirmation,
} from "@/lib/api/reporting";
import { fetchSourceCompanies, fetchSourceGranularities } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import {
  defaultColumns,
  idempotencyKeyForRunAttempt,
  localDateInTimeZone,
  moveColumn,
  normalizeSourceSelection,
  validateDraft,
} from "@/lib/reporting/builder";

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function displayName(key: string) {
  return key
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function windowLabel(spec: ReportingDefinitionDraft["date_window_spec"]) {
  if (spec.kind === "rolling") return `Last ${spec.days} local day${spec.days === 1 ? "" : "s"}`;
  return "throughLocal" in spec
    ? `${spec.fromLocal} through ${spec.throughLocal}`
    : `${spec.fromLocal} to ${spec.toExclusiveLocal} (exclusive)`;
}

function windowPolicy(spec: ReportingDefinitionDraft["date_window_spec"]) {
  return spec.kind === "rolling"
    ? "Preview/run-time anchor; includes current local day"
    : "Explicit local boundaries";
}

function newDraft(dataset: ReportingCatalogDataset, timezone: string): ReportingDefinitionDraft {
  const today = localDateInTimeZone(timezone);
  return {
    name: "",
    description: "",
    dataset_key: dataset.key,
    dataset_schema_version: dataset.schema_version,
    date_window_spec: { kind: "explicit", fromLocal: today, throughLocal: today },
    timezone,
    source_selection: [],
    filters: {},
    selected_columns: defaultColumns(dataset),
    sort: dataset.default_sort,
    destination_id: "",
    destination_snapshot_checksum: "",
    strategy: "snapshot",
  };
}

export function ReportingDashboard({ definitionId }: { definitionId?: string }) {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ReportingDefinitionDraft | null>(null);
  const [preview, setPreview] = useState<ReportingPreview | null>(null);
  const [confirmation, setConfirmation] = useState<ReportingRunConfirmation | null>(null);
  const [runAttempt, setRunAttempt] = useState<{
    revisionId: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: queryKeys.reporting.catalog(),
    queryFn: fetchReportingCatalog,
  });
  const definitions = useQuery({
    queryKey: queryKeys.reporting.definitions(),
    queryFn: fetchReportingDefinitions,
  });
  const runs = useQuery({ queryKey: queryKeys.reporting.runs(), queryFn: fetchReportingRuns });
  const detail = useQuery({
    queryKey: queryKeys.reporting.definition(definitionId ?? ""),
    queryFn: () => fetchReportingDefinition(definitionId!),
    enabled: Boolean(definitionId),
  });
  const companies = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(false),
    queryFn: () => fetchSourceCompanies(),
  });
  const granularities = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: false }),
    queryFn: () => fetchSourceGranularities(),
  });

  const selectedDataset = useMemo(
    () => catalog.data?.datasets.find((dataset) => dataset.key === draft?.dataset_key),
    [catalog.data, draft?.dataset_key],
  );
  const currentRevisionId =
    detail.data?.current_revision.id ?? detail.data?.current_revision._id ?? "";
  const activeConfirmation =
    confirmation?.revision_id === currentRevisionId ? confirmation : null;

  function clearRunConfirmation() {
    setConfirmation(null);
    setRunAttempt(null);
  }

  const refresh = async () => {
    clearRunConfirmation();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.reporting.all }),
      definitionId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.reporting.definition(definitionId) })
        : Promise.resolve(),
    ]);
  };

  function invalidatePreview(next: ReportingDefinitionDraft) {
    setDraft(next);
    setPreview(null);
    clearRunConfirmation();
  }

  function startCreate() {
    const dataset = catalog.data?.datasets[0];
    if (!dataset || !catalog.data) return;
    const next = newDraft(dataset, catalog.data.default_timezone || "America/New_York");
    setDraft(next);
    setPreview(null);
    clearRunConfirmation();
  }

  function startEdit() {
    const current = detail.data?.current_revision;
    if (!current) return;
    setDraft(structuredClone(current.draft));
    setPreview(null);
    clearRunConfirmation();
  }

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("No draft is open.");
      const next = {
        ...draft,
        source_selection: normalizeSourceSelection(draft.source_selection),
      };
      const issues = validateDraft(next);
      if (issues.length) throw new Error(issues.join(" "));
      setDraft(next);
      return previewReportingDraft(definitionId ?? null, next);
    },
    onSuccess: (result) => {
      setPreview(result);
      setMessage("Preview generated. Review all warnings and blocking reasons.");
    },
    onError: (error) => setMessage(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !preview) throw new Error("Generate an unexpired preview before saving.");
      clearRunConfirmation();
      const input = {
        draft,
        preview_id: preview.preview_id ?? preview.preview_token,
        preview_checksum: preview.preview_checksum,
      };
      return definitionId
        ? createReportingRevision(definitionId, input)
        : createReportingDefinition(input);
    },
    onSuccess: async () => {
      setMessage("Immutable reporting revision saved.");
      setDraft(null);
      setPreview(null);
      clearRunConfirmation();
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveReportingDefinition(definitionId!),
    onSuccess: async () => {
      setMessage("Definition archived; its immutable revisions remain available.");
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });

  const prepareRunMutation = useMutation({
    mutationFn: (attempt: { revisionId: string; key: string }) =>
      prepareReportingRun(definitionId!, attempt.revisionId, attempt.key),
    onSuccess: (result) => {
      if ("status" in result) {
        setMessage(
          `Run ${result.run_id} queued${result.idempotent_replay ? " (idempotent replay)" : ""}.${
            result.wakeup_published === false
              ? " Immediate worker wakeup was unavailable; heartbeat recovery is pending."
              : ""
          }`,
        );
        clearRunConfirmation();
        void refresh();
        return;
      }
      setConfirmation(result);
      setRunAttempt({ revisionId: result.revision_id, key: result.idempotency_key });
      setMessage("Fresh run estimate ready. Confirm only after reviewing destination impact and PII.");
    },
    onError: (error) => setMessage(error.message),
  });

  const confirmRunMutation = useMutation({
    mutationFn: () => {
      if (!activeConfirmation || !definitionId) {
        throw new Error("Run confirmation is stale or expired.");
      }
      return confirmReportingRun(definitionId, {
        revision_id: activeConfirmation.revision_id,
        confirmation_token: activeConfirmation.confirmation_token,
        idempotency_key: activeConfirmation.idempotency_key,
      });
    },
    onSuccess: async (result) => {
      setMessage(
        `Run ${result.run_id} queued${result.idempotent_replay ? " (idempotent replay)" : ""}. Delivery runs asynchronously.${
          result.wakeup_published === false
            ? " Immediate worker wakeup was unavailable; heartbeat recovery is pending."
            : ""
        }`,
      );
      clearRunConfirmation();
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });

  const loadingError =
    catalog.error ?? definitions.error ?? runs.error ?? (definitionId ? detail.error : null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust-blue">
            Production reporting
          </p>
          <h1 className="text-2xl font-semibold text-navy">
            {detail.data?.definition.name ?? "Reporting definitions"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-steel">
            Versioned, manual-only projections from canonical production data. Every edit creates
            an immutable revision.
          </p>
        </div>
        <div className="flex gap-2">
          {definitionId ? (
            <Link className="inline-flex h-10 items-center text-sm font-semibold text-trust-blue" href="/reporting">
              All definitions
            </Link>
          ) : null}
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {!definitionId && owner ? (
            <Button onClick={startCreate} disabled={!catalog.data?.datasets.length}>
              <FilePlus2 className="mr-2 h-4 w-4" /> New definition
            </Button>
          ) : null}
        </div>
      </header>

      {!owner ? (
        <FeedbackMessage tone="info">
          <LockKeyhole className="mr-2 inline h-4 w-4" />
          Read-only admin access. Only an owner can connect Google, manage destinations, preview,
          save, archive, or run reports.
        </FeedbackMessage>
      ) : null}
      {message ? <FeedbackMessage>{message}</FeedbackMessage> : null}
      {loadingError ? <FeedbackMessage tone="error">{loadingError.message}</FeedbackMessage> : null}

      {!definitionId && owner ? <GoogleSettingsPanel /> : null}

      {!definitionId ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <InternalReportingLink href="/reporting/destinations">
            Manage destinations
          </InternalReportingLink>
        </div>
      ) : null}

      {draft && selectedDataset ? (
        <Builder
          draft={draft}
          dataset={selectedDataset}
          companies={companies.data ?? []}
          granularities={granularities.data ?? []}
          preview={preview}
          onChange={invalidatePreview}
          onCancel={() => {
            setDraft(null);
            setPreview(null);
            clearRunConfirmation();
          }}
          onPreview={() => previewMutation.mutate()}
          onSave={() => saveMutation.mutate()}
          previewing={previewMutation.isPending}
          saving={saveMutation.isPending}
          catalog={catalog.data!.datasets}
          canChangeDataset={!definitionId}
          dateWindowContract={catalog.data!.date_window}
          owner={owner}
        />
      ) : definitionId ? (
        <DefinitionDetail
          detail={detail.data}
          runs={(runs.data ?? []).filter((run) => run.definition_id === definitionId)}
          owner={owner}
          confirmation={activeConfirmation}
          onEdit={startEdit}
          onArchive={() => archiveMutation.mutate()}
          onPrepareRun={() => {
            const key = idempotencyKeyForRunAttempt(
              runAttempt,
              currentRevisionId,
            );
            const attempt = { revisionId: currentRevisionId, key };
            setRunAttempt(attempt);
            prepareRunMutation.mutate(attempt);
          }}
          onConfirmRun={() => confirmRunMutation.mutate()}
          busy={
            archiveMutation.isPending ||
            prepareRunMutation.isPending ||
            confirmRunMutation.isPending
          }
        />
      ) : (
        <ReportingOverview definitions={definitions.data ?? []} runs={runs.data ?? []} />
      )}
    </div>
  );
}

function ReportingOverview({
  definitions,
  runs,
}: {
  definitions: Awaited<ReturnType<typeof fetchReportingDefinitions>>;
  runs: Awaited<ReturnType<typeof fetchReportingRuns>>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Definitions</CardTitle>
          <CardDescription>Stable definitions pointing to immutable current revisions.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-steel">
              <tr><th className="py-2">Name</th><th>Dataset</th><th>Revision</th><th>Updated</th><th>Status</th></tr>
            </thead>
            <tbody>
              {definitions.map((definition) => (
                <tr key={definition.id ?? definition._id} className="border-b border-steel-100">
                  <td className="py-3 font-semibold">
                    <Link className="text-trust-blue hover:underline" href={`/reporting/${definition.id ?? definition._id}`}>
                      {definition.name}
                    </Link>
                  </td>
                  <td>{displayName(definition.dataset_key)}</td>
                  <td>{definition.current_revision_number ?? "—"}</td>
                  <td>{formatDate(definition.updated_at)}</td>
                  <td>{definition.state}</td>
                </tr>
              ))}
              {!definitions.length ? <tr><td colSpan={5} className="py-8 text-center text-steel">No reporting definitions.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent runs</CardTitle><CardDescription>Manual run preparation and delivery status.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {runs.slice(0, 12).map((run) => (
            <div key={run.id ?? run._id} className="rounded-md border border-steel-100 p-3">
              <div className="flex justify-between gap-3">
                <Link
                  className="font-mono text-xs text-trust-blue hover:underline"
                  href={`/reporting/runs/${run.id ?? run._id}`}
                >
                  {run.id ?? run._id}
                </Link>
                <RunStatusBadge value={run.status} />
              </div>
              <p className="mt-1 text-xs text-steel">
                {formatDate(run.created_at)} · {run.actual_rows ?? run.estimated_rows ?? "—"} rows
              </p>
            </div>
          ))}
          {!runs.length ? <p className="text-sm text-steel">No reporting runs.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

type BuilderProps = {
  draft: ReportingDefinitionDraft;
  dataset: ReportingCatalogDataset;
  companies: Awaited<ReturnType<typeof fetchSourceCompanies>>;
  granularities: Awaited<ReturnType<typeof fetchSourceGranularities>>;
  preview: ReportingPreview | null;
  onChange: (draft: ReportingDefinitionDraft) => void;
  onCancel: () => void;
  onPreview: () => void;
  onSave: () => void;
  previewing: boolean;
  saving: boolean;
  catalog: ReportingCatalogDataset[];
  canChangeDataset: boolean;
  dateWindowContract: Awaited<ReturnType<typeof fetchReportingCatalog>>["date_window"];
  owner: boolean;
};

function Builder(props: BuilderProps) {
  const { draft, dataset, onChange } = props;
  const selectedIds = new Set(draft.selected_columns.map((column) => column.id));
  const selectedCompanyKeys = new Set(draft.source_selection.map((source) => source.company_key));

  function patch(patchValue: Partial<ReportingDefinitionDraft>) {
    onChange({ ...draft, ...patchValue });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Immutable revision builder</CardTitle><CardDescription>Only catalog-declared datasets, filters, columns, and sorts are available.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-navy">Definition name<Input className="mt-1" value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
            <label className="text-sm font-semibold text-navy">Dataset
              <select className={`${fieldClass} mt-1`} value={draft.dataset_key} disabled={!props.canChangeDataset} onChange={(event) => {
                const nextDataset = props.catalog.find((item) => item.key === event.target.value)!;
                onChange({ ...newDraft(nextDataset, draft.timezone), name: draft.name, description: draft.description });
              }}>
                {props.catalog.map((item) => <option key={item.key} value={item.key}>{displayName(item.key)} @ {item.schema_version}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-navy md:col-span-2">Description<Textarea className="mt-1" value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></label>
          </fieldset>
          <div className="rounded-md bg-steel-100 p-3 text-sm text-steel"><strong className="text-navy">Grain:</strong> {dataset.grain}<br /><strong className="text-navy">Date semantic:</strong> {dataset.date_semantic}<br /><strong className="text-navy">Sample policy:</strong> version {dataset.sample_policy_version} · up to 50 representative rows</div>

          <section>
            <h3 className="font-heading text-lg font-semibold text-navy">1. Cohort window</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-semibold">Window kind
                <select
                  className={`${fieldClass} mt-1`}
                  value={draft.date_window_spec.kind}
                  onChange={(event) => {
                    const kind = event.target.value as "explicit" | "rolling";
                    if (kind === "rolling") {
                      patch({
                        date_window_spec: {
                          kind: "rolling",
                          preset: props.dateWindowContract.rolling.presets[0],
                          days: Math.min(
                            30,
                            props.dateWindowContract.rolling.max_days,
                          ),
                          anchor: props.dateWindowContract.rolling.anchor,
                          endPolicy: props.dateWindowContract.rolling.end_policy,
                        },
                      });
                    } else {
                      const today = localDateInTimeZone(draft.timezone);
                      patch({
                        date_window_spec: {
                          kind: "explicit",
                          fromLocal: today,
                          throughLocal: today,
                        },
                      });
                    }
                  }}
                >
                  {props.dateWindowContract.kinds.map((kind) => (
                    <option key={kind} value={kind}>{displayName(kind)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">IANA timezone<Input className="mt-1" value={draft.timezone} onChange={(event) => patch({ timezone: event.target.value })} /></label>
            </div>
            {draft.date_window_spec.kind === "explicit" ? (
              <ExplicitWindowFields
                spec={draft.date_window_spec}
                onChange={(date_window_spec) => patch({ date_window_spec })}
              />
            ) : (
              <RollingWindowFields
                spec={draft.date_window_spec}
                contract={props.dateWindowContract.rolling}
                onChange={(date_window_spec) => patch({ date_window_spec })}
              />
            )}
          </section>

          <section>
            <h3 className="font-heading text-lg font-semibold text-navy">2. Registry sources</h3>
            <p className="text-sm text-steel">Company-only means all active granularities. Selecting children narrows only that company.</p>
            <div className="mt-3 space-y-3">
              {props.companies.filter((company) => company.active).map((company) => {
                const companyKey = company.company_slug;
                const selection = draft.source_selection.find((source) => source.company_key === companyKey);
                const children = props.granularities.filter((item) => item.active && (item.source_company === company.id || item.source_company === company._id || item.source_company === companyKey));
                return (
                  <div key={companyKey} className="rounded-md border border-steel-200 p-3">
                    <label className="flex items-center gap-2 font-semibold text-navy">
                      <input type="checkbox" checked={selectedCompanyKeys.has(companyKey)} onChange={(event) => patch({ source_selection: event.target.checked ? [...draft.source_selection, { company_key: companyKey, company_label_snapshot: company.owner_label || company.name, granularities: [] }] : draft.source_selection.filter((source) => source.company_key !== companyKey) })} />
                      {company.owner_label || company.name}
                    </label>
                    {selection && children.length ? <div className="mt-2 ml-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children.map((child) => {
                      const checked = selection.granularities.some((item) => item.granularity_key === child.granularity_key);
                      return <label key={child.granularity_key} className="flex items-center gap-2 text-sm text-steel"><input type="checkbox" checked={checked} onChange={(event) => patch({ source_selection: draft.source_selection.map((source) => source.company_key !== companyKey ? source : { ...source, granularities: event.target.checked ? [...source.granularities, { granularity_key: child.granularity_key, granularity_label_snapshot: child.owner_label }] : source.granularities.filter((item) => item.granularity_key !== child.granularity_key) }) })} />{child.owner_label}</label>;
                    })}</div> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="font-heading text-lg font-semibold text-navy">3. Dataset filters</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {dataset.filters.map((filter) => (
                <label key={filter.id} className="text-sm font-semibold">{filter.label}{filter.required ? " *" : ""}
                  {filter.type === "boolean" ? (
                    <select className={`${fieldClass} mt-1`} value={String(draft.filters[filter.id] ?? "")} onChange={(event) => patch({ filters: { ...draft.filters, [filter.id]: event.target.value === "" ? "" : event.target.value === "true" } })}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select>
                  ) : filter.type === "multi_select" && !filter.options?.length ? (
                    <Input
                      className="mt-1"
                      placeholder="Comma-separated Registry keys"
                      value={((draft.filters[filter.id] as string[] | undefined) ?? []).join(", ")}
                      onChange={(event) =>
                        patch({
                          filters: {
                            ...draft.filters,
                            [filter.id]: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                  ) : (
                    <select className={`${fieldClass} mt-1`} multiple={filter.type === "multi_select"} value={filter.type === "multi_select" ? (draft.filters[filter.id] as string[] | undefined) ?? [] : String(draft.filters[filter.id] ?? "")} onChange={(event) => patch({ filters: { ...draft.filters, [filter.id]: filter.type === "multi_select" ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value } })}>
                      {filter.type !== "multi_select" ? <option value="">Any</option> : null}
                      {(filter.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  )}
                </label>
              ))}
              {!dataset.filters.length ? <p className="text-sm text-steel">This dataset declares no additional filters.</p> : null}
            </div>
            <p className="mt-2 text-xs text-steel">Unknown filter keys are rejected. Array filters use catalog-declared limits.</p>
          </section>

          <section>
            <h3 className="font-heading text-lg font-semibold text-navy">4. Vetted columns</h3>
            <p className="text-sm text-steel">Remove, relabel, or reorder only. IDs, types, sensitivity, and semantics are immutable.</p>
            <div className="mt-3 space-y-2">
              {draft.selected_columns.map((column, index) => {
                const contract = dataset.columns.find((item) => item.id === column.id)!;
                return <div key={column.id} className="grid items-center gap-2 rounded-md border border-steel-200 p-2 md:grid-cols-[minmax(11rem,1fr)_minmax(12rem,1fr)_auto]">
                  <div><span className="font-mono text-xs text-navy">{column.id}</span><span className="ml-2 text-xs text-steel">{contract.type}</span>{contract.sensitivity === "confidential_pii" ? <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">PII</span> : null}</div>
                  <Input aria-label={`Label for ${column.id}`} value={column.label} onChange={(event) => patch({ selected_columns: draft.selected_columns.map((item) => item.id === column.id ? { ...item, label: event.target.value } : item) })} />
                  <div className="flex gap-1"><Button variant="ghost" className="h-9 w-9 px-0" aria-label={`Move ${column.id} up`} disabled={index === 0} onClick={() => patch({ selected_columns: moveColumn(draft.selected_columns, index, -1) })}><ArrowUp className="h-4 w-4" /></Button><Button variant="ghost" className="h-9 w-9 px-0" aria-label={`Move ${column.id} down`} disabled={index === draft.selected_columns.length - 1} onClick={() => patch({ selected_columns: moveColumn(draft.selected_columns, index, 1) })}><ArrowDown className="h-4 w-4" /></Button><Button variant="ghost" className="h-9 w-9 px-0" aria-label={`Remove ${column.id}`} onClick={() => patch({ selected_columns: draft.selected_columns.filter((item) => item.id !== column.id) })}><Trash2 className="h-4 w-4" /></Button></div>
                </div>;
              })}
            </div>
            <select className={`${fieldClass} mt-3 max-w-md`} value="" onChange={(event) => {
              const contract = dataset.columns.find((item) => item.id === event.target.value);
              if (contract) patch({ selected_columns: [...draft.selected_columns, { id: contract.id, label: contract.default_label }] });
            }}><option value="">Add a vetted column…</option>{dataset.columns.filter((column) => !selectedIds.has(column.id)).map((column) => <option key={column.id} value={column.id}>{column.default_label}{column.sensitivity === "confidential_pii" ? " (PII)" : ""}</option>)}</select>
          </section>

          <section>
            <h3 className="font-heading text-lg font-semibold text-navy">5. Allowed ordering</h3>
            <div className="mt-3 grid max-w-xl grid-cols-[1fr_10rem] gap-2">
              <select className={fieldClass} value={draft.sort[0]?.id ?? ""} onChange={(event) => patch({ sort: [{ id: event.target.value, direction: draft.sort[0]?.direction ?? "asc" }] })}>{dataset.allowed_sorts.map((sort) => <option key={sort.id} value={sort.id}>{sort.label ?? displayName(sort.id)}</option>)}</select>
              <select className={fieldClass} value={draft.sort[0]?.direction ?? "asc"} onChange={(event) => patch({ sort: [{ id: draft.sort[0]?.id ?? dataset.allowed_sorts[0]!.id, direction: event.target.value as "asc" | "desc" }] })}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
            </div>
            <p className="mt-2 text-xs text-steel">The server appends required tie-breakers: {dataset.required_tie_breakers.map((term) => `${term.id} ${term.direction}`).join(", ")}. They cannot be edited or included in clone owner sorting.</p>
          </section>

          <DestinationSelector draft={draft} onChange={onChange} owner={props.owner} />
        </CardContent>
      </Card>

      {props.preview ? <PreviewPanel preview={props.preview} columns={draft.selected_columns} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={props.onCancel}>Cancel</Button>
        <Button variant="outline" disabled={props.previewing || props.saving} onClick={props.onPreview}>{props.previewing ? "Previewing…" : "Generate preview"}</Button>
        <Button disabled={!props.preview || props.preview.blocking_reasons.length > 0 || props.saving} onClick={props.onSave}>{props.saving ? "Saving…" : "Save immutable revision"}</Button>
      </div>
    </div>
  );
}

function ExplicitWindowFields({
  spec,
  onChange,
}: {
  spec: ReportingExplicitDateWindowSpec;
  onChange: (spec: ReportingExplicitDateWindowSpec) => void;
}) {
  const usesThrough = typeof spec.throughLocal === "string";
  const currentEnd = usesThrough ? spec.throughLocal! : spec.toExclusiveLocal!;
  const disambiguation = spec.repeatedTimeDisambiguation
    ? { repeatedTimeDisambiguation: spec.repeatedTimeDisambiguation }
    : {};
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-4">
      <label className="text-sm font-semibold">From
        <Input className="mt-1" placeholder="YYYY-MM-DD or local date-time" value={spec.fromLocal} onChange={(event) => onChange({ ...spec, fromLocal: event.target.value })} />
      </label>
      <label className="text-sm font-semibold">End boundary
        <select
          className={`${fieldClass} mt-1`}
          value={usesThrough ? "through" : "exclusive"}
          onChange={(event) =>
            onChange(
              event.target.value === "through"
                ? { kind: "explicit", fromLocal: spec.fromLocal, throughLocal: currentEnd, ...disambiguation }
                : { kind: "explicit", fromLocal: spec.fromLocal, toExclusiveLocal: currentEnd, ...disambiguation },
            )
          }
        >
          <option value="through">Inclusive through date</option>
          <option value="exclusive">Exclusive end date</option>
        </select>
      </label>
      <label className="text-sm font-semibold">{usesThrough ? "Through" : "Exclusive end"}
        <Input
          className="mt-1"
          placeholder="YYYY-MM-DD or local date-time"
          value={currentEnd}
          onChange={(event) =>
            onChange(
              usesThrough
                ? { kind: "explicit", fromLocal: spec.fromLocal, throughLocal: event.target.value, ...disambiguation }
                : { kind: "explicit", fromLocal: spec.fromLocal, toExclusiveLocal: event.target.value, ...disambiguation },
            )
          }
        />
      </label>
      <label className="text-sm font-semibold">Repeated local time
        <select
          className={`${fieldClass} mt-1`}
          value={spec.repeatedTimeDisambiguation ?? ""}
          onChange={(event) => {
            const repeatedTimeDisambiguation =
              event.target.value === "earlier" || event.target.value === "later"
                ? event.target.value
                : undefined;
            const repeated: {
              repeatedTimeDisambiguation?: "earlier" | "later";
            } = repeatedTimeDisambiguation
              ? { repeatedTimeDisambiguation }
              : {};
            onChange(
              usesThrough
                ? { kind: "explicit", fromLocal: spec.fromLocal, throughLocal: currentEnd, ...repeated }
                : { kind: "explicit", fromLocal: spec.fromLocal, toExclusiveLocal: currentEnd, ...repeated },
            );
          }}
        >
          <option value="">Not ambiguous</option>
          <option value="earlier">Earlier occurrence</option>
          <option value="later">Later occurrence</option>
        </select>
      </label>
    </div>
  );
}

function RollingWindowFields({
  spec,
  contract,
  onChange,
}: {
  spec: ReportingRollingDateWindowSpec;
  contract: Awaited<ReturnType<typeof fetchReportingCatalog>>["date_window"]["rolling"];
  onChange: (spec: ReportingRollingDateWindowSpec) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <label className="text-sm font-semibold">Rolling preset
        <select className={`${fieldClass} mt-1`} value={spec.preset} disabled>
          {contract.presets.map((preset) => (
            <option key={preset} value={preset}>{displayName(preset)}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">Days
        <Input
          className="mt-1"
          type="number"
          min={contract.min_days}
          max={contract.max_days}
          value={spec.days}
          onChange={(event) => onChange({ ...spec, days: Number(event.target.value) })}
        />
      </label>
      <div className="rounded-md bg-steel-100 p-3 text-xs text-steel">
        Anchored at preview/run time and includes the current local day.
        Every preview and run resolves fresh UTC boundaries.
      </div>
    </div>
  );
}

function PreviewPanel({ preview, columns }: { preview: ReportingPreview; columns: ReportingDefinitionDraft["selected_columns"] }) {
  const bounded = preview.estimate.kind === "upper_bound";
  return <Card>
    <CardHeader><CardTitle>Preview</CardTitle><CardDescription>Expires {formatDate(preview.expires_at)} · checksum {preview.preview_checksum} · sample evidence {preview.sample_evidence}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={bounded ? "Safe upper-bound rows" : "Exact rows"} value={preview.estimate.rows} />
        <Metric label="Columns" value={preview.estimate.columns} />
        <Metric label={bounded ? "Maximum cells incl. header" : "Cells incl. header"} value={preview.estimate.cells_including_header} />
        <Metric label="Capacity remaining" value={preview.capacity.remaining_cells} />
        <Metric label="Write batches" value={preview.estimate.write_batches ?? "—"} />
      </div>
      <FeedbackMessage tone={preview.capacity.fits ? "success" : "error"}>{preview.capacity.fits ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}{bounded ? (preview.capacity.fits ? "The safe upper bound fits current destination capacity; actual volume may be lower." : "The safe upper bound cannot prove that this report fits destination capacity.") : `Exact projected volume ${preview.capacity.fits ? "fits" : "exceeds"} destination capacity.`}</FeedbackMessage>
      {bounded && preview.estimate.explanation ? <FeedbackMessage tone="info">{preview.estimate.explanation}</FeedbackMessage> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div><h4 className="font-semibold text-navy">Intended changes</h4><pre className="mt-2 overflow-auto rounded bg-steel-100 p-3 text-xs">{JSON.stringify(preview.intended_changes, null, 2)}</pre></div>
        <div><h4 className="font-semibold text-navy">Sensitivity</h4><p className="mt-2 text-sm text-steel">Highest: {preview.sensitivity.highest}<br />Ownership: {preview.sensitivity.destination_ownership}<br />PII columns: {preview.sensitivity.pii_column_ids.join(", ") || "None"}</p></div>
        <div><h4 className="font-semibold text-navy">Warnings & blockers</h4><div className="mt-2 space-y-2">{[...preview.warnings, ...preview.blocking_reasons].map((warning, index) => <FeedbackMessage key={`${warning.code}-${index}`} tone={preview.blocking_reasons.includes(warning) ? "error" : "warning"}>{warning.message ?? displayName(warning.code)}</FeedbackMessage>)}{!preview.warnings.length && !preview.blocking_reasons.length ? <p className="text-sm text-steel">None.</p> : null}</div></div>
      </div>
      <div className="overflow-x-auto"><h4 className="mb-2 font-semibold text-navy">Representative sample ({preview.sample_rows.length}/50)</h4><table className="min-w-full text-left text-xs"><thead><tr className="border-b">{columns.map((column) => <th key={column.id} className="px-2 py-2">{column.label}</th>)}</tr></thead><tbody>{preview.sample_rows.map((row, index) => <tr key={index} className="border-b border-steel-100">{columns.map((column) => <td key={column.id} className="max-w-56 truncate px-2 py-2">{row[column.id] == null ? "—" : String(row[column.id])}</td>)}</tr>)}</tbody></table></div>
    </CardContent>
  </Card>;
}

function DefinitionDetail({
  detail,
  runs,
  owner,
  confirmation,
  onEdit,
  onArchive,
  onPrepareRun,
  onConfirmRun,
  busy,
}: {
  detail: Awaited<ReturnType<typeof fetchReportingDefinition>> | undefined;
  runs: Awaited<ReturnType<typeof fetchReportingRuns>>;
  owner: boolean;
  confirmation: ReportingRunConfirmation | null;
  onEdit: () => void;
  onArchive: () => void;
  onPrepareRun: () => void;
  onConfirmRun: () => void;
  busy: boolean;
}) {
  if (!detail) return <p className="text-sm text-steel">Loading definition…</p>;
  const revision = detail.current_revision;
  const definition = detail.definition;
  return <div className="space-y-6">
    <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Current revision #{revision.revision_number}</CardTitle><CardDescription>{displayName(revision.dataset_key)} @ {revision.dataset_schema_version} · {revision.revision_snapshot_checksum}</CardDescription></div>{owner && definition.state === "active" ? <div className="flex gap-2"><Button variant="outline" onClick={onEdit}>Create new revision</Button><Button variant="destructive" disabled={busy} onClick={onArchive}>Archive</Button></div> : null}</div></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Metric label="Timezone" value={revision.draft.timezone} /><Metric label="Window" value={windowLabel(revision.draft.date_window_spec)} /><Metric label="Window policy" value={windowPolicy(revision.draft.date_window_spec)} /><Metric label="Columns" value={revision.draft.selected_columns.length} /><Metric label="Sources" value={revision.draft.source_selection.length} /><Metric label="Strategy" value={revision.draft.strategy} /><Metric label="Destination" value={revision.draft.destination_id} /><Metric label="Sample evidence" value={revision.sample_evidence ?? "—"} /><Metric label="Created" value={formatDate(revision.created_at)} /></CardContent></Card>

    {owner && definition.state === "active" ? <Card><CardHeader><CardTitle>Run current revision</CardTitle><CardDescription>Two steps: fetch a fresh estimate with destination/strategy impact, then explicitly confirm the immutable revision. Queued runs continue if you leave this page.</CardDescription></CardHeader><CardContent className="space-y-4">{confirmation ? <><div className="grid gap-3 md:grid-cols-5"><Metric label={confirmation.estimate.kind === "upper_bound" ? "Fresh upper-bound rows" : "Fresh exact rows"} value={confirmation.estimate.rows} /><Metric label={confirmation.estimate.kind === "upper_bound" ? "Maximum cells" : "Exact cells"} value={confirmation.estimate.cells_including_header} /><Metric label="Warnings" value={confirmation.warnings.length} /><Metric label="Confirmation ID" value={confirmation.confirmation_id} /><Metric label="Expires" value={formatDate(confirmation.expires_at)} /></div>{confirmation.estimate.kind === "upper_bound" ? <FeedbackMessage tone="info">{confirmation.estimate.explanation ?? "This is a safe upper bound; actual run volume may be lower."}</FeedbackMessage> : null}<details className="rounded border border-steel-100 p-3 text-sm"><summary className="cursor-pointer font-semibold text-navy">Intended Google mutations</summary><pre className="mt-2 overflow-auto text-xs">{JSON.stringify(confirmation.intended_changes, null, 2)}</pre></details><FeedbackMessage tone="warning">Confirming queues one manual run for revision #{revision.revision_number} ({revision.draft.strategy}). PII may appear in the authorized Google artifact.</FeedbackMessage><Button disabled={busy} onClick={onConfirmRun}><Play className="mr-2 h-4 w-4" /> Confirm and queue run</Button></> : <Button disabled={busy} onClick={onPrepareRun}>Review fresh estimate</Button>}</CardContent></Card> : null}

    <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Revision history</CardTitle></CardHeader><CardContent className="space-y-2">{detail.revisions.map((item) => <div key={item.id ?? item._id} className="rounded-md border border-steel-100 p-3"><div className="flex justify-between"><strong>Revision #{item.revision_number}</strong><span className="text-xs text-steel">{formatDate(item.created_at)}</span></div><p className="mt-1 truncate font-mono text-xs text-steel">{item.revision_snapshot_checksum}</p>{item.sample_evidence ? <p className="mt-1 truncate font-mono text-xs text-steel">Sample evidence: {item.sample_evidence}</p> : null}</div>)}</CardContent></Card><Card><CardHeader><CardTitle>Run history</CardTitle></CardHeader><CardContent className="space-y-2">{runs.map((run) => <div key={run.id ?? run._id} className="rounded-md border border-steel-100 p-3"><div className="flex justify-between gap-2"><Link className="font-mono text-xs text-trust-blue hover:underline" href={`/reporting/runs/${run.id ?? run._id}`}>{run.id ?? run._id}</Link><RunStatusBadge value={run.status} /></div><p className="mt-1 text-xs text-steel">{formatDate(run.created_at)} · revision {run.definition_revision_id}</p>{run.failure ? <p className="mt-1 text-xs text-red-700">{run.failure.summary ?? run.failure.code}{run.failure.metadata?.remediation ? ` — ${run.failure.metadata.remediation}` : ""}</p> : null}</div>)}{!runs.length ? <p className="text-sm text-steel">No runs for this definition.</p> : null}</CardContent></Card></div>
  </div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border border-steel-100 bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-steel">{label}</p><p className="mt-1 wrap-break-word font-semibold text-navy">{value}</p></div>;
}
