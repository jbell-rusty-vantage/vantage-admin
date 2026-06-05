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
  main_site: "main site",
  not_provided: "not provided",
  referral: "Referral",
} as const satisfies Record<SourceCompany, string>;

export const SOURCE_LABELS = [
  "TBM Forms",
  "10best Inbounds",
  "TBM Prime Forms",
  "TBM Prime Inbounds",
  "Top10 Forms",
  "Top10 Inbounds",
  "Best Relocation Forms",
  "Best Relocation Locals",
  "Best Relocation Inbounds",
  "Main Site Forms",
  "Main Site Inbounds",
  "referral",
] as const;

export const SOURCE_LABEL_TO_COMPANY = {
  "Main Site Forms": "main_site",
  "Main Site Inbounds": "main_site",
  "Get Movers": "main_site",
  "TBM Forms": "tbm_leads",
  "TBM Prime Forms": "tbm_prime_leads",
  "TBM Forms Prime": "tbm_prime_leads",
  "TBM Prime Inbounds": "tbm_prime_leads",
  "Top10 Forms": "top10_leads",
  "Top10 Inbounds": "top10_leads",
  "10best Inbounds": "top10_leads",
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
export const SOURCE_LABEL_OPTIONS = toSelectOptions(SOURCE_LABELS);
export const CANCELLATION_REASON_OPTIONS = toSelectOptions(CANCELLATION_REASONS);
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

export function getDatabaseScopeLabel(scope: DatabaseScope): string {
  return DATABASE_SCOPE_LABELS[scope];
}

export const REFERRAL_SOURCE_COMPANY = "referral" as const;

export function isReferralSourceCompany(value: string | null | undefined): boolean {
  return value === REFERRAL_SOURCE_COMPANY;
}
