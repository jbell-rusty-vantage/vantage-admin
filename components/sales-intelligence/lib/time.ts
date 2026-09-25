/**
 * UI1-TIME: the one place Sales Intelligence turns a server time into words (final spec §3.3, UI-0 §2.1).
 *
 * Pure: no React, no `Date.now()`, no argument-less `new Date()`. Every relative phrase takes the
 * response's `as_of` as `asOf`. Time zone is always America/New_York, suffix `ET`.
 *
 * Choices this file makes (also recorded in evidence/UI1-TIME.md):
 * - A time that isn't a parseable instant prints `Time unknown` (final spec §3.3 null wording). Nothing throws.
 * - Future times (t > asOf) read `in 40m` / `in 2h` / `in 3d` with the same thresholds as the past;
 *   under one minute either way is `just now` (processing noise, not a direction).
 * - Units are floored: 59m59s is `59m ago`, 47h59m is `47h ago`, 6d23h is `6d ago`.
 * - `formatDuration`: under 1 h `{m}m`; under 24 h `{h}h` or `{h}h {m}m`; 24 h and over `{d}d` or `{d}d {h}h`.
 *   Negative clamps to `0m`; NaN prints `Time unknown`. `about: true` prefixes `about ` (estimated `band_since`).
 * - Durations count real elapsed milliseconds, so a span across a DST change is its true length.
 *   Day counts (`formatDayCount`, `formatDayHeader`) count ET calendar days, so they ignore the 23/25 h day.
 * - Calendar dates (`YYYY-MM-DD`, or an ISO string whose first ten characters are one) are read as the date
 *   written, never shifted through a time zone.
 */

export const TIME_ZONE = "America/New_York";

export const TIME_WORDS = {
  tz: "ET",
  unknown: "Time unknown",
  justNow: "just now",
  now: "now",
  today: "today",
  todayHeader: "Today",
  yesterdayHeader: "Yesterday",
  ago: (n: string) => `${n} ago`,
  in: (n: string) => `in ${n}`,
  overdue: (n: string) => `overdue ${n}`,
  about: (n: string) => `about ${n}`,
} as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const numericFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar dates are formatted in UTC from Date.UTC(y, m, d) so they print exactly as written. */
const calendarFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  weekday: "short",
});

type EtParts = { year: string; month: string; day: string; weekday: string; hour: string; minute: string; dayPeriod: string };

const instant = (t: string | null | undefined): number => (typeof t === "string" && t ? Date.parse(t) : Number.NaN);

function partsOf(format: Intl.DateTimeFormat, ms: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of format.formatToParts(ms)) out[part.type] = part.value;
  return out;
}

function etParts(ms: number): EtParts {
  const p = partsOf(partsFormat, ms);
  return { year: p.year, month: p.month, day: p.day, weekday: p.weekday, hour: p.hour, minute: p.minute, dayPeriod: (p.dayPeriod ?? "").toUpperCase() };
}

/** `YYYY-MM-DD` of the instant in America/New_York. Empty string for an unparseable time. */
export function etDateKey(t: string): string {
  const ms = instant(t);
  if (Number.isNaN(ms)) return "";
  const p = partsOf(numericFormat, ms);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The ET calendar year of an instant, or NaN. */
export function etYear(t: string): number {
  const ms = instant(t);
  return Number.isNaN(ms) ? Number.NaN : Number(etParts(ms).year);
}

function calendarDay(date: string | null | undefined): { y: number; m: number; d: number; utc: number } | null {
  const match = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(date) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d, utc };
}

const clock = (p: EtParts) => `${p.hour}:${p.minute} ${p.dayPeriod} ${TIME_WORDS.tz}`;

/** `3:10 PM ET`. */
export function formatTimeOnly(t: string): string {
  const ms = instant(t);
  return Number.isNaN(ms) ? TIME_WORDS.unknown : clock(etParts(ms));
}

/**
 * `Sep 20, 3:10 PM ET`; `Sep 20, 2025, 3:10 PM ET` when the ET year differs from `asOf`'s (year: "auto").
 * An unparseable `asOf` under "auto" includes the year.
 */
export function formatExact(t: string, asOf: string, opts: { year?: "auto" | "always" | "never" } = {}): string {
  const ms = instant(t);
  if (Number.isNaN(ms)) return TIME_WORDS.unknown;
  const p = etParts(ms);
  const mode = opts.year ?? "auto";
  const withYear = mode === "always" || (mode === "auto" && Number(p.year) !== etYear(asOf));
  return `${p.month} ${p.day}, ${withYear ? `${p.year}, ` : ""}${clock(p)}`;
}

/** `Sep 20, 2026, 3:10 PM ET`: the accessible label form (title / aria-label). */
export function formatExactFull(t: string): string {
  const ms = instant(t);
  if (Number.isNaN(ms)) return TIME_WORDS.unknown;
  const p = etParts(ms);
  return `${p.month} ${p.day}, ${p.year}, ${clock(p)}`;
}

/** Month + day of an instant in ET, with the year when it isn't `asOf`'s ET year. */
function shortDate(ms: number, asOf: string): string {
  const p = etParts(ms);
  return Number(p.year) === etYear(asOf) ? `${p.month} ${p.day}` : `${p.month} ${p.day}, ${p.year}`;
}

