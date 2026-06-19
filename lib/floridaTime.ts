export const FLORIDA_TIME_ZONE = "America/New_York";

const easternDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FLORIDA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const floridaCalendarDisplayFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function easternCalendarParts(value: Date) {
  const parts = easternDateFormatter.formatToParts(value);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
}

export function formatFloridaCalendarDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return floridaCalendarDisplayFormatter.format(date);
}

export function floridaCalendarDateInputValue(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = easternCalendarParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function floridaCalendarToday(now: Date = new Date()): Date {
  const parts = easternCalendarParts(now);
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
}
