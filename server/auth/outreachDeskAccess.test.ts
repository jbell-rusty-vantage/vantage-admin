import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { resetServerEnvForTests } from "@/lib/env/server";
import { setTestEnv } from "@/tests/setup-env";
import { canAccessDashboardPath, canProxyVantagePath } from "./authorization";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { currentCsiScope, proxyForwardHeaders } from "./proxyForwardHeaders";
import { ADMIN_PROXY_AGENT_HEADER, ADMIN_PROXY_HEADER_NAMES, buildCanonicalAdminActorPayload } from "./proxySigning";
import { applyRoleRouteGuard } from "./routeGuard";
import { signAccessToken } from "./tokens";
import { outreachDeskLive } from "../outreach-desk-live";
import type { VantageApiMethod } from "@/server/vantage-api/client";

/**
 * Sales Outreach Desk access (ADM-1, ADM-7; server S1 "Admin DTO handoff"): the exact method + path allowlists per
 * role, Manager pages, the edge guard, the signed Manager actor and the desk live BFF.
 */

const ID = "65f0000000000000000000cd";
const AGENT = "65f0000000000000000000ab";
const SECRET = "desk-signing-secret-for-tests-32chars!";
const API = "api/v1/admin/sales-outreach";
const METHODS: VantageApiMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];

const REP_ALLOWED: [VantageApiMethod, string][] = [
  ["GET", `${API}/capabilities`],
  ["GET", `${API}/capabilities?scope=production`],
  ["GET", `${API}/rep-days?business_day=2026-10-05`],
  ["GET", `${API}/queue?state=needs_contact&sort=urgency`],
  ["GET", `${API}/outreach/${ID}`],
  ["PATCH", `${API}/outreach/${ID}/quoted-followup`],
  ["PATCH", `${API}/outreach/${ID}/callback`],
];
const MANAGER_ONLY: [VantageApiMethod, string][] = [
  ["GET", `${API}/team?business_day=2026-10-05`],
  ["PATCH", `${API}/outreach/${ID}/assignment`],
  ["PATCH", `${API}/goals/${AGENT}/day-override`],
];
const MANAGER_DAILY: [VantageApiMethod, string][] = [
  ["GET", "api/v1/admin/daily-operations"],
  ["GET", "api/v1/admin/daily-operations?date=2026-10-05"],
  ["GET", "api/v1/admin/daily-operations/events?lane=leads"],
  ["GET", "api/v1/admin/daily-operations/live"],
];
const OWNER_ONLY: [VantageApiMethod, string][] = [
  ["GET", `${API}/configuration`],
  ["PATCH", `${API}/configuration`],
  ["GET", `${API}/restrictions`],
  ["POST", `${API}/restrictions`],
  ["POST", `${API}/restrictions/${ID}/confirm`],
  ["POST", `${API}/restrictions/${ID}/lift`],
  ["GET", `${API}/enrollment/candidates`],
  ["POST", `${API}/enrollment/report`],
  ["POST", `${API}/enrollment/apply`],
  ["POST", `${API}/enrollment/verify`],
  ["POST", "api/v1/admin/daily-operations/rebuild"],
];
/** Shapes that must never pass for a Rep or a Manager: wrong method, malformed id, traversal, trailing segments. */
const NEVER: [VantageApiMethod, string][] = [
  ["POST", `${API}/capabilities`],
  ["DELETE", `${API}/outreach/${ID}`],
  ["PUT", `${API}/outreach/${ID}/callback`],
  ["GET", `${API}/outreach/not-an-id`],
  ["GET", `${API}/outreach/${ID.toUpperCase()}x`],
  ["GET", `${API}/outreach/${ID}/extra`],
  ["GET", `${API}/queue/../configuration`],
  ["GET", `${API}/queue/%2e%2e/configuration`],
  ["GET", `${API}`],
  ["GET", "api/v1/admin/sales-intelligence/numbers"],
  ["GET", "api/v1/admin/form-leads"],
];

const allows = (role: "owner" | "admin" | "manager" | "rep", method: VantageApiMethod, path: string) =>
  canProxyVantagePath({ role, method, path });

test("a Rep reaches exactly its desk calls", () => {
  for (const [method, path] of REP_ALLOWED) assert.equal(allows("rep", method, path), true, `${method} ${path}`);
  for (const [method, path] of [...MANAGER_ONLY, ...MANAGER_DAILY, ...OWNER_ONLY, ...NEVER]) {
    assert.equal(allows("rep", method, path), false, `${method} ${path}`);
  }
});

