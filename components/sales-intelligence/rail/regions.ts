/**
 * UI1-RAIL: the rail's regions and the pure helpers behind them (UI-1 §3.3, §3.5; final spec §7.3, §8).
 * Needs Attention and All Outreach have five regions (Band · Status · Rep · Analysis · Time); Closed has
 * three (Outcome · Rep · Time closed). Priority and the Lead toggle live in the preset bar, not here (UX7, UX24).
 *
 * Server params (S2 CONTRACT): `band`, `needs_review`, `state`, `agent_id`, `unassigned`, `has_recording`,
 * `has_assessment`, `newer_call`, `ti_min`, `ml_min`, `received_from/to`, `move_date_within`, `move_date_passed`;
 * Closed: `outcome`, `closed_from/to`. `received_*` and `closed_*` are ISO instants, half-open `[from, to)`.
 * A window (`last 7d`) is `from = as_of − 7d`, taken from the response's `as_of`, never the browser clock. A custom
 * range is two ET calendar days: `from` = ET midnight of the first day, `to` = ET midnight after the last day.
 */
import { copy } from "../sales-intelligence-copy";
import type { DeskUrlState } from "../data/url-state";

export type RailView = "attention" | "all_outreach" | "closed";
export type RailRegionId = "band" | "status" | "rep" | "analysis" | "time" | "outcome" | "closed_time";

export const RAIL_KEYS = [
  "band", "needs_review", "state", "agent_id", "unassigned", "has_recording", "has_assessment", "newer_call",
  "ti_min", "ml_min", "received_from", "received_to", "move_date_within", "move_date_passed", "outcome", "closed_from", "closed_to",
] as const;
export type RailKey = (typeof RAIL_KEYS)[number];
/** The slice of the desk URL state the rail reads (`useDeskUrlState().state` fits as is). */
export type RailValue = Pick<DeskUrlState, RailKey>;
/** A change the rail asks for; it is a `DeskUrlPatch`, so the desk passes `useDeskUrlState().update` straight through. */
export type RailPatch = Partial<RailValue>;
export type RailRep = { id: string; name: string };

export type RailRegion = {
  id: RailRegionId;
  title: string;
  /** Disclosure memory key (localStorage), per desk: `si.rail.{view}.{region}`. */
  storageId: string;
  /** The URL / server params this region owns; clearing the region resets exactly these. */
  params: readonly RailKey[];
};

const r = copy.ui1.desk.rail;
export const railStorageId = (view: RailView, region: RailRegionId) => `si.rail.${view}.${region}`;

const region = (view: RailView, id: RailRegionId, title: string, params: readonly RailKey[]): RailRegion => ({ id, title, storageId: railStorageId(view, id), params });

/** Needs Attention / All Outreach: five regions, in order. */
export function outreachRegions(view: "attention" | "all_outreach"): RailRegion[] {
  return [
    region(view, "band", r.band, ["band", "needs_review"]),
    region(view, "status", r.status, ["state"]),
    region(view, "rep", r.rep, ["agent_id", "unassigned"]),
    region(view, "analysis", r.analysis, ["has_recording", "has_assessment", "newer_call", "ti_min", "ml_min"]),
    region(view, "time", r.time, ["received_from", "received_to", "move_date_within", "move_date_passed"]),
  ];
}

/** Closed: Outcome (with Booked in Granot) · Rep · Closed (time). */
export function closedRegions(): RailRegion[] {
  return [
    region("closed", "outcome", r.closedOutcome, ["outcome"]),
    region("closed", "rep", r.closedRep, ["agent_id", "unassigned"]),
    region("closed", "closed_time", r.closedTime, ["closed_from", "closed_to"]),
  ];
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
    case "band": case "state": case "agent_id": case "outcome": return [];
    case "needs_review": case "unassigned": case "has_recording": case "has_assessment": case "newer_call": case "move_date_passed": return false;
    default: return null;
  }
}

/** The patch that clears every region in `regions` (the desk's `Clear filters`). */
export function clearAll(regions: readonly RailRegion[]): RailPatch {
  return Object.assign({}, ...regions.map(clearRegion)) as RailPatch;
}
