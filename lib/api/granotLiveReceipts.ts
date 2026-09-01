export const LIVE_EVENTS_HREF = "/live-events";
export const GRANOT_LIVE_RECEIPTS_STREAM_PATH = "/api/granot-live-receipts";
export const LIVE_RECEIPT_WINDOW_MS = 30 * 60 * 1000;
export const LIVE_RECEIPT_WINDOW_LIMIT = 80;

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

export type LiveWebhookIntakeLink = {
  case_id: string;
  kind: "booking";
  state: "open" | "resolved";
  matched_via: "evidence_observation_id";
};

export type LiveWebhookReceipt = {
  receipt_id: string;
  captured_at: string;
  route_event_class: LiveWebhookEventClass;
  observation_channel: "granot_webhook";
  processing_state: string;
  observation_id?: string | null;
  intake_link?: LiveWebhookIntakeLink | null;
  lead: LiveWebhookLead;
  granot_statement: unknown;
};

export function applyLiveWebhookSsePayload(
  eventName: string,
  rawData: string,
  current: LiveWebhookReceipt[],
  nowMs = Date.now(),
): { receipts: LiveWebhookReceipt[]; error?: string } {
  try {
    if (eventName === "snapshot") {
      const payload = JSON.parse(rawData) as { receipts?: LiveWebhookReceipt[] };
      return {
        receipts: trimLiveWebhookReceipts(
          Array.isArray(payload.receipts) ? payload.receipts : [],
          nowMs,
        ),
      };
    }
    if (eventName === "receipt" || eventName === "receipt_updated") {
      const incoming = JSON.parse(rawData) as LiveWebhookReceipt;
      return { receipts: mergeLiveWebhookReceipts(current, incoming, nowMs) };
    }
    if (eventName === "heartbeat") {
      return { receipts: trimLiveWebhookReceipts(current, nowMs) };
    }
    return { receipts: current };
  } catch {
    return {
      receipts: current,
      error:
        eventName === "snapshot"
          ? "Could not read the live snapshot."
          : "Could not read a live webhook.",
    };
  }
}

export const LIVE_WEBHOOK_EVENT_LABELS: Record<LiveWebhookEventClass, string> = {
  lead_created: "Lead created",
  priority_updated: "Priority updated",
  booking_status_changed: "Booking status changed",
};

export function trimLiveWebhookReceipts(
  receipts: LiveWebhookReceipt[],
  nowMs = Date.now(),
): LiveWebhookReceipt[] {
  const floor = nowMs - LIVE_RECEIPT_WINDOW_MS;
  return receipts
    .filter((receipt) => {
      const capturedMs = Date.parse(receipt.captured_at);
      return Number.isFinite(capturedMs) && capturedMs >= floor;
    })
    .sort((left, right) => {
      if (left.captured_at === right.captured_at) {
        return right.receipt_id.localeCompare(left.receipt_id);
      }
      return right.captured_at.localeCompare(left.captured_at);
    })
    .slice(0, LIVE_RECEIPT_WINDOW_LIMIT);
}

export function mergeLiveWebhookReceipts(
  current: LiveWebhookReceipt[],
  incoming: LiveWebhookReceipt | LiveWebhookReceipt[],
  nowMs = Date.now(),
): LiveWebhookReceipt[] {
  const next = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map<string, LiveWebhookReceipt>();
  for (const receipt of [...next, ...current]) {
    if (!byId.has(receipt.receipt_id)) {
      byId.set(receipt.receipt_id, receipt);
    }
  }
  const merged = [...byId.values()].sort((left, right) => {
    if (left.captured_at === right.captured_at) {
      return right.receipt_id.localeCompare(left.receipt_id);
    }
    return right.captured_at.localeCompare(left.captured_at);
  });
  return trimLiveWebhookReceipts(merged, nowMs);
}
