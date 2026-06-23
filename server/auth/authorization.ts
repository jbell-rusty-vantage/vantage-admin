import type { AdminRole } from "@/server/models";
import type { VantageApiMethod } from "@/server/vantage-api/client";

const OWNER_ONLY_PAGE_PREFIXES = ["/audit-log", "/settings"] as const;

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

export function canAccessDashboardPath(role: AdminRole, pathname: string): boolean {
  if (role === "owner") {
    return true;
  }
  return !OWNER_ONLY_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
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
  if (input.method === "DELETE") {
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

  if (
    (input.method === "POST" || input.method === "PATCH") &&
    (path.startsWith("/api/v1/admin/agents") || path.startsWith("/api/v1/admin/merchants"))
  ) {
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
