/**
 * UI1-RAIL: the filter sidebar's sections and the pure helpers behind them (UI-1 §3.3, §3.5; final spec §7.3, §8).
 * The sidebar is the desk's only filter surface (2026-09-29 cleanup): Granot Priority and the Lead toggle, Follow-up,
 * Rep, Dates, Location, Band, Status and Analysis on Needs Attention / All Outreach; Granot Priority, Outcome, Rep,
 * Dates and Location on Closed. The sort stays above the list; the metrics strip stays for context.
 *
 * Server params (S2 CONTRACT): `band`, `needs_review`, `state`, `agent_id`, `unassigned`, `has_recording`,
 * `has_assessment`, `newer_call`, `ti_min`, `ml_min`, `received_from/to`, `move_date_within`, `move_date_passed`;
 * Closed: `outcome`, `closed_from/to`. `received_*` and `closed_*` are ISO instants, half-open `[from, to)`.
 * A window (`last 7d`) is `from = as_of − 7d`, taken from the response's `as_of`, never the browser clock. A custom
 * range is two ET calendar days: `from` = ET midnight of the first day, `to` = ET midnight after the last day.
 * OI-A4 families (`priority`, `attachment`, `work`, `assigned_agent_id`, `relationship`, `move_date_mode`, `loc_*` …)
 * are gated by the server's capabilities; their chips are built by the desk (the move date chip needs the list's
 * resolved window), so `activeFilterChips` skips those sections.
 */
import { copy } from "../sales-intelligence-copy";
import type { DeskUrlState } from "../data/url-state";

export type RailView = "attention" | "all_outreach" | "closed";
export type RailRegionId = "priority" | "lead" | "followup" | "rep" | "time" | "location" | "band" | "status" | "analysis" | "outcome" | "closed_time";

export const RAIL_KEYS = [
  "band", "needs_review", "state", "agent_id", "unassigned", "has_recording", "has_assessment", "newer_call",
  "ti_min", "ml_min", "received_from", "received_to", "move_date_within", "move_date_passed", "outcome", "closed_from", "closed_to",
  "priority", "attachment", "work", "followup_agent_id", "assigned_agent_id", "assignment", "relationship", "agent",
  "move_date_mode", "move_days", "move_on", "move_from", "move_through", "loc_side", "loc_city", "loc_state", "loc_zip",
] as const;
export type RailKey = (typeof RAIL_KEYS)[number];
/** The slice of the desk URL state the rail reads (`useDeskUrlState().state` fits as is). */
export type RailValue = Pick<DeskUrlState, RailKey>;
/** A change the rail asks for; it is a `DeskUrlPatch`, so the desk passes `useDeskUrlState().update` straight through. */
export type RailPatch = Partial<RailValue>;
export type RailRep = { id: string; name: string; active?: boolean };

export type RailRegion = {
  id: RailRegionId;
  title: string;
  /** The desk this section belongs to (Priority counts and Closed capabilities read it). */
  view: RailView;
  /** Disclosure memory key (localStorage), per desk: `si.rail.{view}.{region}`. */
  storageId: string;
  /** Open until the viewer closes it (then remembered). */
  defaultOpen: boolean;
  /** The URL / server params this region owns; clearing the region resets exactly these. */
  params: readonly RailKey[];
};

const r = copy.ui1.desk.rail;
export const railStorageId = (view: RailView, region: RailRegionId) => `si.rail.${view}.${region}`;

const region = (view: RailView, id: RailRegionId, title: string, params: readonly RailKey[], defaultOpen = true): RailRegion =>
  ({ id, title, view, storageId: railStorageId(view, id), defaultOpen, params });

const MOVE_KEYS = ["move_date_mode", "move_days", "move_on", "move_from", "move_through", "move_date_within", "move_date_passed"] as const;
const LOCATION_KEYS = ["loc_side", "loc_city", "loc_state", "loc_zip"] as const;
const priorityRegion = (view: RailView) => region(view, "priority", r.priority, ["priority", "attachment"]);

/** Needs Attention / All Outreach, in order. */
export function outreachRegions(view: "attention" | "all_outreach"): RailRegion[] {
  return [
    priorityRegion(view),
    region(view, "followup", r.followup, ["work", "followup_agent_id"]),
    region(view, "rep", r.rep, ["assigned_agent_id", "assignment", "relationship", "agent", "agent_id", "unassigned"]),
    region(view, "time", r.dates, ["received_from", "received_to", ...MOVE_KEYS]),
    region(view, "location", r.location, LOCATION_KEYS, false),
    region(view, "band", r.band, ["band", "needs_review"], false),
    region(view, "status", r.status, ["state"], false),
    region(view, "analysis", r.analysis, ["has_recording", "has_assessment", "newer_call", "ti_min", "ml_min"], false),
  ];
}

/**
 * Closed: Outcome · Lead · Rep · Dates (closed, move) · Location. No Granot Priority (Owner, 2026-09-30): Priority
 * doesn't decide what is closed, and the Granot codes that close a record (5, 7, 8) are Outcome options already
 * (Booked in Granot, CRM bad/unusable, CRM dead), next to the reasons Priority can't express (Booked, Cancelled…).
 */
export function closedRegions(): RailRegion[] {
  return [
    region("closed", "outcome", r.closedOutcome, ["outcome"]),
    region("closed", "lead", copy.ui1.desk.lead.label, ["attachment"]),
    region("closed", "rep", r.rep, ["assigned_agent_id", "assignment", "agent_id", "unassigned"]),
    region("closed", "closed_time", r.dates, ["closed_from", "closed_to", ...MOVE_KEYS]),
    region("closed", "location", r.location, LOCATION_KEYS, false),
  ];
}

