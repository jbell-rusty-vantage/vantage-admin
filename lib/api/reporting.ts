type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string; issues?: unknown };

export type ReportingDatasetKey =
  | "lead_outcome_detail"
  | "lead_quality_exceptions"
  | "source_performance";
export type ReportingSensitivity = "public" | "internal" | "confidential_pii";
export type ReportingScalarType =
  | "string"
  | "boolean"
  | "integer"
  | "decimal"
  | "money"
  | "date_time"
  | "date"
  | "enum"
  | "not_applicable_boolean";
export type ReportingSortDirection = "asc" | "desc";

export type ReportingCatalogColumn = {
  id: string;
  default_label: string;
  type: ReportingScalarType;
  sensitivity: ReportingSensitivity;
  default_selected: boolean;
};

export type ReportingFilterDefinition = {
  id: string;
  label: string;
  type: "select" | "multi_select" | "boolean";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  max_items?: number;
};

export type ReportingCatalogDataset = {
  key: ReportingDatasetKey;
  schema_version: 1;
  name?: string;
  grain: string;
  date_semantic: string;
  filters: ReportingFilterDefinition[];
  columns: ReportingCatalogColumn[];
  measures?: Array<{ id: string; label?: string; definition: string }>;
  allowed_sorts: Array<{ id: string; label?: string; directions?: ReportingSortDirection[] }>;
  default_sort: ReportingSortTerm[];
  filter_schema: {
    unknown_keys: "reject";
    fields: ReportingFilterDefinition[];
  };
  required_tie_breakers: ReportingSortTerm[];
  sample_policy_version: 1;
};

export type ReportingCatalog = {
  datasets: ReportingCatalogDataset[];
  default_timezone: string;
  capabilities: { manual_only: true };
  preview_limits?: { sample_rows: number };
  date_window: {
    kinds: readonly ["explicit", "rolling"];
    rolling: {
      presets: readonly ["last_n_days"];
      min_days: 1;
      max_days: 366;
      anchor: "preview_or_run_time";
      end_policy: "include_current_local_day";
    };
  };
};

export type ReportingExplicitDateWindowSpec =
  | {
      kind: "explicit";
      fromLocal: string;
      throughLocal: string;
      toExclusiveLocal?: never;
      repeatedTimeDisambiguation?: "earlier" | "later";
    }
  | {
      kind: "explicit";
      fromLocal: string;
      throughLocal?: never;
      toExclusiveLocal: string;
      repeatedTimeDisambiguation?: "earlier" | "later";
    };

export type ReportingRollingDateWindowSpec = {
  kind: "rolling";
  preset: "last_n_days";
  days: number;
  anchor: "preview_or_run_time";
  endPolicy: "include_current_local_day";
};

export type ReportingDateWindowSpec =
  | ReportingExplicitDateWindowSpec
  | ReportingRollingDateWindowSpec;

export type ReportingSourceSelection = {
  company_key: string;
  company_label_snapshot: string;
  granularities: Array<{
    granularity_key: string;
    granularity_label_snapshot: string;
  }>;
};

export type ReportingSelectedColumn = { id: string; label: string };
export type ReportingSortTerm = { id: string; direction: ReportingSortDirection };

export type ReportingDestinationSnapshotV1 = {
  contractVersion: 1;
  destinationId: string;
  provider: "google_sheets";
  driveConnectionId: string;
  ownerIdentitySnapshot: { stableOwnerId: string; maskedEmail: string };
  folder: { id: string; name: string; url: string };
  strategy: "replace_tab" | "snapshot";
  workbook?: { id: string; name: string; url: string };
  managedTab?: { immutableSheetId: number; name: string; managed: true };
  destinationType: string;
  ownershipPolicy: string;
  accessStatus: "verified";
  healthVerifiedAt: string;
  archived: false;
  safety: {
    denylistCheckedAt: string;
    operationalWorkbookMatch: false;
    humanCreatedTabTakeover: false;
  };
  capacity: {
    providerMaxCells: number;
    destinationAvailableCells: number;
  };
  snapshotChecksum: string;
};

