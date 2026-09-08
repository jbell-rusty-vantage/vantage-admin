"use client";

import { SOURCE_COMPANY_LABELS } from "@/lib/constants/domain";
import { FLORIDA_TIME_ZONE } from "@/lib/floridaTime";
import type { ApiResponse } from "./types";

export const DAILY_OPERATIONS_SNAPSHOT_PATH = "api/v1/admin/daily-operations";
export const DAILY_OPERATIONS_EVENTS_PATH = "api/v1/admin/daily-operations/events";

export const DAILY_OPERATIONS_ORIGIN_KEYS = [
  "granot_lead_created",
  "ringcentral",
  "best_relocation_sheet",
  "vantage_admin",
  "wordpress_form",
] as const;

export type DailyOperationsOriginKey = (typeof DAILY_OPERATIONS_ORIGIN_KEYS)[number];

export const DAILY_OPERATIONS_COMPANY_SLUGS = [
  "tbm_leads",
  "tbm_prime_leads",
  "top10_leads",
  "best_relocation_leads",
  "get_movers_leads",
  "main_site",
  "paid_overflow",
  "not_provided",
] as const;

export type DailyOperationsCompanySlug = (typeof DAILY_OPERATIONS_COMPANY_SLUGS)[number];

/**
 * `day_before*` arrived with DOP-10. They are optional on the client so a
 * snapshot from an older server (or an older fixture) still normalizes;
 * `normalizeDailyOperationsSnapshot` fills them with `null`.
 */
export type DailyOperationsHeadlinePace = {
  today: number;
  yesterday: number | null;
  yesterday_by_now: number | null;
  day_before?: number | null;
  day_before_by_now?: number | null;
};

export type DailyOperationsWebhookClassCount = {
  today: number;
  yesterday: number | null;
  day_before?: number | null;
};

export type DailyOperationsSnapshotCompany = {
  source_company: string;
  form: number;
  call: number;
  total: number;
  yesterday_total: number | null;
  day_before_total?: number | null;
};

export type DailyOperationsHourlyBucket = {
  hour: number;
  leads: number;
  bookings: number;
  cancellations: number;
  webhooks: number;
  messages: number;
};

export type DailyOperationsSnapshot = {
  timezone: typeof FLORIDA_TIME_ZONE;
  today: string;
  yesterday: string;
  day_before?: string;
  generated_at: string;
  redis: { configured: boolean; mode: "stream" };
  metrics: {
    leads: DailyOperationsHeadlinePace & {
      form: number;
      call: number;
      duplicate_form: number;
      duplicate_call: number;
    };
    bookings: DailyOperationsHeadlinePace;
    cancellations: DailyOperationsHeadlinePace;
    texts: DailyOperationsHeadlinePace & {
      deferred: number;
      held_now: number;
      skipped: number;
      failed: number;
    };
    webhooks: {
      lead_created: DailyOperationsWebhookClassCount;
      priority_updated: DailyOperationsWebhookClassCount;
      booking_status_changed: DailyOperationsWebhookClassCount;
      booked: DailyOperationsWebhookClassCount;
      release: DailyOperationsWebhookClassCount;
    };
    intakes: { opened_today: number; still_open: number };
    exceptions: {
      zip_missing: number;
      crm_failed: number;
      dead_letter: number;
      adoption_conflict: number;
    };
  };
  origins: Record<DailyOperationsOriginKey, number>;
  companies: DailyOperationsSnapshotCompany[];
  hourly: {
    today: DailyOperationsHourlyBucket[];
    yesterday: DailyOperationsHourlyBucket[];
    day_before?: DailyOperationsHourlyBucket[];
  };
};

export type DailyOperationsTileId =
  | "leads"
  | "form_call"
  | "duplicates"
  | "bookings"
  | "cancellations"
  | "texts"
  | "granot"
  | "intakes";

export type DailyOperationsHeadlineLane =
  | "lead"
  | "text"
  | "granot"
  | "intake"
  | "booking"
  | "cancellation";

export type DailyOperationsPanelLane =
  | DailyOperationsHeadlineLane
  | "exception"
  | "sheet_sync";

