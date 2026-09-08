import assert from "node:assert/strict";
import test from "node:test";
import type { DailyOperationsSnapshot } from "./dailyOperations";
import {
  applyDailyOperationsMetricTouches,
  applyDailyOperationsSsePayload,
  DAILY_OPERATIONS_LIVE_PATH,
  EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  mergeDailyOperationsEvents,
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

test("SSE apply replaces snapshot, merges events, and applies metrics without inventing a poll", () => {
  const first = applyDailyOperationsSsePayload(
    "snapshot",
    JSON.stringify(snapshotFixture()),
    EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  );
  assert.equal(first.board.snapshot?.metrics.leads.today, 42);
  assert.equal(first.board.snapshot?.origins.wordpress_form, 0);
  const withEvent = applyDailyOperationsSsePayload(
    "event",
    JSON.stringify(eventItem("e1", "2026-09-08T18:15:00.000Z")),
    first.board,
  );
  assert.equal(withEvent.board.events[0]?.event_id, "e1");
  const withMetrics = applyDailyOperationsSsePayload(
    "metrics",
    JSON.stringify({ metric_touches: ["leads.total", "leads.form"] }),
    withEvent.board,
  );
  assert.equal(withMetrics.board.snapshot?.metrics.leads.today, 43);
  assert.equal(withMetrics.board.sessionDeltas.leads, 1);
  assert.deepEqual(withMetrics.flashedTiles, ["leads", "form_call"]);
  const heartbeat = applyDailyOperationsSsePayload(
    "heartbeat",
    JSON.stringify({ ts: "2026-09-08T18:16:00.000Z" }),
    withMetrics.board,
  );
  assert.equal(heartbeat.board.lastGoodAt, "2026-09-08T18:16:00.000Z");
});
