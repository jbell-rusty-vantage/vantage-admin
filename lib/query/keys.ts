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
  publicEmployeeBooking: {
    all: ["public-employee-booking"] as const,
    options: () => [...queryKeys.publicEmployeeBooking.all, "options"] as const,
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
  bookingReconciliation: {
    all: ["booking-reconciliation"] as const,
    list: (filters?: QueryFilters) =>
      [...queryKeys.bookingReconciliation.all, "list", stableFilters(filters)] as const,
    detail: (id: string) =>
      [...queryKeys.bookingReconciliation.all, "detail", id] as const,
    candidates: (caseId: string, filters?: QueryFilters) =>
      [...queryKeys.bookingReconciliation.all, "candidates", caseId, stableFilters(filters)] as const,
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
  reporting: {
    all: ["reporting"] as const,
    catalog: () => [...queryKeys.reporting.all, "catalog"] as const,
    definitions: (filters?: QueryFilters) =>
      [...queryKeys.reporting.all, "definitions", stableFilters(filters)] as const,
    definition: (id: string) =>
      [...queryKeys.reporting.all, "definitions", "detail", id] as const,
    runs: (filters?: QueryFilters) =>
      [...queryKeys.reporting.all, "runs", stableFilters(filters)] as const,
    run: (id: string) => [...queryKeys.reporting.all, "runs", "detail", id] as const,
    destinations: (state: "active" | "archived" = "active") =>
      [...queryKeys.reporting.all, "destinations", state] as const,
    destination: (id: string) =>
      [...queryKeys.reporting.all, "destinations", "detail", id] as const,
    googleDrive: () => [...queryKeys.reporting.all, "google-drive", "status"] as const,
  },
  granotAutomation: {
    all: ["granot-automation"] as const,
    sources: () => [...queryKeys.granotAutomation.all, "sources"] as const,
    runs: () => [...queryKeys.granotAutomation.all, "runs"] as const,
    runGroup: (id: string) =>
      [...queryKeys.granotAutomation.all, "run-groups", id] as const,
    run: (id: string) => [...queryKeys.granotAutomation.all, "runs", "detail", id] as const,
  },
  granotLifecycle: {
    all: ["granot-lifecycle"] as const,
    cases: (filters?: QueryFilters) =>
      [...queryKeys.granotLifecycle.all, "cases", stableFilters(filters)] as const,
    caseDetail: (caseId: string) =>
      [...queryKeys.granotLifecycle.all, "cases", "detail", caseId] as const,
    creatingObservation: (caseId: string) =>
      [...queryKeys.granotLifecycle.all, "cases", caseId, "creating-observation"] as const,
    candidates: (caseId: string, filters?: QueryFilters) =>
      [
        ...queryKeys.granotLifecycle.all,
        "cases",
        caseId,
        "candidates",
        stableFilters(filters),
      ] as const,
    connectCandidates: (bookingId: string, filters?: QueryFilters) =>
      [
        ...queryKeys.granotLifecycle.all,
        "bookings",
        bookingId,
        "connect-candidates",
        stableFilters(filters),
      ] as const,
    jobTimeline: (jobNo: string, filters?: QueryFilters) =>
      [
        ...queryKeys.granotLifecycle.all,
        "jobs",
        jobNo,
        "timeline",
        stableFilters(filters),
      ] as const,
    leadTimeline: (leadModel: string, leadId: string, filters?: QueryFilters) =>
      [
        ...queryKeys.granotLifecycle.all,
        "leads",
        leadModel,
        leadId,
        "timeline",
        stableFilters(filters),
      ] as const,
      discrepancies: (filters?: QueryFilters) =>
        [...queryKeys.granotLifecycle.all, "discrepancies", stableFilters(filters)] as const,
      discrepancyDetail: (discrepancyId: string) =>
        [...queryKeys.granotLifecycle.all, "discrepancies", "detail", discrepancyId] as const,
    health: () => [...queryKeys.granotLifecycle.all, "health"] as const,
  },
  jobNumberTimeline: {
    all: ["job-number-timeline"] as const,
    page: (jobNo: string, filters?: QueryFilters) =>
      [...queryKeys.jobNumberTimeline.all, "page", jobNo, stableFilters(filters)] as const,
    recentOfficialBookings: () =>
      [...queryKeys.jobNumberTimeline.all, "recent-official-bookings"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    list: () => [...queryKeys.conversations.all, "list"] as const,
    detail: (id: string) => [...queryKeys.conversations.all, "detail", id] as const,
  },
  operationsRegistry: {
    all: ["operations-registry"] as const,
    overview: () => [...queryKeys.operationsRegistry.all, "overview"] as const,
    health: () => [...queryKeys.operationsRegistry.all, "health"] as const,
    changes: (filters?: QueryFilters) =>
      [...queryKeys.operationsRegistry.all, "changes", stableFilters(filters)] as const,
    agents: (includeInactive = false) =>
      [...queryKeys.operationsRegistry.all, "agents", includeInactive ? "all" : "active"] as const,
    agentDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "agents", "detail", id] as const,
    merchants: (includeInactive = false) =>
      [...queryKeys.operationsRegistry.all, "merchants", includeInactive ? "all" : "active"] as const,
    merchantDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "merchants", "detail", id] as const,
    dependencies: (kind: string, id: string) =>
      [...queryKeys.operationsRegistry.all, "dependencies", kind, id] as const,
    sourceCompanies: (includeInactive = false) =>
      [
        ...queryKeys.operationsRegistry.all,
        "source-companies",
        includeInactive ? "all" : "active",
      ] as const,
    sourceCompanyDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "source-companies", "detail", id] as const,
    sourceGranularities: (filters?: QueryFilters) =>
      [...queryKeys.operationsRegistry.all, "source-granularities", stableFilters(filters)] as const,
    sourceGranularityDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "source-granularities", "detail", id] as const,
    cplSnapshot: () => [...queryKeys.operationsRegistry.all, "cpl", "snapshot"] as const,
    cplPeriods: (granularityId: string) =>
      [...queryKeys.operationsRegistry.all, "cpl", "periods", granularityId] as const,
    cplCorrection: (id: string) =>
      [...queryKeys.operationsRegistry.all, "cpl", "correction", id] as const,
    ringCentralRoutes: (filters?: QueryFilters) =>
      [
        ...queryKeys.operationsRegistry.all,
        "ringcentral",
        "routes",
        stableFilters(filters),
      ] as const,
    ringCentralRouteDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "ringcentral", "routes", "detail", id] as const,
    ringCentralRouteDependencies: (id: string) =>
      [
        ...queryKeys.operationsRegistry.all,
        "ringcentral",
        "routes",
        "dependencies",
        id,
      ] as const,
    granotCrmSources: () =>
      [...queryKeys.operationsRegistry.all, "granot-crm-sources"] as const,
    granotCrmSourceDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "granot-crm-sources", "detail", id] as const,
    leadSources: () => [...queryKeys.operationsRegistry.all, "lead-sources"] as const,
    leadSourceDetail: (id: string) =>
      [...queryKeys.operationsRegistry.all, "lead-sources", "detail", id] as const,
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
