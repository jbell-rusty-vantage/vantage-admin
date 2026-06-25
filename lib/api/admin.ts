"use client";

import { filtersToQueryString, type SerializableFilters } from "./filters";
import type {
  ApiResponse,
  DatabaseScope,
  GlobalSearchResponse,
  PaginatedResult,
} from "./types";

export type AdminResource =
  | "form-leads"
  | "call-leads"
  | "booked-leads"
  | "cancelled-leads"
  | "customers"
  | "agents";

export type UiResource =
  | "form-leads"
  | "duplicate-form-leads"
  | "call-leads"
  | "duplicate-call-leads"
  | "bookings"
  | "cancellations"
  | "customers"
  | "agents";

export type AdminRecord = Record<string, unknown> & {
  _id?: string;
  id?: string;
  database_scope?: DatabaseScope;
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
  | "delivery-state-performance";

export type AnalyticsResponse = {
  report: AnalyticsReport;
  database_scope: DatabaseScope;
  generated_at: string;
  data: Record<string, unknown>;
};

export type OverviewLeadCost = {
  total: number;
  by_source_company: Array<{
    source_company?: string;
    lead_count?: number;
    total_lead_cost?: number;
  }>;
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

export type OverviewSourceRow = {
  source_company?: string;
  bookings?: number;
  total_deposit_amount?: number;
};

export type OverviewReportResponse = {
  database_scope: DatabaseScope;
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

export type AdminFacets = {
  agents: string[];
  source_companies: string[];
  sources: string[];
  merchants: string[];
};

export type AgentSalesReportResponse = {
  database_scope: DatabaseScope;
  from: string;
  to: string;
  agents: string[];
  generated_at: string;
  items: Record<string, unknown>[];
  totals: Record<string, unknown>;
};

export const uiToAdminResource: Record<UiResource, AdminResource> = {
  "form-leads": "form-leads",
  "duplicate-form-leads": "form-leads",
  "call-leads": "call-leads",
  "duplicate-call-leads": "call-leads",
  bookings: "booked-leads",
  cancellations: "cancelled-leads",
  customers: "customers",
  agents: "agents",
};

export const adminToUiResource: Record<AdminResource, UiResource> = {
  "form-leads": "form-leads",
  "call-leads": "call-leads",
  "booked-leads": "bookings",
  "cancelled-leads": "cancellations",
  customers: "customers",
  agents: "agents",
};

export const resourceLabels: Record<UiResource, string> = {
  "form-leads": "Form Leads",
  "duplicate-form-leads": "Duplicate Form Leads",
  "call-leads": "Call Leads",
  "duplicate-call-leads": "Duplicate Call Leads",
  bookings: "Bookings",
  cancellations: "Cancellations",
  customers: "Customers",
  agents: "Agents",
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
  scope: DatabaseScope,
  filters?: SerializableFilters,
): Promise<TRecord> {
  const detailScope = scope === "combined" ? "production" : scope;
  return requestJson<TRecord>(
    proxyUrl(`api/v1/admin/${resource}/${encodeURIComponent(id)}`, {
      ...filters,
      database_scope: detailScope,
    }),
  );
}

export async function updateProductionRecord<TRecord extends AdminRecord>(
  resource: Exclude<AdminResource, "agents">,
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

export async function createBookingFromSource(body: Record<string, unknown>) {
  return requestJson<unknown>(proxyUrl("api/v1/booked-leads/from-source"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createReferralBooking(body: Record<string, unknown>) {
  return requestJson<unknown>(proxyUrl("api/v1/referral-bookings"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createLeadlessBooking(body: Record<string, unknown>) {
  return requestJson<unknown>(proxyUrl("api/v1/leadless-bookings"), {
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

export async function fetchAdminFacets(scope: DatabaseScope): Promise<AdminFacets> {
  return requestJson<AdminFacets>(proxyUrl("api/v1/admin/facets", { database_scope: scope }));
}

export async function fetchAgentSalesReport(
  filters: SerializableFilters,
): Promise<AgentSalesReportResponse> {
  return requestJson<AgentSalesReportResponse>(proxyUrl("api/v1/admin/reports/agent-sales", filters));
}

export function agentSalesReportExportUrl(filters: SerializableFilters): string {
  return proxyUrl("api/v1/admin/exports/reports/agent-sales.csv", filters);
}

export async function fetchOverviewReport(scope: DatabaseScope): Promise<OverviewReportResponse> {
  return requestJson<OverviewReportResponse>(
    proxyUrl("api/v1/admin/analytics/overview", { database_scope: scope }),
  );
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

// ---------------------------------------------------------------------------
// Observability (Observational tab)
// ---------------------------------------------------------------------------

export type ObservabilityLevel = "debug" | "info" | "warn" | "error" | "critical";

export type IncidentStatus =
  | "open"
  | "acknowledged"
  | "resolved"
  | "ignored"
  | "auto_resolved";

export type IncidentSeverity = "warn" | "error" | "critical";

export type OperationalReportKey =
  | "daily-owner-operational-summary"
  | "workflow-failure-summary"
  | "source-company-issue-summary"
  | "sheet-sync-health-summary"
  | "ringcentral-health-summary"
  | "notification-delivery-summary"
  | "http-error-summary";

export type ObservabilityDeleteCollection =
  | "events"
  | "incidents"
  | "notifications"
  | "report-runs";

export type OperationalEvent = {
  _id: string;
  occurred_at: string;
  received_at?: string;
  level: ObservabilityLevel;
  event_key: string;
  category: string;
  workflow: string;
  summary: string;
  details?: Record<string, unknown> | null;
  trace?: Record<string, unknown> | null;
  fingerprint?: string;
  dedupe_key?: string | null;
  environment?: string;
  service?: string;
  request_id?: string | null;
  route?: string | null;
  method?: string | null;
  status_code?: number | null;
  duration_ms?: number | null;
  entity_type?: string | null;
  entity_id?: string | null;
  lead_name?: string | null;
  lead_phone?: string | null;
  lead_email?: string | null;
  source_company?: string | null;
  job_no?: string | null;
  run_id?: string | null;
  incident_id?: string | null;
  notification_candidate?: boolean;
  reportable?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type OperationalIncident = {
  _id: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  fingerprint?: string;
  dedupe_key?: string;
  event_key: string;
  category: string;
  workflow: string;
  title: string;
  summary?: string;
  environment?: string;
  service?: string;
  source_company?: string | null;
  route?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  lead_name?: string | null;
  lead_phone?: string | null;
  lead_email?: string | null;
  run_id?: string | null;
  first_seen_at?: string;
  last_seen_at?: string;
  resolved_at?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  ignored_at?: string | null;
  ignored_by?: string | null;
  count?: number;
  last_details?: Record<string, unknown> | null;
  owner_visible?: boolean;
  notification_state?: {
    immediate_sent_at?: string | null;
    digest_sent_at?: string | null;
    next_notify_at?: string | null;
    suppressed_count?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationDelivery = {
  _id: string;
  channel?: string;
  provider?: string;
  purpose: string;
  status: string;
  recipient_type: string;
  to?: string[];
  from?: string;
  reply_to?: string | null;
  subject?: string;
  body_text_preview?: string;
  event_id?: string | null;
  incident_id?: string | null;
  report_run_id?: string | null;
  dedupe_key?: string | null;
  provider_message_id?: string | null;
  provider_response?: Record<string, unknown> | null;
  error_message?: string | null;
  attempt_count?: number;
  next_attempt_at?: string | null;
  sent_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OperationalReportRun = {
  _id: string;
  report_key: string;
  report_version: number;
  status: "running" | "completed" | "failed";
  requested_by?: string;
  database_scope?: string;
  period?: {
    from: string;
    to: string;
    timezone: string;
    granularity?: string;
  };
  filters?: Record<string, unknown>;
  input_watermark?: {
    events_max_occurred_at?: string | null;
    events_count?: number;
    incidents_count?: number;
  };
  result?: Record<string, unknown>;
  result_hash?: string;
  error_message?: string | null;
  started_at?: string;
  finished_at?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ObservabilityCountRow = { key: string; count: number };

export type ObservabilityOverviewResponse = {
  generated_at: string;
  period: { from: string; to: string; timezone: string };
  health: {
    overall_status: "healthy" | "degraded" | "critical";
    open_critical: number;
    open_error: number;
    open_warn: number;
  };
  event_counts_by_level: ObservabilityCountRow[];
  event_counts_by_category: ObservabilityCountRow[];
  event_counts_by_workflow: ObservabilityCountRow[];
  top_open_incidents: OperationalIncident[];
  recent_critical_events: OperationalEvent[];
  sheet_sync: Record<string, unknown> | null;
  ringcentral: { open_incidents: number };
  notifications: {
    sent_today: number;
    failed_today: number;
    suppressed_today: number;
  };
};

export type ObservabilityFacetsResponse = {
  period: { from: string; to: string };
  workflows: string[];
  event_keys: string[];
  source_companies: string[];
  entity_types: string[];
  routes: string[];
  levels: ObservabilityLevel[];
  categories: string[];
  incident_statuses: IncidentStatus[];
  incident_severities: IncidentSeverity[];
  notification_statuses: string[];
  notification_purposes: string[];
  notification_recipient_types: string[];
  report_keys: OperationalReportKey[];
  report_run_statuses: string[];
};

export type OperationalEventDetailResponse = {
  event: OperationalEvent;
  incident: OperationalIncident | null;
};

export type OperationalIncidentDetailResponse = {
  incident: OperationalIncident;
  events: OperationalEvent[];
  notifications: NotificationDelivery[];
  suggested_action: string;
};

export type ObservabilityIncidentStatusBody = {
  status: IncidentStatus;
  actor?: string;
  note?: string;
};

export type ObservabilityIncidentBatchStatusBody = ObservabilityIncidentStatusBody & {
  ids: string[];
};

export type ObservabilityIncidentBatchStatusResponse = {
  matched: number;
  updated: number;
  updated_ids: string[];
  skipped: Array<{ id: string; reason: string }>;
};

export type ObservabilityDeleteResponse = {
  collection: ObservabilityDeleteCollection;
  matched: number;
  deleted: number;
  deleted_ids: string[];
  skipped: Array<{ id: string; reason: string }>;
};

export type ObservabilityReportRunBody = {
  report_key: OperationalReportKey | string;
  from: string;
  to: string;
  timezone?: string;
  category?: string;
  workflow?: string;
  source_company?: string;
  level?: ObservabilityLevel;
  include_resolved?: boolean;
  requested_by?: string;
};

export async function fetchObservabilityOverview(
  filters: SerializableFilters,
): Promise<ObservabilityOverviewResponse> {
  return requestJson<ObservabilityOverviewResponse>(
    proxyUrl("api/v1/admin/observability/overview", filters),
  );
}

export async function fetchObservabilityFacets(
  filters: SerializableFilters = {},
): Promise<ObservabilityFacetsResponse> {
  return requestJson<ObservabilityFacetsResponse>(
    proxyUrl("api/v1/admin/observability/facets", filters),
  );
}

export async function fetchOperationalEvents(
  filters: SerializableFilters,
): Promise<PaginatedResult<OperationalEvent>> {
  return requestJson<PaginatedResult<OperationalEvent>>(
    proxyUrl("api/v1/admin/observability/events", filters),
  );
}

export async function fetchOperationalEventDetail(
  id: string,
): Promise<OperationalEventDetailResponse> {
  return requestJson<OperationalEventDetailResponse>(
    proxyUrl(`api/v1/admin/observability/events/${encodeURIComponent(id)}`),
  );
}

export async function fetchOperationalIncidents(
  filters: SerializableFilters,
): Promise<PaginatedResult<OperationalIncident>> {
  return requestJson<PaginatedResult<OperationalIncident>>(
    proxyUrl("api/v1/admin/observability/incidents", filters),
  );
}

export async function fetchOperationalIncidentDetail(
  id: string,
): Promise<OperationalIncidentDetailResponse> {
  return requestJson<OperationalIncidentDetailResponse>(
    proxyUrl(`api/v1/admin/observability/incidents/${encodeURIComponent(id)}`),
  );
}

export async function updateOperationalIncidentStatus(
  id: string,
  body: ObservabilityIncidentStatusBody,
): Promise<OperationalIncident> {
  return requestJson<OperationalIncident>(
    proxyUrl(`api/v1/admin/observability/incidents/${encodeURIComponent(id)}/status`),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function updateOperationalIncidentStatuses(
  body: ObservabilityIncidentBatchStatusBody,
): Promise<ObservabilityIncidentBatchStatusResponse> {
  return requestJson<ObservabilityIncidentBatchStatusResponse>(
    proxyUrl("api/v1/admin/observability/incidents/status"),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function deleteObservabilityRecord(
  collection: ObservabilityDeleteCollection,
  id: string,
): Promise<ObservabilityDeleteResponse> {
  return requestJson<ObservabilityDeleteResponse>(
    proxyUrl(`api/v1/admin/observability/${collection}/${encodeURIComponent(id)}`),
    { method: "DELETE" },
  );
}

export async function deleteObservabilityRecords(
  collection: ObservabilityDeleteCollection,
  ids: string[],
): Promise<ObservabilityDeleteResponse> {
  return requestJson<ObservabilityDeleteResponse>(
    proxyUrl(`api/v1/admin/observability/${collection}/delete`),
    {
      method: "POST",
      body: JSON.stringify({ ids }),
    },
  );
}

export async function fetchNotificationDeliveries(
  filters: SerializableFilters,
): Promise<PaginatedResult<NotificationDelivery>> {
  return requestJson<PaginatedResult<NotificationDelivery>>(
    proxyUrl("api/v1/admin/observability/notifications", filters),
  );
}

export async function fetchOperationalReports(
  filters: SerializableFilters,
): Promise<PaginatedResult<OperationalReportRun>> {
  return requestJson<PaginatedResult<OperationalReportRun>>(
    proxyUrl("api/v1/admin/observability/reports", filters),
  );
}

export async function fetchOperationalReportRun(id: string): Promise<OperationalReportRun> {
  return requestJson<OperationalReportRun>(
    proxyUrl(`api/v1/admin/observability/reports/${encodeURIComponent(id)}`),
  );
}

export async function runOperationalReport(
  body: ObservabilityReportRunBody,
): Promise<OperationalReportRun> {
  return requestJson<OperationalReportRun>(proxyUrl("api/v1/admin/observability/reports/run"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function observabilityEventsExportUrl(filters: SerializableFilters): string {
  return proxyUrl("api/v1/admin/exports/observability/events.csv", filters);
}

export function observabilityIncidentsExportUrl(filters: SerializableFilters): string {
  return proxyUrl("api/v1/admin/exports/observability/incidents.csv", filters);
}

export function observabilityReportExportUrl(reportRunId: string): string {
  return proxyUrl(
    `api/v1/admin/exports/observability/reports/${encodeURIComponent(reportRunId)}.csv`,
  );
}

// ---------------------------------------------------------------------------
// Sheet sync admin (surfaced in the Observational Sheet Sync tab)
// ---------------------------------------------------------------------------

export type SheetSyncHealth = Record<string, unknown>;

export type SheetSyncJob = Record<string, unknown> & {
  _id: string;
  status: string;
  resource?: string;
  operation?: string;
  entity_id?: string;
  attempts?: number;
  last_error?: string | null;
};

export type SheetSyncRun = Record<string, unknown> & {
  _id: string;
  status: string;
  trigger?: string;
  started_at?: string;
  finished_at?: string | null;
  claimed_job_count?: number;
  synced_job_count?: number;
  failed_job_count?: number;
  deferred_job_count?: number;
};

export async function fetchSheetSyncHealth(): Promise<SheetSyncHealth> {
  return requestJson<SheetSyncHealth>(proxyUrl("api/v1/admin/sheet-sync/health"));
}

export async function fetchSheetSyncJobs(
  filters: SerializableFilters,
): Promise<PaginatedResult<SheetSyncJob>> {
  return requestJson<PaginatedResult<SheetSyncJob>>(
    proxyUrl("api/v1/admin/sheet-sync/jobs", filters),
  );
}

export async function fetchSheetSyncRuns(
  filters: SerializableFilters,
): Promise<PaginatedResult<SheetSyncRun>> {
  return requestJson<PaginatedResult<SheetSyncRun>>(
    proxyUrl("api/v1/admin/sheet-sync/runs", filters),
  );
}

export async function fetchSheetSyncRunDetail(id: string): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    proxyUrl(`api/v1/admin/sheet-sync/runs/${encodeURIComponent(id)}`),
  );
}

export async function retrySheetSyncJobs(
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(proxyUrl("api/v1/admin/sheet-sync/retry"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}
