import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RepPerformance, PerformanceDay } from "../../components/outreach-desk/views/rep-performance";
import { performanceWeekStart, shiftPerformanceDate, performanceCount, performanceRate } from "../../components/outreach-desk/lib/performance";
import { salesOutreachPerformanceSchema, salesOutreachPaths } from "../../lib/api/salesOutreach";
import { outreachKeys, outreachInvalidationKeys } from "../../lib/query/salesOutreach";

function fixture() {
  return salesOutreachPerformanceSchema.parse({
    week: { start: "2026-10-12", end_exclusive: "2026-10-19", through: "2026-10-16", timezone: "America/New_York" }, as_of: "2026-10-16T16:00:00Z",
    earliest_reliable_dates: { calls: "2026-10-12", text_volume: null, text_requirements: null }, channel_freshness: { calls: null, texts: null }, provisional: { calls: true, texts: true },
    rows: [{ agent_id: "alice", name: "Alice", historical_membership_state: "active", calls: { rank: 1, weekly_volume: 486, met_days: 3, eligible_days: 4, pending_days: 1, completion_rate: .75, provisional: true }, texts: { rank: null, weekly_volume: null, on_time_required: 0, resolved_due_required: 0, pending_requirements: 1, completion_rate: null, provisional: true },
      days: Array.from({ length: 7 }, (_, index) => ({ business_date: shiftPerformanceDate("2026-10-12", index), future: index > 4, calls: { actual: index === 4 ? 62 : index > 4 ? null : 100, goal: 100, state: index > 4 ? "upcoming" : "in_progress", coverage: "partial" }, texts: { sent: null, on_time_required: 0, resolved_due_required: 0, applicable_required: 1, pending: 1, state: "pending_data", coverage: "unknown" } })) }], unassigned: { required_text_counts: 1 },
  });
}
function render(data: ReturnType<typeof fixture> | null, week = "2026-10-12") {
  const client = new QueryClient();
  if (data) client.setQueryData(outreachKeys.performance(week), data);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(RepPerformance, { asOf: "2026-10-16T16:00:00Z" })));
  client.clear(); return html;
}
test("New York week date labels survive Sundays, Mondays, year boundaries and DST", () => {
  assert.equal(performanceWeekStart("2026-11-01"), "2026-10-26");
  assert.equal(performanceWeekStart("2026-11-02"), "2026-11-02");
  assert.equal(shiftPerformanceDate("2026-03-02", 7), "2026-03-09");
  assert.equal(performanceWeekStart("2027-01-01"), "2026-12-28");
  assert.equal(performanceCount(null), "Pending data"); assert.equal(performanceCount(0), "0");
  assert.equal(performanceRate(null), "Not ranked"); assert.equal(performanceRate(0), "0%");
});
test("performance renders server fraction, separate volume, today status and accessible daily disclosure", () => {
  const html = render(fixture());
  for (const text of ["3/4 days", "75%", "486", "62 calls", "100 goal", "Provisional", "1 pending day", "Upcoming", 'role="tablist"', 'role="tabpanel"', 'aria-expanded="false"', "Show daily performance for Alice"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("121.5%"));
  assert.equal((html.match(/<th scope="row">(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g) ?? []).length, 7);
});
test("a different cached week cannot masquerade as the requested week", () => {
  const html = render(fixture(), "2026-10-05");
  assert.ok(!html.includes("Alice")); assert.ok(html.includes("Loading performance"));
});
test("schema preserves null activity and rejects incomplete weekly shape", () => {
  const data = fixture(); assert.equal(data.rows[0].texts.weekly_volume, null);
  assert.equal(salesOutreachPerformanceSchema.safeParse({ ...data, rows: [{ ...data.rows[0], days: [] }] }).success, false);
  assert.equal(salesOutreachPaths.performance("2026-10-12"), "performance?week_start=2026-10-12");
});
test("both evidence hints invalidate historical as well as current performance keys", () => {
  for (const topic of ["outreach_desk", "outreach_goal"] as const) {
    const keys = outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: [topic], changes: [] });
    assert.ok(keys.some(key => JSON.stringify(key) === JSON.stringify(outreachKeys.performanceAll())));
  }
  assert.notDeepEqual(outreachKeys.performance("2026-10-12"), outreachKeys.performance("2026-10-05"));
});

test("text daily detail keeps live applicable requirements distinct from resolved ranking denominator", () => {
  const day = fixture().rows[0].days[0];
  day.texts = { sent: 12, on_time_required: 4, resolved_due_required: 4, applicable_required: 6, pending: 2, state: "in_progress", coverage: "partial" };
  const html = renderToStaticMarkup(createElement(PerformanceDay, { day, channel: "texts" }));
  for (const value of ["12 sent", "4/6 required on time", "In progress", "2 pending requirements", "capture catching up"]) assert.ok(html.includes(value), value);
  day.future = true;
  const future = renderToStaticMarkup(createElement(PerformanceDay, { day, channel: "texts" }));
  assert.equal(future, "Upcoming");
});
