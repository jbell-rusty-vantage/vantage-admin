import type { AdminRole } from "@/server/models";
import type { VantageApiMethod } from "@/server/vantage-api/client";

const OWNER_ONLY_PAGE_PREFIXES = [
  "/audit-log",
  "/settings",
  "/bookings/reconciliation",
  "/ingestion/granot",
  "/intakes",
  "/job-timeline",
  "/conversations",
  "/live-events",
] as const;

const OPERATIONAL_PATCH_PREFIXES = [
  "/api/v1/form-leads/",
  "/api/v1/call-leads/",
  "/api/v1/booked-leads/",
  "/api/v1/cancelled-leads/",
  "/api/v1/customers/",
] as const;

const OPERATIONAL_POST_PATHS = new Set([
  "/api/v1/booked-leads/from-source",
  "/api/v1/referral-bookings",
  "/api/v1/leadless-bookings",
  "/api/v1/cancelled-leads",
]);

/** Registry mutation surfaces are Owner-only; other roles may GET (and read-preview POST). */
const REGISTRY_OWNER_MUTATION_PREFIXES = [
  "/api/v1/admin/operations-registry",
  "/api/v1/admin/agents",
  "/api/v1/admin/merchants",
  "/api/v1/admin/catalog/agents",
  "/api/v1/admin/catalog/merchants",
  "/api/v1/admin/source-companies",
  "/api/v1/admin/source-granularities",
  "/api/v1/admin/cpl",
  "/api/v1/admin/cpl-rates",
  "/api/v1/admin/cpl-corrections",
  "/api/v1/admin/ringcentral",
  "/api/v1/admin/ingestion",
  "/api/v1/admin/granot-automation",
  "/api/v1/admin/granot-crm-sources",
] as const;

/** Read-style POSTs that admins may call. CPL correction preview is Owner-only. */
const REGISTRY_READ_PREVIEW_POST_PATHS = new Set([
  "/api/v1/admin/source-resolution/preview",
  "/api/v1/admin/ingestion/connections/best-relocation/inspect",
]);

const REPORTING_PREFIX = "/api/v1/admin/reporting";
const GOOGLE_DRIVE_PREFIX = "/api/v1/admin/google-drive";
const GRANOT_AUTOMATION_PREFIX = "/api/v1/admin/granot-automation";
const GRANOT_LIFECYCLE_PREFIX = "/api/v1/admin/granot-lifecycle";

export function canAccessDashboardPath(role: AdminRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }
  if (
    pathname === "/ingestion/granot/lifecycle/health"
    || pathname.startsWith("/ingestion/granot/lifecycle/health/")
  ) {
    return true;
  }
  // Operations Registry is readable by authenticated admin roles.
  if (pathname === "/operations-registry" || pathname.startsWith("/operations-registry/")) {
    return true;
  }
  return !OWNER_ONLY_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isRegistryOwnerMutationPath(method: VantageApiMethod, path: string): boolean {
  if (method === "GET" || method === "DELETE") {
    return false;
  }
  const normalized = normalizeProxyPath(path);
  if (REGISTRY_READ_PREVIEW_POST_PATHS.has(normalized)) {
    return false;
  }
  return REGISTRY_OWNER_MUTATION_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function canProxyVantagePath(input: {
  role: AdminRole;
  method: VantageApiMethod;
  path: string;
}): boolean {
  if (input.role === "owner") {
    return true;
  }

  const path = normalizeProxyPath(input.path);
  if (
    path === "/api/v1/admin/job-number-timeline" ||
    path.startsWith("/api/v1/admin/job-number-timeline/")
  ) {
    return false;
  }
  if (
    path === "/api/v1/admin/conversations" ||
    path.startsWith("/api/v1/admin/conversations/")
  ) {
    return false;
  }
  if (path.startsWith("/api/v1/admin/booking-lead-reconciliations")) {
    return false;
  }
  if (
    path === GRANOT_AUTOMATION_PREFIX ||
    path.startsWith(`${GRANOT_AUTOMATION_PREFIX}/`)
  ) {
    return false;
  }
  if (
    path === GRANOT_LIFECYCLE_PREFIX ||
    path.startsWith(`${GRANOT_LIFECYCLE_PREFIX}/`)
  ) {
    // Standard lifecycle reads are available to signed Owner/Admin actors.
    // Candidate browsing and creating-observation statements are Owner-only.
    if (/\/cases\/[^/]+\/(candidates|creating-observation)$/.test(path)) {
      return false;
    }
    if (/\/receipts\/live$/.test(path)) {
      return false;
    }
    return input.method === "GET";
  }
  if (input.method === "DELETE") {
    return false;
  }

  // Reporting metadata is readable by admins; every preview/revision/run mutation is Owner-only.
  if (path === REPORTING_PREFIX || path.startsWith(`${REPORTING_PREFIX}/`)) {
    return input.method === "GET";
  }

  // Google Drive OAuth/Picker routes are owner-only on the server; block admin at the proxy too.
  if (path === GOOGLE_DRIVE_PREFIX || path.startsWith(`${GOOGLE_DRIVE_PREFIX}/`)) {
    return false;
  }

  // Registry Owner-only rules override legacy admin write allowances for agents/merchants.
  if (isRegistryOwnerMutationPath(input.method, path)) {
    return false;
  }

  if (path.startsWith("/api/v1/admin/observability/")) {
    if (path.endsWith("/delete")) {
      return false;
    }
    if (input.method === "PATCH" && path.includes("/incidents/") && path.endsWith("/status")) {
      return true;
    }
    if (input.method === "PATCH" && path === "/api/v1/admin/observability/incidents/status") {
      return true;
    }
    if (input.method === "POST" && path === "/api/v1/admin/observability/reports/run") {
      return true;
    }
    return input.method === "GET";
  }

  if (input.method === "GET") {
    return true;
  }

  // Read-preview POSTs for registry remain available to admin.
  if (input.method === "POST" && REGISTRY_READ_PREVIEW_POST_PATHS.has(path)) {
    return true;
  }

  if (input.method === "PATCH") {
    return OPERATIONAL_PATCH_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  if (input.method === "POST") {
    return (
      OPERATIONAL_POST_PATHS.has(path) ||
      path === "/api/v1/admin/sheet-sync/retry"
    );
  }

  return false;
}

function normalizeProxyPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}
