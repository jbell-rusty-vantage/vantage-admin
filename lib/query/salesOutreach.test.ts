import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { applyOutreachFrame, clearOutreachDesk, clearSubject, outreachInvalidationKeys, outreachKeys } from "./salesOutreach";

const SUBJECT_A = "6650a1b2c3d4e5f607182a01";
const SUBJECT_B = "6650a1b2c3d4e5f607182a02";
const change = (topic: "outreach_desk" | "outreach_goal" | "outreach_configuration", subject_ids: string[] = []) => ({ topic, subject_ids });

test("keys share one root and normalize filters (empty values dropped, order-independent)", () => {
  assert.deepEqual(outreachKeys.all, ["sales-outreach"]);
  assert.deepEqual(outreachKeys.queue({ state: "all_active", search: "", agent_id: null, unassigned: false }), ["sales-outreach", "queue", { state: "all_active" }]);
  assert.deepEqual(outreachKeys.queue({ sort: "lead_received", state: "all_active" }), outreachKeys.queue({ state: "all_active", sort: "lead_received" }));
  assert.deepEqual(outreachKeys.repDays("2026-10-01", null), ["sales-outreach", "rep-days", { business_day: "2026-10-01" }]);
  assert.deepEqual(outreachKeys.detail(SUBJECT_A), ["sales-outreach", "detail", SUBJECT_A]);
  for (const key of [outreachKeys.capabilities(), outreachKeys.team(), outreachKeys.configuration(), outreachKeys.restrictions("active"), outreachKeys.enrollmentCandidates("older")]) {
    assert.equal(key[0], "sales-outreach");
  }
});

test("connect, reconnect, clock, refetch all and configuration changes refetch the whole desk", () => {
  for (const reason of ["connect", "reconnect", "clock"] as const) {
    assert.deepEqual(outreachInvalidationKeys({ reason, refetch: "scoped", topics: [], changes: [] }), [outreachKeys.all]);
  }
  assert.deepEqual(outreachInvalidationKeys({ reason: "change", refetch: "all", topics: ["outreach_goal"], changes: [change("outreach_goal")] }), [outreachKeys.all]);
  assert.deepEqual(outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_configuration"], changes: [change("outreach_configuration")] }), [outreachKeys.all]);
  assert.deepEqual(outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: [], changes: [] }), [outreachKeys.all], "an empty change frame can't be narrowed");
});

test("outreach_desk refetches the queue, the team and the listed subjects only; outreach_goal refetches goal reads", () => {
  const desk = outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_desk"], changes: [change("outreach_desk", [SUBJECT_A, SUBJECT_B, SUBJECT_A])] });
  assert.deepEqual(desk, [outreachKeys.queueAll(), outreachKeys.teamAll(), outreachKeys.detail(SUBJECT_A), outreachKeys.detail(SUBJECT_B)]);
  const deskNoIds = outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_desk"], changes: [change("outreach_desk")] });
  assert.ok(deskNoIds.some((key) => JSON.stringify(key) === JSON.stringify(outreachKeys.detailAll())));
  const goal = outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_goal"], changes: [change("outreach_goal")] });
  assert.deepEqual(goal, [outreachKeys.repDaysAll(), outreachKeys.teamAll()]);
  const both = outreachInvalidationKeys({ reason: "change", refetch: "scoped", topics: ["outreach_desk", "outreach_goal"], changes: [change("outreach_desk", [SUBJECT_A]), change("outreach_goal")] });
  assert.equal(both.filter((key) => JSON.stringify(key) === JSON.stringify(outreachKeys.teamAll())).length, 1, "keys are deduplicated");
});

test("applyOutreachFrame invalidates exactly the routed prefixes", async () => {
  const invalidated: unknown[] = [];
  await applyOutreachFrame({ invalidateQueries: async (filters?: { queryKey?: unknown }) => void invalidated.push(filters?.queryKey) } as never, {
    reason: "change",
    refetch: "scoped",
    topics: ["outreach_goal"],
    changes: [change("outreach_goal")],
  });
  assert.deepEqual(invalidated, [outreachKeys.repDaysAll(), outreachKeys.teamAll()]);
});

test("clearSubject forgets the detail and removes the row from queue pages (plain and infinite) and team attention rows", () => {
  const client = new QueryClient();
  client.setQueryData(outreachKeys.detail(SUBJECT_A), { subject: { subject_id: SUBJECT_A } });
  client.setQueryData(outreachKeys.detail(SUBJECT_B), { subject: { subject_id: SUBJECT_B } });
  client.setQueryData(outreachKeys.queue({ state: "all_active" }), { rows: [{ subject_id: SUBJECT_A }, { subject_id: SUBJECT_B }] });
  client.setQueryData(outreachKeys.queue({}), { pages: [{ rows: [{ subject_id: SUBJECT_A }] }, { rows: [{ subject_id: SUBJECT_B }] }], pageParams: [null, "c"] });
  client.setQueryData(outreachKeys.team(), { leads_needing_attention: { rows: [{ subject_id: SUBJECT_A }], limit: 10 }, goals: null });
  clearSubject(client, SUBJECT_A);
  assert.equal(client.getQueryData(outreachKeys.detail(SUBJECT_A)), undefined);
  assert.ok(client.getQueryData(outreachKeys.detail(SUBJECT_B)));
  assert.deepEqual(client.getQueryData(outreachKeys.queue({ state: "all_active" })), { rows: [{ subject_id: SUBJECT_B }] });
  assert.deepEqual((client.getQueryData(outreachKeys.queue({})) as { pages: unknown[] }).pages, [{ rows: [] }, { rows: [{ subject_id: SUBJECT_B }] }]);
  assert.deepEqual(client.getQueryData(outreachKeys.team()), { leads_needing_attention: { rows: [], limit: 10 }, goals: null });
  clearOutreachDesk(client);
  assert.equal(client.getQueryCache().findAll({ queryKey: outreachKeys.all }).length, 0);
  client.clear();
});
