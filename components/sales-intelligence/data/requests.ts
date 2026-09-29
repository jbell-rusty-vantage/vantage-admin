/**
 * UI1-DATA: request shapes for every UI-1 read, and their serialization. Pure (no React), so the query
 * keys, the hooks and the URL state all build the same string. Multi-values are sent **repeated**
 * (`priority=0&priority=not_set`), never `priority[]=`: the server's `/attention` schema is strict and
 * answers 400 to the bracket form (S2 CONTRACT "Query encoding"). Only the timeline routes accept
 * `kinds[]`, and they accept the repeated form too, so repeated is used everywhere.
 */
import type { AttentionCapabilities } from "@/lib/api/salesIntelligence";

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
  move_date_mode?: string | null; move_days?: number | null; move_on?: string | null; move_from?: string | null; move_through?: string | null;
  assigned_agent_id?: readonly string[]; assignment?: "unassigned" | null; followup_agent_id?: readonly string[];
  relationship?: "assigned" | "followup" | "involved" | null; agent?: string | null;
  work?: readonly string[]; loc_side?: "either" | "pickup" | "delivery" | null;
  loc_city?: string | null; loc_state?: string | null; loc_zip?: string | null; snapshot_id?: string | null;
  limit?: number;
};
export const CLOSED_ONLY_PARAMS = ["outcome", "closed_from", "closed_to"] as const;
/** Four Outreach pages fit the 200-row Back restoration budget; Numbers retains its own page size. */
export const OUTREACH_PAGE_SIZE = 50;

