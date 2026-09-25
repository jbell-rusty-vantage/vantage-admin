/**
 * UI1-DATA: request shapes for every UI-1 read, and their serialization. Pure (no React), so the query
 * keys, the hooks and the URL state all build the same string. Multi-values are sent **repeated**
 * (`priority=0&priority=not_set`), never `priority[]=`: the server's `/attention` schema is strict and
 * answers 400 to the bracket form (S2 CONTRACT "Query encoding"). Only the timeline routes accept
 * `kinds[]`, and they accept the repeated form too, so repeated is used everywhere.
 */
import { LIST_PAGE_SIZE } from "../lib/paging";

export type DeskView = "attention" | "all_outreach" | "closed";
/** `GET /attention` params (S2). Closed-only params (`outcome`, `closed_from`, `closed_to`) are sent only with `view=closed`. */
export type AttentionParams = {
  view: DeskView;
  sort?: string | null;
  direction?: "asc" | "desc" | null;
  band?: readonly string[];
  needs_review?: boolean;
  state?: readonly string[];
  agent_id?: readonly string[];
  unassigned?: boolean;
  priority?: readonly string[];
  attachment?: "lead" | "none" | null;
  has_recording?: boolean;
  has_assessment?: boolean;
  newer_call?: boolean;
  ti_min?: number | null;
  ml_min?: number | null;
  received_from?: string | null;
  received_to?: string | null;
  move_date_within?: number | null;
  move_date_passed?: boolean;
  outcome?: readonly string[];
  closed_from?: string | null;
  closed_to?: string | null;
  freshness?: "fresh" | "all" | null;
  q?: string | null;
  limit?: number;
};
export const CLOSED_ONLY_PARAMS = ["outcome", "closed_from", "closed_to"] as const;

type Scalar = string | number | boolean | null | undefined;
type Value = Scalar | readonly string[];

/** Deterministic: keys in the order given, empty values dropped, booleans only when true, lists repeated. */
export function toQuery(entries: readonly (readonly [string, Value])[]): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === false || value === "") continue;
    if (Array.isArray(value)) { for (const item of value as readonly string[]) if (item !== "") query.append(key, item); continue; }
    query.append(key, value === true ? "true" : String(value));
  }
  return query;
}

export function attentionQuery(params: AttentionParams): URLSearchParams {
  const closed = params.view === "closed";
  return toQuery([
    ["view", params.view],
    ["sort", params.sort], ["direction", params.sort ? params.direction : null],
    ["q", params.q?.trim() || null],
    ["band", closed ? undefined : params.band], ["needs_review", params.needs_review], ["state", params.state],
    ["agent_id", params.agent_id], ["unassigned", params.unassigned],
    ["priority", params.priority], ["attachment", params.attachment],
    ["has_recording", params.has_recording], ["has_assessment", params.has_assessment], ["newer_call", params.newer_call],
    ["ti_min", params.ti_min], ["ml_min", params.ml_min],
    ["received_from", params.received_from], ["received_to", params.received_to],
    ["move_date_within", params.move_date_within], ["move_date_passed", params.move_date_passed],
    ["outcome", closed ? params.outcome : undefined], ["closed_from", closed ? params.closed_from : null], ["closed_to", closed ? params.closed_to : null],
    ["freshness", params.freshness === "fresh" ? "fresh" : null],
    ["limit", params.limit ?? LIST_PAGE_SIZE],
  ]);
}

/** `GET /overview` (S9). No period → the server's defaults (activity Today, spend Last 7 days). */
export type OverviewParams = { period?: string | null; from?: string | null; to?: string | null; priority?: readonly string[]; agent_id?: string | null };
export const OVERVIEW_PERIODS = ["today", "yesterday", "last_7_days", "this_week", "last_30_days", "this_month", "custom"] as const;
export function overviewQuery(params: OverviewParams): URLSearchParams {
  const custom = params.period === "custom";
  return toQuery([["period", params.period], ["from", custom ? params.from : null], ["to", custom ? params.to : null],
    ["priority", params.priority], ["agent_id", params.agent_id]]);
}

/** `GET /outreach/closed-history` (S7): the same outcome/priority/rep filters as the Closed view; `limit` ≤ 50. */
export type ClosedHistoryParams = { outcome?: readonly string[]; priority?: readonly string[]; agent_id?: readonly string[];
  closed_from?: string | null; closed_before?: string | null; q?: string | null; limit?: number };
export const CLOSED_HISTORY_PAGE_SIZE = 50;
export function closedHistoryQuery(params: ClosedHistoryParams): URLSearchParams {
  return toQuery([["outcome", params.outcome], ["priority", params.priority], ["agent_id", params.agent_id],
    ["closed_from", params.closed_from], ["closed_before", params.closed_before], ["q", params.q?.trim() || null],
    ["limit", Math.min(params.limit ?? CLOSED_HISTORY_PAGE_SIZE, CLOSED_HISTORY_PAGE_SIZE)]]);
}

/** Timeline v2 on both scopes (final §10): 50 per page, `kinds` repeated. */
export type TimelineScope = "outreach" | "number";
export const TIMELINE_PAGE_SIZE = 50;
export function timelinePath(scope: TimelineScope, id: string): string {
  return `${scope === "outreach" ? "outreach" : "numbers"}/${encodeURIComponent(id)}/timeline`;
}
export function timelineQuery(kinds: readonly string[] = [], cursor: string | null = null): URLSearchParams {
  return toQuery([["kinds", [...kinds].sort()], ["limit", TIMELINE_PAGE_SIZE], ["cursor", cursor]]);
}

/** `path?query&cursor=…` with the cursor appended last, so the base string is also the query-key part. */
export function withCursor(path: string, query: URLSearchParams, cursor: string | null, key = "cursor"): string {
  const next = new URLSearchParams(query);
  if (cursor) next.set(key, cursor);
  const text = next.toString();
  return text ? `${path}?${text}` : path;
}
