/**
 * UI1-DATA: the desk's URL state, pure (the hook lives in use-url-state.ts). The URL is the whole request:
 * view, sort, direction, every rail filter, the Priority preset, the Lead toggle, search, and the Overview
 * period. Multi-values are written **repeated** (`priority=0&priority=not_set`) and read repeated or
 * comma-separated; the bracket form is never written. Any filter, sort, view or search change drops the
 * list cursor. Old deep links (`lead`, `lead_model`, `outreach`, `si_return`, `panel`, `analysis_run`,
 * ADMIN-REBUILD traps 4–5) and every key this module doesn't own are carried through untouched.
 */
import {
  DESK_SORTS, CLOSED_SORTS, CLOSED_DEFAULT_SORT, CLOSED_SORT_DEFAULT_DIRECTION, DESK_SORT_DEFAULT_DIRECTION, DESK_DEFAULT_SORT, isScoreSort,
  type DeskSort, type ClosedSort,
} from "@/lib/api/salesIntelligence";
import { readList, writeList } from "../lib/filter-state";
import type { AttentionParams, ClosedHistoryParams, DeskView, OverviewParams } from "./requests";

export const PAGE_VIEWS = ["overview", "attention", "all_outreach", "closed", "reps", "coverage", "guide"] as const;
export type PageView = (typeof PAGE_VIEWS)[number];
/** UI-1 §1.1: the page opens on Overview when `view` is absent. An unknown view reads as Overview too. */
export const DEFAULT_VIEW: PageView = "overview";

export type DeskUrlState = {
  view: PageView;
  sort: string | null;
  direction: "asc" | "desc" | null;
  band: string[];
  needs_review: boolean;
  state: string[];
  agent_id: string[];
  unassigned: boolean;
  priority: string[];
  attachment: "lead" | "none" | null;
  has_recording: boolean;
  has_assessment: boolean;
  newer_call: boolean;
  ti_min: number | null;
  ml_min: number | null;
  received_from: string | null;
  received_to: string | null;
  move_date_within: number | null;
  move_date_passed: boolean;
  outcome: string[];
  closed_from: string | null;
  closed_to: string | null;
  freshness: "fresh" | null;
  q: string | null;
  period: string | null;
  from: string | null;
  to: string | null;
  /** Old deep links, read-only here: they open Needs Attention with that record's side dialog. */
  lead: string | null;
  lead_model: string | null;
  outreach: string | null;
};
export type DeskUrlPatch = Partial<Omit<DeskUrlState, "lead" | "lead_model" | "outreach">> & { lead?: string | null; lead_model?: string | null; outreach?: string | null };

const LIST_KEYS = ["band", "state", "agent_id", "priority", "outcome"] as const;
const BOOL_KEYS = ["needs_review", "unassigned", "has_recording", "has_assessment", "newer_call", "move_date_passed"] as const;
const NUM_KEYS = ["ti_min", "ml_min", "move_date_within"] as const;
const TEXT_KEYS = ["received_from", "received_to", "closed_from", "closed_to", "q", "period", "from", "to", "lead", "lead_model", "outreach"] as const;
/** A change to any of these restarts paging (the cursor belongs to the old request). */
export const RESETS_CURSOR: readonly string[] = ["view", "sort", "direction", "freshness", "attachment", ...LIST_KEYS, ...BOOL_KEYS, ...NUM_KEYS,
  "received_from", "received_to", "closed_from", "closed_to", "q", "period", "from", "to"];
export const CURSOR_KEYS = ["cursor", "attention_cursor"] as const;

const num = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const text = (value: string | null): string | null => (value && value.trim() ? value : null);

export function parseDeskUrl(params: URLSearchParams): DeskUrlState {
  const view = params.get("view");
  const direction = params.get("direction");
  const attachment = params.get("attachment");
  return {
    view: (PAGE_VIEWS as readonly string[]).includes(view ?? "") ? (view as PageView) : DEFAULT_VIEW,
    sort: text(params.get("sort")),
    direction: direction === "asc" || direction === "desc" ? direction : null,
    band: readList(params, "band"), state: readList(params, "state"), agent_id: readList(params, "agent_id"),
    priority: readList(params, "priority"), outcome: readList(params, "outcome"),
    needs_review: params.get("needs_review") === "true", unassigned: params.get("unassigned") === "true",
    has_recording: params.get("has_recording") === "true", has_assessment: params.get("has_assessment") === "true",
    newer_call: params.get("newer_call") === "true", move_date_passed: params.get("move_date_passed") === "true",
    attachment: attachment === "lead" || attachment === "none" ? attachment : null,
    ti_min: num(params.get("ti_min")), ml_min: num(params.get("ml_min")), move_date_within: num(params.get("move_date_within")),
    received_from: text(params.get("received_from")), received_to: text(params.get("received_to")),
    closed_from: text(params.get("closed_from")), closed_to: text(params.get("closed_to")),
    freshness: params.get("freshness") === "fresh" ? "fresh" : null,
    q: text(params.get("q")), period: text(params.get("period")), from: text(params.get("from")), to: text(params.get("to")),
    lead: text(params.get("lead")), lead_model: text(params.get("lead_model")), outreach: text(params.get("outreach")),
  };
}

