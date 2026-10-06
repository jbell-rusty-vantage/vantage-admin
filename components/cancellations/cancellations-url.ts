/**
 * `/bookings/cancellations` URL state (doc 03): pure parse and build helpers. Absent keys are the defaults (newest
 * cancel date first, any refund). `record` opens the cancellation's own panel (the fallback for a cancellation whose
 * booking is not on the payload); `panel` picks its tab.
 */
import type { CancellationFilterState, CancellationRefund, CancellationSort } from "@/lib/api/bookings";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";

export type CancellationsUrlState = CancellationFilterState & {
  record: string | null;
  panel: string | null;
};

type Source = URLSearchParams | { get(name: string): string | null };

function text(source: Source, key: string): string | null {
  const value = source.get(key)?.trim();
  return value ? value : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

const SORT_KEY: Record<CancellationSort, string | null> = { cancel_desc: null, cancel_asc: "cancel_asc", refund_desc: "refund_desc" };

export function parseCancellationsUrl(source: Source): CancellationsUrlState {
  return {
    q: text(source, "q"),
    reason: text(source, "reason"),
    source: text(source, "source"),
    agent: text(source, "agent"),
    merchant: text(source, "merchant"),
    from: text(source, "from"),
    to: text(source, "to"),
    refund: oneOf<CancellationRefund>(text(source, "refund"), ["yes", "no"]) ?? "any",
    by: text(source, "by"),
    sort: oneOf<CancellationSort>(text(source, "sort"), ["cancel_asc", "refund_desc"]) ?? "cancel_desc",
    record: text(source, "record"),
    panel: text(source, "panel"),
  };
}

/** A partial state patch to the URL keys it changes. Defaults serialise to a removed key. */
export function cancellationsUrlUpdate(patch: Partial<CancellationsUrlState>): UrlStateUpdate {
  const out: UrlStateUpdate = {};
  const has = (key: keyof CancellationsUrlState) => Object.prototype.hasOwnProperty.call(patch, key);
  if (has("q")) out.q = patch.q ?? null;
  if (has("reason")) out.reason = patch.reason ?? null;
  if (has("source")) out.source = patch.source ?? null;
  if (has("agent")) out.agent = patch.agent ?? null;
  if (has("merchant")) out.merchant = patch.merchant ?? null;
  if (has("from")) out.from = patch.from ?? null;
  if (has("to")) out.to = patch.to ?? null;
  if (has("refund")) out.refund = patch.refund && patch.refund !== "any" ? patch.refund : null;
  if (has("by")) out.by = patch.by ?? null;
  if (has("sort")) out.sort = patch.sort ? SORT_KEY[patch.sort] : null;
  if (has("record")) out.record = patch.record ?? null;
  if (has("panel")) out.panel = patch.panel ?? null;
  return out;
}

/** The patch that clears every filter and the search but keeps sort and the open panel. */
export const CLEAR_ALL: Partial<CancellationsUrlState> = {
  q: null,
  reason: null,
  source: null,
  agent: null,
  merchant: null,
  from: null,
  to: null,
  refund: "any",
  by: null,
};

export type ActiveCancellationFilter = { key: string; label: string; clear: Partial<CancellationsUrlState> };

/** The removable chips for the active filters. `labels` resolves a reason or source value to its Owner label. */
export function activeCancellationFilters(
  state: CancellationsUrlState,
  labels: { reason?: (value: string) => string | undefined; source?: (value: string) => string | undefined } = {},
): ActiveCancellationFilter[] {
  const chips: ActiveCancellationFilter[] = [];
  if (state.reason) chips.push({ key: "reason", label: labels.reason?.(state.reason) ?? state.reason, clear: { reason: null } });
  if (state.source) chips.push({ key: "source", label: labels.source?.(state.source) ?? state.source, clear: { source: null } });
  if (state.agent) chips.push({ key: "agent", label: state.agent, clear: { agent: null } });
  if (state.merchant) chips.push({ key: "merchant", label: state.merchant, clear: { merchant: null } });
  if (state.from || state.to) {
    const range = state.from && state.to ? `${state.from} to ${state.to}` : state.from ? `from ${state.from}` : `to ${state.to}`;
    chips.push({ key: "date", label: `Cancelled ${range}`, clear: { from: null, to: null } });
  }
  if (state.refund !== "any") chips.push({ key: "refund", label: state.refund === "yes" ? "Refunded" : "No refund", clear: { refund: "any" } });
  if (state.by) chips.push({ key: "by", label: `By ${state.by}`, clear: { by: null } });
  return chips;
}
