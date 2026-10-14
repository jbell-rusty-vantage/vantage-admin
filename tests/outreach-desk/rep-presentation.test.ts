import assert from "node:assert/strict";
import test from "node:test";
import { interactionText, moveDateRange, moveDateText } from "../../components/outreach-desk/lib/format";
import { msUntilNewYorkMidnight } from "../../components/outreach-desk/data/use-desk-live";
import { canonicalDeskQuery } from "../../components/outreach-desk/data/desk-url";
import { salesOutreachPaths, salesOutreachQueueQuery, salesOutreachRepMetricsSchema } from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { outreachInvalidationKeys, outreachKeys } from "../../lib/query/salesOutreach";
import { SYNTHETIC_REP_AGENT_ID, syntheticQueueRows } from "./fixtures/synthetic";

test("move labels use NY calendar days across both DST transitions and year rollover", () => {
  assert.equal(moveDateText("2026-03-09", "2026-03-08T05:00:00Z"), "in 1 day");
  assert.equal(moveDateText("2026-11-02", "2026-11-01T04:00:00Z"), "in 1 day");
  assert.equal(moveDateText("2025-12-31", "2026-01-01T05:00:00Z"), "1 day ago");
  assert.equal(moveDateText("2026-10-13", "2026-10-14T03:59:00Z"), "Today");
  assert.equal(moveDateText(null, "2026-10-14T04:00:00Z"), "No move date");
});

test("interaction age includes minute/hour/day precision, null and explicit future timestamp", () => {
  const now = "2026-10-13T16:00:00Z";
  assert.equal(interactionText(null, now), "No interaction");
  assert.equal(interactionText("2026-10-13T15:59:45Z", now), "just now");
  assert.equal(interactionText("2026-10-13T15:57:00Z", now), "3 min ago");
  assert.equal(interactionText("2026-10-13T13:00:00Z", now), "3 h ago");
  assert.equal(interactionText("2026-10-11T16:00:00Z", now), "2 days ago");
  assert.equal(interactionText("2026-10-13T16:01:00Z", now), "Timestamp ahead of current time");
});

test("NY rollover timer targets actual midnight on 23-hour and 25-hour days", () => {
  assert.equal(msUntilNewYorkMidnight(new Date("2026-03-08T05:00:00Z")), 23 * 3_600_000 + 1000);
  assert.equal(msUntilNewYorkMidnight(new Date("2026-11-01T04:00:00Z")), 25 * 3_600_000 + 1000);
  assert.equal(msUntilNewYorkMidnight(new Date("2027-01-01T04:59:59Z")), 2000);
});

test("Future and Past never classify unknown, and filters survive URL round trips for both queues", () => {
  assert.deepEqual(moveDateRange("upcoming", "2026-01-01"), { move_date_from: "2026-01-01" });
  assert.deepEqual(moveDateRange("past", "2026-01-01"), { move_date_to: "2025-12-31" });
  assert.deepEqual(moveDateRange("unknown", "2026-01-01"), { move_date_unknown: "only" });
  for (const view of ["my", "team"]) {
    const query = new URLSearchParams(`view=${view}&q=P555&priority=3&workflow=daily&sort=move_date&move=upcoming`);
    const canonical = canonicalDeskQuery(query, "manager");
    assert.equal(canonical.get("sort"), "move_date");
    assert.equal(canonical.get("move"), "upcoming");
    assert.equal(canonical.get("priority"), "3");
    assert.equal(canonicalDeskQuery(canonical, "manager").toString(), canonical.toString());
  }
  assert.equal(canonicalDeskQuery(new URLSearchParams("view=my&sort=move_date&direction=desc"), "rep").get("direction"), "asc");
  const wire = salesOutreachQueueQuery({ search: "P555", workflow: "daily", priority: "3", sort: "move_date", direction: "desc", ...moveDateRange("past", "2026-01-01") });
  assert.equal(wire.get("direction"), "asc");
  assert.equal(wire.get("move_date_to"), "2025-12-31");
});

test("money read matches contract, protects foreign Rep ids, and shares the existing live invalidation root", () => {
  const response = mockSalesOutreachResponse({ role: "rep", path: "rep-metrics", method: "GET" });
  assert.equal(response.status, 200);
  const data = salesOutreachRepMetricsSchema.parse((response.body as { data: unknown }).data);
  assert.equal(data.agent_id, SYNTHETIC_REP_AGENT_ID);
  assert.equal(data.assigned_potential.coverage, "partial");
  assert.equal(data.assigned_potential.known_binder_total, 6500.75);
  assert.equal(mockSalesOutreachResponse({ role: "rep", path: "rep-metrics", method: "GET", query: { agent_id: "ffffffffffffffffffffffff" } }).status, 403);
  assert.equal(mockSalesOutreachResponse({ role: "manager", path: "rep-metrics", method: "GET" }).status, 400);
  assert.equal(salesOutreachPaths.repMetrics({ agent_id: SYNTHETIC_REP_AGENT_ID }), `rep-metrics?agent_id=${SYNTHETIC_REP_AGENT_ID}`);
  assert.deepEqual(outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_rep_metrics"], changes: [] }), [outreachKeys.repMetricsAll()]);
  for (const reason of ["connect", "reconnect", "clock"] as const) assert.deepEqual(outreachInvalidationKeys({ reason, refetch: "all", topics: [], changes: [] }), [outreachKeys.all]);
});

test("mock full queue sorts known dates then unknown across pages and composes search/move/rep scope", () => {
  const request = (query: Record<string, string>) => mockSalesOutreachResponse({ role: "owner", path: "queue", method: "GET", query });
  const all = syntheticQueueRows("desk").filter((row) => row.status_flags.needs_contact).sort((a, b) => (a.move_date ?? "9999-99-99").localeCompare(b.move_date ?? "9999-99-99") || a.subject_id.localeCompare(b.subject_id));
  const collected: string[] = [];
  let cursor: string | null = null;
  do {
    const result = request({ sort: "move_date", limit: "2", ...(cursor ? { cursor } : {}) });
    const data = (result.body as { data: { rows: { subject_id: string }[]; next_cursor: string | null } }).data;
    collected.push(...data.rows.map((row) => row.subject_id));
    cursor = data.next_cursor;
  } while (cursor);
  assert.deepEqual(collected, all.map((row) => row.subject_id));
  const combined = request({ agent_id: SYNTHETIC_REP_AGENT_ID, search: "P555", move_date_from: "2026-10-01", sort: "move_date" });
  const rows = (combined.body as { data: { rows: ReturnType<typeof syntheticQueueRows> } }).data.rows;
  assert.ok(rows.every((row) => row.assigned_agent_id === SYNTHETIC_REP_AGENT_ID && row.move_date !== null && row.move_date >= "2026-10-01"));
});
