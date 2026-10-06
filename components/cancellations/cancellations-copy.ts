/** Owner-visible strings of the Cancellations workspace and the Record a cancellation sheet (doc 03). */

/** The seven Owner labels of the cancellation reasons (the stored values are snake_case). */
export const CANCELLATION_REASON_LABELS: Readonly<Record<string, string>> = {
  customer_cancelled: "Customer cancelled",
  price_too_high: "Price too high",
  booked_with_competitor: "Booked with competitor",
  duplicate_booking: "Duplicate booking",
  bad_lead: "Bad lead",
  not_serviceable: "Not serviceable",
  other: "Other",
};

/** The Owner label of a stored reason; an unknown value shows as stored. */
export function reasonLabel(reason: unknown): string | null {
  if (typeof reason !== "string" || !reason.trim()) return null;
  const key = reason.trim();
  return CANCELLATION_REASON_LABELS[key] ?? key;
}

/** No cancellation has been recorded since August 2026 (doc 08 open question 6); the empty state says so. */
export const CANCELLATIONS_QUIET_SINCE = "2026-08-01";

export const CANCELLATIONS_COPY = {
  title: "Cancellations",
  subtitle: "Every recorded cancellation, newest first.",
  help: "A cancellation always belongs to one booking. Clicking a card opens that booking on its Cancellation tab. Search takes a job number or a customer name.",
  recordButton: "Record a cancellation",
  recordButtonPlus: "+ Record a cancellation",
  searchPlaceholder: "Job number or customer name",
  sortOptions: [
    { value: "cancel_desc", label: "Cancel date, newest first" },
    { value: "cancel_asc", label: "Cancel date, oldest first" },
    { value: "refund_desc", label: "Refund, highest first" },
  ],
  reasonLabel: "Reason",
  reasonAll: "Reason: any",
  sourceLabel: "Source",
  sourceAll: "Source: any",
  agentLabel: "Agent",
  agentAll: "Agent: any",
  merchantLabel: "Merchant",
  merchantAll: "Merchant: any",
  dateFrom: "Cancelled from",
  dateTo: "Cancelled to",
  refundLabel: "Refund",
  refundOptions: [
    { value: "any", label: "Refund: any" },
    { value: "yes", label: "Refunded" },
    { value: "no", label: "No refund" },
  ],
  byLabel: "Cancelled by",
  byAll: "Cancelled by: anyone",
  clearAll: "Clear all",
  refundNarrowNote: "No refund narrows the loaded cards only. The count above is the server's count for the other filters.",
  summaryCancellations: "Cancellations",
  summaryRefunded: "Refunded total",
  summaryTopReason: "Top reason",
  topReasonCaption: "of loaded",
  totalsPending: "needs server totals",
  ofLoaded: "of loaded",
  none: "—",
  empty: "No cancellations match these filters",
  emptyHint: "Try a different search or clear the filters.",
  emptyQuiet: "No cancellations since Aug 2026",
  emptyQuietHint: "This list does not confirm that no booking was cancelled. Record a cancellation when one happens.",
  loadFailed: "Cancellations could not be read.",
  loadMore: "Loading more cancellations…",
  allLoaded: "All cancellations loaded",
  deleteFailed: "Delete failed.",
  density: "vantage-admin-cancellations-density",
  card: {
    unnamed: "Unnamed customer",
    reasonMissing: "No reason",
    job: "Job",
    booked: "booked",
    cancelled: "cancelled",
    day: "day",
    days: "days",
    refund: "Refund",
    deposit: "Deposit",
    binder: "Binder",
    recordedBy: "recorded by",
    masterCancelled: "Master Cancelled",
    booking: "Booking",
    lead: "Lead",
    selectLabel: (name: string) => `Select ${name}`,
  },
} as const;

/** The Record a cancellation sheet. */
export const RECORD_CANCELLATION_COPY = {
  title: "Record a cancellation",
  subtitle: "One screen: when and how much, why, then file it.",
  chooseBooking: "Choose the booking",
  chooseHint: "Search an active booking by job number or customer name.",
  searchPlaceholder: "Job number or customer name",
  choose: "Choose",
  changeBooking: "Choose a different booking",
  noBookings: "No active booking matches this search.",
  searchFailed: "Bookings could not be read.",
  bookingFailed: "The booking could not be read.",
  alreadyCancelled: "This booking already has a cancellation. Open it from Cancellations to edit it.",
  referralBlocked: "A Referral Booking cannot be cancelled here.",
  block1: "When and how much",
  cancelDate: "Cancel date",
  refund: "Refund",
  refundHint: "Dollars refunded to the customer. Enter 0 when nothing was refunded.",
  depositReference: (amount: string) => `Deposit was ${amount} (for reference)`,
  block2: "Why",
  reasonLabel: "Reason",
  notes: "Notes",
  recordedBy: "Recorded by",
  recordedByBlank: "Choose who recorded it",
  block3: "File it",
  reviewLine: (refund: string, reason: string) => `Cancellation · ${refund} refund · ${reason}`,
  reviewReasonMissing: "no reason chosen yet",
  sheetNote: "Sheet: Master Cancelled; the booking and lead rows are marked Cancelled",
  submit: "Record cancellation",
  submitting: "Recording…",
  refundInvalid: "Refund must be a number such as 250 or 250.00. A leading $ is allowed.",
  reasonRequired: "Choose a reason.",
  failed: "The cancellation could not be recorded.",
  doneTitle: "Cancellation recorded",
  doneCancellation: "Open the cancellation",
  doneBooking: "Open the booking",
  another: "Record another",
} as const;
