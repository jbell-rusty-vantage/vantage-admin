/** `datetime-local` values in America/New_York, both ways. Pure. */
const eastern = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** An instant as the Eastern `YYYY-MM-DDTHH:mm:ss` a `datetime-local` input shows. */
export const easternInput = (iso: string) => eastern.format(new Date(iso)).replace(" ", "T");

/**
 * An Eastern `datetime-local` value as an ISO instant; blank is null. Throws on an incomplete value, and on a time that
 * is missing or ambiguous at a daylight-saving change (never guesses).
 */
export function easternInstant(value: string): string | null {
  if (!value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error("Enter a complete date and time.");
  const normalized = value.length === 16 ? `${value}:00` : value;
  const naive = Date.parse(`${normalized}Z`);
  const matches = [4, 5].map((hours) => new Date(naive + hours * 3600000)).filter((candidate) => Number.isFinite(+candidate) && easternInput(candidate.toISOString()) === normalized);
  if (matches.length !== 1) throw new Error("This Eastern time is missing or ambiguous at a daylight-saving change. Choose an unambiguous time.");
  return matches[0].toISOString();
}