export type ReportingDefinitionDraft = {
  name: string;
  description: string;
  dataset_key: ReportingDatasetKey;
  dataset_schema_version: 1;
  date_window_spec: ReportingDateWindowSpec;
  timezone: string;
  source_selection: ReportingSourceSelection[];
  filters: Record<string, string | string[] | boolean>;
  selected_columns: ReportingSelectedColumn[];
  sort: ReportingSortTerm[];
  destination_id: string;
  destination_snapshot_checksum: string;
  strategy: "replace_tab" | "snapshot";
};

export type ReportingWarning = {
  code: string;
  message?: string;
  parameters?: Record<string, string | number>;
};

export type ReportingPreview = {
  preview_id?: string;
  preview_token: string;
  draft_checksum: string;
  preview_checksum: string;
  estimate: {
    kind: "exact" | "upper_bound";
    rows: number;
    explanation?: string;
    columns: number;
    cells_including_header: number;
    query_pages?: number;
    write_batches?: number;
    generated_at?: string;
  };
  sample_rows: Array<Record<string, unknown>>;
  sample_evidence: string;
  warnings: ReportingWarning[];
  blocking_reasons: ReportingWarning[];
  capacity: {
    provider_max_cells: number;
    destination_available_cells: number;
    remaining_cells: number;
    fits: boolean;
  };
  intended_changes: { summary?: string; [key: string]: unknown };
  sensitivity: {
    highest: ReportingSensitivity;
    pii_column_ids: string[];
    destination_ownership: string;
  };
  expires_at: string;
};

export type ReportingDefinitionSummary = {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  dataset_key: ReportingDatasetKey;
  state: "active" | "archived";
  current_revision_id: string;
  current_revision_number?: number;
  updated_at: string;
};

export type ReportingRevision = {
  id: string;
  _id?: string;
  definition_id: string;
  revision_number: number;
  revision_snapshot_checksum: string;
  dataset_key: ReportingDatasetKey;
  dataset_schema_version: 1;
  draft: ReportingDefinitionDraft;
  sample_count?: number;
  sample_evidence?: string;
  preview?: Omit<ReportingPreview, "sample_rows" | "preview_token">;
  created_by?: string;
  created_at: string;
};

export type ReportingDefinitionDetail = {
  definition: ReportingDefinitionSummary;
  current_revision: ReportingRevision;
  revisions: ReportingRevision[];
  previews: Array<Record<string, unknown>>;
};

export type ReportingRunStatus =
  | "queued"
  | "querying"
  | "writing"
  | "verifying"
  | "promoting"
  | "completed"
  | "failed"
  | "cancelled";

export type ReportingRun = {
  id: string;
  _id?: string;
  definition_id: string;
  definition_revision_id: string;
  revision_snapshot_checksum: string;
  status: ReportingRunStatus;
  trigger: "manual";
  estimated_rows?: number;
  actual_rows?: number;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  failure?: ReportingRunFailure | null;
  confirmation?: ReportingRunConfirmation;
  progress?: ReportingRunProgress | null;
  delivery?: ReportingDelivery | null;
  final_data_checksum?: string | null;
  counters?: Record<string, unknown> | null;
  estimate?: Record<string, unknown> | null;
  actual?: Record<string, unknown> | null;
};

export type ReportingRunFailure = {
  code?: string;
  summary?: string;
  retryable?: boolean;
  metadata?: {
    phase?: string;
    remediation?: string;
    attempt?: number;
    page_number?: number;
    row_count?: number;
    batch_number?: number;
    provider_status?: number;
    [key: string]: unknown;
  };
};

export type ReportingRunProgress = {
  phase?: string | null;
  page_number?: number | null;
  row_count?: number | null;
  checksum_accumulator?: string | null;
  cancellation_requested?: boolean;
};