/** The largest whole unit, floored: `40m`, `2h`, `3d`. Used by the relative phrase. */
function wholeUnit(ms: number): string {
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  if (ms < 48 * HOUR) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

/**
 * Final spec §3.3: `just now` (under 1 minute), `40m ago` (under 60 minutes), `2h ago` (under 48 hours),
 * `3d ago` (under 7 days), then `Sep 12` / `Sep 12, 2025`. A future `t` reads `in 40m` / `in 2h` / `in 3d`
 * with the same thresholds, then the date.
 */
export function formatRelative(t: string, asOf: string): string {
  const ms = instant(t);
  const ref = instant(asOf);
  if (Number.isNaN(ms) || Number.isNaN(ref)) return TIME_WORDS.unknown;
  const diff = ref - ms;
  const span = Math.abs(diff);
  if (span < MINUTE) return TIME_WORDS.justNow;
  if (span >= 7 * DAY) return shortDate(ms, asOf);
  return diff > 0 ? TIME_WORDS.ago(wholeUnit(span)) : TIME_WORDS.in(wholeUnit(span));
}

/**
 * Compact duration: under 1 h `{m}m`; under 24 h `{h}h` or `{h}h {m}m`; 24 h and over `{d}d` or `{d}d {h}h`.
 * Units are floored. Negative clamps to `0m`; NaN / infinite prints `Time unknown`. `about` prefixes `about `.
 */
export function formatDuration(ms: number, opts: { about?: boolean } = {}): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return TIME_WORDS.unknown;
  const span = Math.max(0, ms);
  let text: string;
  if (span < HOUR) text = `${Math.floor(span / MINUTE)}m`;
  else if (span < DAY) {
    const h = Math.floor(span / HOUR);
    const m = Math.floor((span % HOUR) / MINUTE);
    text = m ? `${h}h ${m}m` : `${h}h`;
  } else {
    const d = Math.floor(span / DAY);
    const h = Math.floor((span % DAY) / HOUR);
    text = h ? `${d}d ${h}h` : `${d}d`;
  }
  return opts.about ? TIME_WORDS.about(text) : text;
}

export type Countdown = { kind: "in" | "overdue" | "now" | "unknown"; text: string };

/**
 * `in 2h`, `overdue 40m`, `in 12d`; within one minute either way `now`. The *state* (is it overdue?) is the
 * server's; this only words the distance between `t` and `asOf`. Unparseable input: `{ kind: "unknown", text: "Time unknown" }`.
 */
export function formatCountdown(t: string, asOf: string): Countdown {
  const ms = instant(t);
  const ref = instant(asOf);
  if (Number.isNaN(ms) || Number.isNaN(ref)) return { kind: "unknown", text: TIME_WORDS.unknown };
  const diff = ms - ref;
  if (Math.abs(diff) < MINUTE) return { kind: "now", text: TIME_WORDS.now };
  return diff > 0
    ? { kind: "in", text: TIME_WORDS.in(formatDuration(diff)) }
    : { kind: "overdue", text: TIME_WORDS.overdue(formatDuration(-diff)) };
}

/**
 * Whole ET calendar days from `asOf`'s ET date to `date` (`YYYY-MM-DD`): `in 12d`, `today`, `12d ago`.
 * `days` is negative when the date is past. `(passed)` is the server's boolean, not this.
 */
export function formatDayCount(date: string, asOf: string): { days: number; text: string } {
  const target = calendarDay(date);
  const today = calendarDay(etDateKey(asOf));
  if (!target || !today) return { days: Number.NaN, text: TIME_WORDS.unknown };
  const days = Math.round((target.utc - today.utc) / DAY);
  if (days === 0) return { days, text: TIME_WORDS.today };
  return { days, text: days > 0 ? TIME_WORDS.in(`${days}d`) : TIME_WORDS.ago(`${-days}d`) };
}

/** `Oct 15`; the year is added when it isn't `asOf`'s ET year, and always when `asOf` is omitted. */
export function formatDate(date: string, asOf?: string): string {
  const day = calendarDay(date);
  if (!day) return TIME_WORDS.unknown;
  const p = partsOf(calendarFormat, day.utc);
  const withYear = asOf === undefined || day.y !== etYear(asOf);
  return withYear ? `${p.month} ${p.day}, ${p.year}` : `${p.month} ${p.day}`;
}

/** Timeline / chat day header: `Today`, `Yesterday`, else `Mon Sep 22` (`, 2025` when not `asOf`'s ET year). */
export function formatDayHeader(t: string, asOf: string): string {
  const day = calendarDay(etDateKey(t));
  const ref = calendarDay(etDateKey(asOf));
  if (!day) return TIME_WORDS.unknown;
  if (ref) {
    const diff = Math.round((ref.utc - day.utc) / DAY);
    if (diff === 0) return TIME_WORDS.todayHeader;
    if (diff === 1) return TIME_WORDS.yesterdayHeader;
  }
  const p = partsOf(calendarFormat, day.utc);
  const base = `${p.weekday} ${p.month} ${p.day}`;
  return ref && ref.y === day.y ? base : `${base}, ${p.year}`;
}
