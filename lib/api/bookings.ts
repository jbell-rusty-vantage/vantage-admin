/**
 * All bookings and Cancellations (doc 03): the URL-level filter state of each workspace and the pure builders that turn
 * it into `fetchAdminList("booked-leads" | "cancelled-leads")` filters. Pure; the workspaces own the data fetching.
 */
import type { AdminRecord } from "./admin";
import type { SerializableFilters } from "./filters";
import { classifyLeadSearch } from "./leads";

export const BOOKINGS_PAGE_SIZE = 50;

export type BookingStatus = "active" | "cancelled" | "all";
export type BookingType = "any" | "lead" | "leadless" | "referral";
export type BookingBinder = "any" | "2k" | "4k";
export type BookingSort = "book_desc" | "book_asc" | "binder_desc";

export type BookingFilterState = {
  q: string | null;
  status: BookingStatus;
  source: string | null;
  agent: string | null;
  merchant: string | null;
  from: string | null;
  to: string | null;
  type: BookingType;
  local: string | null;
  binder: BookingBinder;
  sort: BookingSort;
};

export type CancellationRefund = "any" | "yes" | "no";
export type CancellationSort = "cancel_desc" | "cancel_asc" | "refund_desc";

export type CancellationFilterState = {
  q: string | null;
  reason: string | null;
  source: string | null;
  agent: string | null;
  merchant: string | null;
  from: string | null;
  to: string | null;
  refund: CancellationRefund;
  by: string | null;
  sort: CancellationSort;
};

