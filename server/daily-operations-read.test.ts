import assert from "node:assert/strict";
import test from "node:test";
import { setTestEnv } from "../tests/setup-env";
import { canProxyVantagePath } from "./auth/authorization";
import { DAILY_OPERATIONS_BOARD_PATH, DAILY_OPERATIONS_LEGACY_PATH, dailyOperationsRead } from "./daily-operations-read";
setTestEnv();
const admin = { id: "test-owner", email: "owner@example.test", role: "owner" as const };
const base = { admin, url: "https://vantage-api.test/board", apiSecret: "test-secret" };
test("board proxy refuses absent/rep/admin actors before any upstream request", async () => {
  let calls = 0; const fetcher = (async () => { calls++; return Response.json({}); }) as typeof fetch;
  for (const identity of [null, { ...admin, role: "rep" as const }, { ...admin, role: "admin" as const }]) {
    const result = await dailyOperationsRead(new Request("https://admin.test/board"), { ...base, admin: identity, fetch: fetcher });
    assert.equal(result.status, identity ? 403 : 401);
  }
  assert.equal(calls, 0);
});
test("owner and manager reads carry server-signed identity and request cancellation", async () => {
  for (const role of ["owner", "manager"] as const) {
    const abort = new AbortController();
    const request = new Request("https://admin.test/board", { signal: abort.signal, headers: { "x-vantage-admin-role": "rep" } });
    const result = await dailyOperationsRead(request, { ...base, admin: { ...admin, role }, fetch: (async (_url, init) => {
      assert.equal(init?.signal, request.signal); const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-vantage-admin-role"), role); assert.ok(headers.get("x-vantage-admin-signature"));
      assert.equal(init?.cache, "no-store"); return Response.json({ schema_version: 2 });
    }) as typeof fetch });
    assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "private, no-store");
  }
});
test("legacy server 204 remains bodyless 204 so old EventSource stops; 503 never becomes empty success", async () => {
  const old = await dailyOperationsRead(new Request("https://admin.test/live"), { ...base, path: DAILY_OPERATIONS_LEGACY_PATH, fetch: (async () => new Response(null, { status: 204 })) as typeof fetch });
  assert.equal(old.status, 204); assert.equal(await old.text(), "");
  const failed = await dailyOperationsRead(new Request("https://admin.test/board"), { ...base, fetch: (async () => Response.json({ error: "private provider details" }, { status: 503 })) as typeof fetch });
  assert.equal(failed.status, 503); assert.equal(failed.headers.get("retry-after"), "60"); assert.doesNotMatch(await failed.text(), /private provider/);
});
test("manager allowlist is limited to read board/goals; spend and writes stay denied", () => {
  for (const path of [DAILY_OPERATIONS_BOARD_PATH, "api/v1/admin/daily-operations/goal-summary"]) assert.equal(canProxyVantagePath({ role: "manager", method: "GET", path }), true);
  assert.equal(canProxyVantagePath({ role: "manager", method: "GET", path: "api/v1/admin/daily-operations/lead-spend" }), false);
  assert.equal(canProxyVantagePath({ role: "manager", method: "POST", path: DAILY_OPERATIONS_BOARD_PATH }), false);
});
