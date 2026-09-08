import assert from "node:assert/strict";
import test from "node:test";
import type { DailyOperationsSnapshot } from "./dailyOperations";
import {
  applyDailyOperationsMetricTouches,
  applyDailyOperationsSsePayload,
  DAILY_OPERATIONS_LIVE_PATH,
  EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  mergeDailyOperationsEvents,
  receiveDailyOperationsSnapshot,
  sessionDeltaIncrements,
  type DailyOperationsEventItem,
} from "./dailyOperationsLive";

function snapshotFixture(): DailyOperationsSnapshot {
  return {
    timezone: "America/New_York",
    today: "2026-09-08",
    yesterday: "2026-09-07",
    generated_at: "2026-09-08T18:14:00.000Z",
    redis: { configured: false, mode: "stream" },
    metrics: {
      leads: {
        today: 42,
        yesterday: 38,
        yesterday_by_now: 31,
        form: 28,
        call: 14,
        duplicate_form: 3,
        duplicate_call: 1,
      },
      bookings: { today: 6, yesterday: 5, yesterday_by_now: 4 },
      cancellations: { today: 1, yesterday: 0, yesterday_by_now: 0 },
      texts: {
        today: 19,
        yesterday: 22,
        yesterday_by_now: 18,
        deferred: 4,
        held_now: 3,
        skipped: 4,
        failed: 1,
      },
      webhooks: {
        lead_created: { today: 55, yesterday: 49 },
        priority_updated: { today: 120, yesterday: 101 },
        booking_status_changed: { today: 8, yesterday: 7 },
        booked: { today: 5, yesterday: 4 },
        release: { today: 3, yesterday: 3 },
      },
      intakes: { opened_today: 3, still_open: 2 },
      exceptions: { zip_missing: 2, crm_failed: 0, dead_letter: 0, adoption_conflict: 0 },
      sheet_sync: { completed: 4, failed: 1 },
    },
    origins: {
      granot_lead_created: 20,
      ringcentral: 14,
      wordpress_form: 0,
      best_relocation_sheet: 6,
      vantage_admin: 2,
    },
    companies: [
      { source_company: "top10_leads", form: 12, call: 5, total: 17, yesterday_total: 15 },
    ],
    hourly: { today: [], yesterday: [] },
  };
}

function eventItem(id: string, occurred_at: string): DailyOperationsEventItem {
  return {
    event_id: id,
    day: "2026-09-08",
    occurred_at,
    lane: "lead",
    kind: "form_lead.created",
    title: "Form Lead created",
    source_company: "top10_leads",
    ingestion_origin: "wordpress_form",
    lead_kind: "form",
    job_no: null,
    entity_type: "FormLead",
    entity_id: id,
    parent_receipt_id: null,
    links: {},
    card: {},
    metric_touches: ["leads.form", "leads.total"],
  };
}

test("live BFF path is the Daily Operations clone, not Live Events", () => {
  assert.equal(DAILY_OPERATIONS_LIVE_PATH, "/api/daily-operations-live");
});

test("mergeDailyOperationsEvents replaces by event_id and keeps newest first", () => {
  const older = eventItem("a", "2026-09-08T15:00:00.000Z");
  const newer = eventItem("b", "2026-09-08T15:00:05.000Z");
  const merged = mergeDailyOperationsEvents([older], newer);
  assert.deepEqual(merged.map((row) => row.event_id), ["b", "a"]);
  const replayed = mergeDailyOperationsEvents(merged, { ...newer, title: "Form Lead created again" });
  assert.equal(replayed.length, 2);
  assert.equal(replayed[0]?.title, "Form Lead created again");
});

test("merge keeps a Cancellation when Granot floods the live window", () => {
  const granot = Array.from({ length: 50 }, (_, index) => ({
    ...eventItem(`g${index}`, `2026-09-08T16:${String(index).padStart(2, "0")}:00.000Z`),
    lane: "granot",
    kind: "granot.priority_updated",
  }));
  const cancellation: DailyOperationsEventItem = {
    ...eventItem("c1", "2026-09-08T15:00:00.000Z"),
    lane: "cancellation",
    kind: "cancellation.created",
    title: "Cancellation written",
  };
  const merged = mergeDailyOperationsEvents(granot, cancellation);
  assert.equal(merged.some((row) => row.event_id === "c1"), true);
  assert.equal(merged.filter((row) => row.lane === "granot").length, 50);
});

test("metrics touches increment snapshot today counts and session deltas", () => {
  const snapshot = applyDailyOperationsMetricTouches(snapshotFixture(), [
    "leads.form",
    "leads.total",
    "origins.wordpress_form",
    "companies.top10_leads.form",
    "companies.top10_leads.total",
  ]);
  assert.equal(snapshot.metrics.leads.today, 43);
  assert.equal(snapshot.metrics.leads.form, 29);
  assert.equal(snapshot.origins.wordpress_form, 1);
  assert.equal(snapshot.companies.find((row) => row.source_company === "top10_leads")?.total, 18);
  assert.equal(snapshot.companies.find((row) => row.source_company === "tbm_leads")?.total, 0);
  assert.deepEqual(sessionDeltaIncrements(["leads.form", "leads.total"]), {
    leads: 1,
    form_call: 1,
  });
});

