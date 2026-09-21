import { entityHref } from "@/components/observational/entity-link";

export function officialRecordHref(
  model: "FormLead" | "CallLead" | "BookedLead" | "CancelledLead",
  id: string,
  returnTo?: string | null,
) {
  const type = { FormLead: "form_lead", CallLead: "call_lead", BookedLead: "booked_lead", CancelledLead: "cancelled_lead" }[model];
  const href = `${entityHref(type, id)}&database_scope=production&panel=summary`;
  if (!returnTo) return href;
  return `${href}&si_return=${encodeURIComponent(returnTo)}`;
}

export function salesIntelligenceLeadHref(model: "FormLead" | "CallLead", id: string) {
  return `/sales-intelligence?view=attention&lead=${encodeURIComponent(id)}&lead_model=${model}`;
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