export type DailyOperationsLane = DailyOperationsHeadlineLane | DailyOperationsPanelLane;

export const DAILY_OPERATIONS_DEFAULT_PANELS: readonly DailyOperationsPanelLane[] = [
  "lead",
  "text",
  "granot",
  "intake",
  "booking",
  "cancellation",
  "exception",
] as const;

export type DailyOperationsLinks = {
  lead_id?: string;
  lead_model?: "FormLead" | "CallLead";
  booking_id?: string;
  cancellation_id?: string;
  intake_case_id?: string;
  receipt_id?: string;
  message_id?: string;
};

export type DailyOperationsCard = {
  customer_name?: string | null;
  phone_last4?: string | null;
  job_no?: string | null;
  move?: {
    pickup_zip?: string | null;
    pickup_state?: string | null;
    delivery_zip?: string | null;
    delivery_state?: string | null;
    move_type?: "local" | "long_distance" | null;
  };
  zip_miss?: {
    pickup: boolean;
    delivery: boolean;
  };
  text?: {
    purpose?: "quote_request_confirmation" | "granot_create_confirmation" | string;
    status?: string;
    deferred?: boolean;
    send_at?: string | null;
    skip_reason?: string | null;
  };
  granot?: {
    route_event_class?: string;
    booking_action?: "booked" | "release" | null;
    decision?: string | null;
  };
  booking_kind?: string | null;
  exception?: {
    code?: string;
    detail?: string;
  };
};

export type DailyOperationsEventsPage = {
  day: string;
  timezone: string;
  order: string;
  limit: number;
  items: Array<{
    event_id: string;
    day: string;
    occurred_at: string;
    lane: string;
    kind: string;
    title: string;
    source_company: string | null;
    ingestion_origin: string | null;
    lead_kind: "form" | "call" | null;
    job_no: string | null;
    entity_type: string | null;
    entity_id: string | null;
    parent_receipt_id: string | null;
    links: DailyOperationsLinks;
    card: DailyOperationsCard;
    metric_touches: string[];
  }>;
  next_cursor: string | null;
};

export const DAILY_OPERATIONS_TILE_LANES: Record<DailyOperationsTileId, DailyOperationsLane> = {
  leads: "lead",
  form_call: "lead",
  duplicates: "lead",
  bookings: "booking",
  cancellations: "cancellation",
  texts: "text",
  granot: "granot",
  intakes: "intake",
};

export type DailyOperationsPaceTone = "ahead" | "behind" | "even" | "missing";

export type DailyOperationsPace = {
  delta: number | null;
  tone: DailyOperationsPaceTone;
};

/**
 * Percent change of `today` against a like-hour baseline (yesterday at this
 * hour, or the two-day average at this hour). `pct` is `null` when the
 * baseline is missing or zero — a percent against zero is not a number the
 * Owner can use, so the label says `new` instead of `Infinity`.
 */
export type DailyOperationsPercentChange = {
  pct: number | null;
  tone: DailyOperationsPaceTone;
  label: string;
};

/**
 * Everything a tile or panel header shows about pace, so no fact hides in a
 * tooltip: today, count delta and percent versus yesterday at this hour,
 * percent versus the two-day average at this hour, and the prior-day totals
 * for the visible secondary line.
 */
export type DailyOperationsTrend = {
  today: number;
  yesterdayByNow: number | null;
  dayBeforeByNow: number | null;
  yesterday: number | null;
  dayBefore: number | null;
  twoDayAverageByNow: number | null;
  pace: DailyOperationsPace;
  versusYesterday: DailyOperationsPercentChange;
  versusTwoDayAverage: DailyOperationsPercentChange;
};

function proxyUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || !payload.ok) {
    const rawMessage = payload && !payload.ok ? payload.error : response.statusText;
    throw new Error(rawMessage?.trim() || `Request failed (${response.status}).`);
  }

  return payload.data;
}

export function fetchDailyOperationsSnapshot(): Promise<DailyOperationsSnapshot> {
  return requestJson(proxyUrl(DAILY_OPERATIONS_SNAPSHOT_PATH));
}

