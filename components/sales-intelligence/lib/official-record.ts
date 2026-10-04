import { recordHref, type OfficialRecordType } from "@/components/operational/record-href";

const RECORD_TYPE_BY_MODEL = {
  FormLead: "form_lead",
  CallLead: "call_lead",
  BookedLead: "booked_lead",
  CancelledLead: "cancelled_lead",
} as const satisfies Record<string, OfficialRecordType>;

export function officialRecordHref(
  model: keyof typeof RECORD_TYPE_BY_MODEL,
  id: string,
  returnTo?: string | null,
) {
  const href = `${recordHref(RECORD_TYPE_BY_MODEL[model], id)}&panel=summary`;
  if (!returnTo) return href;
  return `${href}&si_return=${encodeURIComponent(returnTo)}`;
}

export function salesIntelligenceLeadHref(model: "FormLead" | "CallLead", id: string) {
  return `/sales-intelligence?view=all_outreach&lead=${encodeURIComponent(id)}&lead_model=${model}`;
}

export function salesIntelligenceReturnHref(search: string | URLSearchParams | null | undefined) {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const value = params?.get("si_return");
  if (!value || !value.startsWith("/sales-intelligence")) return null;
  return value;
}

export function currentSalesIntelligenceHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `/sales-intelligence?${query}` : "/sales-intelligence";
}