function write(params: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) { writeList(params, key, value as string[]); return; }
  if (value === null || value === undefined || value === false || value === "") { params.delete(key); return; }
  params.set(key, value === true ? "true" : String(value));
}

/**
 * Applies a patch to the current query. Keys not in the patch (and keys this module doesn't own) are kept.
 * - Any change to a key in RESETS_CURSOR drops the list cursor.
 * - A new `sort` without a `direction` drops the direction, so the sort's default applies.
 * - A new `view` without a `sort` drops sort and direction (each view has its own default and sort list).
 */
export function deskUrlUpdate(current: URLSearchParams | string, patch: DeskUrlPatch): URLSearchParams {
  const params = new URLSearchParams(current);
  const before = parseDeskUrl(params);
  const next: DeskUrlPatch = { ...patch };
  if ("view" in patch && patch.view !== before.view && !("sort" in patch)) { next.sort = null; next.direction = null; }
  if ("sort" in patch && patch.sort !== before.sort && !("direction" in patch)) next.direction = null;
  let reset = false;
  for (const [key, value] of Object.entries(next)) {
    const was = params.getAll(key).join("\u0000");
    write(params, key, key === "view" && value === DEFAULT_VIEW ? null : value);
    if (RESETS_CURSOR.includes(key) && params.getAll(key).join("\u0000") !== was) reset = true;
  }
  if (reset) for (const key of CURSOR_KEYS) params.delete(key);
  return params;
}

/** The whole state as a query, owned keys only, in a fixed order (for links built from state). */
export function serializeDeskUrl(state: Partial<DeskUrlState>): URLSearchParams {
  const params = new URLSearchParams();
  const order = ["view", "sort", "direction", ...LIST_KEYS, ...BOOL_KEYS, "attachment", ...NUM_KEYS, "freshness", ...TEXT_KEYS] as const;
  for (const key of order) if (key in state) write(params, key, key === "view" && state.view === DEFAULT_VIEW ? null : state[key as keyof DeskUrlState]);
  return params;
}

export function isDeskView(view: PageView): view is DeskView { return view === "attention" || view === "all_outreach" || view === "closed"; }

/** The sort the server is asked for in a view: a valid URL sort, else the view's default (Closed has its own list). */
export function effectiveSort(view: DeskView, sort: string | null): { sort: DeskSort | ClosedSort; direction: "asc" | "desc" } & { closed: boolean } {
  if (view === "closed") {
    const chosen = (CLOSED_SORTS as readonly string[]).includes(sort ?? "") ? (sort as ClosedSort) : CLOSED_DEFAULT_SORT;
    return { sort: chosen, direction: CLOSED_SORT_DEFAULT_DIRECTION[chosen], closed: true };
  }
  const chosen = (DESK_SORTS as readonly string[]).includes(sort ?? "") ? (sort as DeskSort) : DESK_DEFAULT_SORT;
  return { sort: chosen, direction: DESK_SORT_DEFAULT_DIRECTION[chosen], closed: false };
}

/** `GET /attention` params for a desk view. Closed-only params go only to Closed; `freshness` only with a score sort. */
export function attentionParamsFromDesk(state: DeskUrlState, view: DeskView): AttentionParams {
  const { sort, direction: fallback } = effectiveSort(view, state.sort);
  const closed = view === "closed";
  return {
    view, sort, direction: state.direction ?? fallback,
    band: closed ? [] : state.band, needs_review: state.needs_review, state: state.state, agent_id: state.agent_id, unassigned: state.unassigned,
    priority: state.priority, attachment: state.attachment,
    has_recording: state.has_recording, has_assessment: state.has_assessment, newer_call: state.newer_call,
    ti_min: state.ti_min, ml_min: state.ml_min, received_from: state.received_from, received_to: state.received_to,
    move_date_within: state.move_date_within, move_date_passed: state.move_date_passed,
    outcome: closed ? state.outcome : [], closed_from: closed ? state.closed_from : null, closed_to: closed ? state.closed_to : null,
    freshness: !closed && isScoreSort(sort) && state.freshness === "fresh" ? "fresh" : null,
    q: state.q,
  };
}

export function overviewParamsFromDesk(state: DeskUrlState): OverviewParams {
  return { period: state.period, from: state.from, to: state.to, priority: state.priority };
}

/** Closed history takes the Closed view's outcome / Priority / rep filters (E27). */
export function closedHistoryParamsFromDesk(state: DeskUrlState): ClosedHistoryParams {
  return { outcome: state.outcome, priority: state.priority, agent_id: state.agent_id, closed_from: state.closed_from, q: state.q };
}

/** Trap 4: `?view=attention&lead=&lead_model=` (and `outreach=`) opens Needs Attention with that record's side dialog. */
export function deepLinkTarget(state: DeskUrlState): { kind: "outreach"; id: string } | { kind: "lead"; model: string; id: string } | null {
  if (state.outreach) return { kind: "outreach", id: state.outreach };
  if (state.lead && state.lead_model) return { kind: "lead", model: state.lead_model, id: state.lead };
  return null;
}
