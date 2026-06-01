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

export type UiResource = "form-leads" | "call-leads" | "bookings" | "cancellations" | "customers" | "agents";

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
  | "geographic-lanes";

export type AnalyticsResponse = {
  report: AnalyticsReport;
  database_scope: DatabaseScope;
  generated_at: string;
  data: Record<string, unknown>;
};

export const uiToAdminResource: Record<UiResource, AdminResource> = {
  "form-leads": "form-leads",
  "call-leads": "call-leads",
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
  "call-leads": "Call Leads",
  bookings: "Bookings",
  cancellations: "Cancellations",
  customers: "Customers",
  agents: "Agents",
};

function proxyUrl(path: string, filters?: SerializableFilters): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}${filters ? filtersToQueryString(filters) : ""}`;
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
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? response.statusText : payload.error);
  }

  return payload.data;
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
): Promise<TRecord> {
  const detailScope = scope === "combined" ? "production" : scope;
  return requestJson<TRecord>(
    proxyUrl(`api/v1/admin/${resource}/${encodeURIComponent(id)}`, {
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

export async function createBookingFromSource(body: Record<string, unknown>) {
  return requestJson<unknown>(proxyUrl("api/v1/booked-leads/from-source"), {
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

export async function fetchGlobalSearch(filters: SerializableFilters): Promise<GlobalSearchResponse> {
  return requestJson<GlobalSearchResponse>(proxyUrl("api/v1/admin/search", filters));
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
