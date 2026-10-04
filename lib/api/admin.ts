"use client";

import { filtersToQueryString, type SerializableFilters } from "./filters";
import type {
  ApiResponse,
  GlobalSearchResponse,
  PaginatedResult,
} from "./types";

export type AdminResource =
  | "form-leads"
  | "call-leads"
  | "booked-leads"
  | "cancelled-leads";

export type UiResource =
  | "form-leads"
  | "duplicate-form-leads"
  | "call-leads"
  | "duplicate-call-leads"
  | "bookings"
  | "cancellations";

export type AdminRecord = Record<string, unknown> & {
  _id?: string;
  id?: string;
};

export type AnalyticsReport =
  | "summary"
  | "revenue-trend"
  | "source-company-performance"
  | "agent-performance"
  | "booking-cancellation-ratio"
  | "source-company-funnel"
  | "cancellation-reasons"
  | "lead-source-performance"
  | "local-vs-long-distance"
  | "geographic-lanes"
  | "pickup-state-performance"
  | "delivery-state-performance"
  | "receiver-agent-performance"
  | "receiver-agent-trend"
  | "receiver-agent-source-breakdown"
  | "sms-successfully-sent-then-booked";

export type SourceGranularityMetricRow = Record<string, unknown> & {
  source_granularity_key?: string;
  source_granularity_label?: string;
  channel?: "form" | "call" | string | null;
};

export type SourceCompanyMetricRow<
  TGranularity extends SourceGranularityMetricRow = SourceGranularityMetricRow,
> = Record<string, unknown> & {
  source_company?: string;
  source_company_label?: string;
  granularities?: TGranularity[];
};

export type AnalyticsSourceGranularityRow = SourceGranularityMetricRow;

export type AnalyticsSourceCompanyRow =
  SourceCompanyMetricRow<AnalyticsSourceGranularityRow>;

export type AnalyticsResponse<TData extends Record<string, unknown> = Record<string, unknown>> = {
  report: AnalyticsReport;
  generated_at: string;
  data: TData;
};

export type OverviewLeadCostGranularityRow = SourceGranularityMetricRow & {
  lead_count?: number;
  total_lead_cost?: number;
  unresolved_cpl_count?: number;
};

export type OverviewLeadCostSourceRow =
  SourceCompanyMetricRow<OverviewLeadCostGranularityRow> & {
    lead_count?: number;
    total_lead_cost?: number;
    unresolved_cpl_count?: number;
  };

export type OverviewLeadCost = {
  total: number;
  by_source_company: OverviewLeadCostSourceRow[];
};

export type OverviewTotals = {
  total_binder_amount?: number;
  total_deposit_amount?: number;
  total_refund_amount?: number;
  bookings?: number;
  active_bookings?: number;
  cancelled_bookings?: number;
  cancellations?: number;
  total_leads?: number;
  form_leads?: number;
  call_leads?: number;
  booking_rate?: number;
  cancellation_rate?: number;
};

export type OverviewAgentRow = {
  agent_name?: string;
  bookings?: number;
  total_binder_amount?: number;
  total_deposit_amount?: number;
};

export type OverviewSourceGranularityRow = SourceGranularityMetricRow & {
  bookings?: number;
  total_deposit_amount?: number;
};

export type OverviewSourceRow =
  SourceCompanyMetricRow<OverviewSourceGranularityRow> & {
    bookings?: number;
    total_deposit_amount?: number;
  };

export type OverviewReportResponse = {
  generated_at: string;
  all_time: {
    totals: OverviewTotals;
    lead_cost: OverviewLeadCost | null;
    top_agents: OverviewAgentRow[];
  };
  last_7_days: {
    period: { from: string; to: string };
    totals: OverviewTotals;
    by_source_company: OverviewSourceRow[];
    lead_cost: OverviewLeadCost;
    top_agents: OverviewAgentRow[];
  } | null;
};

export type FilterCatalogCompany = {
  id: string;
  company_slug: string;
  owner_label: string;
  active: boolean;
};

export type FilterCatalogGranularity = {
  id: string;
  source_company_id: string;
  company_slug: string;
  company_owner_label: string;
  granularity_key: string;
  channel?: "form" | "call";
  owner_label: string;
  crm_label?: string;
  local?: "local" | "long_distance";
  active: boolean;
};

export type FilterCatalogAgent = {
  id: string;
  name: string;
  active: boolean;
};

