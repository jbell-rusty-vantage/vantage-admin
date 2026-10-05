import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { resetServerEnvForTests } from "@/lib/env/server";
import { setTestEnv } from "@/tests/setup-env";
import { canAccessDashboardPath, canProxyVantagePath } from "./authorization";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { proxyForwardHeaders } from "./proxyForwardHeaders";
import {
  ADMIN_PROXY_AGENT_HEADER,
  ADMIN_PROXY_HEADER_NAMES,
  buildCanonicalAdminActorPayload,
} from "./proxySigning";
import { applyRoleRouteGuard } from "./routeGuard";
import { signAccessToken } from "./tokens";
import { setTrustedAdminHeaders } from "./trustedProxyHeaders";
import { salesIntelligenceLive } from "../sales-intelligence-live";

/**
 * S8-REP (addendum §4.1): the trusted proxy signs `role` and, for a rep only, `agent_id`. Owner and
 * Admin requests stay byte-identical to the pre-S8 contract so the deployed main server keeps
 * accepting them. A rep reaches exactly its Sales Intelligence pages and calls.
 */

const SECRET = "s8-rep-signing-secret-for-tests-32chars";
const AGENT = "65f0000000000000000000ab";
const ID = "65f0000000000000000000cd";

/** The pre-S8 canonical payload, frozen here so a change to the shared builder can't hide a drift. */
function preS8Signature(fields: { adminId: string; email: string; role: string; timestamp: string; requestId: string; method: string; path: string }) {
  const path = (() => {
    const bare = fields.path.split("?")[0] ?? "";
    const slash = bare.startsWith("/") ? bare : `/${bare}`;
    return slash.length > 1 ? slash.replace(/\/+$/, "") : slash;
  })();
  const payload = [fields.adminId.trim(), fields.email.trim().toLowerCase(), fields.role.trim().toLowerCase(), fields.timestamp.trim(),
    fields.requestId.trim(), fields.method.trim().toUpperCase(), path].join("\n");
  return createHmac("sha256", SECRET).update(payload, "utf8").digest("hex");
}

function withSecret<T>(secret: string | undefined, run: () => T): T {
  setTestEnv();
  if (secret === undefined) delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
  else process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = secret;
  resetServerEnvForTests();
  try {
    return run();
  } finally {
    delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
    resetServerEnvForTests();
  }
}

const headerEntries = (headers: Headers) => [...headers.entries()].sort(([a], [b]) => a.localeCompare(b));

test("Owner and Admin signing is byte-identical to the pre-S8 contract, with or without an agent_id on the identity", () => {
  withSecret(SECRET, () => {
    for (const role of ["owner", "admin"] as const) {
      for (const identity of [
        { id: "admin_1", email: "Owner@Example.test", role },
        { id: "admin_1", email: "Owner@Example.test", role, agent_id: AGENT },
        { id: "admin_1", email: "Owner@Example.test", role, agent_id: null },
      ]) {
        const headers = new Headers();
        setTrustedAdminHeaders(headers, identity, { method: "post", path: "api/v1/admin/agents/?x=1", requestId: "req_1", timestampMs: 1_700_000_000_000 });
        assert.deepEqual(headerEntries(headers), [
          [ADMIN_PROXY_HEADER_NAMES.email, "Owner@Example.test"],
          [ADMIN_PROXY_HEADER_NAMES.requestId, "req_1"],
          [ADMIN_PROXY_HEADER_NAMES.role, role],
          [ADMIN_PROXY_HEADER_NAMES.signature, preS8Signature({ adminId: "admin_1", email: "Owner@Example.test", role, timestamp: "1700000000000",
            requestId: "req_1", method: "post", path: "api/v1/admin/agents/?x=1" })],
          [ADMIN_PROXY_HEADER_NAMES.timestamp, "1700000000000"],
          [ADMIN_PROXY_HEADER_NAMES.userId, "admin_1"],
        ].sort(([a], [b]) => a.localeCompare(b)), `${role} ${JSON.stringify(identity)}`);
      }
    }
    // The payload builder ignores an agent id for every role but rep.
    const base = { adminId: "a", email: "e@x.test", timestamp: "1", requestId: "r", method: "GET", path: "/p" };
    assert.equal(buildCanonicalAdminActorPayload({ ...base, role: "owner", agentId: AGENT }), buildCanonicalAdminActorPayload({ ...base, role: "owner" }));
    assert.equal(buildCanonicalAdminActorPayload({ ...base, role: "owner" }).split("\n").length, 7);
  });
});

