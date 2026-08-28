export const GRANOT_LIVE_RECEIPTS_HREF = "/ingestion/granot/live";
export const GRANOT_LIVE_RECEIPTS_STREAM_PATH = "/api/granot-live-receipts";

export const LIVE_WEBHOOK_EVENT_CLASSES = [
  "lead_created",
  "priority_updated",
  "booking_status_changed",
] as const;

export type LiveWebhookEventClass = (typeof LIVE_WEBHOOK_EVENT_CLASSES)[number];

export type LiveWebhookLead = {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_no: string | null;
  event_type: string | null;
  priority: string | null;
  origin: string | null;
  destination: string | null;
  move_date: string | null;
};

export type LiveWebhookReceipt = {
  receipt_id: string;
  captured_at: string;
  route_event_class: LiveWebhookEventClass;
  observation_channel: "granot_webhook";
  processing_state: string;
  lead: LiveWebhookLead;
  granot_statement: unknown;
};

export const LIVE_WEBHOOK_EVENT_LABELS: Record<LiveWebhookEventClass, string> = {
  lead_created: "Lead created",
  priority_updated: "Priority updated",
  booking_status_changed: "Booking status changed",
};

export function mergeLiveWebhookReceipts(
  current: LiveWebhookReceipt[],
  incoming: LiveWebhookReceipt | LiveWebhookReceipt[],
): LiveWebhookReceipt[] {
  const next = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map<string, LiveWebhookReceipt>();
  for (const receipt of [...next, ...current]) {
    if (!byId.has(receipt.receipt_id)) {
      byId.set(receipt.receipt_id, receipt);
    }
  }
  return [...byId.values()].sort((left, right) => {
    if (left.captured_at === right.captured_at) {
      return right.receipt_id.localeCompare(left.receipt_id);
    }
    return right.captured_at.localeCompare(left.captured_at);
  });
}
