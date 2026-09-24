import type { AdminRole } from "@/server/models";
import type { VantageApiMethod } from "@/server/vantage-api/client";

const OWNER_ONLY_PAGE_PREFIXES = [
  "/audit-log",
  "/bookings/reconciliation",
  "/granot-lifecycle",
  "/ingestion/granot",
  "/intakes",
  "/job-timeline",
  "/conversations",
  "/daily",
  "/sales-intelligence",
  "/live-events",
  "/manual",
  "/extension",
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
  "/api/v1/admin/moving-carriers",
  "/api/v1/admin/cpl",
  "/api/v1/admin/cpl-rates",
  "/api/v1/admin/cpl-corrections",
  "/api/v1/admin/ringcentral",
  "/api/v1/admin/ingestion",
  "/api/v1/admin/granot-automation",
  "/api/v1/admin/granot-crm-sources",
  "/api/v1/admin/source-label-mappings",
] as const;

/** Read-style POSTs that admins may call. CPL correction preview is Owner-only. */
const REGISTRY_READ_PREVIEW_POST_PATHS = new Set([
  "/api/v1/admin/source-resolution/preview",
  "/api/v1/admin/source-label-resolution/preview",
  "/api/v1/admin/operations-registry/lead-source-setups/preview",
  "/api/v1/admin/ingestion/connections/best-relocation/inspect",
]);

const REPORTING_PREFIX = "/api/v1/admin/reporting";
const GOOGLE_DRIVE_PREFIX = "/api/v1/admin/google-drive";
const GRANOT_AUTOMATION_PREFIX = "/api/v1/admin/granot-automation";
const GRANOT_LIFECYCLE_PREFIX = "/api/v1/admin/granot-lifecycle";

/**
 * S8-REP (addendum §4.1): the only dashboard pages a rep may open. `/sales-intelligence` (its
 * Overview, Needs Attention, All Outreach and Closed tabs are query state on the same page) and
 * one Outreach record's page. Numbers, Messages / rep threads, Operations, Daily Operations, the
 * Registry and settings stay denied. The main server still decides which records the rep sees.
 */
const REP_DASHBOARD_PATHS: readonly RegExp[] = [
  /^\/sales-intelligence$/,
  /^\/sales-intelligence\/outreach\/[a-f\d]{24}$/i,
];

const CSI_API = "/api/v1/admin/sales-intelligence";
const OBJECT_ID = "[a-f\\d]{24}";
/**
 * S8-REP: every main-server call the rep UI makes, method by method. Everything else is denied
 * here and again on the server (which also forces the rep's scope and returns 404 outside it).
 * The live stream goes through `/api/sales-intelligence-live`, not this proxy.
 */
const REP_PROXY_ROUTES: ReadonlyArray<{ method: VantageApiMethod; pattern: RegExp }> = [
  { method: "GET", pattern: new RegExp(`^${CSI_API}/attention$`) },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/overview$`) },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/outreach/closed-history$`) },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/outreach/${OBJECT_ID}$`, "i") },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/outreach/${OBJECT_ID}/(?:timeline|assessment|findings)$`, "i") },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/numbers/${OBJECT_ID}/conversations$`, "i") },
  { method: "GET", pattern: new RegExp(`^${CSI_API}/conversations/${OBJECT_ID}/(?:transcript|media)$`, "i") },
  // E9: complete, snooze and re-date (`PATCH /followups/:id` with only `due_at`) their own follow-ups.
  { method: "POST", pattern: new RegExp(`^${CSI_API}/followups/${OBJECT_ID}/(?:complete|snooze)$`, "i") },
  { method: "PATCH", pattern: new RegExp(`^${CSI_API}/followups/${OBJECT_ID}$`, "i") },
];

export function canRepProxyVantagePath(method: VantageApiMethod, path: string): boolean {
  const normalized = normalizeProxyPath(path);
  return REP_PROXY_ROUTES.some(route => route.method === method && route.pattern.test(normalized));
}

export function canAccessDashboardPath(role: AdminRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }
  // S8-REP: a rep reaches only its Sales Intelligence pages. Anything that is
  // not exactly "admin" or "rep" is denied, so a new role never inherits the
  // Admin allowances below.
  if (role === "rep") {
    return REP_DASHBOARD_PATHS.some(pattern => pattern.test(pathname));
  }
  if (role !== "admin") {
    return false;
  }
  if (
    pathname === "/granot-lifecycle/health"
    || pathname.startsWith("/granot-lifecycle/health/")
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
  // S8-REP: a rep reaches only the Sales Intelligence calls its UI makes.
  if (input.role === "rep") {
    return canRepProxyVantagePath(input.method, input.path);
  }
  // Any role that is not exactly "admin" reaches no API.
  if (input.role !== "admin") {
    return false;
  }

  const path = normalizeProxyPath(input.path);
  if (path === "/api/v1/admin/sales-intelligence" || path.startsWith("/api/v1/admin/sales-intelligence/")) return false;
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
  if (
    path === "/api/v1/admin/daily-operations" ||
    path.startsWith("/api/v1/admin/daily-operations/")
  ) {
    return false;
  }
  if (
    path === "/api/v1/admin/extension-users" ||
    path.startsWith("/api/v1/admin/extension-users/")
  ) {
    return false;
  }
  if (path.startsWith("/api/v1/admin/booking-lead-reconciliations")) {
    return false;
  }
  if (/^\/api\/v1\/admin\/bookings\/[^/]+\/connect-lead(?:-candidates)?$/.test(path)) {
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
    if (path === `${GRANOT_LIFECYCLE_PREFIX}/receipts`) {
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
