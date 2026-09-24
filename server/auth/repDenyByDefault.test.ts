import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { setTestEnv } from "@/tests/setup-env";
import { canAccessDashboardPath, canProxyVantagePath } from "./authorization";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { applyRoleRouteGuard, DASHBOARD_PATH_PREFIXES } from "./routeGuard";
import { signAccessToken } from "./tokens";
import { salesIntelligenceLive } from "../sales-intelligence-live";

/** S8-USERS: a rep can sign in but is denied every dashboard path and API until S8-REP. */

const DASHBOARD_PATHS = [
  ...DASHBOARD_PATH_PREFIXES,
  "/sales-intelligence/outreach/65f0000000000000000000aa",
  "/operations-registry?tab=agents",
  "/granot-lifecycle/health",
  "/settings",
  "/form-leads/abc",
  "/daily",
  "/granot-lifecycle",
  "/granot-lifecycle/receipts",
  "/live-events",
  "/job-timeline?job=1",
];

const API_PATHS = [
  "api/v1/admin/sales-intelligence/attention?scope=production",
  "api/v1/admin/sales-intelligence/outreach/65f0000000000000000000aa",
  "api/v1/admin/catalog/agents",
  "api/v1/admin/form-leads",
  "api/v1/form-leads/abc",
  "api/v1/booked-leads/from-source",
  "api/v1/admin/granot-lifecycle/operations/health",
  "api/v1/admin/observability/events",
  "api/v1/admin/reporting/definitions",
  "api/v1/admin/operations-registry/overview",
  "api/v1/admin/sheet-sync/retry",
  "api/v1/admin/search?q=x",
] as const;

test("canAccessDashboardPath denies a rep every dashboard path", () => {
  for (const path of DASHBOARD_PATHS) {
    assert.equal(canAccessDashboardPath("rep", path), false, path);
  }
  // Owner and Admin keep today's answers.
  assert.equal(canAccessDashboardPath("owner", "/sales-intelligence"), true);
  assert.equal(canAccessDashboardPath("admin", "/form-leads"), true);
  assert.equal(canAccessDashboardPath("admin", "/granot-lifecycle/health"), true);
  assert.equal(canAccessDashboardPath("admin", "/sales-intelligence"), false);
});

test("canProxyVantagePath denies a rep every API, including the ones Admin may call", () => {
  for (const path of API_PATHS) {
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
      assert.equal(canProxyVantagePath({ role: "rep", method, path }), false, `${method} ${path}`);
    }
  }
  // Paths an Admin may use stay open to Admin (the rep denial is not "not owner").
  assert.equal(canProxyVantagePath({ role: "admin", method: "GET", path: "api/v1/admin/form-leads" }), true);
  assert.equal(canProxyVantagePath({ role: "admin", method: "POST", path: "api/v1/admin/sheet-sync/retry" }), true);
});

test("an unknown role string is denied everywhere (no role inherits Admin allowances)", () => {
  const unknownRole = "superuser" as unknown as "rep";
  assert.equal(canAccessDashboardPath(unknownRole, "/form-leads"), false);
  assert.equal(canProxyVantagePath({ role: unknownRole, method: "GET", path: "api/v1/admin/form-leads" }), false);
});

function requestWithRole(pathname: string, role: "owner" | "admin" | "rep" | null) {
  const headers: Record<string, string> = {};
  if (role) {
    const token = signAccessToken({ sub: "65f0000000000000000000a1", email: `${role}@example.invalid`, role, token_version: 0 });
    headers.cookie = `${ACCESS_TOKEN_COOKIE}=${token}`;
  }
  return new NextRequest(`http://localhost:3000${pathname}`, { headers });
}

test("the request-boundary role guard returns 403 for a rep on every dashboard page", () => {
  setTestEnv();
  for (const path of DASHBOARD_PATHS) {
    const response = applyRoleRouteGuard(requestWithRole(path, "rep"));
    assert.equal(response?.status, 403, path);
  }
  for (const role of ["owner", "admin"] as const) {
    assert.equal(applyRoleRouteGuard(requestWithRole("/form-leads", role)), null, role);
  }
  // Login, the API and public pages are not dashboard paths; a stale/garbage token falls through.
  assert.equal(applyRoleRouteGuard(requestWithRole("/login", "rep")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/api/auth/me", "rep")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/employee-booking", "rep")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/accept-invite", "rep")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/privacy-policy", "rep")), null);
  const garbage = new NextRequest("http://localhost:3000/form-leads", { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=garbage` } });
  assert.equal(applyRoleRouteGuard(garbage), null);
});

test("the Sales Intelligence live BFF refuses a rep", async () => {
  setTestEnv();
  const response = await salesIntelligenceLive(new Request("http://localhost/api/sales-intelligence-live?scope=production"), {
    admin: { id: "65f0000000000000000000a1", email: "rep@example.invalid", role: "rep" },
    url: "http://upstream.invalid/live",
    apiSecret: "x",
    fetch: async () => {
      throw new Error("must not be called");
    },
  });
  assert.equal(response.status, 403);
});
