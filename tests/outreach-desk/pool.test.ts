import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { salesOutreachPoolSchema, salesOutreachQueueSchema, salesOutreachDetailSchema, salesOutreachQueueQuery, type SalesOutreachPoolDto } from "../../lib/api/salesOutreach";
import { canonicalDeskQuery } from "../../components/outreach-desk/data/desk-url";
import { PoolStatus, PoolWorkload } from "../../components/outreach-desk/views/pool-status";
import { QueueRow } from "../../components/outreach-desk/views/my-view";
import { LeadPanel } from "../../components/outreach-desk/views/lead-panel";
import { clearSubject, outreachInvalidationKeys, outreachKeys } from "../../lib/query/salesOutreach";
import { mockSalesOutreachResponse } from "../../lib/api/salesOutreachMock";
import { SYNTHETIC_AGENTS, SYNTHETIC_AS_OF, syntheticDetail, syntheticQueueRows } from "./fixtures/synthetic";

const pool: SalesOutreachPoolDto = {
  business_date: "2026-10-01", state: "completed", due_at: "2026-10-02T00:00:00.000Z",
  completed_at: SYNTHETIC_AS_OF, completed_by_agent_id: SYNTHETIC_AGENTS.alex.id,
  completed_by_agent_name: "Alex Morgan", completion_event_id: "6650a1b2c3d4e5f607199001",
};
const markup = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

test("Pool is a separate queue scope, retains strict request keys and survives every Desk role URL", () => {
  for (const role of ["owner", "manager", "rep"] as const) {
    assert.equal(canonicalDeskQuery(new URLSearchParams("view=my&workflow=pool&state=all_active&q=P555"), role).get("workflow"), "pool");
    assert.equal(canonicalDeskQuery(new URLSearchParams("view=my&workflow=other"), role).get("workflow"), "other");
  }
  assert.equal(salesOutreachQueueQuery({ queue_scope: "pool", state: "all_active" }).toString(), "queue_scope=pool&state=all_active");
  assert.equal(salesOutreachQueueQuery({ workflow: "other" }).toString(), "workflow=other");
  assert.equal(salesOutreachQueueQuery({ queue_scope: "assigned" }).toString(), "");
});

test("Pool duty contract rejects incomplete or invented completion and preserves caller identity in list/detail", () => {
  assert.deepEqual(salesOutreachPoolSchema.parse(pool), pool);
  assert.equal(salesOutreachPoolSchema.safeParse({ ...pool, state: "overdue" }).success, false);
  assert.equal(salesOutreachPoolSchema.safeParse({ ...pool, client_can_complete: true }).success, false);
  const { completed_by_agent_id: omitted, ...missingCaller } = pool;
  assert.ok(omitted);
  assert.equal(salesOutreachPoolSchema.safeParse(missingCaller).success, false);
  const response = mockSalesOutreachResponse({ role: "owner", path: "queue", method: "GET" });
  const queue = salesOutreachQueueSchema.parse({ ...(response.body as { data: object }).data, rows: [{ ...syntheticQueueRows()[0], pool }] });
  assert.deepEqual(queue.rows[0]?.pool, pool);
  const detail = syntheticDetail({ subjectId: syntheticQueueRows()[0]!.subject_id, role: "rep" })!;
  assert.deepEqual(salesOutreachDetailSchema.parse({ ...detail, pool }).pool, pool);
});

test("shared completion displays the actual teammate while retaining the assigned Rep and unassigned badge", () => {
  const row = { ...syntheticQueueRows()[0]!, assigned_agent_id: SYNTHETIC_AGENTS.sam.id, assigned_agent_name: "Sam Taylor", pool };
  const html = markup(createElement(QueueRow, { row, asOf: SYNTHETIC_AS_OF, relativeNow: SYNTHETIC_AS_OF, selected: false, onSelect() {}, onMove() {} }));
  assert.match(html, /Assigned to Sam Taylor/);
  assert.match(html, /Shared call completed/);
  assert.match(html, /Alex Morgan/);
  const unassigned = markup(createElement(QueueRow, { row: { ...row, assigned_agent_id: null, assigned_agent_name: null }, asOf: SYNTHETIC_AS_OF, relativeNow: SYNTHETIC_AS_OF, selected: false, onSelect() {}, onMove() {} }));
  assert.match(unassigned, /Unassigned/);
  const pending = markup(createElement(PoolStatus, { pool: { ...pool, state: "coverage_pending", completed_at: null, completed_by_agent_id: null, completed_by_agent_name: null, completion_event_id: null }, asOf: SYNTHETIC_AS_OF }));
  assert.match(pending, /Call coverage pending/);
  assert.doesNotMatch(pending, /overdue|completed|Alex Morgan/i);
});

test("assigned Pool fulfillment and actual outbound remain distinct in the workload display", () => {
  const html = markup(createElement(PoolWorkload, { summary: { team_due: 2, team_completed: 3, assigned_due: 1, assigned_completed: 2, actual_outbound: 0 }, assigned: true }));
  assert.match(html, /1 due · 2 fulfilled/);
  assert.match(html, /Actual Pool outbound calls:<\/strong> 0/);
  assert.match(html, /actual caller/);
});

test("shared Pool detail hides callback commands and exposes assigned Rep and caller without a completion button", () => {
  const client = new QueryClient();
  const detail = { ...syntheticDetail({ subjectId: syntheticQueueRows()[0]!.subject_id, role: "rep" })!, pool };
  client.setQueryData(outreachKeys.detail(detail.subject.subject_id), detail);
  const html = markup(createElement(QueryClientProvider, { client }, createElement(LeadPanel, { subjectId: detail.subject.subject_id, commands: ["callback", "quoted_followup"], reps: null, onRevoked() {} })));
  assert.match(html, /Shared call completed/);
  assert.match(html, /Alex Morgan/);
  assert.doesNotMatch(html, /Schedule a callback|Set quoted date|Mark complete/);
  client.clear();
});

test("Pool completion resnapshots all eligible readers and revocation removes shared cached rows and detail", () => {
  assert.deepEqual(outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_pool"], changes: [] }), [outreachKeys.all]);
  const client = new QueryClient();
  const id = syntheticQueueRows()[0]!.subject_id;
  client.setQueryData(outreachKeys.queue({ queue_scope: "pool" }), { pages: [{ rows: [{ subject_id: id, pool }] }], pageParams: [null] });
  client.setQueryData(outreachKeys.detail(id), { pool });
  clearSubject(client, id);
  assert.equal(client.getQueryData(outreachKeys.detail(id)), undefined);
  assert.deepEqual((client.getQueryData(outreachKeys.queue({ queue_scope: "pool" })) as { pages: unknown[] }).pages, [{ rows: [] }]);
  client.clear();
});