/** UI2-SHELL (UI-2 §3): a view's regions; a rep's rail has no Rep region (the scope is forced by the server). */
export function railRegionsFor(view: RailView, rep = false): RailRegion[] {
  const regions = view === "closed" ? closedRegions() : outreachRegions(view);
  return rep ? regions.filter((r) => r.id !== "rep") : regions;
}

export const BAND_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const STATUS_OPTIONS = ["unworked", "open", "waiting_on_customer", "identity_review"] as const;
export const OUTCOME_OPTIONS = ["booked", "granot_booked", "cancelled", "bad_lead", "duplicate", "no_sync", "crm_dead", "crm_bad_unusable", "owner"] as const;
export const SCORE_STEPS = [25, 50, 75] as const;
export const MOVE_WITHIN = [7, 30] as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const RECEIVED_WINDOWS = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY } as const;
export const CLOSED_WINDOWS = { "7d": 7 * DAY, "30d": 30 * DAY, "90d": 90 * DAY } as const;
export type WindowTable = Readonly<Record<string, number>>;

/** `as_of − ms` as an ISO instant, or null when `as_of` isn't a time. */
export function windowFrom(asOf: string, ms: number): string | null {
  const t = Date.parse(asOf);
  return Number.isNaN(t) ? null : new Date(t - ms).toISOString();
}

/**
 * Which window a stored `[from, to)` is: a key of `windows` when `to` is empty and `from` sits within
 * max(1h, 5 %) of `as_of − window` (the list's `as_of` moves on after the filter was chosen), `custom` for any
 * other range, null when nothing is set.
 */
export function matchWindow(from: string | null, to: string | null, asOf: string | null | undefined, windows: WindowTable): string | null {
  if (!from && !to) return null;
  if (to || !from || !asOf) return "custom";
  const age = Date.parse(asOf) - Date.parse(from);
  if (Number.isNaN(age)) return "custom";
  for (const [key, ms] of Object.entries(windows)) if (Math.abs(age - ms) <= Math.max(HOUR, ms * 0.05)) return key;
  return "custom";
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const etHourMinute = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const etDateOnly = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

function parts(format: Intl.DateTimeFormat, ms: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of format.formatToParts(ms)) out[part.type] = part.value;
  return out;
}

/** `YYYY-MM-DD` (an ET calendar day) → the ISO instant of ET midnight that day (EDT −4 or EST −5). Null if invalid. */
export function etDayStartIso(date: string): string | null {
  const m = DATE_RE.exec(date.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  for (const offset of [4, 5]) {
    const ms = Date.UTC(y, mo - 1, d, offset);
    const p = parts(etHourMinute, ms);
    if (`${p.year}-${p.month}-${p.day}` === `${m[1]}-${m[2]}-${m[3]}` && p.hour === "00" && p.minute === "00") return new Date(ms).toISOString();
  }
  return null;
}

/** The ET day after `YYYY-MM-DD`, as `YYYY-MM-DD`. */
function nextDay(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
}

/** Two ET days (either may be empty) → `{ from, to }` instants, `to` exclusive (midnight after the last day). */
export function customRange(fromDate: string, toDate: string): { from: string | null; to: string | null } {
  const from = fromDate ? etDayStartIso(fromDate) : null;
  const to = toDate && DATE_RE.test(toDate.trim()) ? etDayStartIso(nextDay(toDate.trim())) : null;
  return { from, to };
}

const etDay = (ms: number) => { const p = parts(etDateOnly, ms); return `${p.year}-${p.month}-${p.day}`; };

/** The ET days a stored `[from, to)` covers, for the custom inputs and the chip: `to` shows the last included day. */
export function rangeDates(from: string | null, to: string | null): { from: string; to: string } {
  const f = from ? Date.parse(from) : Number.NaN;
  const t = to ? Date.parse(to) : Number.NaN;
  return { from: Number.isNaN(f) ? "" : etDay(f), to: Number.isNaN(t) ? "" : etDay(t - 1) };
}

/** The patch that clears one region. */
export function clearRegion(regionDef: RailRegion): RailPatch {
  const patch: Record<string, unknown> = {};
  for (const key of regionDef.params) patch[key] = emptyValue(key);
  return patch as RailPatch;
}

export function emptyValue(key: RailKey): RailValue[RailKey] {
  switch (key) {
    case "band": case "state": case "agent_id": case "outcome": case "priority": case "work": case "followup_agent_id": case "assigned_agent_id": return [];
    case "needs_review": case "unassigned": case "has_recording": case "has_assessment": case "newer_call": case "move_date_passed": return false;
    default: return null;
  }
}

/** How many of a section's params hold a value (the number beside its title). `loc_side` alone is not a filter. */
export function regionActiveCount(regionDef: RailRegion, value: RailValue): number {
  const keys = regionDef.params.filter((key) => key !== "loc_side" && key !== "relationship" && key !== "move_days" && key !== "move_on" && key !== "move_from" && key !== "move_through");
  return keys.reduce((n, key) => {
    const v = value[key];
    return n + (Array.isArray(v) ? v.length : v !== null && v !== undefined && v !== false ? 1 : 0);
  }, 0);
}

/** The patch that clears every region in `regions` (the desk's `Clear filters`). */
export function clearAll(regions: readonly RailRegion[]): RailPatch {
  return Object.assign({}, ...regions.map(clearRegion)) as RailPatch;
}
