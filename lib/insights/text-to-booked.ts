/**
 * Text to booked (doc 09 "More breakdowns"; was its own Analytics tab): of the leads whose confirmation text was
 * accepted, sent or delivered, how many booked, by message origin. Reads the older
 * `api/v1/admin/analytics/sms-successfully-sent-then-booked` report (`{ items: [{ origin, label, texted_leads,
 * booked_leads, booking_rate }] }`, first item `origin: "all"`). Pure.
 */
export type TextToBookedRow = { key: string; label: string; texted: number; booked: number; rate: number | null };

export type TextToBookedSummary = { overall: TextToBookedRow | null; origins: TextToBookedRow[] };

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

function toRow(item: Record<string, unknown>): TextToBookedRow {
  const texted = count(item.texted_leads);
  const booked = count(item.booked_leads);
  const origin = typeof item.origin === "string" && item.origin.trim() ? item.origin : "unknown";
  const label = typeof item.label === "string" && item.label.trim() ? item.label : origin;
  return { key: origin, label, texted, booked, rate: texted > 0 ? booked / texted : null };
}

/** The overall row and the per-origin rows (most texted first). Accepts `{ items }` or a bare array. */
export function textToBookedSummary(data: unknown): TextToBookedSummary {
  const items = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.items) ? data.items : [];
  const rows = items.filter(isRecord).map(toRow);
  const overall = rows.find((row) => row.key === "all") ?? null;
  const origins = rows.filter((row) => row.key !== "all" && row.texted > 0).sort((a, b) => b.texted - a.texted || a.label.localeCompare(b.label));
  return { overall, origins };
}
