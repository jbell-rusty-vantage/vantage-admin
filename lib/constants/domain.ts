import type { DatabaseScope, SelectOption } from "@/lib/api/types";

export const DATABASE_SCOPES = ["production", "historical", "combined"] as const;
export const OPERATIONAL_DATABASE_SCOPES = ["production", "historical"] as const;

export const DATABASE_SCOPE_LABELS = {
  production: "Production",
  historical: "Historical Read-Only",
  combined: "Combined Analytics",
} as const satisfies Record<DatabaseScope, string>;

export const SOURCE_COMPANIES = [
  "tbm_leads",
  "tbm_prime_leads",
  "top10_leads",
  "best_relocation_leads",
  "get_movers_leads",
  "main_site",
  "not_provided",
  "referral",
] as const;

export type SourceCompany = (typeof SOURCE_COMPANIES)[number];

export const SOURCE_COMPANY_LABELS = {
  tbm_leads: "TBM Leads",
  tbm_prime_leads: "TBM Prime Leads",
  top10_leads: "Top 10 Forms",
  best_relocation_leads: "Best Relocation Leads",
  get_movers_leads: "GetMovers Leads",
  main_site: "main site",
  not_provided: "not provided",
  referral: "Referral",
} as const satisfies Record<SourceCompany, string>;

/** Granot CRM `label` values for web form leads (maps to `source_company` on save). */
export const FORM_LEAD_SOURCE_LABELS = [
  "Main Site Forms",
  "TBM Forms",
  "TBM Prime Forms",
  "Top10 Forms",
  "Best Relocation Forms",
  "Best Relocation Locals",
  "GetMovers Forms",
] as const;

export type FormLeadSourceLabel = (typeof FORM_LEAD_SOURCE_LABELS)[number];

/** Granot CRM `label` values for inbound call leads (maps to `source_company` on save). */
export const CALL_LEAD_SOURCE_LABELS = [
  "Main Site Inbounds",
  "10best Inbounds",
  "TBM Prime Inbounds",
  "Top10 Inbounds",
  "Best Relocation Inbounds",
  "GetMovers Inbounds",
] as const;

export type CallLeadSourceLabel = (typeof CALL_LEAD_SOURCE_LABELS)[number];

export const CRM_SOURCE_LABELS = [
  ...FORM_LEAD_SOURCE_LABELS,
  ...CALL_LEAD_SOURCE_LABELS,
] as const;

// ---------------------------------------------------------------------------
// Observability enums (mirror api/config/domain/observability.ts in
// vantage-main-server). Used as built-in dropdown options so the
// Observational filters keep working even when the facets endpoint is
// unavailable; dynamic values (workflows, event keys, etc.) still come from
// the facets endpoint.
// ---------------------------------------------------------------------------

export const OBSERVABILITY_LEVELS = ["debug", "info", "warn", "error", "critical"] as const;

export const OPERATIONAL_EVENT_CATEGORIES = [
  "http",
  "mongo",
  "crm",
  "google_sheets",
  "sheet_sync",
  "ringcentral",
  "queue",
  "cron",
  "lead",
  "booking",
  "cancellation",
  "customer",
  "auth",
  "zip_state",
  "notification",
  "report",
  "admin",
] as const;

export const INCIDENT_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "ignored",
  "auto_resolved",
] as const;

export const INCIDENT_SEVERITIES = ["warn", "error", "critical"] as const;

export const NOTIFICATION_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
  "suppressed",
  "cancelled",
] as const;

export const NOTIFICATION_PURPOSES = [
  "immediate_alert",
  "daily_digest",
  "weekly_report",
  "test",
] as const;

export const NOTIFICATION_RECIPIENT_TYPES = ["owner", "developer", "internal"] as const;

export const OPERATIONAL_REPORT_KEYS = [
  "daily-owner-operational-summary",
  "workflow-failure-summary",
  "source-company-issue-summary",
  "sheet-sync-health-summary",
  "ringcentral-health-summary",
  "notification-delivery-summary",
  "http-error-summary",
] as const;

export const REPORT_RUN_STATUSES = ["running", "completed", "failed"] as const;

export type CrmSourceLabel = (typeof CRM_SOURCE_LABELS)[number];

export const SOURCE_LABELS = [...CRM_SOURCE_LABELS, "referral"] as const;

export const SOURCE_LABEL_TO_COMPANY = {
  "Main Site Forms": "main_site",
  "Main Site Inbounds": "main_site",
  "Get Movers": "get_movers_leads",
  "GetMovers Forms": "get_movers_leads",
  "Get Movers Forms": "get_movers_leads",
  "GetMovers Inbounds": "get_movers_leads",
  "Get Movers Inbounds": "get_movers_leads",
  "TBM Forms": "tbm_leads",
  "TBM Prime Forms": "tbm_prime_leads",
  "TBM Forms Prime": "tbm_prime_leads",
  "TBM Prime Inbounds": "tbm_prime_leads",
  "Top10 Forms": "top10_leads",
  "Top10 Inbounds": "top10_leads",
  "10 Best Inbounds": "tbm_leads",
  "10Best Inbounds": "tbm_leads",
  "10best Inbounds": "tbm_leads",
  "Best Relocation Forms": "best_relocation_leads",
  "Best Relocation Locals": "best_relocation_leads",
  "Best Relocation Inbounds": "best_relocation_leads",
  "BestRelocation Forms": "best_relocation_leads",
  "BestRelocation Locals": "best_relocation_leads",
  "BestRelocation Inbounds": "best_relocation_leads",
} as const satisfies Record<string, SourceCompany>;

export const CANCELLATION_REASONS = [
  "customer_cancelled",
  "price_too_high",
  "booked_with_competitor",
  "duplicate_booking",
  "bad_lead",
  "not_serviceable",
  "other",
] as const;

