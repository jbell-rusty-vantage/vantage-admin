/** Pure display rules of a booking card (doc 03 "Booking card"). */
import { getValue, stringValue } from "@/components/operational/operational-helpers";
import { relatedRecordId } from "@/components/operational/related-record-nav";
import { formatMoney } from "@/components/ui/crm/format";
import type { CrmTone, EvidenceState, PillVariant } from "@/components/ui/crm/primitives";
import type { AdminRecord } from "@/lib/api/admin";
import { formatCalendarDay } from "@/lib/api/bookings";
import { BOOKINGS_COPY } from "./bookings-copy";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberOf(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function bookingName(item: AdminRecord): string {
  return (
    stringValue(getValue(item, "customer.full_name")) ??
    stringValue(item.customer_name) ??
    stringValue(item.customer_name_snapshot) ??
    BOOKINGS_COPY.card.unnamed
  );
}

/** The populated cancellation of a booking (`cancelled`), or null when the booking is active. */
export function bookingCancellation(item: AdminRecord): Record<string, unknown> | null {
  return isObject(item.cancelled) ? item.cancelled : null;
}

/** A booking is cancelled when `cancelled` carries a cancellation, populated or as a bare id. */
export function isCancelledBooking(item: AdminRecord): boolean {
  const value = item.cancelled;
  if (isObject(value)) return true;
  return typeof value === "string" && value.trim().length > 0;
}

export function cancellationIdOf(item: AdminRecord): string | null {
  return relatedRecordId(item.cancelled);
}

export function bookingTone(item: AdminRecord): CrmTone {
  return isCancelledBooking(item) ? "red" : "green";
}

export function bookingStatus(item: AdminRecord, now?: Date): { label: string; variant: PillVariant } {
  if (!isCancelledBooking(item)) return { label: BOOKINGS_COPY.card.active, variant: "green" };
  const date = formatCalendarDay(bookingCancellation(item)?.cancel_date, now);
  return { label: date ? `${BOOKINGS_COPY.card.cancelled} ${date}` : BOOKINGS_COPY.card.cancelled, variant: "red" };
}

/** Over $4k beats Over $2k. The server's flags win; the binder amount is the fallback when the flags are absent. */
export function binderPill(item: AdminRecord): string | null {
  if (item.over_4000 === true) return BOOKINGS_COPY.card.over4k;
  if (item.over_2000 === true) return BOOKINGS_COPY.card.over2k;
  if (item.over_4000 === false || item.over_2000 === false) return null;
  const binder = numberOf(item.total_binder_amount);
  if (binder === null) return null;
  if (binder > 4000) return BOOKINGS_COPY.card.over4k;
  if (binder > 2000) return BOOKINGS_COPY.card.over2k;
  return null;
}

/** "10best Inbounds › Calls": the source snapshot's company and feed labels, else the stored `source` label. */
export function bookingSourceText(item: AdminRecord): string | null {
  const snapshot = isObject(item.employee_source_snapshot) ? item.employee_source_snapshot : null;
  const company = stringValue(snapshot?.source_company_label_snapshot);
  const feed = stringValue(snapshot?.source_granularity_label_snapshot) ?? stringValue(snapshot?.crm_source_label_snapshot);
  if (company && feed && feed !== company) return `${company} › ${feed}`;
  return feed ?? company ?? stringValue(item.source) ?? null;
}

export type AgentShare = { name: string; binder: number | null };

/** Every agent on the booking with the binder share, or the single `agent` name when there are no allocations. */
export function agentShares(item: AdminRecord): AgentShare[] {
  const allocations = Array.isArray(item.agent_allocations) ? item.agent_allocations : [];
  const shares = allocations
    .filter(isObject)
    .map((row) => ({
      name: stringValue(row.agent_name_snapshot) ?? stringValue(getValue(row, "agent.name")) ?? "",
      binder: numberOf(row.binder_amount),
    }))
    .filter((row) => row.name);
  if (shares.length > 0) return shares;
  const single = stringValue(item.agent);
  return single ? [{ name: single, binder: null }] : [];
}

export function isSplit(shares: readonly AgentShare[]): boolean {
  return shares.length > 1;
}

function placeText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!isObject(value)) return null;
  const text = [stringValue(value.city), stringValue(value.state)].filter(Boolean).join(", ");
  return text || stringValue(value.label) || null;
}

