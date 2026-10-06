/**
 * Deep links to the official records (doc 03). Detail pages do not exist per record, so a link opens the owning
 * workspace with the record's panel open: a lead in the Leads workspace (`/leads?lead=<id>&lk=form|call`), a booking
 * or a cancellation in the Bookings workspace (`?record=<id>`). The old `/form-leads?record=` links redirect here.
 */

export type OfficialRecordType = "form_lead" | "call_lead" | "booked_lead" | "cancelled_lead";

export const LEADS_PATH = "/leads";
export const BOOKINGS_PATH = "/bookings";
export const CANCELLATIONS_PATH = "/bookings/cancellations";

export function leadHref(kind: "form" | "call", id: string, options: { duplicate?: boolean; panel?: string } = {}): string {
  const params = new URLSearchParams({ lead: id, lk: kind });
  if (options.duplicate) params.set("show", "duplicates");
  if (options.panel) params.set("panel", options.panel);
  return `${LEADS_PATH}?${params.toString()}`;
}

export function recordHref(
  recordType: OfficialRecordType | null | undefined,
  recordId: string | null | undefined,
): string | null {
  if (!recordType || !recordId) {
    return null;
  }
  switch (recordType) {
    case "form_lead":
      return leadHref("form", recordId);
    case "call_lead":
      return leadHref("call", recordId);
    case "booked_lead":
      return `${BOOKINGS_PATH}?record=${encodeURIComponent(recordId)}`;
    case "cancelled_lead":
      return `${CANCELLATIONS_PATH}?record=${encodeURIComponent(recordId)}`;
  }
}