/** Keep unsupported selections in the URL/UI while sending only families the current server advertises. */
export function supportedAttentionParams(requested: AttentionParams, capabilities: AttentionCapabilities | null): { params: AttentionParams; unavailable: string[] } {
  const cap = requested.view === "closed" ? capabilities?.closed_history : capabilities;
  const params = { ...requested };
  const unavailable: string[] = [];
  const validDay = (day: string | null | undefined) => !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
  const mode = params.move_date_mode;
  if (mode && (!["today", "tomorrow", "within", "future", "today_onward", "past", "unknown", "exact", "range"].includes(mode)
    || (mode === "within" && (!Number.isInteger(params.move_days) || (params.move_days ?? -1) < 0 || (params.move_days ?? 367) > 366))
    || (mode === "exact" && !validDay(params.move_on))
    || (mode === "range" && (!validDay(params.move_from) || !validDay(params.move_through) || params.move_from! > params.move_through!))
    || (mode !== "within" && params.move_days != null) || (mode !== "exact" && params.move_on != null)
    || (mode !== "range" && (params.move_from != null || params.move_through != null)))) {
    unavailable.push("Invalid move date");
    Object.assign(params, { move_date_mode: null, move_days: null, move_on: null, move_from: null, move_through: null });
  }
  if (!mode && (params.move_days != null || params.move_on || params.move_from || params.move_through)) {
    unavailable.push("Invalid move date");
    Object.assign(params, { move_days: null, move_on: null, move_from: null, move_through: null });
  }
  const agentId = (value: string) => /^[a-f\d]{24}$/i.test(value);
  if (params.assignment && params.assigned_agent_id?.length || params.assigned_agent_id?.some((value) => !agentId(value))) {
    unavailable.push("Invalid assigned rep"); Object.assign(params, { assignment: null, assigned_agent_id: [] });
  }
  if (params.followup_agent_id?.some((value) => !agentId(value))) { unavailable.push("Invalid follow-up assignee"); params.followup_agent_id = []; }
  if (params.relationship || params.agent) {
    if (!params.relationship || !params.agent || !agentId(params.agent)) { unavailable.push("Invalid involvement"); Object.assign(params, { relationship: null, agent: null }); }
  }
  if (params.work?.some((value) => !["overdue_followup", "due_today", "no_next_step", "blocked"].includes(value))) { unavailable.push("Invalid follow-up"); params.work = []; }
  if ((params.loc_side && !params.loc_city && !params.loc_state && !params.loc_zip)
    || (params.loc_city && params.loc_city.length > 100) || (params.loc_state && !/^[a-z]{2}$/i.test(params.loc_state))
    || (params.loc_zip && !/^\d{5}$/.test(params.loc_zip))) {
    unavailable.push("Invalid location"); Object.assign(params, { loc_side: null, loc_city: null, loc_state: null, loc_zip: null });
  }
  if (cap?.move_date !== true) {
    if (params.move_date_mode) unavailable.push("Move date");
    Object.assign(params, { move_date_mode: null, move_days: null, move_on: null, move_from: null, move_through: null });
  }
  if (cap?.assignment !== true) {
    if (params.assigned_agent_id?.length || params.assignment) unavailable.push("Assigned rep");
    Object.assign(params, { assigned_agent_id: [], assignment: null });
  }
  if (cap?.relationship !== true) {
    if (params.relationship || params.agent) unavailable.push("Involvement");
    Object.assign(params, { relationship: null, agent: null });
  }
  if (cap?.work !== true) {
    if (params.work?.length || params.followup_agent_id?.length) unavailable.push("Follow-up");
    Object.assign(params, { work: [], followup_agent_id: [] });
  }
  if (cap?.location !== true) {
    if (params.loc_city || params.loc_state || params.loc_zip) unavailable.push("Location");
    Object.assign(params, { loc_side: null, loc_city: null, loc_state: null, loc_zip: null });
  }
  if (cap?.move_date_sort !== true && params.sort === "move_date") { unavailable.push("Move date sort"); params.sort = "lead_received"; params.direction = "desc"; }
  if (cap?.snapshot_pin !== true) {
    if (params.snapshot_id) unavailable.push("Snapshot");
    params.snapshot_id = null;
  }
  return { params, unavailable };
}

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
    ["move_date_mode", params.move_date_mode], ["move_days", params.move_days], ["move_on", params.move_on],
    ["move_from", params.move_from], ["move_through", params.move_through],
    ["assigned_agent_id", params.assigned_agent_id], ["assignment", params.assignment], ["followup_agent_id", params.followup_agent_id],
    ["relationship", params.relationship], ["agent", params.agent], ["work", closed ? undefined : params.work],
    ["loc_side", params.loc_side], ["loc_city", params.loc_city], ["loc_state", params.loc_state], ["loc_zip", params.loc_zip],
    ["snapshot_id", closed ? null : params.snapshot_id],
    ["band", closed ? undefined : params.band], ["needs_review", params.needs_review], ["state", params.state],
    ["agent_id", params.agent_id], ["unassigned", params.unassigned],
    ["priority", params.priority], ["attachment", params.attachment],
    ["has_recording", params.has_recording], ["has_assessment", params.has_assessment], ["newer_call", params.newer_call],
    ["ti_min", params.ti_min], ["ml_min", params.ml_min],
    ["received_from", params.received_from], ["received_to", params.received_to],
    ["move_date_within", params.move_date_within], ["move_date_passed", params.move_date_passed],
    ["outcome", closed ? params.outcome : undefined], ["closed_from", closed ? params.closed_from : null], ["closed_to", closed ? params.closed_to : null],
    ["freshness", params.freshness === "fresh" ? "fresh" : null],
    ["limit", params.limit ?? OUTREACH_PAGE_SIZE],
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
  closed_from?: string | null; closed_before?: string | null; q?: string | null; limit?: number;
  move_date_mode?: string | null; move_days?: number | null; move_on?: string | null; move_from?: string | null; move_through?: string | null;
  assigned_agent_id?: readonly string[]; assignment?: "unassigned" | null;
  loc_side?: "either" | "pickup" | "delivery" | null; loc_city?: string | null; loc_state?: string | null; loc_zip?: string | null };
export const CLOSED_HISTORY_PAGE_SIZE = 50;
export function closedHistoryQuery(params: ClosedHistoryParams): URLSearchParams {
  return toQuery([["outcome", params.outcome], ["priority", params.priority], ["agent_id", params.agent_id],
    ["move_date_mode", params.move_date_mode], ["move_days", params.move_days], ["move_on", params.move_on],
    ["move_from", params.move_from], ["move_through", params.move_through], ["assigned_agent_id", params.assigned_agent_id], ["assignment", params.assignment],
    ["loc_side", params.loc_side], ["loc_city", params.loc_city], ["loc_state", params.loc_state], ["loc_zip", params.loc_zip],
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
