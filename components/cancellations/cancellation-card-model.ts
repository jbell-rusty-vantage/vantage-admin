/** Pure display rules of a cancellation card (doc 03 "Cancellation card"). */
import { bookingSourceText, moneyText, sheetSyncChip, type BookingEvidence } from "@/components/bookings/booking-card-model";
import { getValue, stringValue } from "@/components/operational/operational-helpers";
import { relatedRecordId } from "@/components/operational/related-record-nav";
import type { AdminRecord } from "@/lib/api/admin";
import { daysBetween, formatCalendarDay } from "@/lib/api/bookings";
import { CANCELLATIONS_COPY, CANCELLATIONS_QUIET_SINCE } from "./cancellations-copy";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The booking of a cancellation when the list populated it, else null. */
export function populatedBooking(item: AdminRecord): Record<string, unknown> | null {
  return isObject(item.booked_lead) ? item.booked_lead : null;
}

export function bookingIdOf(item: AdminRecord): string | null {
  return relatedRecordId(item.booked_lead);
}

export function cancellationName(item: AdminRecord): string {
  return (
    stringValue(item.customer_name) ??
    stringValue(getValue(item, "customer.full_name")) ??
    stringValue(getValue(item, "booked_lead.customer_name")) ??
    CANCELLATIONS_COPY.card.unnamed
  );
}

export function cancellationJob(item: AdminRecord): string | null {
  return stringValue(item.job_no_snapshot) ?? stringValue(item.job_no) ?? stringValue(getValue(item, "booked_lead.job_no")) ?? null;
}

/** The booking's source snapshot labels when the booking arrived populated, else the cancellation's stored `source`. */
export function cancellationSourceText(item: AdminRecord): string | null {
  const booking = populatedBooking(item);
  const fromBooking = booking ? bookingSourceText(booking) : null;
  return fromBooking ?? stringValue(item.source) ?? null;
}

export function cancellationBookDate(item: AdminRecord): unknown {
  return item.book_date ?? getValue(item, "booked_lead.book_date");
}

/** "booked Sep 28 → cancelled Oct 9 · 11 days"; a missing date drops its half. */
export function datesText(item: AdminRecord, now?: Date): string {
  const copy = CANCELLATIONS_COPY.card;
  const book = formatCalendarDay(cancellationBookDate(item), now);
  const cancel = formatCalendarDay(item.cancel_date, now);
  const days = daysBetween(cancellationBookDate(item), item.cancel_date);
  const parts = [book ? `${copy.booked} ${book}` : null, cancel ? `${copy.cancelled} ${cancel}` : null].filter(Boolean);
  const range = parts.join(" → ");
  if (!range) return "";
  return days === null ? range : `${range} · ${days} ${days === 1 ? copy.day : copy.days}`;
}

/** The first line of the notes; the full text goes on hover. */
export function notesFirstLine(item: AdminRecord): { first: string; full: string } | null {
  const full = stringValue(item.notes);
  if (!full) return null;
  const first = full.split(/\r?\n/).find((line) => line.trim())?.trim() ?? full;
  return { first, full };
}

/** The lead a cancellation points at: the live `lead_ref`, else the immutable snapshot taken at cancel time. */
export function cancellationLead(item: AdminRecord): { kind: "form" | "call"; id: string } | null {
  const id = relatedRecordId(item.lead_ref);
  if (id) {
    if (item.lead_model === "FormLead") return { kind: "form", id };
    if (item.lead_model === "CallLead") return { kind: "call", id };
  }
  const snapshot = item.lead_ref_snapshot;
  if (isObject(snapshot)) {
    const snapshotId = relatedRecordId(snapshot.id);
    if (snapshotId && snapshot.model === "FormLead") return { kind: "form", id: snapshotId };
    if (snapshotId && snapshot.model === "CallLead") return { kind: "call", id: snapshotId };
  }
  return null;
}

/** The booking panel on its Cancellation tab: where a cancellation card click goes. */
export function bookingPanelHref(bookingId: string): string {
  return `/bookings?record=${encodeURIComponent(bookingId)}&panel=cancellation`;
}

export function masterCancelledChip(item: AdminRecord): BookingEvidence | null {
  return sheetSyncChip(item, CANCELLATIONS_COPY.card.masterCancelled);
}

export function refundText(item: AdminRecord): string {
  return item.refund_amount === undefined || item.refund_amount === null ? "—" : moneyText(item.refund_amount);
}

/** The reason that appears most among the loaded cancellations, with its count; null when none has a reason. */
export function topReason(items: readonly AdminRecord[]): { reason: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reason = stringValue(item.reason);
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  let best: { reason: string; count: number } | null = null;
  for (const [reason, count] of counts) {
    if (!best || count > best.count) best = { reason, count };
  }
  return best;
}

/**
 * The quiet-period message (doc 03: no cancellation recorded since Aug 2026). It reads when no filter or search
 * narrows the default newest-first list and either nothing is recorded or the newest loaded cancellation is older than
 * 2026-08-01. It never claims a 0% cancellation rate.
 */
export function isQuietSinceAugust(
  items: readonly AdminRecord[],
  options: { filtered: boolean; newestFirst: boolean },
): boolean {
  if (options.filtered) return false;
  if (items.length === 0) return true;
  if (!options.newestFirst) return false;
  const newest = Date.parse(String(items[0]?.cancel_date ?? ""));
  return !Number.isNaN(newest) && newest < Date.parse(`${CANCELLATIONS_QUIET_SINCE}T00:00:00Z`);
}
