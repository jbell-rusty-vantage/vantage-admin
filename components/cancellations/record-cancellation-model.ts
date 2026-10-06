/** Pure rules of the Record a cancellation sheet (doc 03): the payload, the review line and the Recorded by default. */
import { moneyText } from "@/components/bookings/booking-card-model";
import { parseMoneyInput } from "@/lib/booking/parseMoneyInput";
import { RECORD_CANCELLATION_COPY, reasonLabel } from "./cancellations-copy";

export type CancellationDraft = {
  bookingId: string;
  cancelDate: string;
  refund: string;
  reason: string;
  by: string;
  notes: string;
};

/** The body `createCancellation` sends: the same fields the retired form sent for a booking-selected cancellation. */
export type CancellationPayload = {
  booked_lead: string;
  cancel_date?: string;
  refund_amount: number;
  reason: string;
  cancelled_by?: string;
  notes?: string;
};

export function buildCancellationPayload(draft: CancellationDraft): { ok: true; payload: CancellationPayload } | { ok: false; error: string } {
  const refund = parseMoneyInput(draft.refund);
  if (refund === undefined) return { ok: false, error: RECORD_CANCELLATION_COPY.refundInvalid };
  const reason = draft.reason.trim();
  if (!reason) return { ok: false, error: RECORD_CANCELLATION_COPY.reasonRequired };
  return {
    ok: true,
    payload: {
      booked_lead: draft.bookingId,
      cancel_date: draft.cancelDate.trim() || undefined,
      refund_amount: refund,
      reason,
      cancelled_by: draft.by.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    },
  };
}

/** "Cancellation · $250.00 refund · Booked with competitor". */
export function reviewLine(draft: Pick<CancellationDraft, "refund" | "reason">): string {
  const refund = parseMoneyInput(draft.refund);
  return RECORD_CANCELLATION_COPY.reviewLine(
    refund === undefined ? "—" : moneyText(refund),
    reasonLabel(draft.reason) ?? RECORD_CANCELLATION_COPY.reviewReasonMissing,
  );
}

/**
 * Recorded by defaults to the signed-in user when their name matches a roster entry: the first word of the email's
 * local part ("rusty.smith@…" → "rusty") against the roster names, case-insensitively. No match leaves it blank.
 */
export function defaultRecordedBy(email: string | null | undefined, roster: readonly string[]): string {
  const local = email?.split("@")[0]?.trim().toLowerCase();
  if (!local) return "";
  const words = local.split(/[._\-+\s]+/).filter(Boolean);
  const full = words.join(" ");
  return (
    roster.find((name) => name.trim().toLowerCase() === full) ??
    roster.find((name) => name.trim().toLowerCase() === words[0]) ??
    ""
  );
}
