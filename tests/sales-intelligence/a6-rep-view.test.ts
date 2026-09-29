import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TeamRow, WorkloadCount } from "../../lib/api/salesIntelligenceOverview";
import { activityOverviewSchema } from "../../lib/api/salesIntelligenceOverview";
import { metricTiles } from "../../components/sales-intelligence/desk/metrics-strip";
import { parseDeskUrl, deskUrlUpdate } from "../../components/sales-intelligence/data/url-state";
import { clearRepViewFilters, repCanonicalHref, repViewHref } from "../../components/sales-intelligence/rep-view/drills";
import { RepViewHeader } from "../../components/sales-intelligence/rep-view/rep-view";
import { MyWorkloadView } from "../../components/sales-intelligence/rep/my-workload";
import { TeamWorkload } from "../../components/sales-intelligence/overview/team-workload";
import { LineSix } from "../../components/sales-intelligence/card/card-lines";
import { isExpiredSnapshot } from "../../components/sales-intelligence/rep-view/snapshot-freshness";
import { SalesIntelligenceError } from "../../lib/api/salesIntelligence";

const AGENT = "a".repeat(24);
const OTHER = "b".repeat(24);
const snapshot = "outreach:test-snapshot";
const metric = (count: number, params: Record<string, string | string[]>): WorkloadCount => ({ count, drill: { params: { view: "all_outreach", snapshot_id: snapshot, priority: ["OI"], state: ["unworked", "open"], ...params } } });
const row: TeamRow = {
  agent: { id: AGENT, name: "Alex", active: false },
  assigned: metric(1, { assigned_agent_id: [AGENT] }),
  records_with_overdue: metric(1, { assigned_agent_id: [AGENT], work: ["overdue_followup"] }),
  due_today: metric(2, { assigned_agent_id: [AGENT], work: ["due_today"] }),
  no_next_step: metric(0, { assigned_agent_id: [AGENT], work: ["no_next_step"] }),
  blocked: metric(0, { assigned_agent_id: [AGENT], work: ["blocked"] }),
  followups: { actions: metric(3, { followup_agent_id: [AGENT] }), records: metric(2, { followup_agent_id: [AGENT] }) },
  followups_overdue: { actions: metric(2, { followup_agent_id: [AGENT], work: ["overdue_followup"] }), records: metric(1, { followup_agent_id: [AGENT], work: ["overdue_followup"] }) },
  involved: metric(4, { agent_id: [AGENT] }),
};

test("A6 Owner rep drill keeps the exact server filters and pinned snapshot", () => {
  const url = new URL(repViewHref(row.followups.records, AGENT, "followup"), "http://local");
  assert.equal(url.searchParams.get("view"), "rep");
  assert.equal(url.searchParams.get("agent"), AGENT);
  assert.equal(url.searchParams.get("relationship"), "followup");
  assert.equal(url.searchParams.get("snapshot_id"), snapshot);
  assert.deepEqual(url.searchParams.getAll("priority"), ["OI"]);
  assert.deepEqual(url.searchParams.getAll("state"), ["unworked", "open"]);
  assert.deepEqual(url.searchParams.getAll("followup_agent_id"), [AGENT]);
  assert.equal(parseDeskUrl(url.searchParams).view, "rep");
});

test("A6 rep cannot open Owner rep view; strict self-work filters remain narrowing", () => {
  const state = parseDeskUrl(new URLSearchParams(`view=rep&agent=${OTHER}&agent_id=${OTHER}&assigned_agent_id=${OTHER}&followup_agent_id=${OTHER}&relationship=assigned&snapshot_id=${snapshot}`), "rep");
  assert.equal(state.view, "all_outreach");
  assert.deepEqual(state.agent_id, []);
  assert.deepEqual(state.assigned_agent_id, []);
  assert.deepEqual(state.followup_agent_id, []);
  assert.equal(state.agent, null);
  assert.equal(state.relationship, null);
  assert.equal(state.snapshot_id, null);
  const fallback = deskUrlUpdate(`view=rep&agent=${OTHER}&relationship=assigned&assigned_agent_id=${OTHER}&snapshot_id=${snapshot}`, {}, "rep");
  for (const key of ["view", "agent", "relationship", "assigned_agent_id", "snapshot_id"]) assert.equal(fallback.has(key), false, key);
  const updated = deskUrlUpdate(`agent_id=${OTHER}&assigned_agent_id=${OTHER}`, { work: ["overdue_followup"] }, "rep");
  assert.equal(updated.has("agent_id"), false);
  assert.equal(updated.get("assigned_agent_id"), OTHER);
});

test("A6 rep header has relationship counts, exact quick drill, activity, and updated-since notice", () => {
  const html = renderToStaticMarkup(createElement(RepViewHeader, { row, selected: "followup", activeWork: [], snapshotId: "outreach:older", latestSnapshotId: snapshot,
    activity: { human_conversations: 3, outbound_attempts: 9, last_conversation_at: "2026-09-29T13:42:00Z" } }));
  assert.ok(html.includes("Owner viewing Alex"));
  assert.ok(html.includes("inactive, has work"));
  assert.ok(html.includes("Follow-ups assigned"));
  assert.ok(html.includes("followup_agent_id"));
  assert.ok(html.includes("Updated since"));
  assert.ok(html.includes("9:42 AM"));
  const withBack = renderToStaticMarkup(createElement(RepViewHeader, { row, selected: "assigned", activeWork: [], snapshotId: snapshot, latestSnapshotId: snapshot, activity: null, overviewHref: "/sales-intelligence?priority=OI" }));
  assert.ok(withBack.includes("/sales-intelligence?priority=OI"));
});