export type ReportingDelivery = {
  run_id?: string;
  destination_id?: string;
  strategy?: ReportingDestinationStrategy;
  status?: string;
  workbook_id?: string | null;
  workbook_url?: string | null;
  staging_sheet_id?: number | null;
  published_sheet_id?: number | null;
  published_sheet_title?: string | null;
  old_sheet_id?: number | null;
  expected?: Record<string, unknown> | null;
  actual?: Record<string, unknown> | null;
  verification?: Record<string, unknown> | null;
  progress?: {
    next_write_row?: number | null;
    completed_batch_number?: number | null;
    rows_written?: number | null;
    cells_written?: number | null;
    provider_requests?: number | null;
    provider_retries?: number | null;
    promotion_step?: string | null;
  } | null;
  cleanup?: {
    state?: string | null;
    attempts?: number | null;
    last_error_code?: string | null;
  } | null;
  failure?: ReportingRunFailure | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ReportingDestinationStrategy = "replace_tab" | "snapshot";

export type ReportingRunDetail = ReportingRun;

export type ReportingRunConfirmation = {
  confirmation_token: string;
  confirmation_id: string;
  idempotency_key: string;
  definition_id: string;
  revision_id: string;
  revision_snapshot_checksum: string;
  destination_snapshot_checksum: string;
  query_input_checksum: string;
  estimate: ReportingPreview["estimate"];
  warnings: ReportingWarning[];
  intended_changes: ReportingPreview["intended_changes"];
  expires_at: string;
};

export type ReportingQueuedRun = {
  run_id: string;
  status: "queued";
  idempotent_replay: boolean;
  wakeup_published?: boolean;
  execution_package: Record<string, unknown>;
};

export type SaveReportingRevisionInput = {
  draft: ReportingDefinitionDraft;
  preview_id: string;
  preview_checksum: string;
};

type WireCatalog = {
  defaultTimezone: string;
  manualOnly: true;
  previewLimit: number;
  dateWindow: {
    kinds: readonly ["explicit", "rolling"];
    rolling: {
      presets: readonly ["last_n_days"];
      minDays: 1;
      maxDays: 366;
      anchor: "preview_or_run_time";
      endPolicy: "include_current_local_day";
    };
  };
  datasets: Array<{
    key: ReportingDatasetKey;
    schemaVersion: 1;
    grain: string;
    dateSemantic: string;
    columns: Array<{
      id: string;
      defaultLabel: string;
      type: ReportingScalarType;
      sensitivity: ReportingSensitivity;
      default: boolean;
    }>;
    measures: Array<{ id: string; definition: string; type: ReportingScalarType }>;
    filterKeys: string[];
    filterSchema: {
      unknownKeys: "reject";
      fields: Array<{
        id: string;
        type: "enum" | "boolean" | "string_array" | "enum_array";
        required: boolean;
        options?: string[];
        maxItems?: number;
      }>;
    };
    allowedSorts: string[];
    defaultSort: ReportingSortTerm[];
    requiredTieBreakers: ReportingSortTerm[];
    samplePolicyVersion: 1;
  }>;
};

type WireDraft = {
  name: string;
  description: string;
  datasetKey: ReportingDatasetKey;
  datasetSchemaVersion: 1;
  timezone: string;
  dateWindow: ReportingDateWindowSpec;
  sources: { companyKeys: string[]; granularityKeys: string[] };
  filters: Record<string, string | string[] | boolean>;
  selectedColumns: ReportingSelectedColumn[];
  sort: ReportingSortTerm[];
  destinationId: string;
  destinationSnapshotChecksum: string;
  strategy: "replace_tab" | "snapshot";
};

type WireDefinition = {
  _id: string;
  name: string;
  description?: string;
  dataset_key: ReportingDatasetKey;
  state: "active" | "archived";
  current_revision_id?: string | null;
  current_revision_number?: number;
  updated_at: string;
};

type WireRevision = {
  _id: string;
  definition_id: string;
  revision_number: number;
  revision_snapshot_checksum: string;
  dataset_key: ReportingDatasetKey;
  dataset_schema_version: 1;
  date_window_spec: ReportingDateWindowSpec;
  registry_snapshot: {
    companies: Array<{ id: string; key: string; label: string }>;
    granularities: Array<{ key: string; label: string; companyId: string }>;
  };
  filters: Record<string, string | string[] | boolean>;
  selected_columns: ReportingSelectedColumn[];
  effective_sort: ReportingSortTerm[];
  timezone: string;
  destination_id: string;
  destination_snapshot_checksum: string;
  strategy: "replace_tab" | "snapshot";
  sample_count?: number;
  sample_evidence?: string;
  created_by?: { actor_label?: string };
  created_at: string;
};

type WirePreview = {
  previewId: string;
  draftChecksum: string;
  previewChecksum: string;
  estimate: { kind: "exact" | "upper_bound"; rows: number; explanation?: string };
  projected: { rows: number; columns: number; cellsIncludingHeader: number };
  capacity: {
    providerMaxCells?: number;
    destinationAvailableCells?: number;
    applicableLimit: number;
    remainingCells: number;
  };
  batches: { queryPages: number; writeBatches: number };
  sampleRows: Array<Record<string, unknown>>;
  sampleEvidence: string;
  warnings: ReportingWarning[];
  piiColumnIds: string[];
  destinationOwnership: string;
  intendedChanges: Record<string, unknown>;
  expiresAt: string;
};

type WireRun = {
  _id: string;
  definition_id: string;
  definition_revision_id: string;
  revision_snapshot_checksum: string;
  status: ReportingRunStatus;
  trigger: "manual";
  estimate?: { rows?: number } | Record<string, unknown>;
  actual?: { rows?: number } | Record<string, unknown> | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  failure?: ReportingRunFailure;
  progress?: ReportingRunProgress;
  delivery?: ReportingDelivery | null;
  final_data_checksum?: string | null;
  counters?: Record<string, unknown> | null;
};

type WireRunDetail = WireRun & {
  delivery?: ReportingDelivery | null;
};

type WireCancelRun = {
  runId: string;
  cancellation: "cancel_requested" | "already_terminal" | "already_requested" | "not_found";
  runStatus?: ReportingRunStatus | null;
  idempotencyKey?: string | null;
};

type WireRunConfirmation = {
  requiresConfirmation: true;
  confirmationToken: string;
  confirmationId: string;
  idempotencyKey: string;
  definitionId: string;
  revisionId: string;
  revisionSnapshotChecksum: string;
  destinationSnapshotChecksum: string;
  queryInputChecksum: string;
  estimate: {
    kind: "exact" | "upper_bound";
    rows: number;
    explanation?: string;
    columns: number;
    cellsIncludingHeader: number;
    generatedAt: string;
  };
  warnings: ReportingWarning[];
  intendedChanges: Record<string, unknown>;
  expiresAt: string;
};

type WireQueuedRun = {
  runId: string;
  status: "queued";
  executionPackage: Record<string, unknown>;
  idempotentReplay: boolean;
  wakeupPublished?: boolean;
};

const root = "/api/proxy/api/v1/admin/reporting";
const OWNER_SORTS: Record<ReportingDatasetKey, ReadonlySet<string>> = {
  lead_outcome_detail: new Set([
    "lead_timestamp",
    "source_company",
    "source_granularity",
    "customer_name",
    "move_date",
    "book_date",
    "primary_job_number",
  ]),
  lead_quality_exceptions: new Set(["exception_timestamp", "exception_type"]),
  source_performance: new Set(["period", "source_company", "source_granularity"]),
};

const options = (...values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));

