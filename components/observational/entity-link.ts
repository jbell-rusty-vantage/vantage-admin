/**
 * Pure helpers for the Observational tab: business-record deep links, label
 * humanization, and inclusive date-range handling. Kept free of React/browser
 * imports so they are unit-testable under the Node test runner.
 */

/**
 * Maps an operational event/incident `entity_type` to a dashboard route.
 * Detail pages do not exist for every model, so links open the owning list
 * page with the record preselected (`?record=<id>`), matching global search.
 */
export function entityHref(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityType || !entityId) {
    return null;
  }

  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case "form_lead":
      return `/form-leads?record=${id}`;
    case "call_lead":
      return `/call-leads?record=${id}`;
    case "booked_lead":
      return `/bookings?record=${id}`;
    case "cancelled_lead":
      return `/cancellations?record=${id}`;
    case "customer":
      return `/customers?record=${id}`;
    case "agent":
      return `/agents?record=${id}`;
    case "sheet_sync_job":
      return `/observational?tab=sheet-sync&job_id=${id}`;
    case "sheet_sync_run":
      return `/observational?tab=sheet-sync&run_id=${id}`;
    default:
      return null;
  }
}

/** "sheet_sync.drain.failed" -> "Sheet Sync Drain Failed"; "lead" -> "Lead". */
export function humanizeKey(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * The backend filters with exclusive `occurred_at < to`. Date-only inputs
 * ("2026-06-12") coerce to midnight UTC, which would exclude the selected
 * day entirely, so date-only `to` values are advanced by one day. Full ISO
 * timestamps pass through untouched.
 */
export function exclusiveEndDate(to?: string): string | undefined {
  if (!to) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return to;
  }
  const date = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return to;
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Picks only the listed keys from URL-derived table state, dropping empty
 * values and UI-only params (`tab`, `record`). Applies the exclusive-end
 * adjustment to `to` when requested.
 */
export function pickApiFilters(
  filters: Record<string, unknown>,
  keys: readonly string[],
  options: { exclusiveTo?: boolean } = { exclusiveTo: true },
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  if (options.exclusiveTo && typeof out.to === "string") {
    const adjusted = exclusiveEndDate(out.to);
    if (adjusted) {
      out.to = adjusted;
    }
  }
  return out;
}

export function formatDurationMs(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "-";
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${Math.floor(minutes)}m ${Math.round(seconds % 60)}s`;
  }
  const hours = minutes / 60;
  return `${Math.floor(hours)}h ${Math.round(minutes % 60)}m`;
}