export const FORM_LEAD_BAD_LEAD_REASONS = [
  "disconnected_number",
  "bad_phone_email_name",
  "auto_only",
  "international_move",
] as const;

export type FormLeadBadLeadReason = (typeof FORM_LEAD_BAD_LEAD_REASONS)[number];

export const FORM_LEAD_BAD_LEAD_LABELS = {
  disconnected_number: "D/C number",
  bad_phone_email_name: "Bad Phone-Email-Name",
  auto_only: "Auto Only",
  international_move: "International Move",
} as const satisfies Record<FormLeadBadLeadReason, string>;

export const LOCAL_TYPES = ["local", "long_distance"] as const;
export const LEAD_MODELS = ["FormLead", "CallLead"] as const;
export const MOVE_SIZES = [
  "Studio",
  "2 Bedrooms",
  "3 Bedrooms",
  "4 Bedrooms",
  "5+ Bedrooms",
  "Office",
] as const;
export const SHEET_SYNC_STATUSES = ["pending", "synced", "failed"] as const;

export function toSelectOptions<TValue extends string>(
  values: readonly TValue[],
  labels?: Partial<Record<TValue, string>>,
): SelectOption<TValue>[] {
  return values.map((value) => ({
    value,
    label: labels?.[value] ?? value,
  }));
}

export const DATABASE_SCOPE_OPTIONS = toSelectOptions(DATABASE_SCOPES, DATABASE_SCOPE_LABELS);
export const OPERATIONAL_DATABASE_SCOPE_OPTIONS = toSelectOptions(
  OPERATIONAL_DATABASE_SCOPES,
  DATABASE_SCOPE_LABELS,
);
export const SOURCE_COMPANY_OPTIONS = toSelectOptions(SOURCE_COMPANIES, SOURCE_COMPANY_LABELS);
export const FORM_LEAD_SOURCE_LABEL_OPTIONS = toSelectOptions(FORM_LEAD_SOURCE_LABELS);
export const CALL_LEAD_SOURCE_LABEL_OPTIONS = toSelectOptions(CALL_LEAD_SOURCE_LABELS);
export const SOURCE_LABEL_OPTIONS = toSelectOptions(SOURCE_LABELS);
export const CANCELLATION_REASON_OPTIONS = toSelectOptions(CANCELLATION_REASONS);
export const FORM_LEAD_BAD_LEAD_REASON_OPTIONS = toSelectOptions(
  FORM_LEAD_BAD_LEAD_REASONS,
  FORM_LEAD_BAD_LEAD_LABELS,
);
export const LOCAL_TYPE_OPTIONS = toSelectOptions(LOCAL_TYPES, {
  local: "Local",
  long_distance: "Long Distance",
});
export const MOVE_SIZE_OPTIONS = toSelectOptions(MOVE_SIZES);
export const SHEET_SYNC_STATUS_OPTIONS = toSelectOptions(SHEET_SYNC_STATUSES, {
  pending: "Pending",
  synced: "Synced",
  failed: "Failed",
});

export function getSourceCompanyLabel(sourceCompany: SourceCompany): string {
  return SOURCE_COMPANY_LABELS[sourceCompany];
}

function resolveStoredSourceCompany(value?: string | null): SourceCompany | undefined {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "not_provided";
  }

  for (const [label, sourceCompany] of Object.entries(SOURCE_LABEL_TO_COMPANY)) {
    if (label.toLowerCase() === normalized) {
      return sourceCompany;
    }
  }

  if ((SOURCE_COMPANIES as readonly string[]).includes(normalized)) {
    return normalized as SourceCompany;
  }

  for (const [slug, label] of Object.entries(SOURCE_COMPANY_LABELS)) {
    if (label.toLowerCase() === normalized) {
      return slug as SourceCompany;
    }
  }

  return undefined;
}

/** Sheet/CRM label shown for a stored form lead `source_company` slug. */
export function getFormLeadSourceLabel(
  sourceCompany?: string | null,
  local?: string | null,
): FormLeadSourceLabel {
  const company = resolveStoredSourceCompany(sourceCompany) ?? "not_provided";
  switch (company) {
    case "tbm_leads":
      return "TBM Forms";
    case "tbm_prime_leads":
      return "TBM Prime Forms";
    case "top10_leads":
      return "Top10 Forms";
    case "best_relocation_leads":
      return local === "local" ? "Best Relocation Locals" : "Best Relocation Forms";
    case "get_movers_leads":
      return "GetMovers Forms";
    case "main_site":
    case "not_provided":
    default:
      return "Main Site Forms";
  }
}

/** Sheet/CRM label shown for a stored call lead `source_company` slug. */
export function getCallLeadSourceLabel(sourceCompany?: string | null): CallLeadSourceLabel {
  const company = resolveStoredSourceCompany(sourceCompany) ?? "not_provided";
  switch (company) {
    case "tbm_leads":
      return "10best Inbounds";
    case "tbm_prime_leads":
      return "TBM Prime Inbounds";
    case "top10_leads":
      return "Top10 Inbounds";
    case "best_relocation_leads":
      return "Best Relocation Inbounds";
    case "get_movers_leads":
      return "GetMovers Inbounds";
    case "main_site":
    case "not_provided":
    default:
      return "Main Site Inbounds";
  }
}

export function getDatabaseScopeLabel(scope: DatabaseScope): string {
  return DATABASE_SCOPE_LABELS[scope];
}

export const REFERRAL_SOURCE_COMPANY = "referral" as const;

export function isReferralSourceCompany(value: string | null | undefined): boolean {
  return value === REFERRAL_SOURCE_COMPANY;
}
