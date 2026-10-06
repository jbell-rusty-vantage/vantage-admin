/**
 * `/leads` URL state (doc 03): pure parse and build helpers. Absent keys are the defaults (regular, newest first).
 */
import type { LeadDateField, LeadFilterState, LeadKind, LeadShow, LeadSort, LeadStatus } from "@/lib/api/leads";
import type { UrlStateUpdate } from "@/lib/api/url-state-update";

export type LeadsUrlState = LeadFilterState & {
  lead: string | null;
  lk: LeadKind | null;
  panel: string | null;
  isNew: boolean;
};

type Source = URLSearchParams | { get(name: string): string | null };

function text(source: Source, key: string): string | null {
  const value = source.get(key)?.trim();
  return value ? value : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseLeadsUrl(source: Source): LeadsUrlState {
  const noSyncRaw = text(source, "no_sync");
  return {
    q: text(source, "q"),
    kind: oneOf<LeadKind>(text(source, "kind"), ["form", "call"]),
    show: oneOf<LeadShow>(text(source, "show"), ["duplicates", "both"]) ?? "regular",
    status: oneOf<LeadStatus>(text(source, "status"), ["open", "booked", "cancelled", "bad"]) ?? "all",
    company: text(source, "company"),
    feed: text(source, "feed"),
    agent: text(source, "agent"),
    from: text(source, "from"),
    to: text(source, "to"),
    dateField: oneOf<LeadDateField>(text(source, "date_field"), ["move_date"]) ?? "timestamp",
    sort: oneOf<LeadSort>(text(source, "sort"), ["received_asc", "move_soonest"]) ?? "received_desc",
    noSync: noSyncRaw === "true" ? "yes" : noSyncRaw === "false" ? "no" : "any",
    moveSize: text(source, "move_size"),
    local: text(source, "local"),
    lead: text(source, "lead"),
    lk: oneOf<LeadKind>(text(source, "lk"), ["form", "call"]),
    panel: text(source, "panel"),
    isNew: text(source, "new") === "1",
  };
}

/** A partial state patch to the URL keys it changes. Defaults serialise to a removed key. */
export function leadsUrlUpdate(patch: Partial<LeadsUrlState>): UrlStateUpdate {
  const out: UrlStateUpdate = {};
  const has = (key: keyof LeadsUrlState) => Object.prototype.hasOwnProperty.call(patch, key);
  if (has("q")) out.q = patch.q ?? null;
  if (has("kind")) out.kind = patch.kind ?? null;
  if (has("show")) out.show = patch.show && patch.show !== "regular" ? patch.show : null;
  if (has("status")) out.status = patch.status && patch.status !== "all" ? patch.status : null;
  if (has("company")) out.company = patch.company ?? null;
  if (has("feed")) out.feed = patch.feed ?? null;
  if (has("agent")) out.agent = patch.agent ?? null;
  if (has("from")) out.from = patch.from ?? null;
  if (has("to")) out.to = patch.to ?? null;
  if (has("dateField")) out.date_field = patch.dateField && patch.dateField !== "timestamp" ? patch.dateField : null;
  if (has("sort")) out.sort = patch.sort && patch.sort !== "received_desc" ? patch.sort : null;
  if (has("noSync")) out.no_sync = patch.noSync === "yes" ? "true" : patch.noSync === "no" ? "false" : null;
  if (has("moveSize")) out.move_size = patch.moveSize ?? null;
  if (has("local")) out.local = patch.local ?? null;
  if (has("lead")) out.lead = patch.lead ?? null;
  if (has("lk")) out.lk = patch.lk ?? null;
  if (has("panel")) out.panel = patch.panel ?? null;
  if (has("isNew")) out.new = patch.isNew ? "1" : null;
  return out;
}

/** The patch that clears every filter and the search but keeps sort, the open panel and the New lead sheet. */
export const CLEAR_ALL_FILTERS: Partial<LeadsUrlState> = {
  q: null,
  kind: null,
  show: "regular",
  status: "all",
  company: null,
  feed: null,
  agent: null,
  from: null,
  to: null,
  dateField: "timestamp",
  noSync: "any",
  moveSize: null,
  local: null,
};

export type ActiveLeadFilter = { key: string; label: string; clear: Partial<LeadsUrlState> };

/** The removable chips for the active filters. `labels` resolves ids and slugs to Owner labels. */
export function activeLeadFilters(
  state: LeadsUrlState,
  labels: {
    company?: (slug: string) => string | undefined;
    feed?: (key: string) => string | undefined;
    agent?: (id: string) => string | undefined;
    moveSize?: (value: string) => string | undefined;
    local?: (value: string) => string | undefined;
  } = {},
): ActiveLeadFilter[] {
  const chips: ActiveLeadFilter[] = [];
  if (state.kind) chips.push({ key: "kind", label: state.kind === "form" ? "Form leads" : "Call leads", clear: { kind: null } });
  if (state.status !== "all") {
    const label = { open: "Open", booked: "Booked", cancelled: "Cancelled", bad: "Bad", all: "" }[state.status];
    chips.push({ key: "status", label, clear: { status: "all" } });
  }
  if (state.company) chips.push({ key: "company", label: labels.company?.(state.company) ?? state.company, clear: { company: null, feed: null } });
  if (state.feed) chips.push({ key: "feed", label: labels.feed?.(state.feed) ?? state.feed, clear: { feed: null } });
  if (state.agent) {
    const label = state.agent === "unassigned" ? "Unassigned" : (labels.agent?.(state.agent) ?? "Agent");
    chips.push({ key: "agent", label, clear: { agent: null } });
  }
  if (state.show !== "regular") chips.push({ key: "show", label: state.show === "duplicates" ? "Duplicates" : "Regular and duplicates", clear: { show: "regular" } });
  if (state.from || state.to) {
    const field = state.dateField === "move_date" ? "Move date" : "Received";
    const range = state.from && state.to ? `${state.from} to ${state.to}` : state.from ? `from ${state.from}` : `to ${state.to}`;
    chips.push({ key: "date", label: `${field} ${range}`, clear: { from: null, to: null, dateField: "timestamp" } });
  }
  if (state.noSync !== "any") chips.push({ key: "no_sync", label: state.noSync === "yes" ? "Hidden from sheets" : "Not hidden from sheets", clear: { noSync: "any" } });
  if (state.moveSize) chips.push({ key: "move_size", label: labels.moveSize?.(state.moveSize) ?? state.moveSize, clear: { moveSize: null } });
  if (state.local) chips.push({ key: "local", label: labels.local?.(state.local) ?? state.local, clear: { local: null } });
  return chips;
}

/** True when a filter other than the search box narrows the list. */
export function hasActiveLeadFilters(state: LeadsUrlState): boolean {
  return activeLeadFilters(state).length > 0;
}
