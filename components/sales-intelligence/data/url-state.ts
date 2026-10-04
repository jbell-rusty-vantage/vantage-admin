/**
 * The Sales Intelligence URL, pure (the hook lives in use-url-state.ts). The interim page has two views: Numbers (the
 * default, written as no `view`) and RingCentral Accounts (`view=reps`). The URL is the whole request: the Numbers
 * search, filters, sort and keyset page, the open Number, and the Accounts directory page.
 *
 * `canonicalSiQuery` keeps only the keys the current view owns, with valid values, in a fixed order. Everything else
 * (old Outreach, Attention, Closed, Overview, Coverage and Guide views, `outreach=`/`lead=`/`panel=` deep links, old
 * desk filters, `database_scope`) is dropped, so an old link opens Numbers. Old OutreachRecord ids are never mapped.
 */
import { NUMBER_SORTS, type NumberSort } from "@/lib/api/salesIntelligence";
import { readList } from "../lib/filter-state";

export const SI_VIEWS = ["numbers", "reps"] as const;
export type SiView = (typeof SI_VIEWS)[number];
export const DEFAULT_VIEW: SiView = "numbers";

export const NUMBER_CLASSIFICATIONS = ["unknown", "customer", "company", "non_customer"] as const;
export const NUMBER_ATTACHMENTS = ["any", "linked", "unlinked"] as const;
export type NumberAttachmentFilter = (typeof NUMBER_ATTACHMENTS)[number];
export const NUMBER_SORT_DEFAULT: { sort: NumberSort; direction: "asc" | "desc" } = { sort: "last_activity", direction: "desc" };

export type SiUrlState = {
  view: SiView;
  /** Numbers. */
  q: string | null;
  classification: string[];
  attachment: NumberAttachmentFilter;
  hygiene: boolean;
  has_recording: boolean;
  include_form_only: boolean;
  active_from: string | null;
  active_to: string | null;
  sort: NumberSort;
  direction: "asc" | "desc";
  /** The keyset cursor of the page shown, and the cursors of the pages before it (for Previous). */
  cursor: string | null;
  before: string[];
  /** The open Number (its detail dialog). */
  number: string | null;
  /** RingCentral Accounts: the directory page. */
  directory_cursor: string | null;
};
export type SiUrlPatch = Partial<SiUrlState>;

const OBJECT_ID = /^[a-f\d]{24}$/i;
const text = (value: string | null, max: number): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
};
/** The server takes only a Z-suffixed ISO instant, so any readable date is normalized to one (and the route redirects). */
const instant = (value: string | null): string | null => (value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null);
const cursorText = (value: string | null): string | null => (value && value.length <= 2000 ? value : null);

export function parseSiUrl(params: URLSearchParams): SiUrlState {
  const view = params.get("view") === "reps" ? "reps" : DEFAULT_VIEW;
  const sort = (NUMBER_SORTS as readonly string[]).includes(params.get("sort") ?? "") ? (params.get("sort") as NumberSort) : NUMBER_SORT_DEFAULT.sort;
  const direction = params.get("direction") === "asc" ? "asc" : params.get("direction") === "desc" ? "desc" : NUMBER_SORT_DEFAULT.direction;
  const attachment = params.get("attachment");
  // Numbers is written with no `view`, so a `cursor` beside any other view comes from an old desk link (its All
  // Outreach or Closed keyset cursor) and would be rejected by `GET /numbers`: such a link opens Numbers at page one.
  const legacyView = params.has("view") && params.get("view") !== "reps";
  const cursor = legacyView ? null : cursorText(params.get("cursor"));
  return {
    view,
    q: text(params.get("q"), 200),
    classification: [...new Set(readList(params, "classification").filter((value) => (NUMBER_CLASSIFICATIONS as readonly string[]).includes(value)))],
    attachment: attachment === "linked" || attachment === "unlinked" ? attachment : "any",
    hygiene: params.get("hygiene") === "true",
    has_recording: params.get("has_recording") === "true",
    include_form_only: params.get("include_form_only") === "true",
    active_from: instant(params.get("active_from")),
    active_to: instant(params.get("active_to")),
    sort,
    direction,
    cursor,
    before: cursor ? params.getAll("before").filter((value) => cursorText(value) !== null) : [],
    number: OBJECT_ID.test(params.get("number") ?? "") ? params.get("number") : null,
    directory_cursor: cursorText(params.get("directory_cursor")),
  };
}