function filterDefinition(
  field: WireCatalog["datasets"][number]["filterSchema"]["fields"][number],
): ReportingFilterDefinition {
  return {
    id: field.id,
    label: field.id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase()),
    type:
      field.type === "boolean"
        ? "boolean"
        : field.type === "string_array" || field.type === "enum_array"
          ? "multi_select"
          : "select",
    required: field.required,
    options: field.options ? options(...field.options) : [],
    max_items: field.maxItems,
  };
}

export function normalizeReportingCatalog(wire: WireCatalog): ReportingCatalog {
  return {
    default_timezone: wire.defaultTimezone,
    capabilities: { manual_only: wire.manualOnly },
    preview_limits: { sample_rows: wire.previewLimit },
    date_window: {
      kinds: wire.dateWindow.kinds,
      rolling: {
        presets: wire.dateWindow.rolling.presets,
        min_days: wire.dateWindow.rolling.minDays,
        max_days: wire.dateWindow.rolling.maxDays,
        anchor: wire.dateWindow.rolling.anchor,
        end_policy: wire.dateWindow.rolling.endPolicy,
      },
    },
    datasets: wire.datasets.map((dataset) => {
      const fields = dataset.filterSchema.fields.map(filterDefinition);
      return {
        key: dataset.key,
        schema_version: dataset.schemaVersion,
        grain: dataset.grain,
        date_semantic: dataset.dateSemantic,
        filters: fields,
        filter_schema: {
          unknown_keys: dataset.filterSchema.unknownKeys,
          fields,
        },
        columns: dataset.columns.map((column) => ({
          id: column.id,
          default_label: column.defaultLabel,
          type: column.type,
          sensitivity: column.sensitivity,
          default_selected: column.default,
        })),
        measures: dataset.measures,
        allowed_sorts: dataset.allowedSorts.map((id) => ({ id })),
        default_sort: dataset.defaultSort,
        required_tie_breakers: dataset.requiredTieBreakers,
        sample_policy_version: dataset.samplePolicyVersion,
      };
    }),
  };
}