/** A `to` date from a date input is the whole day, as the Leads workspace does. */
export function dayEnd(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

/**
 * The search box on a booking or a cancellation: a job-looking query sends `job_no`; everything else sends `q`.
 * The server has no phone or email field on either list, so those still go through `q` (doc 03 server work).
 */
export function applySearch(filters: SerializableFilters, q: string | null): void {
  const text = q?.trim();
  if (!text) return;
  const search = classifyLeadSearch(text);
  if (search.kind === "job") filters.job_no = search.value;
  else filters.q = text;
}

const BINDER_MIN: Record<Exclude<BookingBinder, "any">, number> = { "2k": 2000, "4k": 4000 };

/** The `fetchAdminList("booked-leads")` filters for a state (page 1; the caller sets `page`). */
export function bookingListFilters(state: BookingFilterState): SerializableFilters {
  const filters: SerializableFilters = { limit: BOOKINGS_PAGE_SIZE };

  if (state.sort === "book_asc") {
    filters.sort = "book_date";
    filters.direction = "asc";
  } else if (state.sort === "binder_desc") {
    filters.sort = "total_binder_amount";
    filters.direction = "desc";
  } else {
    filters.sort = "book_date";
    filters.direction = "desc";
  }

  if (state.status === "active") filters.cancelled = false;
  else if (state.status === "cancelled") filters.cancelled = true;

  if (state.source) filters.source = state.source;
  if (state.agent) filters.agent = state.agent;
  if (state.merchant) filters.merchant = state.merchant;
  if (state.local) filters.local = state.local;

  if (state.from || state.to) {
    filters.date_field = "book_date";
    if (state.from) filters.from = state.from;
    if (state.to) filters.to = dayEnd(state.to);
  }

  // The server filters `leadless`; Referral has no server filter and narrows the loaded pages (see below).
  if (state.type === "leadless") filters.leadless = true;
  else if (state.type === "lead") filters.leadless = false;

  if (state.binder !== "any") filters.binder_min = BINDER_MIN[state.binder];

  applySearch(filters, state.q);
  return filters;
}

/** Whether the type filter narrows the loaded cards in the browser (the server cannot filter Referral). */
export function bookingClientNarrowing(state: BookingFilterState): boolean {
  return state.type === "referral" || state.type === "lead";
}

/** The browser-side half of the booking type filter. Referral Bookings carry no lead, so "With lead" drops them. */
export function matchesBookingType(item: AdminRecord, type: BookingType): boolean {
  if (type === "referral") return item.is_referral_booking === true;
  if (type === "lead") return item.is_referral_booking !== true;
  return true;
}

/** The `fetchAdminList("cancelled-leads")` filters for a state (page 1; the caller sets `page`). */
export function cancellationListFilters(state: CancellationFilterState): SerializableFilters {
  const filters: SerializableFilters = { limit: BOOKINGS_PAGE_SIZE };

  if (state.sort === "cancel_asc") {
    filters.sort = "cancel_date";
    filters.direction = "asc";
  } else if (state.sort === "refund_desc") {
    filters.sort = "refund_amount";
    filters.direction = "desc";
  } else {
    filters.sort = "cancel_date";
    filters.direction = "desc";
  }

  if (state.reason) filters.reason = state.reason;
  if (state.source) filters.source = state.source;
  if (state.agent) filters.agent = state.agent;
  if (state.merchant) filters.merchant = state.merchant;
  if (state.by) filters.cancelled_by = state.by;

  if (state.from || state.to) {
    filters.date_field = "cancel_date";
    if (state.from) filters.from = state.from;
    if (state.to) filters.to = dayEnd(state.to);
  }

  // "Refunded" is a server range; "No refund" has no server filter and narrows the loaded pages.
  if (state.refund === "yes") filters.refund_min = 0.01;

  applySearch(filters, state.q);
  return filters;
}

/** "No refund" narrows the loaded cancellations in the browser. */
export function cancellationClientNarrowing(state: CancellationFilterState): boolean {
  return state.refund === "no";
}

export function matchesCancellationRefund(item: AdminRecord, refund: CancellationRefund): boolean {
  if (refund !== "no") return true;
  const amount = typeof item.refund_amount === "number" ? item.refund_amount : Number(item.refund_amount);
  return !Number.isFinite(amount) || amount <= 0;
}

/**
 * The list totals the server will add to every list response (doc 03 server work: one `$facet` over the same filter).
 * Until then every field is null and the summary cards say so; the loaded page is never summed as if it were the whole.
 */
export type ListTotals = {
  count: number | null;
  binder: number | null;
  deposit: number | null;
  refund: number | null;
  cancelled: number | null;
};

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reads the optional `totals` object of the last loaded page. Contract for B-series: `totals: { count,
 * total_binder_amount, total_deposit_amount, total_refund_amount, cancelled_count }`. The list's own `total` is the
 * count either way.
 */
export function readListTotals(page: { total?: number } | null | undefined): ListTotals {
  const totals = (page as { totals?: Record<string, unknown> } | null | undefined)?.totals;
  const source = totals && typeof totals === "object" ? totals : {};
  return {
    count: numberOrNull(page?.total) ?? numberOrNull(source.count),
    binder: numberOrNull(source.total_binder_amount),
    deposit: numberOrNull(source.total_deposit_amount),
    refund: numberOrNull(source.total_refund_amount),
    cancelled: numberOrNull(source.cancelled_count),
  };
}

const calendarMonthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const calendarMonthDayYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

function calendarDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "Oct 9" for a stored calendar date (`book_date`, `cancel_date`). Those store the Florida calendar day as UTC
 * midnight, so they are shown in UTC (a New York conversion would show the day before). The year appears when it
 * differs from `now`. Returns null for a missing or invalid value.
 */
export function formatCalendarDay(value: unknown, now = new Date()): string | null {
  const date = calendarDate(value);
  if (!date) return null;
  return date.getUTCFullYear() === now.getUTCFullYear() ? calendarMonthDay.format(date) : calendarMonthDayYear.format(date);
}

/** Whole calendar days from `from` to `to` (both stored calendar dates); null when either is missing. Never negative. */
export function daysBetween(from: unknown, to: unknown): number | null {
  const a = calendarDate(from);
  const b = calendarDate(to);
  if (!a || !b) return null;
  const startA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const startB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.round((startB - startA) / 86_400_000));
}
