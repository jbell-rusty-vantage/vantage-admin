export const BOOKING_FORM_COPY = {
  pageTitle: "Precise Booking Form",
  pageHint:
    "Book from a selected Form Lead, a Call Lead Job Number, a Referral, or as a Leadless Booking.",
  leadSourceHint:
    "Book from a Form Lead, Call Lead, Referral, or Leadless Booking. A Leadless Booking does not need a stored Lead.",
  callPhoneHint: "Optional. Helps Booking Reconciliation later.",
  successLinked: "Booking created. The backend handled booking rules and sheet sync side effects.",
  successReferral:
    "Referral booking created. The backend will sync it to the Master Booked Sheet.",
  successPending:
    "Booking saved. Connect a lead from Booking Reconciliation, or keep the booking without a lead.",
  openReconciliation: "Open Booking Reconciliation",
  missingFieldsPrefix: "Please enter the required",
  missingFieldsSuffix: "before creating the booking.",
} as const;

export function preciseBookingReconciliationHref(caseId?: string): string {
  if (!caseId) {
    return "/bookings/reconciliation";
  }
  return `/bookings/reconciliation?case=${encodeURIComponent(caseId)}`;
}