export function toReportingDraftPayload(draft: ReportingDefinitionDraft): WireDraft {
  return {
    name: draft.name,
    description: draft.description,
    datasetKey: draft.dataset_key,
    datasetSchemaVersion: draft.dataset_schema_version,
    timezone: draft.timezone,
    dateWindow: draft.date_window_spec,
    sources: {
      companyKeys: draft.source_selection.map((source) => source.company_key),
      granularityKeys: draft.source_selection.flatMap((source) =>
        source.granularities.map((granularity) => granularity.granularity_key),
      ),
    },
    filters: Object.fromEntries(
      Object.entries(draft.filters).filter(([, value]) =>
        Array.isArray(value) ? value.length > 0 : value !== "",
      ),
    ),
    selectedColumns: draft.selected_columns,
    sort: draft.sort,
    destinationId: draft.destination_id,
    destinationSnapshotChecksum: draft.destination_snapshot_checksum,
    strategy: draft.strategy,
  };
}

function normalizeDefinition(value: WireDefinition): ReportingDefinitionSummary {
  return {
    id: String(value._id),
    _id: String(value._id),
    name: value.name,
    description: value.description,
    dataset_key: value.dataset_key,
    state: value.state,
    current_revision_id: value.current_revision_id ? String(value.current_revision_id) : "",
    current_revision_number: value.current_revision_number,
    updated_at: new Date(value.updated_at).toISOString(),
  };
}

function draftFromRevision(
  definition: ReportingDefinitionSummary,
  value: WireRevision,
): ReportingDefinitionDraft {
  const companies = value.registry_snapshot.companies;
  const granularities = value.registry_snapshot.granularities;
  const companyIds = new Map(
    value.registry_snapshot.companies.map((company) => [String(company.id), company.key]),
  );
  return {
    name: definition.name,
    description: definition.description ?? "",
    dataset_key: value.dataset_key,
    dataset_schema_version: value.dataset_schema_version,
    date_window_spec: value.date_window_spec,
    timezone: value.timezone,
    source_selection: companies.map((company) => ({
      company_key: company.key,
      company_label_snapshot: company.label,
      granularities: granularities
        .filter((granularity) => companyIds.get(String(granularity.companyId)) === company.key)
        .map((granularity) => ({
          granularity_key: granularity.key,
          granularity_label_snapshot: granularity.label,
        })),
    })),
    filters: value.filters ?? {},
    selected_columns: value.selected_columns,
    sort: value.effective_sort.filter((term) => OWNER_SORTS[value.dataset_key].has(term.id)),
    destination_id: value.destination_id,
    destination_snapshot_checksum: value.destination_snapshot_checksum,
    strategy: value.strategy,
  };
}

function normalizeRevision(
  definition: ReportingDefinitionSummary,
  value: WireRevision,
): ReportingRevision {
  return {
    id: String(value._id),
    _id: String(value._id),
    definition_id: String(value.definition_id),
    revision_number: value.revision_number,
    revision_snapshot_checksum: value.revision_snapshot_checksum,
    dataset_key: value.dataset_key,
    dataset_schema_version: value.dataset_schema_version,
    draft: draftFromRevision(definition, value),
    sample_count: value.sample_count,
    sample_evidence: value.sample_evidence,
    created_by: value.created_by?.actor_label,
    created_at: new Date(value.created_at).toISOString(),
  };
}