export type FilterCatalogMerchant = {
  id: string;
  name: string;
  active: boolean;
};

export type FilterCatalog = {
  source_companies: FilterCatalogCompany[];
  source_granularities: FilterCatalogGranularity[];
  agents: FilterCatalogAgent[];
  merchants: FilterCatalogMerchant[];
};

export type AdminFacets = {
  catalog?: FilterCatalog;
  agents: string[];
  source_companies: string[];
  source_granularities?: string[];
  sources: string[];
  merchants: string[];
};

export type AdminTestimonial = {
  id: string;
  source: string;
  source_company?: string;
  reviewer_name: string;
  review_date: string;
  rating: number;
  review_text: string;
  business_response: {
    responded_at: string;
    text: string;
  } | null;
  published: boolean;
  featured: boolean;
  customer: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export const uiToAdminResource: Record<UiResource, AdminResource> = {
  "form-leads": "form-leads",
  "duplicate-form-leads": "form-leads",
  "call-leads": "call-leads",
  "duplicate-call-leads": "call-leads",
  bookings: "booked-leads",
  cancellations: "cancelled-leads",
};

function proxyUrl(path: string, filters?: SerializableFilters): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}${filters ? filtersToQueryString(filters) : ""}`;
}

/** HTML error pages (e.g. a 404 from a stale deployment) are not user-facing messages. */
function cleanErrorMessage(message: string | undefined, status: number, statusText: string): string {
  const trimmed = message?.trim() ?? "";
  if (!trimmed || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return `Request failed (${status}${statusText ? ` ${statusText}` : ""}).`;
  }
  return trimmed;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || !payload.ok) {
    const rawMessage = payload && !payload.ok ? payload.error : response.statusText;
    throw new Error(cleanErrorMessage(rawMessage, response.status, response.statusText));
  }

  return payload.data;
}

async function requestEmpty(url: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.ok) {
    return;
  }

  let payload: ApiResponse<unknown> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<unknown>;
  } catch {
    payload = undefined;
  }

  const rawMessage = payload && !payload.ok ? payload.error : response.statusText;
  throw new Error(cleanErrorMessage(rawMessage, response.status, response.statusText));
}

export function getRecordId(record: AdminRecord): string {
  const value = record._id ?? record.id;
  return typeof value === "string" ? value : "";
}

export async function fetchAdminList<TRecord extends AdminRecord>(
  resource: AdminResource,
  filters: SerializableFilters,
): Promise<PaginatedResult<TRecord>> {
  return requestJson<PaginatedResult<TRecord>>(proxyUrl(`api/v1/admin/${resource}`, filters));
}

export async function fetchAdminDetail<TRecord extends AdminRecord>(
  resource: AdminResource,
  id: string,
  filters?: SerializableFilters,
): Promise<TRecord> {
  return requestJson<TRecord>(
    proxyUrl(`api/v1/admin/${resource}/${encodeURIComponent(id)}`, filters),
  );
}

export async function updateProductionRecord<TRecord extends AdminRecord>(
  resource: AdminResource,
  id: string,
  body: Record<string, unknown>,
): Promise<TRecord> {
  return requestJson<TRecord>(proxyUrl(`api/v1/${resource}/${encodeURIComponent(id)}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function updateFormLeadBadLead<TRecord extends AdminRecord>(
  id: string,
  badLead: string | null,
): Promise<TRecord> {
  return updateProductionRecord<TRecord>("form-leads", id, {
    bad_lead: badLead,
  });
}

export async function updateLeadNoSync<TRecord extends AdminRecord>(
  resource: "form-leads" | "call-leads",
  id: string,
  no_sync: boolean,
): Promise<TRecord> {
  return updateProductionRecord<TRecord>(resource, id, {
    no_sync,
  });
}

export type CreateFormLeadResult = {
  lead: AdminRecord;
  sheet_sync_status?: string;
  crm_sync_status?: string;
  crm_company_label?: string;
  messaging_status?: string;
};