test("sheet_sync touches move the Sheet Sync panel count and nothing else; old servers normalize to zero", () => {
  const snapshot = applyDailyOperationsMetricTouches(snapshotFixture(), [
    "sheet_sync.completed",
    "sheet_sync.completed",
    "sheet_sync.failed",
  ]);
  assert.deepEqual(snapshot.metrics.sheet_sync, { completed: 6, failed: 2 });
  assert.equal(snapshot.metrics.leads.today, 42);
  assert.equal(snapshot.metrics.texts.today, 19);
  assert.deepEqual(sessionDeltaIncrements(["sheet_sync.completed"]), {});

  const legacy = snapshotFixture();
  delete (legacy.metrics as Partial<typeof legacy.metrics>).sheet_sync;
  assert.deepEqual(
    applyDailyOperationsMetricTouches(legacy, ["sheet_sync.failed"]).metrics.sheet_sync,
    { completed: 0, failed: 1 },
  );
});

test("SSE apply replaces snapshot, counts per fact, and ignores the metrics summary", () => {
  const first = applyDailyOperationsSsePayload(
    "snapshot",
    JSON.stringify(snapshotFixture()),
    EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  );
  assert.equal(first.board.snapshot?.metrics.leads.today, 42);
  assert.equal(first.board.snapshot?.origins.wordpress_form, 0);
  const withEvent = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify({
      ...eventItem("e1", "2026-09-08T18:15:00.000Z"),
      metric_touches: ["leads.total", "leads.form", "hourly.leads"],
    }),
    first.board,
  );
  assert.equal(withEvent.board.events[0]?.event_id, "e1");
  // The fact itself moves the tile, the badge, the hourly bucket, and the flash.
  assert.equal(withEvent.board.snapshot?.metrics.leads.today, 43);
  assert.equal(withEvent.board.sessionDeltas.leads, 1);
  assert.equal(withEvent.board.snapshot?.hourly.today.find((bucket) => bucket.hour === 14)?.leads, 1);
  assert.deepEqual(withEvent.flashedTiles, ["leads", "form_call"]);
  // A replay of the same fact after reconnect counts nothing twice.
  const replay = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify({
      ...eventItem("e1", "2026-09-08T18:15:00.000Z"),
      metric_touches: ["leads.total", "leads.form"],
    }),
    withEvent.board,
  );
  assert.equal(replay.board.snapshot?.metrics.leads.today, 43);
  assert.equal(replay.board.sessionDeltas.leads, 1);
  assert.deepEqual(replay.flashedTiles, []);
  // The server's batch summary is acknowledged, not counted again.
  const withMetrics = applyDailyOperationsSsePayload(
    "metrics",
    JSON.stringify({ metric_touches: ["leads.total", "leads.form"] }),
    replay.board,
  );
  assert.equal(withMetrics.board.snapshot?.metrics.leads.today, 43);
  assert.equal(withMetrics.board.sessionDeltas.leads, 1);
  assert.deepEqual(withMetrics.flashedTiles, []);
  const heartbeat = applyDailyOperationsSsePayload(
    "heartbeat",
    JSON.stringify({ ts: "2026-09-08T18:16:00.000Z" }),
    withMetrics.board,
  );
  assert.equal(heartbeat.board.lastGoodAt, "2026-09-08T18:16:00.000Z");
});

test("a held text flashes the Texts tile but does not move its +N badge", () => {
  const seeded = applyDailyOperationsSsePayload(
    "snapshot",
    JSON.stringify(snapshotFixture()),
    EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  );
  const held = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify({
      ...eventItem("t1", "2026-09-08T18:15:00.000Z"),
      lane: "text",
      kind: "text.deferred",
      metric_touches: ["messages.deferred"],
    }),
    seeded.board,
  );
  assert.deepEqual(held.flashedTiles, ["texts"]);
  assert.equal(held.board.sessionDeltas.texts, 0);
  assert.equal(held.board.snapshot?.metrics.texts.today, seeded.board.snapshot?.metrics.texts.today);
});

test("a new-day snapshot drops yesterday's facts and session badges, keeps today's", () => {
  const seeded = applyDailyOperationsSsePayload(
    "snapshot",
    JSON.stringify(snapshotFixture()),
    EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  );
  const withFacts = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify({ ...eventItem("old", "2026-09-08T18:15:00.000Z"), metric_touches: ["leads.total"] }),
    seeded.board,
  );
  const straddle = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify({ ...eventItem("new", "2026-09-09T04:05:00.000Z"), metric_touches: ["leads.total"] }),
    withFacts.board,
  );
  assert.equal(straddle.board.sessionDeltas.leads, 2);
  const rolled = receiveDailyOperationsSnapshot(straddle.board, {
    ...snapshotFixture(),
    today: "2026-09-09",
    yesterday: "2026-09-08",
    generated_at: "2026-09-09T04:06:00.000Z",
  });
  assert.deepEqual(
    rolled.events.map((event) => event.event_id),
    ["new"],
  );
  assert.equal(rolled.sessionDeltas.leads, 0);
  assert.equal(rolled.snapshot?.today, "2026-09-09");
  // Same day: a resync is a plain replace.
  const same = receiveDailyOperationsSnapshot(straddle.board, snapshotFixture());
  assert.equal(same.events.length, 2);
  assert.equal(same.sessionDeltas.leads, 2);
});