test("Owner headers without a secret are unchanged (no agent header, unsigned as before)", () => {
  withSecret(undefined, () => {
    const headers = new Headers();
    setTrustedAdminHeaders(headers, { id: "admin_1", email: "o@x.test", role: "owner", agent_id: AGENT }, { method: "GET", path: "api/v1/x", requestId: "req_2" });
    assert.equal(headers.get(ADMIN_PROXY_AGENT_HEADER), null);
    assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.signature), null);
    assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.requestId), "req_2");
  });
});

test("a rep's headers carry its Agent id, signed as the eighth payload line", () => {
  withSecret(SECRET, () => {
    const headers = new Headers();
    setTrustedAdminHeaders(headers, { id: "rep_1", email: "Rep@Example.test", role: "rep", agent_id: AGENT.toUpperCase() },
      { method: "GET", path: "api/v1/admin/sales-intelligence/attention?scope=production", requestId: "req_3", timestampMs: 1_700_000_000_001 });
    assert.equal(headers.get(ADMIN_PROXY_AGENT_HEADER), AGENT);
    assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.role), "rep");
    const payload = ["rep_1", "rep@example.test", "rep", "1700000000001", "req_3", "GET", "/api/v1/admin/sales-intelligence/attention", AGENT].join("\n");
    assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.signature), createHmac("sha256", SECRET).update(payload, "utf8").digest("hex"));
    // A different Agent is a different signature: the scope can't be swapped after signing.
    const other = new Headers();
    setTrustedAdminHeaders(other, { id: "rep_1", email: "Rep@Example.test", role: "rep", agent_id: "65f0000000000000000000ee" },
      { method: "GET", path: "api/v1/admin/sales-intelligence/attention", requestId: "req_3", timestampMs: 1_700_000_000_001 });
    assert.notEqual(other.get(ADMIN_PROXY_HEADER_NAMES.signature), headers.get(ADMIN_PROXY_HEADER_NAMES.signature));
    // The rep payload is never a valid Owner payload for the same fields.
    assert.notEqual(headers.get(ADMIN_PROXY_HEADER_NAMES.signature), preS8Signature({ adminId: "rep_1", email: "Rep@Example.test", role: "rep",
      timestamp: "1700000000001", requestId: "req_3", method: "GET", path: "/api/v1/admin/sales-intelligence/attention" }));
  });
});

test("a rep without a linked Agent, or without a signing secret, is never forwarded", () => {
  withSecret(SECRET, () => {
    for (const agent_id of [undefined, null, "", "not-an-id", "65f0000000000000000000a"]) {
      assert.throws(() => setTrustedAdminHeaders(new Headers(), { id: "rep_1", email: "r@x.test", role: "rep", agent_id }, { method: "GET", path: "/x" }), String(agent_id));
    }
    assert.throws(() => setTrustedAdminHeaders(new Headers(), { id: "rep_1", email: "r@x.test", role: "rep", agent_id: AGENT }));
    assert.throws(() => buildCanonicalAdminActorPayload({ adminId: "a", email: "e", role: "rep", timestamp: "1", requestId: "r", method: "GET", path: "/p" }));
  });
  withSecret(undefined, () => {
    assert.throws(() => setTrustedAdminHeaders(new Headers(), { id: "rep_1", email: "r@x.test", role: "rep", agent_id: AGENT }, { method: "GET", path: "/x" }));
  });
});