export function normalizeReportingDefinitionDetail(value: {
  definition: WireDefinition;
  revisions: WireRevision[];
  previews: Array<Record<string, unknown>>;
}): ReportingDefinitionDetail {
  const definition = normalizeDefinition(value.definition);
  const revisions = value.revisions.map((revision) => normalizeRevision(definition, revision));
  const currentRevision = revisions.find(
    (revision) => revision.id === definition.current_revision_id,
  );
  if (!currentRevision) {
    throw new Error("Reporting definition has no readable current revision.");
  }
  return { definition, revisions, previews: value.previews, current_revision: currentRevision };
}

function normalizePreview(value: WirePreview): ReportingPreview {
  return {
    preview_id: value.previewId,
    preview_token: value.previewId,
    draft_checksum: value.draftChecksum,
    preview_checksum: value.previewChecksum,
    estimate: {
      ...value.estimate,
      columns: value.projected.columns,
      cells_including_header: value.projected.cellsIncludingHeader,
      query_pages: value.batches.queryPages,
      write_batches: value.batches.writeBatches,
    },
    sample_rows: value.sampleRows,
    sample_evidence: value.sampleEvidence,
    warnings: value.warnings,
    blocking_reasons: [],
    capacity: {
      provider_max_cells:
        value.capacity.providerMaxCells ?? value.capacity.applicableLimit,
      destination_available_cells:
        value.capacity.destinationAvailableCells ?? value.capacity.applicableLimit,
      remaining_cells: value.capacity.remainingCells,
      fits: value.capacity.remainingCells >= 0,
    },
    intended_changes: value.intendedChanges,
    sensitivity: {
      highest: value.piiColumnIds.length ? "confidential_pii" : "internal",
      pii_column_ids: value.piiColumnIds,
      destination_ownership: value.destinationOwnership,
    },
    expires_at: value.expiresAt,
  };
}

function normalizeRun(value: WireRun): ReportingRun {
  const estimate =
    value.estimate && typeof value.estimate === "object" && "rows" in value.estimate
      ? (value.estimate as { rows?: number })
      : undefined;
  const actual =
    value.actual && typeof value.actual === "object" && "rows" in value.actual
      ? (value.actual as { rows?: number })
      : undefined;
  return {
    id: String(value._id),
    _id: String(value._id),
    definition_id: String(value.definition_id),
    definition_revision_id: String(value.definition_revision_id),
    revision_snapshot_checksum: value.revision_snapshot_checksum,
    status: value.status,
    trigger: value.trigger,
    estimated_rows: estimate?.rows,
    actual_rows: actual?.rows,
    created_at: new Date(value.created_at).toISOString(),
    started_at: value.started_at,
    completed_at: value.completed_at,
    failure: value.failure ?? null,
    progress: value.progress ?? null,
    delivery: value.delivery ?? null,
    final_data_checksum: value.final_data_checksum ?? null,
    counters: value.counters ?? null,
    estimate: value.estimate ?? null,
    actual: value.actual ?? null,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${root}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.ok) {
    throw new Error(envelope.ok ? `Reporting request failed (${response.status}).` : envelope.error);
  }
  return envelope.data;
}

export const fetchReportingCatalog = async () =>
  normalizeReportingCatalog(await request<WireCatalog>("/catalog"));
export const fetchReportingDefinitions = () =>
  request<WireDefinition[]>("/definitions").then((items) => items.map(normalizeDefinition));
export const fetchReportingDefinition = async (id: string) =>
  normalizeReportingDefinitionDetail(
    await request<{
      definition: WireDefinition;
      revisions: WireRevision[];
      previews: Array<Record<string, unknown>>;
    }>(`/definitions/${encodeURIComponent(id)}`),
  );
export const fetchReportingRuns = () =>
  request<WireRun[]>("/runs").then((items) => items.map(normalizeRun));
export const fetchReportingRun = (id: string) =>
  request<WireRunDetail>(`/runs/${encodeURIComponent(id)}`).then((value) => normalizeRun(value));

