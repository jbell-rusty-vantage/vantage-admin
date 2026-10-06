/**
 * The Leads workspace's client-side stand-in for the missing unified `GET /api/v1/admin/leads` (doc 03, server work).
 * Pure: the merge of the two paginated lists (form, call), the search classifier and the per-kind list filters.
 */
import type { AdminRecord } from "./admin";
import type { SerializableFilters } from "./filters";

export type LeadKind = "form" | "call";
export type LeadItem = AdminRecord & { __kind: LeadKind };
export type LeadSort = "received_desc" | "received_asc" | "move_soonest";
export type LeadStatus = "all" | "open" | "booked" | "cancelled" | "bad";
export type LeadShow = "regular" | "duplicates" | "both";
export type LeadDateField = "timestamp" | "move_date";

export const LEADS_PAGE_SIZE = 50;

export function tagLeadItems(items: readonly AdminRecord[], kind: LeadKind): LeadItem[] {
  return items.map((item) => ({ ...item, __kind: kind }));
}

function idOf(item: AdminRecord): string {
  const value = item._id ?? item.id;
  return typeof value === "string" ? value : "";
}

function instantMs(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

/** The ordering key of an item for a sort, or null when it has none (a missing move date sorts last). */
function sortKey(item: AdminRecord, sort: LeadSort): number | null {
  if (sort === "move_soonest") return instantMs(item.move_date);
  return instantMs(item.timestamp) ?? instantMs(item.createdAt);
}

/** Negative when `a` is shown before `b`. Ties break on `_id` (the same direction as the sort). */
export function compareLeads(a: AdminRecord, b: AdminRecord, sort: LeadSort): number {
  const ka = sortKey(a, sort);
  const kb = sortKey(b, sort);
  const ascending = sort !== "received_desc";
  if (ka !== kb) {
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ascending ? ka - kb : kb - ka;
  }
  if (sort === "move_soonest") {
    // Same move date (or both missing): newest received first.
    const ta = instantMs(a.timestamp) ?? 0;
    const tb = instantMs(b.timestamp) ?? 0;
    if (ta !== tb) return tb - ta;
  }
  const ia = idOf(a);
  const ib = idOf(b);
  if (ia === ib) return 0;
  const idOrder = ia < ib ? -1 : 1;
  return ascending ? idOrder : -idOrder;
}

/**
 * K-way merge of the loaded pages of the form and call lists, emitting only up to the **frontier**: the last loaded
 * item of the not-yet-exhausted list that ran out first. Anything after it could still be preceded by an unloaded item
 * of that list, so showing it would leave a gap. `frontier` names the list to fetch next. When both lists are
 * exhausted everything is emitted and `frontier` is null.
 */
export function mergeLeadPages(
  form: readonly LeadItem[],
  call: readonly LeadItem[],
  opts: { sort: LeadSort; formExhausted: boolean; callExhausted: boolean },
): { items: LeadItem[]; frontier: LeadKind | null } {
  const { sort } = opts;
  const byOrder = (a: LeadItem, b: LeadItem) => compareLeads(a, b, sort);
  const sortedForm = [...form].sort(byOrder);
  const sortedCall = [...call].sort(byOrder);
  const all = [...sortedForm, ...sortedCall].sort(byOrder);

  const boundaries: { kind: LeadKind; last: LeadItem | null }[] = [];
  if (!opts.formExhausted) boundaries.push({ kind: "form", last: sortedForm[sortedForm.length - 1] ?? null });
  if (!opts.callExhausted) boundaries.push({ kind: "call", last: sortedCall[sortedCall.length - 1] ?? null });
  if (boundaries.length === 0) return { items: all, frontier: null };

  // A list with nothing loaded yet has an unknown boundary: nothing can be shown before it is fetched.
  const unloaded = boundaries.find((entry) => entry.last === null);
  if (unloaded) return { items: [], frontier: unloaded.kind };

  let frontier = boundaries[0]!;
  for (const entry of boundaries.slice(1)) {
    if (compareLeads(entry.last!, frontier.last!, sort) < 0) frontier = entry;
  }
  const limit = frontier.last!;
  return { items: all.filter((item) => compareLeads(item, limit, sort) <= 0), frontier: frontier.kind };
}

export type LeadSearchKind = "job" | "phone" | "email" | "name";

/** Doc 03 search table: job number, phone, email, else name. */
export function classifyLeadSearch(text: string): { kind: LeadSearchKind; value: string } {
  const trimmed = text.trim();
  const job = /^(?:P|RF|DT)?\s*(\d{7})$/i.exec(trimmed);
  if (job) return { kind: "job", value: job[1]! };
  if (trimmed.includes("@")) return { kind: "email", value: trimmed };
  if (/^[\d\s().+-]+$/.test(trimmed)) {
    let digits = trimmed.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (digits.length >= 10) return { kind: "phone", value: digits };
  }
  return { kind: "name", value: trimmed };
}

/** The URL-level state the list filters are built from (see `components/leads/leads-url.ts`). */
export type LeadFilterState = {
  q: string | null;
  kind: LeadKind | null;
  show: LeadShow;
  status: LeadStatus;
  company: string | null;
  feed: string | null;
  agent: string | null;
  from: string | null;
  to: string | null;
  dateField: LeadDateField;
  sort: LeadSort;
  noSync: "any" | "yes" | "no";
  moveSize: string | null;
  local: string | null;
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Which lists a state needs. Filters that exist on one model only narrow the search to it. */
export function effectiveLeadKinds(state: LeadFilterState, feedChannel?: LeadKind | null): LeadKind[] {
  if (state.kind) return [state.kind];
  if (state.status === "bad" || state.moveSize) return ["form"];
  if (feedChannel) return [feedChannel];
  return ["form", "call"];
}

/** Statuses the server cannot filter; they narrow the loaded pages in the browser instead. */
export function leadClientNarrowing(state: LeadFilterState): { bad: boolean; unassigned: boolean } {
  return { bad: state.status === "bad", unassigned: state.agent === "unassigned" };
}

function dayEnd(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

/** The `fetchAdminList` filters for one kind (page 1; the caller sets `page`). */
export function leadListFilters(state: LeadFilterState, kind: LeadKind): SerializableFilters {
  const filters: SerializableFilters = { limit: LEADS_PAGE_SIZE };

  if (state.sort === "received_asc") {
    filters.sort = "timestamp";
    filters.direction = "asc";
  } else if (state.sort === "move_soonest" && kind === "form") {
    filters.sort = "move_date";
    filters.direction = "asc";
  } else {
    // Call leads have no move date to sort on; they fall back to newest first and merge last.
    filters.sort = "timestamp";
    filters.direction = "desc";
  }

  let dateField: LeadDateField = state.dateField;
  let from = state.from;
  if (kind === "form" && state.sort === "move_soonest" && !from && !state.to && state.dateField === "timestamp") {
    // Mongo sorts missing dates first ascending. A floor on move_date drops leads with no move date from the list.
    dateField = "move_date";
    from = "2000-01-01";
  }
  if (from || state.to) {
    filters.date_field = dateField;
    if (from) filters.from = from;
    if (state.to) filters.to = dayEnd(state.to);
  }

  if (state.show === "duplicates") filters.duplicate = true;
  else if (state.show === "regular") filters.duplicate = false;

  if (state.feed) filters.source_granularity_key = state.feed;
  else if (state.company) filters.source_company = state.company;

  if (state.agent && OBJECT_ID.test(state.agent)) filters.receiver_agent = state.agent;

  if (state.status === "open") {
    filters.booked = false;
    filters.cancelled = false;
  } else if (state.status === "booked") {
    filters.booked = true;
  } else if (state.status === "cancelled") {
    filters.cancelled = true;
  }

  if (state.noSync === "yes") filters.no_sync = true;
  else if (state.noSync === "no") filters.no_sync = false;

  if (kind === "form" && state.moveSize) filters.move_size = state.moveSize;
  if (state.local) filters.local = state.local;

  if (state.q?.trim()) {
    const search = classifyLeadSearch(state.q);
    if (search.kind === "job") {
      // The server does not search the job number on form leads (spec gap): `q` still reaches ref_no and lid.
      if (kind === "call") filters.job_no = search.value;
      else filters.q = search.value;
    } else if (search.kind === "phone") filters.phone_number = search.value;
    else if (search.kind === "email") filters.email = search.value;
    else filters.q = search.value;
  }

  return filters;
}
