"use client";

import type { SourceGranularityItem } from "./registrySources";
import { RegistryApiError, registryRequestJson } from "./registryRequest";

export const REGISTRY_STALE_REVISION_CODE = "REGISTRY_STALE_REVISION";
export const CPL_PREVIEW_STALE_CODE = "CPL_PREVIEW_STALE";

export function isRegistryStaleRevisionError(error: unknown): boolean {
  return error instanceof RegistryApiError && error.registryCode === REGISTRY_STALE_REVISION_CODE;
}

export function isCplPreviewStaleError(error: unknown): boolean {
  return error instanceof RegistryApiError && error.registryCode === CPL_PREVIEW_STALE_CODE;
}

/** Parse a CPL amount field; empty/invalid input returns null (not 0). */
export function parseCplAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/** Advanced commands require a loaded schedule revision; never fabricate 0. */
export function resolveAdvancedExpectedRevision(
  periodsLoaded: boolean,
  revision: number | undefined,
): number | null {
  if (!periodsLoaded || typeof revision !== "number" || !Number.isFinite(revision) || revision < 0) {
    return null;
  }
  return revision;
}

export type CplCurrentRate =
  | {
      status: "resolved";
      amount: number;
      amount_cents: number;
      period_id?: string;
    }
  | { status: "missing_rate"; fallback_amount: 0 }
  | { status: "duplicate_zero"; amount: 0; base_period_id?: string }
  | { status: "not_applicable"; amount: 0 };

export type CplSnapshotItem = {
  source_granularity: SourceGranularityItem;
  schedule_revision: number;
  current_rate: CplCurrentRate;
};

export type CplSnapshot = {
  generated_at: string;
  items: CplSnapshotItem[];
};

export type CplSchedulePeriod = {
  id?: string;
  source_granularity_id: string;
  amount_cents: number;
  effective_from: string;
  effective_until?: string;
  effective_from_date: string;
  effective_until_date_exclusive?: string;
  business_timezone: string;
  schedule_revision?: number;
  supersedes?: string;
  change_reason?: string;
};

export type CplScheduleState = {
  source_granularity_id: string;
  revision: number;
  active: boolean;
  periods: CplSchedulePeriod[];
};

export type CplScheduleCommandResult = {
  changed: boolean;
  schedules: CplScheduleState[];
};

export type SimpleCplScheduleInput = {
  effective_date: string;
  expected_revisions: Record<string, number>;
  changes: Array<{
    source_granularity_id: string;
    amount: number;
  }>;
  reason?: string;
};

export type AdvancedCplScheduleCommand =
  | {
      operation: "add_future";
      expected_revision: number;
      effective_date: string;
      amount: number;
      reason?: string;
    }
  | {
      operation: "split";
      expected_revision: number;
      period_id: string;
      effective_date: string;
      amount: number;
      reason?: string;
    }
  | {
      operation: "replace_schedule";
      expected_revision: number;
      periods: Array<{
        effective_from_date: string;
        effective_until_date?: string;
        amount: number;
      }>;
      reason?: string;
    }
  | {
      operation: "correct_period";
      expected_revision: number;
      period_id: string;
      amount: number;
      reason: string;
    };

export type CplCorrectionPreviewInput = {
  source_granularity_id: string;
  window_from: string;
  window_until: string;
  sample_limit?: number;
};

export type CplCorrectionPreviewResult = {
  preview_hash: string;
  target_schedule_revision: number;
  impact: {
    matched_count: number;
    form_lead_count: number;
    call_lead_count: number;
    would_change_count: number;
    would_no_op_count: number;
    sample: Array<{
      lead_model: string;
      lead_id: string;
      timestamp: string;
      current_cpl: number;
      current_resolution_status?: string;
      target_cpl: number;
      target_resolution_status: string;
      would_change: boolean;
    }>;
  };
};

export type CreateCplCorrectionInput = {
  source_granularity_id: string;
  window_from: string;
  window_until: string;
  target_schedule_revision: number;
  preview_hash: string;
  confirm: true;
  reason?: string;
};

