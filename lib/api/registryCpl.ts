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

/* ---- Setup → Lead costs helpers (additive; the Registry commands above are unchanged) ---- */

/** How one snapshot row reads to the Owner. Missing is a state, never $0. */
export type CplRowState =
  | { kind: "resolved"; amount: number }
  | { kind: "missing" }
  | { kind: "recorded_twice" }
  | { kind: "not_needed" };

export function cplRowState(currentRate: CplCurrentRate): CplRowState {
  switch (currentRate.status) {
    case "resolved":
      return { kind: "resolved", amount: currentRate.amount };
    case "duplicate_zero":
      return { kind: "recorded_twice" };
    case "not_applicable":
      return { kind: "not_needed" };
    default:
      return { kind: "missing" };
  }
}

export type CplCompanyGroup = {
  /** The source company id (a key, never printed). */
  companyId: string;
  /** The Owner label of the lead source. */
  companyName: string;
  items: CplSnapshotItem[];
};

/** Web forms before phone calls, long distance before local, then the stored priority. */
function compareFeeds(a: CplSnapshotItem, b: CplSnapshotItem): number {
  const left = a.source_granularity;
  const right = b.source_granularity;
  const channel = (left.channel === "form" ? 0 : 1) - (right.channel === "form" ? 0 : 1);
  if (channel !== 0) return channel;
  const local = (left.local === "local" ? 1 : 0) - (right.local === "local" ? 1 : 0);
  if (local !== 0) return local;
  return left.priority - right.priority;
}

/** One group per source company (alphabetical by Owner label), feeds ordered inside each. */
export function groupCplSnapshotByCompany(
  items: readonly CplSnapshotItem[],
  companyName: (companyId: string) => string,
): CplCompanyGroup[] {
  const byCompany = new Map<string, CplSnapshotItem[]>();
  for (const item of items) {
    const key = item.source_granularity.source_company;
    byCompany.set(key, [...(byCompany.get(key) ?? []), item]);
  }
  return [...byCompany.entries()]
    .map(([companyId, rows]) => ({ companyId, companyName: companyName(companyId), items: [...rows].sort(compareFeeds) }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

/** A one-feed snapshot, so the sheet saves through the same pure diff as the grid. */
export function singleFeedSnapshot(item: CplSnapshotItem, generatedAt = ""): CplSnapshot {
  return { generated_at: generatedAt, items: [item] };
}

/** The body of the simple-schedule command: expected revisions come from the rows being changed, nothing else. */
export function buildSimpleCplInput(
  changes: readonly SimpleCplComputedChange[],
  effectiveDate: string,
  reason?: string,
): SimpleCplScheduleInput {
  const expected_revisions: Record<string, number> = {};
  for (const change of changes) {
    expected_revisions[change.source_granularity_id] = change.schedule_revision;
  }
  const trimmed = reason?.trim();
  return {
    effective_date: effectiveDate,
    expected_revisions,
    changes: changes.map(({ source_granularity_id, amount }) => ({ source_granularity_id, amount })),
    ...(trimmed ? { reason: trimmed } : {}),
  };
}

/** Past, current and future periods against a New York day (`today` is YYYY-MM-DD). */
export function classifyCplPeriods(periods: readonly CplSchedulePeriod[], today: string) {
  const past: CplSchedulePeriod[] = [];
  const current: CplSchedulePeriod[] = [];
  const future: CplSchedulePeriod[] = [];
  for (const period of periods) {
    const untilInclusive = exclusiveEndToInclusiveOwnerDate(period.effective_until_date_exclusive);
    if (period.effective_from_date > today) {
      future.push(period);
    } else if (untilInclusive && untilInclusive < today) {
      past.push(period);
    } else {
      current.push(period);
    }
  }
  return { past, current, future };
}

/** The start date of the period the dashboard prices with today: the snapshot's period when known, else the current one. */
export function currentCplSince(
  periods: readonly CplSchedulePeriod[],
  today: string,
  periodId?: string,
): string | null {
  const byId = periodId ? periods.find((period) => period.id === periodId) : undefined;
  const period = byId ?? classifyCplPeriods(periods, today).current[0];
  return period?.effective_from_date ?? null;
}

export type AdvancedCplKind = "add_future" | "split" | "correct_period" | "replace_schedule";

export type AdvancedCplForm = {
  kind: AdvancedCplKind;
  effectiveDate: string;
  amount: string;
  periodId: string;
  reason: string;
  replaceRows: Array<{ from: string; until: string; amount: string }>;
};

export type AdvancedCplBuild =
  | { ok: true; command: AdvancedCplScheduleCommand }
  | { ok: false; message: string };

/**
 * Validate the form and build the schedule command, with the same checks the Advanced tab ran: a loaded revision is
 * required (never a fabricated 0), amounts are non-negative, a period is required to split or correct, and a
 * correction always carries a reason ("Correction" when left empty).
 */
export function buildAdvancedCplCommand(
  form: AdvancedCplForm,
  expectedRevision: number | null,
): AdvancedCplBuild {
  if (expectedRevision === null) {
    return { ok: false, message: "Wait for this lead cost to finish loading, then try again." };
  }
  const reason = form.reason.trim();
  const amount = parseCplAmountInput(form.amount);
  if (form.kind === "replace_schedule") {
    if (form.replaceRows.length === 0) {
      return { ok: false, message: "Add at least one period to the new schedule." };
    }
    const periods: Array<{ effective_from_date: string; effective_until_date?: string; amount: number }> = [];
    for (const row of form.replaceRows) {
      const rowAmount = parseCplAmountInput(row.amount);
      if (!row.from || rowAmount === null) {
        return { ok: false, message: "Every period needs a start date and an amount of $0 or more." };
      }
      periods.push({
        effective_from_date: row.from,
        ...(row.until ? { effective_until_date: row.until } : {}),
        amount: rowAmount,
      });
    }
    return {
      ok: true,
      command: { operation: "replace_schedule", expected_revision: expectedRevision, periods, ...(reason ? { reason } : {}) },
    };
  }
  if (amount === null) {
    return { ok: false, message: "Enter an amount of $0 or more." };
  }
  if (form.kind === "add_future") {
    if (!form.effectiveDate) return { ok: false, message: "Pick the date the new amount starts." };
    return {
      ok: true,
      command: {
        operation: "add_future",
        expected_revision: expectedRevision,
        effective_date: form.effectiveDate,
        amount,
        ...(reason ? { reason } : {}),
      },
    };
  }
  const periodId = form.periodId.trim();
  if (!periodId) {
    return { ok: false, message: "Pick the period first." };
  }
  if (form.kind === "split") {
    if (!form.effectiveDate) return { ok: false, message: "Pick the date to split the period at." };
    return {
      ok: true,
      command: {
        operation: "split",
        expected_revision: expectedRevision,
        period_id: periodId,
        effective_date: form.effectiveDate,
        amount,
        ...(reason ? { reason } : {}),
      },
    };
  }
  return {
    ok: true,
    command: {
      operation: "correct_period",
      expected_revision: expectedRevision,
      period_id: periodId,
      amount,
      reason: reason || "Correction",
    },
  };
}

export const CPL_SCHEDULE_START_FALLBACK = "2024-01-01";

/** The first day a feed's schedule covers (earliest period start); "All leads" saves from here. */
export function cplScheduleStartDate(periods: readonly Pick<CplSchedulePeriod, "effective_from_date">[] | null | undefined): string {
  const dates = (periods ?? []).map((period) => period.effective_from_date).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
  return dates.length === 0 ? CPL_SCHEDULE_START_FALLBACK : [...dates].sort()[0];
}
