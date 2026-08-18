type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; issues?: unknown; request_id?: string };

export type GranotOperation = "form_leads" | "call_leads";
export type GranotWorkflow = "preview" | "apply";

export type GranotAutomationCompatibility = {
  granot_crm_source_id?: string;
  available_for_apply: boolean;
  status:
    | "ready"
    | "missing_reference"
    | "source_disabled"
    | "source_ambiguous"
    | "operation_not_permitted";
  issues: Array<{ code: string; message: string }>;
};

export type GranotAutomationSource = {
  id: string;
  label: string;
  active: boolean;
  supported_operations: GranotOperation[];
  created_from: "seed" | "admin";
  created_at?: string;
  granot_crm_source?: string;
  compatibility?: GranotAutomationCompatibility;
};

export type GranotRunStatus =
  | "queued"
  | "collecting"
  | "planning"
  | "awaiting_approval"
  | "applying"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "expired"
  | string;

export type CreateGranotRunInput = {
  from: string;
  to: string;
  operation: GranotOperation;
  workflow: GranotWorkflow;
  source_labels: string[];
  filters?: {
    date_factor?: "OPEN" | "BOOK";
    type?: string;
    department?: string;
    state?: string;
    status?: string;
  };
};

export type CreateGranotRunGroupInput = {
  from: string;
  to: string;
  operations: GranotOperation[];
  workflow: GranotWorkflow;
  source_ids: string[];
  filters?: CreateGranotRunInput["filters"];
};

export type GranotRunGroup = {
  run_group_id: string;
  runs: Array<{
    run_id: string;
    operation: GranotOperation;
    source_labels: string[];
  }>;
};

export type ApproveGranotRunInput = {
  runId: string;
  plan_checksum: string;
  selected_action_ids: string[];
};

export type GranotCollectionSummary = {
  source_label: string;
  content_hash: string;
  booked_jobs: number;
  follow_up_estimates: number;
  row_count: number;
};

export type GranotCollection = {
  requested_date_window?: { from?: string; to?: string };
  discovered_source_labels: string[];
  not_observed_source_labels: string[];
  sources: GranotCollectionSummary[];
};

export type GranotAction = {
  action_id: string;
  operation?: string;
  status?: string;
  syncable?: boolean;
  source_label?: string;
  source_row_id?: string;
  target_id?: string;
  summary?: string;
  reason?: string;
  classification?: string;
  match_method?: "ref_no_exact" | "mongo_id" | "fallback" | "none" | string;
  warnings?: string[];
  preview?: Record<string, unknown>;
};

export type GranotConflict = {
  conflict_id: string;
  action_id?: string;
  type?: string;
  status?: string;
  source_label?: string;
  summary?: string;
  reason?: string;
};

export type GranotReceipt = {
  receipt_id: string;
  lifecycle_receipt_id?: string;
  observation_id?: string;
  decision_id?: string;
  action_id: string;
  outcome: string;
  status: string;
  pending: boolean;
  applied_at?: string;
  error_code?: string;
};

export type GranotCheckpoint = {
  phase?: string;
  completed_units?: number;
  updated_at?: string;
};

export type GranotRun = {
  run_id: string;
  run_group_id?: string;
  status: GranotRunStatus;
  operation?: GranotOperation;
  workflow?: GranotWorkflow;
  from?: string;
  to?: string;
  plan_checksum?: string | null;
  expires_at?: string | null;
  collection?: GranotCollection;
  collection_summaries?: GranotCollectionSummary[];
  operation_status_counts?: Record<string, number>;
  actions?: GranotAction[];
  conflicts?: GranotConflict[];
  receipts?: GranotReceipt[];
  receipt_count: number;
  checkpoint?: GranotCheckpoint;
  created_at?: string;
  updated_at?: string;
};

export type GranotApprovalAck = {
  run_id: string;
  approved: boolean;
  local_worker?: {
    claimed?: boolean;
    run_id?: string;
    status?: string;
  };
};

export class GranotAutomationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: unknown,
    readonly requestId?: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GranotAutomationApiError";
  }
}

const root = "/api/proxy/api/v1/admin/granot-automation";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeCompatibility(value: unknown): GranotAutomationCompatibility | undefined {
  const compatibility = asRecord(value);
  const status = stringValue(compatibility.status);
  if (
    status !== "ready" &&
    status !== "missing_reference" &&
    status !== "source_disabled" &&
    status !== "source_ambiguous" &&
    status !== "operation_not_permitted"
  ) {
    return undefined;
  }
  const issues = Array.isArray(compatibility.issues)
    ? compatibility.issues.flatMap((issue) => {
        const row = asRecord(issue);
        const code = stringValue(row.code);
        const message = stringValue(row.message);
        return code && message ? [{ code, message }] : [];
      })
    : [];
  return {
    granot_crm_source_id: stringValue(compatibility.granot_crm_source_id),
    available_for_apply: compatibility.available_for_apply === true,
    status,
    issues,
  };
}

