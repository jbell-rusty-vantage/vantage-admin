import assert from "node:assert/strict";
import test from "node:test";
import { emptySnapshot } from "../../tests/today-fixtures";
import { EMPTY_DAILY_OPERATIONS_LIVE_BOARD, type DailyOperationsEventItem } from "./dailyOperationsLive";
import { dailyOperationsReadDayNotice, parseDailyOperationsReadView, receiveDailyOperationsReadView } from "./dailyOperationsRead";
function fixture() { return { schema_version: 2, day: emptySnapshot.today, timezone: "America/New_York", revision: 2, generated_at: emptySnapshot.generated_at, freshness: "fresh", poll_after_ms: 1000, snapshot: structuredClone(emptySnapshot), events: [], milestones: [] }; }
test("minute contract rejects malformed/unbounded views and clamps unsafe server intervals", () => {
  assert.equal(parseDailyOperationsReadView(fixture()).poll_after_ms, 60_000);
  assert.equal(parseDailyOperationsReadView({ ...fixture(), poll_after_ms: Infinity }).poll_after_ms, 60_000);
  assert.throws(() => parseDailyOperationsReadView({ ...fixture(), schema_version: 1 }));
  assert.throws(() => parseDailyOperationsReadView({ ...fixture(), day: "wrong" }));
  assert.throws(() => parseDailyOperationsReadView({ ...fixture(), events: Array(81).fill({}) }));
});
test("authoritative snapshots replace counts and repeated revisions/events never add touches", () => {
  const view = parseDailyOperationsReadView(fixture());
  view.snapshot.metrics.leads.today = 10;
  view.events = [{ event_id: "event-1", kind: "form_lead.created", lane: "lead", occurred_at: view.generated_at, metric_touches: ["leads.total"] } as DailyOperationsEventItem];
  const first = receiveDailyOperationsReadView(EMPTY_DAILY_OPERATIONS_LIVE_BOARD, view);
  const repeated = receiveDailyOperationsReadView(first, view);
  assert.equal(repeated.snapshot?.metrics.leads.today, 10); assert.equal(repeated.events.length, 1); assert.equal(repeated.sessionDeltas.leads, 0);
  const next = { ...view, day: "2026-12-20", snapshot: { ...view.snapshot, today: "2026-12-20" }, events: [] };
  assert.deepEqual(receiveDailyOperationsReadView(repeated, next).events, []);
});

test("retained data after New York midnight is explicitly dated instead of masquerading as today", () => {
  const saved = { day: "2026-10-23" };
  assert.equal(dailyOperationsReadDayNotice(saved, Date.parse("2026-10-24T03:59:59Z")), null);
  assert.match(dailyOperationsReadDayNotice(saved, Date.parse("2026-10-24T04:00:00Z")) ?? "", /saved board for 2026-10-23/);
  assert.equal(dailyOperationsReadDayNotice({ day: "2026-10-24" }, Date.parse("2026-10-24T04:01:00Z")), null);
});
