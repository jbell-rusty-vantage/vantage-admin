/**
 * Deep links to the official record lists. Detail pages do not exist per record, so a link opens
 * the owning list with the record preselected (`?record=<id>`).
 */

export type OfficialRecordType = "form_lead" | "call_lead" | "booked_lead" | "cancelled_lead";

const LIST_PATH_BY_TYPE: Record<OfficialRecordType, string> = {
  form_lead: "/form-leads",
  call_lead: "/call-leads",
  booked_lead: "/bookings",
  cancelled_lead: "/cancellations",
};

export function recordHref(
  recordType: OfficialRecordType | null | undefined,
  recordId: string | null | undefined,
): string | null {
  if (!recordType || !recordId) {
    return null;
  }
  return `${LIST_PATH_BY_TYPE[recordType]}?record=${encodeURIComponent(recordId)}`;
}