test("a Manager reaches the Rep set, team, assignment, day override and Daily Operations reads — nothing Owner-only", () => {
  for (const [method, path] of [...REP_ALLOWED, ...MANAGER_ONLY, ...MANAGER_DAILY]) {
    assert.equal(allows("manager", method, path), true, `${method} ${path}`);
  }
  for (const [method, path] of [...OWNER_ONLY, ...NEVER]) assert.equal(allows("manager", method, path), false, `${method} ${path}`);
  // Nothing else in Admin.
  for (const path of ["api/v1/admin/catalog/agents", "api/v1/admin/search?q=x", "api/v1/admin/operations-registry/overview", "api/v1/admin/analytics/summary"]) {
    for (const method of METHODS) assert.equal(allows("manager", method, path), false, `${method} ${path}`);
  }
});

test("the Owner reaches every desk call; a generic Admin reaches none (P09c)", () => {
  for (const [method, path] of [...REP_ALLOWED, ...MANAGER_ONLY, ...OWNER_ONLY]) {
    assert.equal(allows("owner", method, path), true, `${method} ${path}`);
    assert.equal(allows("admin", method, path), false, `${method} ${path}`);
  }
  for (const method of METHODS) assert.equal(allows("admin", method, `${API}/capabilities`), false, method);
});

test("the desk live stream never goes through the buffered proxy, for any role", () => {
  for (const role of ["owner", "manager", "rep", "admin"] as const) {
    assert.equal(allows(role, "GET", `${API}/live?scope=production&version=1`), false, role);
  }
  assert.equal(canProxyVantagePath({ role: "rep", method: "GET", path: `${API}/live?scope=production`, via: "live" }), true);
  assert.equal(canProxyVantagePath({ role: "manager", method: "GET", path: `${API}/live`, via: "live" }), true);
  assert.equal(canProxyVantagePath({ role: "owner", method: "GET", path: `${API}/live`, via: "live" }), true);
  assert.equal(canProxyVantagePath({ role: "admin", method: "GET", path: `${API}/live`, via: "live" }), false);
});

test("desk calls are production-only and forward the browser's Idempotency-Key on writes", () => {
  assert.equal(currentCsiScope(`${API}/queue?scope=production`), true);
  assert.equal(currentCsiScope(`${API}/queue?scope=test`), false);
  assert.equal(currentCsiScope(`${API}/outreach/${ID}/callback`, { scope: "test" }), false);
  setTestEnv();
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = SECRET;
  resetServerEnvForTests();
  try {
    const incoming = new Headers({ "idempotency-key": "desk-key-1", "content-type": "application/json" });
    const write = proxyForwardHeaders(incoming, { id: "m1", email: "m@x.test", role: "manager" }, "PATCH", `${API}/outreach/${ID}/assignment`).headers;
    assert.equal(write.get("idempotency-key"), "desk-key-1");
    const read = proxyForwardHeaders(incoming, { id: "m1", email: "m@x.test", role: "manager" }, "GET", `${API}/queue`).headers;
    assert.equal(read.get("idempotency-key"), null);
  } finally {
    delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
    resetServerEnvForTests();
  }
});

test("a Manager is signed with the seven-line payload and no Agent header", () => {
  setTestEnv();
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = SECRET;
  resetServerEnvForTests();
  try {
    const headers = proxyForwardHeaders(new Headers({ [ADMIN_PROXY_AGENT_HEADER]: AGENT }), { id: "m1", email: "Manager@X.test", role: "manager", agent_id: AGENT }, "GET", `${API}/team`).headers;
    assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.role), "manager");
    assert.equal(headers.get(ADMIN_PROXY_AGENT_HEADER), null);
    assert.ok(headers.get(ADMIN_PROXY_HEADER_NAMES.signature));
    const payload = buildCanonicalAdminActorPayload({ adminId: "m1", email: "Manager@X.test", role: "manager", timestamp: "1", requestId: "r", method: "GET", path: `/${API}/team`, agentId: AGENT });
    assert.equal(payload.split("\n").length, 7);
  } finally {
    delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
    resetServerEnvForTests();
  }
});

test("pages: a Manager opens only the desk and Daily Operations; a Rep only the desk; an Admin no desk", () => {
  assert.equal(canAccessDashboardPath("manager", "/outreach-desk"), true);
  assert.equal(canAccessDashboardPath("manager", "/daily"), true);
  for (const path of ["/", "/daily/x", "/outreach-desk/x", "/sales-intelligence", "/form-leads", "/operations-registry", "/intakes", "/settings"]) {
    assert.equal(canAccessDashboardPath("manager", path), false, path);
  }
  assert.equal(canAccessDashboardPath("rep", "/outreach-desk"), true);
  assert.equal(canAccessDashboardPath("rep", "/daily"), false);
  assert.equal(canAccessDashboardPath("admin", "/outreach-desk"), false);
  assert.equal(canAccessDashboardPath("admin", "/daily"), false);
  assert.equal(canAccessDashboardPath("owner", "/outreach-desk"), true);
});

