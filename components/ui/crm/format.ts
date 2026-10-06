/**
 * Display helpers shared by the dashboard's CRM pages. Pure (no React). Times are shown in New York (the platform's
 * business time zone); money is USD.
 */
export const CRM_TIME_ZONE = "America/New_York";

const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const timeOfDay = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIME_ZONE, month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });
const absolute = new Intl.DateTimeFormat("en-US", {
  timeZone: CRM_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});
const longDay = new Intl.DateTimeFormat("en-US", { timeZone: CRM_TIME_ZONE, weekday: "long", month: "short", day: "numeric" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CRM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatMoney(value: unknown, options: { cents?: boolean } = {}): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "—";
  return options.cents ? money2.format(number) : money0.format(number);
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : integer.format(value);
}

export function parseInstant(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2:40 PM" for an instant. */
export function formatTime(value: unknown): string {
  const date = parseInstant(value);
  return date ? timeOfDay.format(date) : "—";
}

/** "Oct 29" (no year) or "Oct 29, 2025" when the year differs from now. */
export function formatShortDate(value: unknown, now = new Date()): string {
  const date = parseInstant(value);
  if (!date) return "—";
  const sameYear = dayKey.format(date).slice(0, 4) === dayKey.format(now).slice(0, 4);
  return sameYear ? monthDay.format(date) : monthDayYear.format(date);
}

/** The full instant for a tooltip: "Thu, Oct 1, 2026, 9:10 AM EDT". */
export function formatAbsolute(value: unknown): string {
  const date = parseInstant(value);
  return date ? absolute.format(date) : "—";
}

/** "Monday, Oct 5". */
export function formatLongDay(value: unknown): string {
  const date = parseInstant(value);
  return date ? longDay.format(date) : "—";
}

export function newYorkDayKey(value: Date | number | string): string {
  const date = parseInstant(value);
  return date ? dayKey.format(date) : "";
}

/**
 * A relative instant for a card: "2:40 PM" today, "Yesterday 2:40 PM", "3 days ago", then "Sep 25".
 * Absolute text belongs in the title attribute (`formatAbsolute`).
 */
export function formatRelative(value: unknown, now = new Date()): string {
  const date = parseInstant(value);
  if (!date) return "—";
  const today = newYorkDayKey(now);
  const day = newYorkDayKey(date);
  if (day === today) return timeOfDay.format(date);
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000);
  if (days === 1) return `Yesterday ${timeOfDay.format(date)}`;
  if (days > 1 && days < 7) return `${days} days ago`;
  if (days < 0) return formatShortDate(date, now);
  return formatShortDate(date, now);
}

/** Age in words: "1h", "35m", "3d". */
export function formatAge(value: unknown, now = Date.now()): string {
  const date = parseInstant(value);
  if (!date) return "—";
  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "(281) 900-1836" for a 10-digit US number; anything else is shown as stored. */
export function formatPhone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return value.trim();
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function percentOf(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part === null || part === undefined || !whole) return null;
  return Math.min(1, Math.max(0, part / whole));
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}