function normalizeAutomationSource(value: unknown): GranotAutomationSource | null {
  const source = asRecord(value);
  const id = stringValue(source.id, source._id);
  const label = stringValue(source.label);
  if (!id || !label) {
    return null;
  }
  return {
    id,
    label,
    active: source.active !== false,
    supported_operations: stringArray(source.supported_operations).filter(
      (operation): operation is GranotOperation =>
        operation === "form_leads" || operation === "call_leads",
    ),
    created_from: source.created_from === "admin" ? "admin" : "seed",
    created_at: stringValue(source.created_at, source.createdAt),
    granot_crm_source: stringValue(source.granot_crm_source),
    compatibility: normalizeCompatibility(source.compatibility),
  };
}

function normalizeAction(value: unknown): GranotAction {
  const action = asRecord(value);
  const row = asRecord(action.row);
  const preview = asRecord(action.preview);
  const classification = stringValue(action.classification);
  const status = stringValue(classification, preview.status, action.status);
  const operation = stringValue(action.operation, classification);
  return {
    action_id: stringValue(action.action_id, action.actionId, action.id, action._id) ?? "",
    operation,
    status,
    classification,
    match_method: stringValue(action.match_method, preview.match_method),
    warnings: stringArray(action.warnings ?? preview.warnings),
    syncable:
      typeof action.syncable === "boolean"
        ? action.syncable
        : classification !== undefined
        ? classification === "update"
        : ["updateable", "unchanged"].includes(status ?? ""),
    source_label: stringValue(action.source_label, row.source_label, row.sourceLabel),
    source_row_id: stringValue(action.row_id, row.row_id, row.id),
    target_id: stringValue(action.lead_id),
    reason: stringValue(action.reason),
    summary: stringValue(action.reason, preview.message, preview.summary),
    preview: Object.keys(preview).length > 0 ? preview : undefined,
  };
}

function conflictFromAction(action: GranotAction): GranotConflict {
  return {
    conflict_id: action.action_id,
    action_id: action.action_id,
    type: action.classification ?? action.status ?? "conflict",
    status: action.status,
    source_label: action.source_label,
    summary: action.summary,
    reason: action.reason,
  };
}

function normalizeReceipt(value: unknown): GranotReceipt {
  const receipt = asRecord(value);
  const actionId = stringValue(receipt.action_id, receipt.actionId) ?? "";
  const outcome = stringValue(receipt.outcome) ?? "unknown";
  const lifecycleReceiptId = stringValue(
    receipt.lifecycle_receipt_id,
    receipt.lifecycleReceiptId,
    receipt.receipt_id,
    receipt.receiptId,
  );
  const pending =
    outcome === "accepted_for_processing" || outcome === "pending_match";
  return {
    receipt_id: lifecycleReceiptId ?? actionId,
    lifecycle_receipt_id: lifecycleReceiptId,
    observation_id: stringValue(receipt.observation_id, receipt.observationId),
    decision_id: stringValue(receipt.decision_id, receipt.decisionId),
    action_id: actionId,
    outcome,
    status: outcome,
    pending,
    applied_at: stringValue(receipt.applied_at, receipt.appliedAt),
    error_code: stringValue(receipt.error_code, receipt.errorCode),
  };
}

function normalizeCollection(value: unknown): GranotCollection | undefined {
  const collection = asRecord(value);
  if (Object.keys(collection).length === 0) {
    return undefined;
  }
  const requestedWindow = asRecord(collection.requestedDateWindow);
  const sources = Array.isArray(collection.sources)
    ? collection.sources.map((value) => {
        const source = asRecord(value);
        const bookedJobs = numberValue(source.bookedJobs);
        const followUpEstimates = numberValue(source.followUpEstimates);
        return {
          source_label: stringValue(source.sourceLabel) ?? "",
          content_hash: stringValue(source.contentHash) ?? "",
          booked_jobs: bookedJobs,
          follow_up_estimates: followUpEstimates,
          row_count: bookedJobs + followUpEstimates,
        };
      })
    : [];
  return {
    requested_date_window:
      Object.keys(requestedWindow).length > 0
        ? {
            from: stringValue(requestedWindow.from),
            to: stringValue(requestedWindow.to),
          }
        : undefined,
    discovered_source_labels: stringArray(collection.discoveredSourceLabels),
    not_observed_source_labels: stringArray(collection.notObservedSourceLabels),
    sources,
  };
}

function normalizeCounts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

