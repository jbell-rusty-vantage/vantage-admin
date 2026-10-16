/** Calendar-date arithmetic: UTC is only a carrier for New York date labels, never an elapsed local day. */
export function shiftPerformanceDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function performanceWeekStart(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftPerformanceDate(date, -((weekday + 6) % 7));
}
export function performanceDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function performanceCount(value: number | null): string { return value === null ? "Pending data" : value.toLocaleString("en-US"); }
export function performanceRate(value: number | null): string { return value === null ? "Not ranked" : `${Number((value * 100).toFixed(1))}%`; }
export function performanceState(value: string): string {
  return ({ met: "Met", goal_met: "Goal met", not_met: "Not met", in_progress: "In progress", no_goal: "No goal", no_texts_due: "No texts due", pending: "Pending data", pending_data: "Pending data", upcoming: "Upcoming", future: "Upcoming", unavailable: "Pending data" } as Record<string, string>)[value] ?? value.replaceAll("_", " ");
}
