"use client";
/**
 * UI1-CHAT (UI-0 §2.7): the delivery indicator in an Owner bubble's footer. The state is the server's
 * `nudge.status` (or the send attempt's outcome); nothing is inferred from times.
 */
import { Check, CircleAlert, CircleHelp, LoaderCircle } from "lucide-react";
import type { NudgeRecord } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { formatExactFull, formatTimeOnly } from "../lib/time";
import { cx } from "../lib/format";

export type DeliveryState = "sending" | "sent" | "fallback" | "failed" | "unknown";

/** `pending` → Sending…, `sent`, `fallback_sent` → Sent by extension message instead, `failed`, `unknown_delivery`. */
export function deliveryStateOf(status: NudgeRecord["status"] | string): DeliveryState {
  if (status === "sent") return "sent";
  if (status === "fallback_sent") return "fallback";
  if (status === "failed") return "failed";
  if (status === "unknown_delivery") return "unknown";
  return "sending";
}

export function DeliveryIndicator({
  state,
  at,
  reason,
  onRetry,
  onCheckStatus,
  checking = false,
}: {
  state: DeliveryState;
  /** Sent: the server's `sent_at` (else `created_at`). */
  at?: string | null;
  /** Failed: the words for the refusal code. */
  reason?: string;
  onRetry?: () => void;
  onCheckStatus?: () => void;
  checking?: boolean;
}) {
  const c = copy.ui1.chat;
  if (state === "sending") {
    return (
      <span className="si-delivery is-sending" data-delivery="sending" role="status">
        <LoaderCircle size={12} className="si-spin" aria-hidden />
        {c.sending}
      </span>
    );
  }
  if (state === "sent") {
    return (
      <span className="si-delivery is-sent" data-delivery="sent">
        <Check size={12} aria-hidden />
        {at ? (
          <time dateTime={at} title={formatExactFull(at)} aria-label={c.sent(formatExactFull(at))}>{c.sent(formatTimeOnly(at))}</time>
        ) : (
          c.sent("").trim()
        )}
      </span>
    );
  }
  if (state === "fallback") {
    return (
      <span className="si-delivery is-fallback" data-delivery="fallback">
        <Check size={12} aria-hidden />
        {c.fallback}
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="si-delivery is-failed" data-delivery="failed" role="alert">
        <CircleAlert size={12} aria-hidden />
        <span className="si-text--danger">{c.failed(reason ?? c.errors.default("UNKNOWN"))}</span>
        {onRetry && (
          <button type="button" className={cx("si-link si-delivery__action")} onClick={onRetry}>{c.retry}</button>
        )}
      </span>
    );
  }
  return (
    <span className="si-delivery is-unknown" data-delivery="unknown">
      <CircleHelp size={12} aria-hidden />
      {c.unknown}
      {onCheckStatus && (
        <button type="button" className="si-link si-delivery__action" disabled={checking} aria-busy={checking || undefined} onClick={onCheckStatus}>
          {checking ? c.checking : c.checkStatus}
        </button>
      )}
    </span>
  );
}