export function cancelReportingRun(runId: string, idempotencyKey: string) {
  return request<WireCancelRun>(`/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey }),
  });
}

export function previewReportingDraft(
  definitionId: string | null,
  draft: ReportingDefinitionDraft,
): Promise<ReportingPreview> {
  const path = definitionId
    ? `/definitions/${encodeURIComponent(definitionId)}/preview`
    : "/draft/preview";
  const body = definitionId ? { draft: toReportingDraftPayload(draft) } : toReportingDraftPayload(draft);
  return request<WirePreview>(path, {
    method: "POST",
    body: JSON.stringify(body),
  }).then(normalizePreview);
}

export function createReportingDefinition(input: SaveReportingRevisionInput) {
  return request<{
    definitionId: string;
    revisionId: string;
    revisionNumber: number;
    revisionSnapshotChecksum: string;
  }>("/definitions", {
    method: "POST",
    body: JSON.stringify({
      draft: toReportingDraftPayload(input.draft),
      previewId: input.preview_id,
      previewChecksum: input.preview_checksum,
    }),
  });
}

export function createReportingRevision(definitionId: string, input: SaveReportingRevisionInput) {
  return request<{
    definitionId: string;
    revisionId: string;
    revisionNumber: number;
    revisionSnapshotChecksum: string;
  }>(
    `/definitions/${encodeURIComponent(definitionId)}/revisions`,
    {
      method: "POST",
      body: JSON.stringify({
        draft: toReportingDraftPayload(input.draft),
        previewId: input.preview_id,
        previewChecksum: input.preview_checksum,
      }),
    },
  );
}

export function archiveReportingDefinition(definitionId: string) {
  return request<WireDefinition>(`/definitions/${encodeURIComponent(definitionId)}`, {
    method: "DELETE",
  }).then(normalizeDefinition);
}

export function cloneReportingDefinition(definitionId: string) {
  return request<{ draft: WireDraft }>(
    `/definitions/${encodeURIComponent(definitionId)}/clone`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

function normalizeQueuedRun(value: WireQueuedRun): ReportingQueuedRun {
  return {
    run_id: value.runId,
    status: value.status,
    idempotent_replay: value.idempotentReplay,
    wakeup_published: value.wakeupPublished,
    execution_package: value.executionPackage,
  };
}

export function prepareReportingRun(
  definitionId: string,
  revisionId: string | undefined,
  idempotencyKey: string,
): Promise<ReportingRunConfirmation | ReportingQueuedRun> {
  return request<WireRunConfirmation | WireQueuedRun>(
    `/definitions/${encodeURIComponent(definitionId)}/run`,
    {
    method: "POST",
      body: JSON.stringify({
        ...(revisionId ? { revisionId } : {}),
        idempotencyKey,
      }),
    },
  ).then((value) =>
    "status" in value
      ? normalizeQueuedRun(value)
      : {
          confirmation_token: value.confirmationToken,
          confirmation_id: value.confirmationId,
          idempotency_key: value.idempotencyKey,
          definition_id: value.definitionId,
          revision_id: value.revisionId,
          revision_snapshot_checksum: value.revisionSnapshotChecksum,
          destination_snapshot_checksum: value.destinationSnapshotChecksum,
          query_input_checksum: value.queryInputChecksum,
          estimate: {
            ...value.estimate,
            cells_including_header: value.estimate.cellsIncludingHeader,
            generated_at: value.estimate.generatedAt,
          },
          warnings: value.warnings,
          intended_changes: value.intendedChanges,
          expires_at: value.expiresAt,
        },
  );
}

export function confirmReportingRun(
  definitionId: string,
  input: { revision_id: string; confirmation_token: string; idempotency_key: string },
) {
  return request<WireQueuedRun>(
    `/definitions/${encodeURIComponent(definitionId)}/run`,
    {
      method: "POST",
      body: JSON.stringify({
        revisionId: input.revision_id,
        confirmationToken: input.confirmation_token,
        idempotencyKey: input.idempotency_key,
      }),
    },
  ).then(normalizeQueuedRun);
}
