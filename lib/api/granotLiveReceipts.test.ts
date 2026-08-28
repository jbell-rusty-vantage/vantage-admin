import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeLiveWebhookReceipts, type LiveWebhookReceipt } from "./granotLiveReceipts";

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

test("mergeLiveWebhookReceipts prepends new receipts and replaces duplicates without reordering existing ones incorrectly", () => {
  const older = receipt("a", "2026-08-28T15:00:00.000Z");
  const newer = receipt("b", "2026-08-28T15:00:05.000Z");
  const merged = mergeLiveWebhookReceipts([older], newer);
  assert.deepEqual(merged.map((row) => row.receipt_id), ["b", "a"]);
  const replayed = mergeLiveWebhookReceipts(merged, newer);
  assert.equal(replayed.length, 2);
  assert.deepEqual(replayed.map((row) => row.receipt_id), ["b", "a"]);
});