export function fetchDailyOperationsEvents(input: {
  lane?: string | null;
  cursor?: string | null;
  limit?: number;
} = {}): Promise<DailyOperationsEventsPage> {
  const params = new URLSearchParams();
  if (input.lane && input.lane !== "all") params.set("lane", input.lane);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return requestJson(proxyUrl(query ? `${DAILY_OPERATIONS_EVENTS_PATH}?${query}` : DAILY_OPERATIONS_EVENTS_PATH));
}

export function paceVersusYesterdayByNow(
  today: number,
  yesterdayByNow: number | null | undefined,
): DailyOperationsPace {
  if (yesterdayByNow == null) {
    return { delta: null, tone: "missing" };
  }
  const delta = today - yesterdayByNow;
  if (delta > 0) {
    return { delta, tone: "ahead" };
  }
  if (delta < 0) {
    return { delta, tone: "behind" };
  }
  return { delta: 0, tone: "even" };
}

export function percentChange(
  today: number,
  baseline: number | null | undefined,
): DailyOperationsPercentChange {
  if (baseline == null) {
    return { pct: null, tone: "missing", label: "—" };
  }
  if (baseline === 0) {
    if (today === 0) {
      return { pct: null, tone: "even", label: "even" };
    }
    return { pct: null, tone: "ahead", label: "new" };
  }
  const pct = Math.round(((today - baseline) / baseline) * 100);
  if (pct > 0) {
    return { pct, tone: "ahead", label: `+${pct}%` };
  }
  if (pct < 0) {
    return { pct, tone: "behind", label: `−${Math.abs(pct)}%` };
  }
  return { pct: 0, tone: "even", label: "even" };
}

export function twoDayAverageByNow(
  yesterdayByNow: number | null | undefined,
  dayBeforeByNow: number | null | undefined,
): number | null {
  if (yesterdayByNow == null && dayBeforeByNow == null) {
    return null;
  }
  if (yesterdayByNow == null) {
    return dayBeforeByNow ?? null;
  }
  if (dayBeforeByNow == null) {
    return yesterdayByNow;
  }
  return Math.round(((yesterdayByNow + dayBeforeByNow) / 2) * 10) / 10;
}

export function dailyOperationsTrend(input: {
  today: number;
  yesterdayByNow: number | null | undefined;
  dayBeforeByNow?: number | null | undefined;
  yesterday?: number | null | undefined;
  dayBefore?: number | null | undefined;
}): DailyOperationsTrend {
  const yesterdayByNow = input.yesterdayByNow ?? null;
  const dayBeforeByNow = input.dayBeforeByNow ?? null;
  const average = twoDayAverageByNow(yesterdayByNow, dayBeforeByNow);
  return {
    today: input.today,
    yesterdayByNow,
    dayBeforeByNow,
    yesterday: input.yesterday ?? null,
    dayBefore: input.dayBefore ?? null,
    twoDayAverageByNow: average,
    pace: paceVersusYesterdayByNow(input.today, yesterdayByNow),
    versusYesterday: percentChange(input.today, yesterdayByNow),
    versusTwoDayAverage: percentChange(input.today, average),
  };
}

export function trendFromPace(pace: DailyOperationsHeadlinePace | null | undefined): DailyOperationsTrend {
  return dailyOperationsTrend({
    today: pace?.today ?? 0,
    yesterdayByNow: pace?.yesterday_by_now,
    dayBeforeByNow: pace?.day_before_by_now,
    yesterday: pace?.yesterday,
    dayBefore: pace?.day_before,
  });
}

export function formatSignedCount(delta: number | null): string {
  if (delta == null) return "—";
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "even";
}

export function granotReceiptsToday(snapshot: DailyOperationsSnapshot): number {
  const webhooks = snapshot.metrics.webhooks;
  return (
    webhooks.lead_created.today +
    webhooks.priority_updated.today +
    webhooks.booking_status_changed.today
  );
}

