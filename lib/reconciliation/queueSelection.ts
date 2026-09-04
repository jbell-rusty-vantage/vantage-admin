export const BOOKING_RECONCILIATION_HREF = "/bookings/reconciliation";

export function readBookingReconciliationCaseId(
  searchParams: { get(name: string): string | null } | null | undefined,
): string {
  const fromCase = searchParams?.get("case")?.trim();
  if (fromCase) return fromCase;
  return searchParams?.get("record")?.trim() || "";
}

export function buildBookingReconciliationHref(caseId = ""): string {
  if (!caseId.trim()) return BOOKING_RECONCILIATION_HREF;
  return `${BOOKING_RECONCILIATION_HREF}?case=${encodeURIComponent(caseId.trim())}`;
}

export function nextSelectedBookingReconciliationCaseId(input: {
  requestedCaseId: string;
  selectedCaseId: string;
  firstQueueId: string;
}): string {
  if (input.requestedCaseId) return input.requestedCaseId;
  if (input.selectedCaseId) return input.selectedCaseId;
  return input.firstQueueId;
}
