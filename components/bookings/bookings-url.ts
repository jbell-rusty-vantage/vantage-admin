/**
 * `/bookings` URL state (doc 03): pure parse and build helpers. Absent keys are the defaults (Active, newest first).
 */
import type { BookingBinder, BookingFilterState, BookingSort, BookingStatus, BookingType } from "@/lib/api/bookings";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";

export type BookingsUrlState = BookingFilterState & {
  record: string | null;
  panel: string | null;
  connect: boolean;
};

type Source = URLSearchParams | { get(name: string): string | null };

function text(source: Source, key: string): string | null {
  const value = source.get(key)?.trim();
  return value ? value : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

const SORT_KEY: Record<BookingSort, string | null> = { book_desc: null, book_asc: "book_asc", binder_desc: "binder_desc" };

export function parseBookingsUrl(source: Source): BookingsUrlState {
  return {
    q: text(source, "q"),
    status: oneOf<BookingStatus>(text(source, "status"), ["cancelled", "all"]) ?? "active",
    source: text(source, "source"),
    agent: text(source, "agent"),
    merchant: text(source, "merchant"),
    from: text(source, "from"),
    to: text(source, "to"),
    type: oneOf<BookingType>(text(source, "type"), ["lead", "leadless", "referral"]) ?? "any",
    local: text(source, "local"),
    binder: oneOf<BookingBinder>(text(source, "binder"), ["2k", "4k"]) ?? "any",
    sort: oneOf<BookingSort>(text(source, "sort"), ["book_asc", "binder_desc"]) ?? "book_desc",
    record: text(source, "record"),
    panel: text(source, "panel"),
    connect: text(source, "connect") === "1",
  };
}

/** A partial state patch to the URL keys it changes. Defaults serialise to a removed key. */
export function bookingsUrlUpdate(patch: Partial<BookingsUrlState>): UrlStateUpdate {
  const out: UrlStateUpdate = {};
  const has = (key: keyof BookingsUrlState) => Object.prototype.hasOwnProperty.call(patch, key);
  if (has("q")) out.q = patch.q ?? null;
  if (has("status")) out.status = patch.status && patch.status !== "active" ? patch.status : null;
  if (has("source")) out.source = patch.source ?? null;
  if (has("agent")) out.agent = patch.agent ?? null;
  if (has("merchant")) out.merchant = patch.merchant ?? null;
  if (has("from")) out.from = patch.from ?? null;
  if (has("to")) out.to = patch.to ?? null;
  if (has("type")) out.type = patch.type && patch.type !== "any" ? patch.type : null;
  if (has("local")) out.local = patch.local ?? null;
  if (has("binder")) out.binder = patch.binder && patch.binder !== "any" ? patch.binder : null;
  if (has("sort")) out.sort = patch.sort ? SORT_KEY[patch.sort] : null;
  if (has("record")) out.record = patch.record ?? null;
  if (has("panel")) out.panel = patch.panel ?? null;
  if (has("connect")) out.connect = patch.connect ? "1" : null;
  return out;
}

/** The patch that clears every filter and the search but keeps sort and the open panel. */
export const CLEAR_ALL: Partial<BookingsUrlState> = {
  q: null,
  status: "active",
  source: null,
  agent: null,
  merchant: null,
  from: null,
  to: null,
  type: "any",
  local: null,
  binder: "any",
};

export type ActiveBookingFilter = { key: string; label: string; clear: Partial<BookingsUrlState> };

/**
 * The removable chips for the active filters. Status Active is the default, so it shows no chip. `labels` resolves
 * a source value or a local value to its Owner label.
 */
export function activeBookingFilters(
  state: BookingsUrlState,
  labels: { source?: (value: string) => string | undefined; local?: (value: string) => string | undefined } = {},
): ActiveBookingFilter[] {
  const chips: ActiveBookingFilter[] = [];
  if (state.status !== "active") chips.push({ key: "status", label: state.status === "cancelled" ? "Cancelled" : "Active and cancelled", clear: { status: "active" } });
  if (state.source) chips.push({ key: "source", label: labels.source?.(state.source) ?? state.source, clear: { source: null } });
  if (state.agent) chips.push({ key: "agent", label: state.agent, clear: { agent: null } });
  if (state.merchant) chips.push({ key: "merchant", label: state.merchant, clear: { merchant: null } });
  if (state.from || state.to) {
    const range = state.from && state.to ? `${state.from} to ${state.to}` : state.from ? `from ${state.from}` : `to ${state.to}`;
    chips.push({ key: "date", label: `Booked ${range}`, clear: { from: null, to: null } });
  }
  if (state.type !== "any") {
    const label = { lead: "With lead", leadless: "Leadless", referral: "Referral", any: "" }[state.type];
    chips.push({ key: "type", label, clear: { type: "any" } });
  }
  if (state.local) chips.push({ key: "local", label: labels.local?.(state.local) ?? state.local, clear: { local: null } });
  if (state.binder !== "any") chips.push({ key: "binder", label: state.binder === "2k" ? "Binder over $2k" : "Binder over $4k", clear: { binder: "any" } });
  return chips;
}