export type CplCorrectionJob = {
  id: string;
  request_id: string;
  source_granularity_id: string;
  window_from: string;
  window_until: string;
  target_schedule_revision: number;
  preview_hash: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  reason: string | null;
  matched_count: number;
  changed_count: number;
  no_op_count: number;
  failed_count: number;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchCplSnapshot(): Promise<CplSnapshot> {
  return registryRequestJson<CplSnapshot>("api/v1/admin/cpl/snapshot");
}

export async function applySimpleCplSchedule(
  body: SimpleCplScheduleInput,
): Promise<CplScheduleCommandResult> {
  return registryRequestJson<CplScheduleCommandResult>("api/v1/admin/cpl/simple-schedule", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCplPeriods(granularityId: string): Promise<CplScheduleState> {
  return registryRequestJson<CplScheduleState>(
    `api/v1/admin/source-granularities/${encodeURIComponent(granularityId)}/cpl-periods`,
  );
}

export async function applyAdvancedCplCommand(
  granularityId: string,
  body: AdvancedCplScheduleCommand,
): Promise<CplScheduleCommandResult> {
  return registryRequestJson<CplScheduleCommandResult>(
    `api/v1/admin/source-granularities/${encodeURIComponent(granularityId)}/cpl-schedule/commands`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function previewCplCorrection(
  body: CplCorrectionPreviewInput,
): Promise<CplCorrectionPreviewResult> {
  return registryRequestJson<CplCorrectionPreviewResult>("api/v1/admin/cpl-corrections/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createCplCorrection(
  body: CreateCplCorrectionInput,
): Promise<CplCorrectionJob> {
  return registryRequestJson<CplCorrectionJob>("api/v1/admin/cpl-corrections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCplCorrection(id: string): Promise<CplCorrectionJob> {
  return registryRequestJson<CplCorrectionJob>(
    `api/v1/admin/cpl-corrections/${encodeURIComponent(id)}`,
  );
}

export async function cancelCplCorrection(
  id: string,
  body: { reason?: string } = {},
): Promise<CplCorrectionJob> {
  return registryRequestJson<CplCorrectionJob>(
    `api/v1/admin/cpl-corrections/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/** Owner-facing inclusive end from exclusive stored end (day before exclusive). */
export function exclusiveEndToInclusiveOwnerDate(
  exclusiveEnd: string | undefined,
): string | undefined {
  if (!exclusiveEnd) return undefined;
  const [year, month, day] = exclusiveEnd.split("-").map(Number);
  if (!year || !month || !day) return exclusiveEnd;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return utc.toISOString().slice(0, 10);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCplAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type SimpleCplDraftRow = {
  source_granularity_id: string;
  schedule_revision: number;
  baseline_amount: number | null;
  draft_amount: string;
};

export type SimpleCplComputedChange = {
  source_granularity_id: string;
  amount: number;
  schedule_revision: number;
};

/** Resolved snapshot amount, or null when the row is Missing (not $0.00). */
export function snapshotCurrentAmount(currentRate: CplCurrentRate): number | null {
  if (currentRate.status === "resolved") {
    return currentRate.amount;
  }
  if (currentRate.status === "duplicate_zero") {
    return 0;
  }
  if (currentRate.status === "not_applicable") {
    return 0;
  }
  return null;
}

export function isSnapshotRateMissing(currentRate: CplCurrentRate): boolean {
  return currentRate.status === "missing_rate";
}

export function buildSimpleCplDraftRows(
  snapshot: CplSnapshot,
  drafts: Record<string, string>,
): SimpleCplDraftRow[] {
  return snapshot.items.map((item) => {
    const id = item.source_granularity.id;
    const baseline = snapshotCurrentAmount(item.current_rate);
    const draft_amount =
      drafts[id] ?? (baseline === null ? "" : String(baseline));
    return {
      source_granularity_id: id,
      schedule_revision: item.schedule_revision,
      baseline_amount: baseline,
      draft_amount,
    };
  });
}

/** Pure diff of simple CPL edits against snapshot baselines. */
export function computeSimpleCplChanges(
  snapshot: CplSnapshot,
  drafts: Record<string, string>,
): SimpleCplComputedChange[] {
  const rows = buildSimpleCplDraftRows(snapshot, drafts);
  const changes: SimpleCplComputedChange[] = [];

  for (const row of rows) {
    const trimmed = row.draft_amount.trim();
    if (!trimmed) {
      continue;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) {
      continue;
    }
    if (row.baseline_amount === null || parsed !== row.baseline_amount) {
      changes.push({
        source_granularity_id: row.source_granularity_id,
        amount: parsed,
        schedule_revision: row.schedule_revision,
      });
    }
  }

  return changes;
}