export function granotYesterdayByNow(snapshot: DailyOperationsSnapshot): number | null {
  if (snapshot.metrics.leads.yesterday_by_now == null) {
    return null;
  }
  return sumHourlyFieldThroughNow(snapshot.hourly.yesterday, snapshot.generated_at, "webhooks");
}

export function granotDayBeforeByNow(snapshot: DailyOperationsSnapshot): number | null {
  if (snapshot.metrics.leads.day_before_by_now == null) {
    return null;
  }
  return sumHourlyFieldThroughNow(snapshot.hourly.day_before ?? [], snapshot.generated_at, "webhooks");
}

export function granotYesterdayTotal(snapshot: DailyOperationsSnapshot): number | null {
  const webhooks = snapshot.metrics.webhooks;
  if (webhooks.lead_created.yesterday == null) {
    return null;
  }
  return (
    (webhooks.lead_created.yesterday ?? 0) +
    (webhooks.priority_updated.yesterday ?? 0) +
    (webhooks.booking_status_changed.yesterday ?? 0)
  );
}

export function granotDayBeforeTotal(snapshot: DailyOperationsSnapshot): number | null {
  const webhooks = snapshot.metrics.webhooks;
  if (webhooks.lead_created.day_before == null) {
    return null;
  }
  return (
    (webhooks.lead_created.day_before ?? 0) +
    (webhooks.priority_updated.day_before ?? 0) +
    (webhooks.booking_status_changed.day_before ?? 0)
  );
}

function sumHourlyFieldThroughNow(
  buckets: DailyOperationsHourlyBucket[],
  generatedAt: string,
  field: Exclude<keyof DailyOperationsHourlyBucket, "hour">,
): number | null {
  if (!buckets.length) {
    return null;
  }
  const currentHour = easternHour(new Date(generatedAt));
  return buckets
    .filter((bucket) => bucket.hour <= currentHour)
    .reduce((sum, bucket) => sum + Number(bucket[field] ?? 0), 0);
}

export function easternHourOf(value: string | Date): number {
  return easternHour(value instanceof Date ? value : new Date(value));
}

export function sourceCompanyLabel(slug: string): string {
  if (slug in SOURCE_COMPANY_LABELS) {
    return SOURCE_COMPANY_LABELS[slug as keyof typeof SOURCE_COMPANY_LABELS];
  }
  return slug;
}

export function ensureSnapshotOrigins(
  origins: Partial<Record<DailyOperationsOriginKey, number>> | undefined,
): Record<DailyOperationsOriginKey, number> {
  const next = {} as Record<DailyOperationsOriginKey, number>;
  for (const key of DAILY_OPERATIONS_ORIGIN_KEYS) {
    next[key] = Number(origins?.[key] ?? 0);
  }
  return next;
}

export function ensureSnapshotCompanies(
  companies: DailyOperationsSnapshotCompany[] | undefined,
): DailyOperationsSnapshotCompany[] {
  const bySlug = new Map((companies ?? []).map((row) => [row.source_company, row]));
  return DAILY_OPERATIONS_COMPANY_SLUGS.map((slug) => {
    const row = bySlug.get(slug);
    return {
      source_company: slug,
      form: Number(row?.form ?? 0),
      call: Number(row?.call ?? 0),
      total: Number(row?.total ?? 0),
      yesterday_total: row?.yesterday_total ?? null,
      day_before_total: row?.day_before_total ?? null,
    };
  });
}

export function normalizeDailyOperationsSnapshot(
  snapshot: DailyOperationsSnapshot,
): DailyOperationsSnapshot {
  return {
    ...snapshot,
    origins: ensureSnapshotOrigins(snapshot.origins),
    companies: ensureSnapshotCompanies(snapshot.companies),
  };
}

export function toggleSearchParam(
  params: URLSearchParams,
  key: "lane" | "company" | "quiet_priorities",
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (next.get(key) === value) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

export function writeSearchParam(
  params: URLSearchParams,
  key: "lane" | "company" | "quiet_priorities",
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (!value) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next;
}

function easternHour(value: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: FLORIDA_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(value).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}
