import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionUser, fetchExtensionUsers } from "./extensionUsers";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("list Extension Users uses the Owner proxy", async () => {
  const calls = mockFetch({
    ok: true,
    data: [{ id: "user-1", email: "owner@vantage.com", role: "owner", active: true }],
  });
  const result = await fetchExtensionUsers();
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users");
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.equal(result[0]?.email, "owner@vantage.com");
});

test("create Extension User posts email, password, and role through the Owner proxy", async () => {
  const calls = mockFetch(
    {
      ok: true,
      data: { id: "user-2", email: "rep@vantage.com", role: "sales", active: true },
    },
    201,
  );
  const result = await createExtensionUser({
    email: "rep@vantage.com",
    password: "secret-pass",
    role: "sales",
  });
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, JSON.stringify({
    email: "rep@vantage.com",
    password: "secret-pass",
    role: "sales",
  }));
  assert.equal(result.role, "sales");
});
