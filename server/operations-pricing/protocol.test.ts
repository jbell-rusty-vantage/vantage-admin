import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { pricingHeaders, pricingTarget } from "./protocol";
import { validatePricingBody } from "./validation";
import { handlePricingRequest } from "./proxy";

const actor = { id: "6a0000000000000000000001", role: "owner" };
const secret = "offline-operations-signing-secret-0001";
const operation = { calculation_enabled: false, expected_activation_version: 3, operation_id: "87a9d6aa-0772-464a-8966-d69403002dc1", change_note: "Owner disabled" };
test("operations assertion binds exact method, canonical target, actor and body bytes with its own audience", () => {
  const input = { actorId: actor.id, method: "POST", target: "/api/v1/pricing/enabled", body: JSON.stringify(operation), secret, timestamp: "1792960000000", requestId: operation.operation_id };
  const headers = pricingHeaders(input);
  const expected = ["vantage-operations-admin-v1", "transportation-pricing", actor.id, "owner", input.timestamp, input.requestId, input.method, input.target, createHash("sha256").update(input.body).digest("hex")].join("\n");
  assert.equal(headers["x-vantage-operations-signature"], createHmac("sha256", secret).update(expected).digest("hex"));
  assert.notEqual(pricingHeaders({ ...input, body: input.body + " " })["x-vantage-operations-signature"], headers["x-vantage-operations-signature"]);
  assert.throws(() => pricingHeaders({ ...input, timestamp: "01792960000000" }));
  assert.throws(() => pricingHeaders({ ...input, requestId: "-".repeat(36) }));
  assert.throws(() => pricingHeaders({ ...input, target: input.target + "\nforged" }));
});
test("allowlist excludes alternate targets and canonicalizes only permitted revision query keys", () => {
  assert.equal(pricingTarget("GET", ["revisions"], new URLSearchParams("limit=20&cursor=YWJj")), "/api/v1/pricing/revisions?cursor=YWJj&limit=20");
  for (const path of [["..", "enabled"], ["enabled", ""], ["drafts", "%2e%2e"], ["https:", "host"], ["configuration/"]]) assert.throws(() => pricingTarget("GET", path, new URLSearchParams()));
  for (const query of ["limit=20&limit=30", "actor=owner", "limit=101"]) assert.throws(() => pricingTarget("GET", ["revisions"], new URLSearchParams(query)));
  assert.throws(() => pricingTarget("GET", ["configuration"], new URLSearchParams("limit=20")));
  assert.throws(() => validatePricingBody("/api/v1/pricing/enabled", "POST", { ...operation, actor_id: actor.id }));
  assert.throws(() => validatePricingBody("/api/v1/pricing/enabled", "POST", { ...operation, expected_activation_version: "3" }));
});
function request(method = "POST", origin: string | null = "https://admin.example", body: unknown = operation) { return new NextRequest("https://admin.example/api/operations-pricing/enabled", { method, headers: { "content-type": "application/json", ...(origin ? { origin } : {}), cookie: "private=session", "x-vantage-operations-actor-id": "forged", "x-api-secret": "not-an-actor" }, body: method === "GET" ? undefined : JSON.stringify(body) }); }
test("current session is rechecked for every request and non-Owner/CSRF calls never reach operations", async () => {
  let checked = 0; let forwarded = 0;
  let current: typeof actor | null = actor;
  const deps = { actor: async () => { checked++; return current; }, env: () => ({ OPERATIONS_API_BASE_URL: "https://operations.example", OPERATIONS_ADMIN_SIGNING_SECRET: secret }), fetch: (async () => { forwarded++; return Response.json({ ok: true, data: {} }); }) as typeof fetch };
  const context = { params: Promise.resolve({ path: ["enabled"] }) };
  assert.equal((await handlePricingRequest(request(), context, deps)).status, 200);
  current = null;
  assert.equal((await handlePricingRequest(request(), context, deps)).status, 401);
  current = { ...actor, role: "admin" };
  assert.equal((await handlePricingRequest(request(), context, deps)).status, 403);
  current = actor;
  assert.equal((await handlePricingRequest(request("POST", "https://attacker.example"), context, deps)).status, 403);
  assert.equal((await handlePricingRequest(request("POST", null), context, deps)).status, 403);
  assert.equal(checked, 5); assert.equal(forwarded, 1);
});
test("proxy strips browser credentials/forgeries and signs the exact validated outbound body", async () => {
  const deps = { actor: async () => actor, env: () => ({ OPERATIONS_API_BASE_URL: "https://operations.example", OPERATIONS_ADMIN_SIGNING_SECRET: secret }), fetch: (async (url, init) => {
    assert.equal(String(url), "https://operations.example/api/v1/pricing/enabled");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("cookie"), null); assert.equal(headers.get("x-api-secret"), null); assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("x-vantage-operations-actor-id"), actor.id);
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    const body = String(init?.body);
    assert.deepEqual(JSON.parse(body), operation);
    const signature = pricingHeaders({ actorId: actor.id, method: "POST", target: "/api/v1/pricing/enabled", body, secret, requestId: headers.get("x-vantage-operations-request-id")!, timestamp: headers.get("x-vantage-operations-timestamp")! });
    assert.equal(headers.get("x-vantage-operations-signature"), signature["x-vantage-operations-signature"]);
    return Response.json({ ok: false, error: { code: "RATE_LIMITED", message: "Try later." } }, { status: 429, headers: { "retry-after": "60" } });
  }) as typeof fetch };
  const response = await handlePricingRequest(request(), { params: Promise.resolve({ path: ["enabled"] }) }, deps);
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "60"); assert.equal(response.headers.get("cache-control"), "no-store");
});
test("missing integration settings, invalid bodies and malformed authority response fail closed", async () => {
  let calls = 0;
  const deps = { actor: async () => actor, env: () => ({}), fetch: (async () => { calls++; throw new Error("private upstream detail"); }) as typeof fetch };
  const context = { params: Promise.resolve({ path: ["enabled"] }) };
  assert.equal((await handlePricingRequest(request(), context, deps)).status, 503);
  assert.equal((await handlePricingRequest(request("POST", "https://admin.example", { ...operation, unexpected: true }), context, deps)).status, 400);
  assert.equal(calls, 0);
  const response = await handlePricingRequest(request(), context, { ...deps, env: () => ({ OPERATIONS_API_BASE_URL: "https://operations.example", OPERATIONS_ADMIN_SIGNING_SECRET: secret }), fetch: (async () => new Response("private upstream detail")) as typeof fetch });
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private upstream/);
});


test("every non-Owner role and revoked session are denied without forwarding", async () => {
  let calls = 0;
  for (const role of ["admin", "manager", "rep", "unknown"]) {
    const response = await handlePricingRequest(request(), { params: Promise.resolve({ path: ["enabled"] }) }, { actor: async () => ({ ...actor, role }), env: () => ({}), fetch: (async () => { calls++; return Response.json({ ok: true, data: {} }); }) as typeof fetch });
    assert.equal(response.status, 403);
  }
  assert.equal(calls, 0);
});
