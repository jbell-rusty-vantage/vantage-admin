import type { AdminRole } from "@/server/models";
import type { VantageApiMethod } from "@/server/vantage-api/client";
import {
  MANAGER_DAILY_OPERATIONS_ROUTES,
  MANAGER_OUTREACH_ROUTES,
  OUTREACH_DESK_LIVE_API_PATH,
  REP_OUTREACH_ROUTES,
  isOutreachDeskApiPath,
  matchesDeskRoute,
} from "./outreach-desk-routes";

const OWNER_ONLY_PAGE_PREFIXES = [
  "/automations",
  "/systems",
  "/bookings/reconciliation",
  "/granot-lifecycle",
  "/ingestion/granot",
  "/intakes",
  "/job-timeline",
  "/daily",
  "/sales-intelligence",
  "/outreach-desk",
  "/manual",
  "/extension",
] as const;

const OPERATIONAL_PATCH_PREFIXES = [
  "/api/v1/form-leads/",
  "/api/v1/call-leads/",
  "/api/v1/booked-leads/",
  "/api/v1/cancelled-leads/",
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

/** Sales Outreach Desk (IMPL-02/03): a rep opens only its desk; every other page stays denied. */
const REP_DASHBOARD_PATHS: readonly RegExp[] = [/^\/outreach-desk$/];

/**
 * A Manager (P09b) opens only the desk and Daily Operations, which now lives on Today → Operations (`/?tab=operations`;
 * `/daily` redirects there). Every other page stays denied.
 */
const MANAGER_DASHBOARD_PATHS: readonly RegExp[] = [/^\/outreach-desk$/, /^\/daily$/, /^\/$/];

export function canAccessDashboardPath(role: AdminRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }
  // A rep reaches only its desk and a manager only the desk and Daily Operations. Anything that is not exactly
  // "admin", "manager" or "rep" is denied, so a new role never inherits the Admin allowances below.
  if (role === "rep") {
    return REP_DASHBOARD_PATHS.some(pattern => pattern.test(pathname));
  }
  if (role === "manager") {
    return MANAGER_DASHBOARD_PATHS.some(pattern => pattern.test(pathname));
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
  /** `live` only from the desk's SSE route handler; the generic proxy never forwards the desk stream. */
  via?: "proxy" | "live";
}): boolean {
  const path = normalizeProxyPath(input.path);
  // Desk live hints are an SSE stream: they go through `app/api/outreach-desk-live`, never the buffered proxy.
  if (input.via !== "live" && path === OUTREACH_DESK_LIVE_API_PATH) {
    return false;
  }
  if (input.role === "owner") {
    return true;
  }
  // A rep reaches exactly its desk calls (ADM-7, the server's Rep allowlist); the server still scopes each one to
  // its own assignment and Agent. The interim Sales Intelligence reads stay Owner-only.
  if (input.role === "rep") {
    return matchesDeskRoute(REP_OUTREACH_ROUTES, input.method, path);
  }
  // A manager reaches the Manager desk calls and the Daily Operations reads (P09b), nothing else.
  if (input.role === "manager") {
    return (
      matchesDeskRoute(MANAGER_OUTREACH_ROUTES, input.method, path) ||
      matchesDeskRoute(MANAGER_DAILY_OPERATIONS_ROUTES, input.method, path)
    );
  }
  // Any role that is not exactly "admin" reaches no API.
  if (input.role !== "admin") {
    return false;
  }

  // P09c: a generic Admin gets no desk.
  if (isOutreachDeskApiPath(path)) return false;
  if (path === "/api/v1/admin/sales-intelligence" || path.startsWith("/api/v1/admin/sales-intelligence/")) return false;
  if (
    path === "/api/v1/admin/job-number-timeline" ||
    path.startsWith("/api/v1/admin/job-number-timeline/")
  ) {
    return false;
  }
  if (
    path === "/api/v1/admin/daily-operations" ||
    path.startsWith("/api/v1/admin/daily-operations/")
  ) {
    return false;
  }
  // Systems (doc 11b) is the Owner's; the server refuses any other actor too.
  if (path === "/api/v1/admin/systems" || path.startsWith("/api/v1/admin/systems/")) return false;
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

  // SLIM-02: the Sheet Sync retry allowance went with the Observational tab, its only caller.
  // The server route stays; Owner can still reach it through the proxy.
  if (input.method === "POST") {
    return OPERATIONAL_POST_PATHS.has(path);
  }

  return false;
}

/**
 * The pathname the main server will actually be asked for: the query is dropped and dot segments
 * (including percent-encoded ones such as `%2e%2e`) are resolved the way `buildVantageApiUrl`'s
 * WHATWG URL resolution resolves them, so the allowlists judge the resolved path (V-T3 m14).
 */
function normalizeProxyPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  const rooted = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  try {
    return new URL(rooted, "http://proxy.invalid").pathname;
  } catch {
    return rooted;
  }
}