test("the proxy never forwards a browser-sent scope header", () => {
  withSecret(SECRET, () => {
    const incoming = new Headers({ [ADMIN_PROXY_AGENT_HEADER]: "65f0000000000000000000ff", [ADMIN_PROXY_HEADER_NAMES.role]: "owner", accept: "application/json" });
    const owner = proxyForwardHeaders(incoming, { id: "o", email: "o@x.test", role: "owner" }, "GET", "api/v1/admin/sales-intelligence/attention").headers;
    assert.equal(owner.get(ADMIN_PROXY_AGENT_HEADER), null);
    const rep = proxyForwardHeaders(incoming, { id: "r", email: "r@x.test", role: "rep", agent_id: AGENT }, "GET", "api/v1/admin/sales-intelligence/attention").headers;
    assert.equal(rep.get(ADMIN_PROXY_AGENT_HEADER), AGENT);
    assert.equal(rep.get(ADMIN_PROXY_HEADER_NAMES.role), "rep");
  });
});

test("canAccessDashboardPath: a rep opens only /outreach-desk (its Outreach Desk)", () => {
  assert.equal(canAccessDashboardPath("rep", "/outreach-desk"), true);
  for (const path of ["/", "/outreach-desk/", "/outreach-desk/x", "/sales-intelligence", "/sales-intelligence/", `/sales-intelligence/outreach/${ID}`, `/sales-intelligence/outreach/${ID.toUpperCase()}`, "/sales-intelligence/numbers",
    `/sales-intelligence/numbers/${ID}`, "/sales-intelligence/outreach", "/sales-intelligence/legacy", "/sales-intelligence-x",
    "/operations-registry", "/settings", "/daily", "/conversations", "/form-leads"]) {
    assert.equal(canAccessDashboardPath("rep", path), false, path);
  }
  // The Owner is unchanged; a generic Admin has no desk (P09c).
  assert.equal(canAccessDashboardPath("owner", "/sales-intelligence/numbers"), true);
  assert.equal(canAccessDashboardPath("admin", "/sales-intelligence"), false);
  assert.equal(canAccessDashboardPath("admin", "/outreach-desk"), false);
});

/** Every interim Sales Intelligence call (Owner only) and the retired rep allowlist: a rep reaches none of them. */
const SI_PATHS = [
  "api/v1/admin/sales-intelligence/numbers", `api/v1/admin/sales-intelligence/numbers/${ID}`, `api/v1/admin/sales-intelligence/numbers/${ID}/timeline`,
  `api/v1/admin/sales-intelligence/numbers/${ID}/rebuild`, "api/v1/admin/sales-intelligence/attachments", "api/v1/admin/sales-intelligence/attachments/attach",
  "api/v1/admin/sales-intelligence/coverage", "api/v1/admin/sales-intelligence/reps", `api/v1/admin/sales-intelligence/reps/${ID}/review`,
  "api/v1/admin/sales-intelligence/nudges", "api/v1/admin/sales-intelligence/live", "api/v1/admin/sales-intelligence/settings",
  "api/v1/admin/sales-intelligence/attention?scope=production&agent_id=65f0000000000000000000ee", "api/v1/admin/sales-intelligence/roster",
  "api/v1/admin/sales-intelligence/overview?period=today", `api/v1/admin/sales-intelligence/outreach/${ID}`, `api/v1/admin/sales-intelligence/outreach/${ID}/timeline`,
  `api/v1/admin/sales-intelligence/numbers/${ID}/conversations`, `api/v1/admin/sales-intelligence/conversations/${ID}/transcript`,
  `api/v1/admin/sales-intelligence/analysis-runs/${ID}/presentation`, `api/v1/admin/sales-intelligence/followups/${ID}/complete`, `api/v1/admin/sales-intelligence/followups/${ID}`,
  "api/v1/internal/sales-intelligence/history/story", "api/v1/admin/catalog/agents", "api/v1/admin/form-leads",
];
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