/** "Tucson, AZ → Sterling, VA · pickup Oct 19" from `case_file_summary`, or null when the case file is not captured. */
export function caseFileRouteText(item: AdminRecord, now?: Date): string | null {
  const summary = item.case_file_summary;
  if (!isObject(summary)) return null;
  const from = placeText(summary.origin);
  const to = placeText(summary.destination);
  const route = from && to ? `${from} → ${to}` : (from ?? to);
  const pickup = summary.pickup ?? summary.pickup_date;
  const pickupText = formatCalendarDay(pickup, now);
  const pickupPart = pickupText ? `pickup ${pickupText}` : null;
  const text = [route, pickupPart].filter(Boolean).join(" · ");
  return text || null;
}

/** The lead's kind (`form` or `call`) and id when the booking has a stored lead. */
export function storedLead(item: AdminRecord): { kind: "form" | "call"; id: string } | null {
  const id = relatedRecordId(item.lead_ref);
  if (!id) return null;
  if (item.lead_model === "FormLead") return { kind: "form", id };
  if (item.lead_model === "CallLead") return { kind: "call", id };
  return null;
}

export type BookingEvidence = { key: string; state: EvidenceState; text: string; title?: string };

/** `auto_match.rule` in plain words (doc 03). */
export function matchRuleText(rule: unknown): string | null {
  switch (rule) {
    case "call_job_no_exact":
    case "form_job_no_exact":
      return BOOKINGS_COPY.match.jobNumber;
    case "form_lid_exact":
      return BOOKINGS_COPY.match.granotLid;
    case "form_contact_triple_exact":
    case "form_email_phone_exact":
      return BOOKINGS_COPY.match.contact;
    case "channel_phone_exact":
      return BOOKINGS_COPY.match.phone;
    default:
      return null;
  }
}

type SheetSyncRow = { status?: unknown; target?: unknown; tab_name?: unknown };

/** The worst Master sheet sync status among the rows: failed beats pending beats synced; null when none. */
export function sheetSyncStatus(item: AdminRecord): "synced" | "pending" | "failed" | null {
  const rows = (Array.isArray(item.sheet_sync) ? item.sheet_sync : []).filter(isObject) as SheetSyncRow[];
  if (rows.length === 0) return null;
  const statuses = rows.map((row) => row.status);
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("pending")) return "pending";
  return statuses.includes("synced") ? "synced" : null;
}

const SYNC_STATE: Record<"synced" | "pending" | "failed", EvidenceState> = { synced: "ok", pending: "warn", failed: "bad" };

/** `Master Booked · synced`, or the same with `Master Cancelled` for a cancellation (`sheetName`). */
export function sheetSyncChip(item: AdminRecord, sheetName: string): BookingEvidence | null {
  const status = sheetSyncStatus(item);
  if (!status) return null;
  return { key: "sheet", state: SYNC_STATE[status], text: `${sheetName} · ${status}` };
}

/** Line 4 of the card: lead, how it was matched, Master Booked sync, booking form. */
export function bookingEvidence(item: AdminRecord): BookingEvidence[] {
  const chips: BookingEvidence[] = [];
  if (item.is_referral_booking === true) {
    chips.push({ key: "referral", state: "none", text: BOOKINGS_COPY.card.referral });
  } else if (item.is_leadless_booking === true) {
    chips.push({ key: "leadless", state: "warn", text: BOOKINGS_COPY.card.leadless });
  } else {
    const lead = storedLead(item);
    if (lead) {
      chips.push({ key: "lead", state: "ok", text: `${BOOKINGS_COPY.card.leadAttached} · ${lead.kind === "form" ? BOOKINGS_COPY.card.form : BOOKINGS_COPY.card.call}` });
    }
  }
  const rule = isObject(item.auto_match) ? matchRuleText(item.auto_match.rule) : null;
  if (rule) chips.push({ key: "match", state: "ok", text: rule });
  const sheet = sheetSyncChip(item, BOOKINGS_COPY.card.masterBooked);
  if (sheet) chips.push(sheet);
  if (item.booking_origin === "employee_booking") chips.push({ key: "origin", state: "none", text: BOOKINGS_COPY.card.employeeForm });
  return chips;
}

/** Record cancellation is offered on an active booking that is not a Referral Booking. */
export function canRecordCancellation(item: AdminRecord): boolean {
  return !isCancelledBooking(item) && item.is_referral_booking !== true;
}

export function recordCancellationHref(id: string): string {
  return `/cancellations/new?booked_lead=${encodeURIComponent(id)}`;
}

/** "Oct 5" for the book date, or "—". */
export function bookDateText(item: AdminRecord, now?: Date): string {
  return formatCalendarDay(item.book_date, now) ?? "—";
}

export function moneyText(value: unknown): string {
  return formatMoney(value, { cents: true });
}

/** The Refund of a cancelled booking, from the populated cancellation. */
export function bookingRefund(item: AdminRecord): number | null {
  return numberOf(bookingCancellation(item)?.refund_amount);
}