function requestWithRole(pathname: string, role: "owner" | "admin" | "manager" | "rep") {
  const token = signAccessToken({ sub: "65f0000000000000000000a1", email: `${role}@example.invalid`, role, token_version: 0 });
  return new NextRequest(`http://localhost:3000${pathname}`, { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${token}` } });
}

test("the edge guard sends a Manager to the desk from any page but the desk and Daily Operations", () => {
  setTestEnv();
  assert.equal(applyRoleRouteGuard(requestWithRole("/outreach-desk?view=team", "manager")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/daily", "manager")), null);
  for (const path of ["/", "/form-leads", "/sales-intelligence", "/operations-registry?tab=users", "/intakes", "/analytics"]) {
    const response = applyRoleRouteGuard(requestWithRole(path, "manager"));
    assert.equal(response?.status, 307, path);
    assert.equal(new URL(response!.headers.get("location")!).pathname, "/outreach-desk", path);
  }
  // Owner and Admin pages are gated by their layouts as before.
  assert.equal(applyRoleRouteGuard(requestWithRole("/outreach-desk", "admin")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/outreach-desk", "owner")), null);
});

test("the desk live BFF: refuses an Admin and an unlinked Rep without an upstream call, forwards the signed actor, keeps the refusal status", async () => {
  setTestEnv();
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = SECRET;
  resetServerEnvForTests();
  const refuse = async () => {
    throw new Error("must not be called");
  };
  const request = () => new Request("http://localhost/api/outreach-desk-live", { headers: { [ADMIN_PROXY_AGENT_HEADER]: "65f0000000000000000000ff" } });
  try {
    assert.equal((await outreachDeskLive(request(), { admin: null, url: "http://upstream.invalid/live", apiSecret: "x", fetch: refuse })).status, 401);
    const admin = await outreachDeskLive(request(), { admin: { id: "a", email: "a@x.test", role: "admin" }, url: "http://upstream.invalid/live", apiSecret: "x", fetch: refuse });
    assert.equal(admin.status, 403);
    const unlinked = await outreachDeskLive(request(), { admin: { id: "r", email: "r@x.test", role: "rep", agent_id: null }, url: "http://upstream.invalid/live", apiSecret: "x", fetch: refuse });
    assert.equal(unlinked.status, 403);

    const forwarded: Headers[] = [];
    const stream = async (_url: string | URL | Request, init?: RequestInit) => {
      forwarded.push(new Headers(init?.headers));
      return new Response(new ReadableStream({ start: (controller) => controller.close() }), { headers: { "content-type": "text/event-stream" } });
    };
    const rep = await outreachDeskLive(request(), { admin: { id: "r", email: "r@x.test", role: "rep", agent_id: AGENT }, url: "http://upstream.invalid/live", apiSecret: "secret-x", fetch: stream });
    assert.equal(rep.status, 200);
    assert.equal(rep.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(forwarded[0]?.get(ADMIN_PROXY_HEADER_NAMES.role), "rep");
    // The Agent is the session's, never the browser's.
    assert.equal(forwarded[0]?.get(ADMIN_PROXY_AGENT_HEADER), AGENT);
    assert.equal(forwarded[0]?.get("x-api-secret"), "secret-x");
    assert.equal(forwarded[0]?.get("accept"), "text/event-stream");
    const manager = await outreachDeskLive(request(), { admin: { id: "m", email: "m@x.test", role: "manager" }, url: "http://upstream.invalid/live", apiSecret: "x", fetch: stream });
    assert.equal(manager.status, 200);
    assert.equal(forwarded[1]?.get(ADMIN_PROXY_HEADER_NAMES.role), "manager");
    assert.equal(forwarded[1]?.get(ADMIN_PROXY_AGENT_HEADER), null);

    const muted = await outreachDeskLive(request(), {
      admin: { id: "o", email: "o@x.test", role: "owner" },
      url: "http://upstream.invalid/live",
      apiSecret: "x",
      fetch: async () => Response.json({ ok: false, code: "CONFIGURATION_UNAVAILABLE", error: "Desk is disabled.", request_id: "r" }, { status: 503 }),
    });
    assert.equal(muted.status, 503);
    assert.deepEqual(await muted.json(), { ok: false, code: "CONFIGURATION_UNAVAILABLE", error: "Live updates unavailable." });
  } finally {
    delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
    resetServerEnvForTests();
  }
});