test("canProxyVantagePath: a rep reaches no API (the interim reads are Owner-only)", () => {
  for (const path of SI_PATHS) for (const method of METHODS) assert.equal(canProxyVantagePath({ role: "rep", method, path }), false, `${method} ${path}`);
  // Owner unchanged; Admin still has no Sales Intelligence API.
  for (const path of SI_PATHS.filter((item) => item.includes("/admin/sales-intelligence"))) {
    assert.equal(canProxyVantagePath({ role: "owner", method: "GET", path }), true);
    assert.equal(canProxyVantagePath({ role: "admin", method: "GET", path }), false);
  }
});

function requestWithRole(pathname: string, role: "owner" | "admin" | "rep") {
  const token = signAccessToken({ sub: "65f0000000000000000000a1", email: `${role}@example.invalid`, role, token_version: 0 });
  return new NextRequest(`http://localhost:3000${pathname}`, { headers: { cookie: `${ACCESS_TOKEN_COOKIE}=${token}` } });
}

test("the request-boundary role guard lets a rep through to /outreach-desk only", () => {
  setTestEnv();
  assert.equal(applyRoleRouteGuard(requestWithRole("/outreach-desk", "rep")), null);
  assert.equal(applyRoleRouteGuard(requestWithRole("/outreach-desk?view=my", "rep")), null);
  // Anything else (the old Sales Intelligence pages included) redirects to the rep's desk.
  for (const path of ["/sales-intelligence", `/sales-intelligence/outreach/${ID}`, `/sales-intelligence/numbers/${ID}`, "/form-leads", "/sales-intelligence/legacy", "/sales-intelligence/dev/gallery", "/operations-registry", "/daily", "/"]) {
    const response = applyRoleRouteGuard(requestWithRole(path, "rep"));
    assert.equal(response?.status, 307, path);
    assert.equal(new URL(response!.headers.get("location")!).pathname, "/outreach-desk", path);
  }
});

test("the live BFF admits only the Owner: a rep and the Admin role are refused without an upstream call", async () => {
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = SECRET;
  resetServerEnvForTests();
  try {
    const refuse = async () => { throw new Error("must not be called"); };
    const rep = await salesIntelligenceLive(new Request("http://localhost/api/sales-intelligence-live?scope=production", { headers: { [ADMIN_PROXY_AGENT_HEADER]: "65f0000000000000000000ff" } }), {
      admin: { id: "65f0000000000000000000a1", email: "rep@example.invalid", role: "rep", agent_id: AGENT },
      url: "http://upstream.invalid/live", apiSecret: "x", fetch: refuse,
    });
    assert.equal(rep.status, 403);
    const admin = await salesIntelligenceLive(new Request("http://localhost/api/sales-intelligence-live"), {
      admin: { id: "a", email: "a@x.test", role: "admin" }, url: "http://upstream.invalid/live", apiSecret: "x", fetch: refuse,
    });
    assert.equal(admin.status, 403);
    let forwarded: Headers | null = null;
    const owner = await salesIntelligenceLive(new Request("http://localhost/api/sales-intelligence-live?scope=production"), {
      admin: { id: "65f0000000000000000000a2", email: "owner@example.invalid", role: "owner" },
      url: "http://upstream.invalid/live", apiSecret: "x",
      fetch: async (_url, init) => {
        forwarded = new Headers(init?.headers);
        return new Response(new ReadableStream({ start(c) { c.close(); } }), { headers: { "content-type": "text/event-stream" } });
      },
    });
    assert.equal(owner.status, 200);
    assert.equal((forwarded as Headers | null)?.get(ADMIN_PROXY_HEADER_NAMES.role), "owner");
  } finally {
    delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
    resetServerEnvForTests();
  }
});