export function normalizeGranotRun(value: unknown): GranotRun {
  const run = asRecord(value);
  const plan = asRecord(run.plan);
  const actions = Array.isArray(plan.actions) ? plan.actions.map(normalizeAction) : undefined;
  const collection = normalizeCollection(run.collection);
  const checkpoint = asRecord(run.checkpoint);
  return {
    run_id: stringValue(run.run_id, run.runId, run.id, run._id) ?? "",
    run_group_id: stringValue(run.run_group_id, run.runGroupId),
    status: stringValue(run.status) ?? "unknown",
    operation: stringValue(run.operation) as GranotOperation | undefined,
    workflow: stringValue(run.workflow) as GranotWorkflow | undefined,
    from: collection?.requested_date_window?.from,
    to: collection?.requested_date_window?.to,
    plan_checksum: stringValue(run.plan_checksum, run.planChecksum) ?? null,
    expires_at: stringValue(run.expires_at),
    collection,
    collection_summaries: collection?.sources,
    operation_status_counts: normalizeCounts(run.counters ?? plan.counters),
    actions,
    conflicts: actions
      ?.filter((action) =>
        ["conflict", "no_match", "invalid", "booking_missing", "failed"].includes(
          action.classification ?? action.status ?? "",
        ),
      )
      .map(conflictFromAction),
    receipts: Array.isArray(run.receipts) ? run.receipts.map(normalizeReceipt) : undefined,
    receipt_count: numberValue(run.receipt_count),
    checkpoint:
      Object.keys(checkpoint).length > 0
        ? {
            phase: stringValue(checkpoint.phase),
            completed_units: numberValue(checkpoint.completed_units),
            updated_at: stringValue(checkpoint.updated_at),
          }
        : undefined,
    created_at: stringValue(run.created_at, run.createdAt),
    updated_at: stringValue(run.updated_at, run.updatedAt),
  };
}

export function toGranotApiDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Granot date inputs must use YYYY-MM-DD.");
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
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
    throw new GranotAutomationApiError(
      envelope.ok ? `Granot request failed (${response.status}).` : envelope.error,
      response.status,
      envelope.ok ? undefined : envelope.issues,
      envelope.ok ? undefined : envelope.request_id,
      envelope.ok ? undefined : envelope.code,
    );
  }
  return envelope.data;
}

export async function createGranotRun(input: CreateGranotRunInput): Promise<GranotRun> {
  return normalizeGranotRun(
    await request<unknown>("/runs", {
      method: "POST",
      body: JSON.stringify({
        operation: input.operation,
        workflow: input.workflow,
        from: toGranotApiDate(input.from),
        to: toGranotApiDate(input.to),
        ...(input.source_labels ? { source_labels: input.source_labels } : {}),
        ...(input.filters ? { filters: input.filters } : {}),
      }),
    }),
  );
}

export async function createGranotRunGroup(
  input: CreateGranotRunGroupInput,
): Promise<GranotRunGroup> {
  const data = asRecord(
    await request<unknown>("/run-groups", {
      method: "POST",
      body: JSON.stringify({
        operations: input.operations,
        workflow: input.workflow,
        from: toGranotApiDate(input.from),
        to: toGranotApiDate(input.to),
        source_ids: input.source_ids,
        ...(input.filters ? { filters: input.filters } : {}),
      }),
    }),
  );
  return {
    run_group_id: stringValue(data.run_group_id) ?? "",
    runs: Array.isArray(data.runs)
      ? data.runs.map((value) => {
          const run = asRecord(value);
          return {
            run_id: stringValue(run.run_id, run.id, run._id) ?? "",
            operation: stringValue(run.operation) as GranotOperation,
            source_labels: stringArray(run.source_labels),
          };
        })
      : [],
  };
}

export async function fetchGranotAutomationSources(
  operation?: GranotOperation,
): Promise<GranotAutomationSource[]> {
  const data = await request<unknown>(
    `/runs/sources${operation ? `?operation=${encodeURIComponent(operation)}` : ""}`,
  );
  return Array.isArray(data)
    ? data
        .map((value) => normalizeAutomationSource(value))
        .filter((source): source is GranotAutomationSource => source !== null)
    : [];
}

export async function createGranotAutomationSource(
  input: {
    label: string;
    supported_operations: GranotOperation[];
  },
): Promise<GranotAutomationSource> {
  const source = asRecord(
    await request<unknown>("/runs/sources", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  return (
    normalizeAutomationSource({
      ...source,
      label: stringValue(source.label) ?? input.label,
      created_from: source.created_from === "seed" ? "seed" : "admin",
    }) ?? {
      id: stringValue(source.id, source._id) ?? "",
      label: stringValue(source.label) ?? input.label,
      active: source.active !== false,
      supported_operations: input.supported_operations,
      created_from: "admin",
    }
  );
}

export async function fetchGranotRuns(): Promise<GranotRun[]> {
  const data = await request<unknown>("/runs");
  const runs = Array.isArray(data) ? data : asRecord(data).runs;
  return Array.isArray(runs) ? runs.map(normalizeGranotRun) : [];
}

export async function fetchGranotRun(runId: string): Promise<GranotRun> {
  return normalizeGranotRun(
    await request<unknown>(`/runs/${encodeURIComponent(runId)}?details=owner`),
  );
}

export async function approveGranotRun(
  input: ApproveGranotRunInput,
): Promise<GranotApprovalAck> {
  const data = asRecord(
    await request<unknown>(`/runs/${encodeURIComponent(input.runId)}/approve`, {
      method: "POST",
      body: JSON.stringify({
        plan_checksum: input.plan_checksum,
        selected_action_ids: input.selected_action_ids,
      }),
    }),
  );
  return {
    run_id: input.runId,
    approved: data.approved === true,
    ...(data.local_worker && typeof data.local_worker === "object"
      ? { local_worker: data.local_worker as GranotApprovalAck["local_worker"] }
      : {}),
  };
}
