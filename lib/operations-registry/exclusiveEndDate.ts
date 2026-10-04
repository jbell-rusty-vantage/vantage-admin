/**
 * The backend filters with exclusive `occurred_at < to`. Date-only inputs
 * ("2026-06-12") coerce to midnight UTC, which would exclude the selected
 * day entirely, so date-only `to` values are advanced by one day. Full ISO
 * timestamps pass through untouched.
 */
export function exclusiveEndDate(to?: string): string | undefined {
  if (!to) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return to;
  }
  const date = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return to;
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
