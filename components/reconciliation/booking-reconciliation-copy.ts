import type { BookingLeadReconciliationOrigin } from "@/lib/api/bookingLeadReconciliation";

export const BOOKING_RECONCILIATION_COPY = {
  pageTitle: "Booking Reconciliation",
  pageHint:
    "Owner-only queue for Bookings that need a lead connected, or that you chose to keep without a lead.",
  allOrigins: "All origins",
  origin: {
    employee_booking: "Employee booking",
    owner_booking: "Precise Booking Form",
    external_sheet_ingestion: "External sheet",
  },
  dismissButton: "Keep without a lead",
  dismissConfirm:
    "The booking stays filed. You do not have to attach a lead. You can reopen this later.",
  dismissHelper: "The booking stays filed. You do not have to attach a lead.",
  dismissNotesLabel: "Notes (optional)",
} as const;

export function bookingReconciliationOriginLabel(
  origin: BookingLeadReconciliationOrigin | string | undefined,
): string {
  if (origin === "owner_booking") {
    return BOOKING_RECONCILIATION_COPY.origin.owner_booking;
  }
  if (origin === "external_sheet_ingestion") {
    return BOOKING_RECONCILIATION_COPY.origin.external_sheet_ingestion;
  }
  return BOOKING_RECONCILIATION_COPY.origin.employee_booking;
}
