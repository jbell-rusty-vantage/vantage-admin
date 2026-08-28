import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GRANOT_LIVE_RECEIPTS_STREAM_PATH,
  LIVE_EVENTS_HREF,
  LIVE_RECEIPT_WINDOW_LIMIT,
  LIVE_RECEIPT_WINDOW_MS,
  mergeLiveWebhookReceipts,
  trimLiveWebhookReceipts,
  type LiveWebhookReceipt,
} from "./granotLiveReceipts";

function receipt(id: string, captured_at: string): LiveWebhookReceipt {
  return {
    receipt_id: id,
    captured_at,
    route_event_class: "lead_created",
    observation_channel: "granot_webhook",
    processing_state: "pending",
    lead: {
      display_name: "Ada",
      first_name: "Ada",
      last_name: null,
      email: null,
      phone: null,
      job_no: "P1",
      event_type: "Lead",
      priority: null,
      origin: null,
      destination: null,
      move_date: null,
    },
    granot_statement: { job_no: "P1" },
  };
}

test("Live Events page href moved off Ingestion; stream path stays the BFF", () => {
  assert.equal(LIVE_EVENTS_HREF, "/live-events");
  assert.equal(GRANOT_LIVE_RECEIPTS_STREAM_PATH, "/api/granot-live-receipts");
});

test("mergeLiveWebhookReceipts prepends new receipts and replaces duplicates without reordering existing ones incorrectly", () => {
  const older = receipt("a", "2026-08-28T15:00:00.000Z");
  const newer = receipt("b", "2026-08-28T15:00:05.000Z");
  const now = Date.parse("2026-08-28T15:10:00.000Z");
  const merged = mergeLiveWebhookReceipts([older], newer, now);
  assert.deepEqual(merged.map((row) => row.receipt_id), ["b", "a"]);
  const replayed = mergeLiveWebhookReceipts(merged, newer, now);
  assert.equal(replayed.length, 2);
  assert.deepEqual(replayed.map((row) => row.receipt_id), ["b", "a"]);
});

test("mergeLiveWebhookReceipts drops receipts older than the 30-minute window", () => {
  const now = Date.parse("2026-08-28T16:00:00.000Z");
  const stale = receipt("old", new Date(now - LIVE_RECEIPT_WINDOW_MS - 1).toISOString());
  const fresh = receipt("new", new Date(now - 60_000).toISOString());
  const merged = mergeLiveWebhookReceipts([stale], fresh, now);
  assert.deepEqual(merged.map((row) => row.receipt_id), ["new"]);
});

test("trimLiveWebhookReceipts keeps only the newest receipts up to the window cap", () => {
  const now = Date.parse("2026-08-28T16:00:00.000Z");
  const receipts = Array.from({ length: LIVE_RECEIPT_WINDOW_LIMIT + 5 }, (_, index) =>
    receipt(`id-${index}`, new Date(now - index * 1_000).toISOString()),
  );
  const trimmed = trimLiveWebhookReceipts(receipts, now);
  assert.equal(trimmed.length, LIVE_RECEIPT_WINDOW_LIMIT);
  assert.equal(trimmed[0]?.receipt_id, "id-0");
  assert.equal(trimmed.at(-1)?.receipt_id, `id-${LIVE_RECEIPT_WINDOW_LIMIT - 1}`);
});
