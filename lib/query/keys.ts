import type { DatabaseScope } from "@/lib/api/types";

type QueryFilters = Record<string, unknown>;

function stableFilters(filters?: QueryFilters) {
  if (!filters) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    overview: (filters?: QueryFilters) =>
      [...queryKeys.dashboard.all, "overview", stableFilters(filters)] as const,
  },
  lists: {
    all: ["lists"] as const,
    resource: (resource: string, filters?: QueryFilters) =>
      [...queryKeys.lists.all, resource, stableFilters(filters)] as const,
  },
  details: {
    all: ["details"] as const,
    resource: (resource: string, id: string, scope: DatabaseScope = "production", filters?: QueryFilters) =>
      [...queryKeys.details.all, resource, id, scope, stableFilters(filters)] as const,
  },
  search: {
    all: ["search"] as const,
    global: (query: string, scope: DatabaseScope = "production") =>
      [...queryKeys.search.all, "global", query, scope] as const,
  },
  exports: {
    all: ["exports"] as const,
    resource: (resource: string, filters?: QueryFilters) =>
      [...queryKeys.exports.all, resource, stableFilters(filters)] as const,
  },
  auditLog: {
    all: ["audit-log"] as const,
    list: (filters?: QueryFilters) =>
      [...queryKeys.auditLog.all, "list", stableFilters(filters)] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    booking: (leadType?: string, leadId?: string) =>
      [...queryKeys.workflows.all, "booking", leadType, leadId] as const,
    cancellation: (recordId?: string) =>
      [...queryKeys.workflows.all, "cancellation", recordId] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    report: (report: string, filters?: QueryFilters) =>
      [...queryKeys.analytics.all, report, stableFilters(filters)] as const,
  },
  facets: {
    all: ["facets"] as const,
    scope: (scope: DatabaseScope) => [...queryKeys.facets.all, scope] as const,
  },
  catalog: {
    all: ["catalog"] as const,
    kind: (kind: string, includeInactive = false) =>
      [...queryKeys.catalog.all, kind, includeInactive ? "all" : "active"] as const,
  },
  cplRates: {
    all: ["cpl-rates"] as const,
  },
  sourceCompanies: {
    all: ["source-companies"] as const,
    list: (includeInactive = false) =>
      [...queryKeys.sourceCompanies.all, includeInactive ? "all" : "active"] as const,
  },
  carriers: {
    all: ["moving-carriers"] as const,
    list: (includeInactive = false) =>
      [...queryKeys.carriers.all, includeInactive ? "all" : "active"] as const,
  },
  testimonials: {
    all: ["testimonials"] as const,
    list: (filters?: QueryFilters) =>
      [...queryKeys.testimonials.all, "list", stableFilters(filters)] as const,
    reviewerNames: () => [...queryKeys.testimonials.all, "reviewer-names"] as const,
    customer: (customerId: string) => [...queryKeys.testimonials.all, "customer", customerId] as const,
  },
  reports: {
    all: ["reports"] as const,
    agentSales: (filters?: QueryFilters) =>
      [...queryKeys.reports.all, "agent-sales", stableFilters(filters)] as const,
  },
  observability: {
    all: ["observability"] as const,
    overview: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "overview", stableFilters(filters)] as const,
    facets: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "facets", stableFilters(filters)] as const,
    events: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "events", stableFilters(filters)] as const,
    eventDetail: (id: string) =>
      [...queryKeys.observability.all, "events", "detail", id] as const,
    incidents: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "incidents", stableFilters(filters)] as const,
    incidentDetail: (id: string) =>
      [...queryKeys.observability.all, "incidents", "detail", id] as const,
    notifications: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "notifications", stableFilters(filters)] as const,
    reports: (filters?: QueryFilters) =>
      [...queryKeys.observability.all, "reports", stableFilters(filters)] as const,
    reportRun: (id: string) =>
      [...queryKeys.observability.all, "reports", "run", id] as const,
    sheetSync: {
      all: ["observability", "sheet-sync"] as const,
      health: () => [...queryKeys.observability.sheetSync.all, "health"] as const,
      jobs: (filters?: QueryFilters) =>
        [...queryKeys.observability.sheetSync.all, "jobs", stableFilters(filters)] as const,
      runs: (filters?: QueryFilters) =>
        [...queryKeys.observability.sheetSync.all, "runs", stableFilters(filters)] as const,
      runDetail: (id: string) =>
        [...queryKeys.observability.sheetSync.all, "runs", "detail", id] as const,
    },
  },
};
