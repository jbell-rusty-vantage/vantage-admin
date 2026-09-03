import type { LeadSourceChannel, LeadSourceCompany, LeadSourceGranularity } from "@/lib/api/sourceCompanies";

export type ManualLeadKind = "FormLead" | "CallLead";

export type ManualCreateLeadDraft = {
  kind: ManualLeadKind;
  source_company: string;
  source_granularity_key: string;
  name: string;
  phone_number: string;
  email: string;
  pickup_zip: string;
  destination_zip: string;
  move_size: string;
  move_date: string;
  job_no: string;
  post_to_granot: boolean;
};

export const emptyManualCreateLeadDraft = (kind: ManualLeadKind = "FormLead"): ManualCreateLeadDraft => ({
  kind,
  source_company: "",
  source_granularity_key: "",
  name: "",
  phone_number: "",
  email: "",
  pickup_zip: "",
  destination_zip: "",
  move_size: "",
  move_date: "",
  job_no: "",
  post_to_granot: false,
});

const ZIP = /^\d{5}$/;

function trim(value: string): string {
  return value.trim();
}

export function granularitiesForChannel(
  company: LeadSourceCompany | undefined,
  channel: LeadSourceChannel,
): LeadSourceGranularity[] {
  return (company?.granularities ?? []).filter(
    (granularity) => granularity.channel === channel && granularity.active !== false,
  );
}

export function defaultGranularityKey(granularities: LeadSourceGranularity[]): string {
  if (granularities.length === 1) {
    return granularities[0]?.granularity_key ?? "";
  }
  return "";
}

export function validateManualCreateLeadDraft(draft: ManualCreateLeadDraft): string[] {
  const missing: string[] = [];
  if (!trim(draft.source_company)) missing.push("Source Company");
  if (!trim(draft.name)) missing.push("name");

  if (draft.kind === "FormLead") {
    if (!trim(draft.phone_number)) missing.push("phone");
    if (!ZIP.test(trim(draft.pickup_zip))) missing.push("pickup zip");
    if (!ZIP.test(trim(draft.destination_zip))) missing.push("delivery zip");
    if (!trim(draft.move_size)) missing.push("move size");
    return missing;
  }

  if (!trim(draft.phone_number) && !trim(draft.job_no)) {
    missing.push("phone or job number");
  }
  return missing;
}

function optionalField(value: string): string | undefined {
  const next = trim(value);
  return next || undefined;
}

export function buildManualCreateLeadPayload(draft: ManualCreateLeadDraft): Record<string, unknown> {
  const source = {
    source_company: trim(draft.source_company),
    source_granularity_key: optionalField(draft.source_granularity_key),
    name: trim(draft.name),
    email: optionalField(draft.email),
  };

  if (draft.kind === "FormLead") {
    return {
      ...source,
      phone_number: trim(draft.phone_number),
      pickup_zip: trim(draft.pickup_zip),
      destination_zip: trim(draft.destination_zip),
      move_size: trim(draft.move_size),
      move_date: optionalField(draft.move_date),
      post_to_granot: draft.post_to_granot,
    };
  }

  return {
    ...source,
    phone_number: optionalField(draft.phone_number),
    job_no: optionalField(draft.job_no),
  };
}

export function createdLeadRecordHref(kind: ManualLeadKind, id: string): string {
  const path = kind === "CallLead" ? "/call-leads" : "/form-leads";
  return `${path}?record=${encodeURIComponent(id)}`;
}

export function bookingRecordHref(id: string): string {
  return `/bookings?record=${encodeURIComponent(id)}`;
}

export function isBookingObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value.trim());
}

export function leadlessBookingListFilters(query: string): Record<string, string | number | boolean> {
  const q = query.trim();
  return {
    leadless: true,
    cancelled: false,
    limit: 10,
    ...(q && !isBookingObjectId(q) ? { q } : {}),
  };
}
