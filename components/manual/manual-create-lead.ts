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
  hide_from_master_leads: boolean;
};

export type ManualSourceChoice = {
  source_company: string;
  source_granularity_key: string;
  owner_label: string;
  channel: LeadSourceChannel;
};

export type ManualLeadSearchDraft = {
  source_granularity_key: string;
  phone_number: string;
  name: string;
  email: string;
  ref_no: string;
  job_no: string;
};

export type ManualLeadSearchResource = "form-leads" | "call-leads";

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
  hide_from_master_leads: true,
});

export const emptyManualLeadSearchDraft = (): ManualLeadSearchDraft => ({
  source_granularity_key: "",
  phone_number: "",
  name: "",
  email: "",
  ref_no: "",
  job_no: "",
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

export function sourceChoicesForChannel(
  companies: LeadSourceCompany[] | undefined,
  channel: LeadSourceChannel,
): ManualSourceChoice[] {
  return (companies ?? []).flatMap((company) =>
    granularitiesForChannel(company, channel).map((granularity) => ({
      source_company: company.company_slug,
      source_granularity_key: granularity.granularity_key,
      owner_label: granularity.owner_label,
      channel: granularity.channel,
    })),
  );
}

export function allSourceChoices(companies: LeadSourceCompany[] | undefined): ManualSourceChoice[] {
  return [...sourceChoicesForChannel(companies, "form"), ...sourceChoicesForChannel(companies, "call")];
}

export function defaultGranularityKey(granularities: LeadSourceGranularity[]): string {
  if (granularities.length === 1) {
    return granularities[0]?.granularity_key ?? "";
  }
  return "";
}

export function defaultSourceChoice(choices: ManualSourceChoice[]): ManualSourceChoice | undefined {
  return choices.length === 1 ? choices[0] : undefined;
}

export function findSourceChoice(
  choices: ManualSourceChoice[],
  granularityKey: string,
): ManualSourceChoice | undefined {
  return choices.find((choice) => choice.source_granularity_key === granularityKey);
}

export function validateManualCreateLeadDraft(draft: ManualCreateLeadDraft): string[] {
  const missing: string[] = [];
  if (!trim(draft.source_granularity_key) || !trim(draft.source_company)) {
    missing.push("Source Company");
  }
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
    source_granularity_key: trim(draft.source_granularity_key),
    name: trim(draft.name),
    email: optionalField(draft.email),
  };

  const optInToMasterLeads = draft.hide_from_master_leads === false ? { no_sync: false } : {};

  if (draft.kind === "FormLead") {
    return {
      ...source,
      phone_number: trim(draft.phone_number),
      pickup_zip: trim(draft.pickup_zip),
      destination_zip: trim(draft.destination_zip),
      move_size: trim(draft.move_size),
      move_date: optionalField(draft.move_date),
      post_to_granot: draft.post_to_granot,
      ...optInToMasterLeads,
    };
  }

  return {
    ...source,
    phone_number: optionalField(draft.phone_number),
    job_no: optionalField(draft.job_no),
    ...optInToMasterLeads,
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

export function bookingJobSearchFilters(jobNo: string): Record<string, string | number | boolean> {
  return {
    job_no: jobNo.trim(),
    leadless: true,
    cancelled: false,
    limit: 10,
  };
}

export function bookingJobExplainFilters(jobNo: string): Record<string, string | number | boolean> {
  return {
    job_no: jobNo.trim(),
    limit: 10,
  };
}

export function hasLeadSearchCriteria(draft: ManualLeadSearchDraft): boolean {
  return Boolean(
    trim(draft.source_granularity_key) ||
      trim(draft.phone_number) ||
      trim(draft.name) ||
      trim(draft.email) ||
      trim(draft.ref_no) ||
      trim(draft.job_no),
  );
}

function hasSharedLeadCriteria(draft: ManualLeadSearchDraft): boolean {
  return Boolean(
    trim(draft.source_granularity_key) ||
      trim(draft.phone_number) ||
      trim(draft.name) ||
      trim(draft.email),
  );
}

export function sanitizeLeadSearchDraft(
  draft: ManualLeadSearchDraft,
  channel?: LeadSourceChannel,
): ManualLeadSearchDraft {
  return {
    ...draft,
    ref_no: channel === "call" ? "" : draft.ref_no,
    job_no: channel === "form" ? "" : draft.job_no,
  };
}

export function leadSearchResources(
  draft: ManualLeadSearchDraft,
  channel?: LeadSourceChannel,
): ManualLeadSearchResource[] {
  const next = sanitizeLeadSearchDraft(draft, channel);
  if (channel === "form") return hasSharedLeadCriteria(next) || trim(next.ref_no) ? ["form-leads"] : [];
  if (channel === "call") return hasSharedLeadCriteria(next) || trim(next.job_no) ? ["call-leads"] : [];
  const resources: ManualLeadSearchResource[] = [];
  if (hasSharedLeadCriteria(next) || trim(next.ref_no)) resources.push("form-leads");
  if (hasSharedLeadCriteria(next) || trim(next.job_no)) resources.push("call-leads");
  return resources;
}

export function leadSearchFilters(
  draft: ManualLeadSearchDraft,
  resource: ManualLeadSearchResource = "form-leads",
): Record<string, string | number | boolean> {
  const filters: Record<string, string | number | boolean> = {
    duplicate: false,
    booked: false,
    limit: 10,
  };
  if (trim(draft.source_granularity_key)) filters.source_granularity_key = trim(draft.source_granularity_key);
  if (trim(draft.phone_number)) filters.phone_number = trim(draft.phone_number);
  if (trim(draft.name)) filters.name = trim(draft.name);
  if (trim(draft.email)) filters.email = trim(draft.email);
  if (resource === "form-leads" && trim(draft.ref_no)) filters.ref_no = trim(draft.ref_no);
  if (resource === "call-leads" && trim(draft.job_no)) filters.job_no = trim(draft.job_no);
  return filters;
}

export function channelForLeadKind(kind: ManualLeadKind): LeadSourceChannel {
  return kind === "CallLead" ? "call" : "form";
}

export function leadKindFromResource(resource: ManualLeadSearchResource): ManualLeadKind {
  return resource === "call-leads" ? "CallLead" : "FormLead";
}
