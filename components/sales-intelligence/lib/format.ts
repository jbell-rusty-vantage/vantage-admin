import { copy } from "../sales-intelligence-copy";

/** Display helpers only: no ticking, ranking, deadlines or staffed-clock calculation. */
export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" ");

const date = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export const formatDateTime = (value: string | null | undefined) =>
  value ? date.format(new Date(value)) : copy.time.notObserved;

const day = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const formatDay = (value: string | null | undefined) =>
  value ? day.format(new Date(value)) : copy.time.notObserved;

const display: Record<string, string> = {
  ...copy.classification,
  ...copy.eligibility,
  ...copy.contactType,
  ...copy.result,
  ...copy.direction,
  ...copy.attachment,
  ...copy.certainty,
  ...copy.attachmentState,
  ...copy.restrictionState,
};

export const label = (value: string) => display[value] ?? value.replaceAll("_", " ");

export const classificationLabel = (value: string) =>
  copy.classification[value as keyof typeof copy.classification] ?? label(value);

export const eligibilityLabel = (value: string) =>
  copy.eligibility[value as keyof typeof copy.eligibility] ?? label(value);

export const contactTypeLabel = (value: string) =>
  copy.contactType[value as keyof typeof copy.contactType] ?? label(value);

export const officialStatusLabel = (value: string) =>
  copy.official[value as keyof typeof copy.official] ?? label(value);

export function leadMatchSummary(attached: number, candidates: number): string {
  if (!attached && !candidates) return copy.lead.noLead;
  const parts: string[] = [];
  if (attached) parts.push(attached === 1 ? "1 attached" : `${attached} attached`);
  if (candidates) parts.push(candidates === 1 ? "1 candidate" : `${candidates} candidates`);
  return parts.join(" · ");
}

/** A provider call duration in seconds as `4m 05s` / `42s`; null stays unknown. */
export function formatCallDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return copy.fields.unknown;
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes < 60) return `${minutes}m ${String(rest).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