test("A6 rep Overview workload is compact and has no team table", () => {
  const html = renderToStaticMarkup(createElement(MyWorkloadView, { row }));
  assert.ok(html.includes("My workload"));
  assert.ok(html.includes("Follow-ups assigned"));
  assert.ok(html.includes("3 on 2 records"));
  assert.ok(html.includes("My overdue follow-ups"));
  assert.ok(html.includes("2 on 1 record"));
  assert.ok(!html.includes("<table"));
  const overview = renderToStaticMarkup(createElement(TeamWorkload, { data: { rows: [row], unassigned: null, attention: null, snapshot_id: snapshot, as_of: "2026-09-29T12:00:00Z", status: "ready" }, rep: true }));
  assert.ok(overview.includes("My workload"));
  assert.ok(!overview.includes("<table"));
  assert.ok(!overview.includes("Search rep"));
});

test("A6 bare Owner rep URL first resolves to the server's counted open-state drill; Clear keeps rep scope", () => {
  const bare = `view=rep&agent=${AGENT}&sort=move_date&direction=asc&band=1&band=2&work=due_today&work=blocked`;
  const state = parseDeskUrl(new URLSearchParams(bare));
  const canonical = repCanonicalHref(state, bare, row.assigned);
  const params = new URL(canonical!, "http://local").searchParams;
  assert.deepEqual(params.getAll("state"), ["unworked", "open"]);
  assert.equal(params.get("snapshot_id"), snapshot);
  assert.equal(params.get("assigned_agent_id"), AGENT);
  assert.equal(params.get("sort"), "move_date");
  assert.equal(params.get("direction"), "asc");
  assert.deepEqual(params.getAll("band"), ["1", "2"]);
  assert.deepEqual(params.getAll("work"), ["due_today", "blocked"]);
  const clear = deskUrlUpdate(params, clearRepViewFilters(parseDeskUrl(params)));
  assert.equal(clear.get("view"), "rep");
  assert.equal(clear.get("agent"), AGENT);
  assert.equal(clear.get("relationship"), "assigned");
  assert.equal(clear.get("sort"), "move_date");
  assert.equal(clear.has("snapshot_id"), false);
  assert.equal(repCanonicalHref(parseDeskUrl(clear), clear.toString(), row.assigned)?.includes("snapshot_id="), true);
});

test("A6 Overdue tile uses the server record count and exact drill", () => {
  const [,, overdue] = metricTiles({ records_with_overdue: 3335 } as never, "2026-09-29T12:00:00Z", row.records_with_overdue);
  assert.equal(overdue.value, 1);
  assert.equal(overdue.label, "Records with overdue follow-ups");
  const params = new URL(overdue.href!, "http://local").searchParams;
  assert.equal(params.get("snapshot_id"), snapshot);
  assert.deepEqual(params.getAll("priority"), ["OI"]);
  assert.deepEqual(params.getAll("work"), ["overdue_followup"]);
});

test("A6 activity accepts the new server last-conversation fact and older null/missing shapes", () => {
  const payload = { ok: true, as_of: "2026-09-29T12:00:00Z", data: { totals: { human_conversations: 1, outbound_attempts: 2 }, by_rep: [{ agent_id: AGENT, name: "Alex", human_conversations: 1, outbound_attempts: 2, last_conversation_at: null }], unmapped: null, coverage: [], status: "complete", period: { key: "today", from_day: "2026-09-29", to_day: "2026-09-29", start: "2026-09-29T04:00:00Z", end: "2026-09-30T04:00:00Z" } } };
  assert.equal(activityOverviewSchema.parse(payload).data.by_rep[0]?.last_conversation_at, null);
  delete (payload.data.by_rep[0] as Partial<typeof payload.data.by_rep[number]>).last_conversation_at;
  assert.equal(activityOverviewSchema.parse(payload).data.by_rep[0]?.last_conversation_at, undefined);
});

test("A6 Row F distinguishes the selected rep's primary follow-up from another primary", () => {
  const outreach = { next_action: { description: "Call customer", due_at: null, assignment: { agent: { id: AGENT, name: "Alex" } } }, facts: { next_action_state: "due" }, assignment: { agent: { id: AGENT, name: "Alex" } } } as never;
  const selected = renderToStaticMarkup(createElement(LineSix, { o: outreach, asOf: "2026-09-29T12:00:00Z", selectedFollowup: { id: AGENT, name: "Alex" } }));
  assert.ok(selected.includes('data-selected-followup="primary"'));
  const secondary = renderToStaticMarkup(createElement(LineSix, { o: outreach, asOf: "2026-09-29T12:00:00Z", selectedFollowup: { id: OTHER, name: "Sam" } }));
  assert.ok(secondary.includes('data-selected-followup="secondary"'));
  assert.ok(secondary.includes("Sam has another follow-up"));
  assert.ok(secondary.includes("Call customer"), "the primary remains identified rather than relabelled as Sam's action");
});

test("A6 an expired pinned snapshot is not silently replaced", () => {
  assert.equal(isExpiredSnapshot(new SalesIntelligenceError("SNAPSHOT_EXPIRED", 409), snapshot), true);
  assert.equal(isExpiredSnapshot(new SalesIntelligenceError("BAD_FILTER", 400), snapshot), false);
  assert.equal(isExpiredSnapshot(new SalesIntelligenceError("SNAPSHOT_EXPIRED", 409), null), false);
});
