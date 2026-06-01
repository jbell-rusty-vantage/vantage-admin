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
    resource: (resource: string, id: string, scope: DatabaseScope = "production") =>
      [...queryKeys.details.all, resource, id, scope] as const,
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
};