/** The state as a query: the current view's keys only, defaults omitted, in a fixed order. */
export function serializeSiUrl(state: SiUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view === "reps") {
    params.set("view", "reps");
    if (state.directory_cursor) params.set("directory_cursor", state.directory_cursor);
    return params;
  }
  if (state.q) params.set("q", state.q);
  for (const value of state.classification) params.append("classification", value);
  if (state.attachment !== "any") params.set("attachment", state.attachment);
  if (state.hygiene) params.set("hygiene", "true");
  if (state.has_recording) params.set("has_recording", "true");
  if (state.include_form_only) params.set("include_form_only", "true");
  if (state.active_from) params.set("active_from", state.active_from);
  if (state.active_to) params.set("active_to", state.active_to);
  if (state.sort !== NUMBER_SORT_DEFAULT.sort || state.direction !== NUMBER_SORT_DEFAULT.direction) {
    params.set("sort", state.sort);
    params.set("direction", state.direction);
  }
  if (state.cursor) {
    params.set("cursor", state.cursor);
    for (const value of state.before) params.append("before", value);
  }
  if (state.number) params.set("number", state.number);
  return params;
}

/** The canonical query for any incoming query (idempotent). The route redirects when they differ. */
export function canonicalSiQuery(params: URLSearchParams): URLSearchParams {
  return serializeSiUrl(parseSiUrl(params));
}

/** Changing any of these restarts paging (the cursor belongs to the old request). */
const RESETS_PAGING: readonly (keyof SiUrlState)[] = ["view", "q", "classification", "attachment", "hygiene", "has_recording", "include_form_only", "active_from", "active_to", "sort", "direction"];

/** Applies a patch; a request change drops the Numbers cursor, and a view change also closes the open Number. */
export function siUrlUpdate(current: URLSearchParams | string, patch: SiUrlPatch): URLSearchParams {
  const before = parseSiUrl(new URLSearchParams(current));
  const next: SiUrlState = { ...before, ...patch };
  const changed = (key: keyof SiUrlState) => key in patch && JSON.stringify(patch[key]) !== JSON.stringify(before[key]);
  if (RESETS_PAGING.some(changed) && !("cursor" in patch)) {
    next.cursor = null;
    next.before = [];
  }
  if (changed("view") && !("number" in patch)) next.number = null;
  return serializeSiUrl(next);
}

/** A filter reset for Numbers that keeps the search and the sort. */
export function clearNumberFilters(): SiUrlPatch {
  return { classification: [], attachment: "any", hygiene: false, has_recording: false, include_form_only: false, active_from: null, active_to: null };
}

/** `GET /numbers` for the URL state (the server's strict query: only these keys). */
export function numbersQuery(state: SiUrlState, limit: number): URLSearchParams {
  const query = new URLSearchParams({ limit: String(limit) });
  if (state.q) query.set("q", state.q);
  for (const value of state.classification) query.append("classification", value);
  if (state.attachment !== "any") query.set("attachment", state.attachment);
  if (state.hygiene) query.set("hygiene", "true");
  if (state.has_recording) query.set("has_recording", "true");
  if (state.include_form_only) query.set("include_form_only", "true");
  if (state.active_from) query.set("active_from", state.active_from);
  if (state.active_to) query.set("active_to", state.active_to);
  query.set("sort", state.sort);
  query.set("direction", state.direction);
  if (state.cursor) query.set("cursor", state.cursor);
  return query;
}
