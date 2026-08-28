import type { AdminRecord } from "@/lib/api/admin";
import { relatedRecordId } from "@/components/operational/related-record-nav";
import { BOOKINGS_CONNECT_COPY } from "./bookings-copy";

export type StoredLeadChip = {
  label: typeof BOOKINGS_CONNECT_COPY.noStoredLead | typeof BOOKINGS_CONNECT_COPY.referral;
  tone: "warning" | "muted";
} | null;

export function isReferralBookingRecord(record: AdminRecord | null | undefined): boolean {
  return record?.is_referral_booking === true;
}

export function isCancelledBookingRecord(record: AdminRecord | null | undefined): boolean {
  return Boolean(record?.cancelled);
}

export function bookingHasStoredLead(record: AdminRecord | null | undefined): boolean {
  return Boolean(relatedRecordId(record?.lead_ref));
}

export function isLeadlessNonReferralBooking(record: AdminRecord | null | undefined): boolean {
  if (!record || isReferralBookingRecord(record)) return false;
  return record.is_leadless_booking === true || !bookingHasStoredLead(record);
}

export function canConnectBookingToLead(record: AdminRecord | null | undefined): boolean {
  return Boolean(
    record
    && isLeadlessNonReferralBooking(record)
    && !isCancelledBookingRecord(record),
  );
}

export function storedLeadChip(record: AdminRecord | null | undefined): StoredLeadChip {
  if (!record) return null;
  if (isReferralBookingRecord(record)) {
    return { label: BOOKINGS_CONNECT_COPY.referral, tone: "muted" };
  }
  if (isLeadlessNonReferralBooking(record)) {
    return { label: BOOKINGS_CONNECT_COPY.noStoredLead, tone: "warning" };
  }
  return null;
}

export function bookingLeadRef(record: AdminRecord | null | undefined): {
  model: "FormLead" | "CallLead";
  id: string;
} | null {
  if (!record) return null;
  const id = relatedRecordId(record.lead_ref);
  if (!id) return null;
  if (record.lead_model === "FormLead" || record.lead_model === "CallLead") {
    return { model: record.lead_model, id };
  }
  return null;
}