export async function createFormLead(body: Record<string, unknown>): Promise<CreateFormLeadResult> {
  return requestJson<CreateFormLeadResult>(proxyUrl("api/v1/form-leads"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createCallLead(body: Record<string, unknown>): Promise<AdminRecord> {
  return requestJson<AdminRecord>(proxyUrl("api/v1/call-leads"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type OwnerBookingCreateResult = {
  booking?: unknown;
  message?: string;
  warnings?: unknown;
  total_binder_amount?: number;
  reconciliation_case_id?: string;
};

export async function createBookingFromSource(body: Record<string, unknown>) {
  return requestJson<OwnerBookingCreateResult>(proxyUrl("api/v1/booked-leads/from-source"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createReferralBooking(body: Record<string, unknown>) {
  return requestJson<OwnerBookingCreateResult>(proxyUrl("api/v1/referral-bookings"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createLeadlessBooking(body: Record<string, unknown>) {
  return requestJson<OwnerBookingCreateResult>(proxyUrl("api/v1/leadless-bookings"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createCancellation(body: Record<string, unknown>) {
  return requestJson<unknown>(proxyUrl("api/v1/cancelled-leads"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteBookedLead(id: string, options: { cascade?: boolean } = {}): Promise<void> {
  return requestEmpty(
    proxyUrl(`api/v1/booked-leads/${encodeURIComponent(id)}`, {
      ...(options.cascade ? { cascade: "true" } : {}),
    }),
    { method: "DELETE" },
  );
}

export async function deleteCancelledLead(id: string): Promise<void> {
  return requestEmpty(proxyUrl(`api/v1/cancelled-leads/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
}

export async function fetchGlobalSearch(filters: SerializableFilters): Promise<GlobalSearchResponse> {
  return requestJson<GlobalSearchResponse>(proxyUrl("api/v1/admin/search", filters));
}

export async function fetchAdminFacets(): Promise<AdminFacets> {
  return requestJson<AdminFacets>(proxyUrl("api/v1/admin/facets"));
}

export async function fetchAdminTestimonials(
  filters: SerializableFilters,
): Promise<PaginatedResult<AdminTestimonial>> {
  return requestJson<PaginatedResult<AdminTestimonial>>(
    proxyUrl("api/v1/admin/testimonials", filters),
  );
}

export async function fetchAdminTestimonialReviewerNames(): Promise<string[]> {
  return requestJson<string[]>(proxyUrl("api/v1/admin/testimonials/reviewer-names"));
}

export async function fetchOverviewReport(): Promise<OverviewReportResponse> {
  return requestJson<OverviewReportResponse>(proxyUrl("api/v1/admin/analytics/overview"));
}

export async function fetchAnalyticsReport(
  report: AnalyticsReport,
  filters: SerializableFilters,
): Promise<AnalyticsResponse> {
  return requestJson<AnalyticsResponse>(proxyUrl(`api/v1/admin/analytics/${report}`, filters));
}

export function adminExportUrl(resource: AdminResource, filters: SerializableFilters): string {
  return proxyUrl(`api/v1/admin/exports/${resource}.csv`, filters);
}

export function analyticsExportUrl(report: AnalyticsReport, filters: SerializableFilters): string {
  return proxyUrl(`api/v1/admin/exports/analytics/${report}.csv`, filters);
}

export type SheetContainsEntityModel = "FormLead" | "CallLead" | "BookedLead" | "CancelledLead";

export type SheetContainsVerdict =
  | "found"
  | "missing"
  | "wrong_tab"
  | "not_expected"
  | "not_found";

export type SheetContainsEvidenceCell = {
  header: string;
  value: string;
};

export type SheetContainsLocation = {
  workbook: string;
  workbook_key: string;
  spreadsheet_id: string;
  tab_name: string;
  target: string;
  role: "expected" | "sibling";
  row_number: number;
  gid?: number;
  sheet_url?: string;
  evidence: SheetContainsEvidenceCell[];
};

export type SheetContainsItem = {
  id: string;
  entity_model: SheetContainsEntityModel;
  label: string;
  verdict: SheetContainsVerdict;
  expected_tabs: string[];
  missing_expected_tabs: string[];
  found: SheetContainsLocation[];
  reason?: "created_on_unmatched" | "missing_from_mongo" | "no_sync";
  sheet_sync_hint: Array<{
    target: string;
    tab_name: string;
    row_number?: number;
    status: string;
  }>;
  open_job?: {
    job_id: string;
    status: string;
    resource: string;
  };
};

export type SheetContainsResult = {
  entity_model: SheetContainsEntityModel;
  checked_at: string;
  items: SheetContainsItem[];
};

export async function checkSheetContains(body: {
  entity_model: SheetContainsEntityModel;
  ids: string[];
}): Promise<SheetContainsResult> {
  return requestJson<SheetContainsResult>(proxyUrl("api/v1/admin/sheet-sync/contains"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
