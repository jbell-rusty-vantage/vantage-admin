import assert from "node:assert/strict";
import test from "node:test";
import {
  createExtensionUser,
  deleteExtensionUser,
  fetchExtensionUsers,
  formatExtensionRoleLabels,
  rolesSetsEqual,
  updateExtensionUser,
} from "./extensionUsers";

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

const listedUser = {
  id: "user-1",
  email: "owner@vantage.com",
  roles: ["owner"],
  active: true,
  created_at: "2026-09-04T16:00:00.000Z",
  last_login_at: null,
};

const createdUser = {
  id: "user-2",
  email: "rep@vantage.com",
  roles: ["sales", "customer_service"],
  active: true,
  created_at: "2026-09-04T16:00:00.000Z",
  last_login_at: null,
};

test("list Extension Users uses the Owner proxy", async () => {
  const calls = mockFetch({
    ok: true,
    data: [listedUser],
  });
  const result = await fetchExtensionUsers();
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users");
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.equal(result[0]?.email, "owner@vantage.com");
  assert.deepEqual(result[0]?.roles, ["owner"]);
});

test("create Extension User posts email, password, and roles through the Owner proxy", async () => {
  const calls = mockFetch({ ok: true, data: createdUser }, 201);
  const result = await createExtensionUser({
    email: "rep@vantage.com",
    password: "secret-pass",
    roles: ["sales", "customer_service"],
  });
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      email: "rep@vantage.com",
      password: "secret-pass",
      roles: ["sales", "customer_service"],
    }),
  );
  assert.deepEqual(result.roles, ["sales", "customer_service"]);
  assert.equal("role" in result, false);
});

test("update Extension User patches only supplied fields on /:id", async () => {
  const calls = mockFetch({
    ok: true,
    data: { ...createdUser, email: "new@vantage.com", roles: ["owner", "sales"] },
  });
  const result = await updateExtensionUser("user-2", {
    email: "new@vantage.com",
    roles: ["owner", "sales"],
  });
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users/user-2");
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      email: "new@vantage.com",
      roles: ["owner", "sales"],
    }),
  );
  assert.deepEqual(result.roles, ["owner", "sales"]);
});

test("update Extension User omits a blank password", async () => {
  const calls = mockFetch({ ok: true, data: createdUser });
  await updateExtensionUser("user-2", {
    email: "rep@vantage.com",
    password: "",
    roles: ["sales"],
  });
  assert.equal(
    calls[0]?.init?.body,
    JSON.stringify({
      email: "rep@vantage.com",
      roles: ["sales"],
    }),
  );
});

test("update Extension User can send only a password", async () => {
  const calls = mockFetch({ ok: true, data: createdUser });
  await updateExtensionUser("user-2", { password: "new-password" });
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ password: "new-password" }));
});

test("delete Extension User hits /:id with DELETE", async () => {
  const calls = mockFetch({ ok: true, data: { id: "user-2" } });
  const result = await deleteExtensionUser("user-2");
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/extension-users/user-2");
  assert.equal(calls[0]?.init?.method, "DELETE");
  assert.deepEqual(result, { id: "user-2" });
});

test("rolesSetsEqual compares membership, not order", () => {
  assert.equal(rolesSetsEqual(["sales", "owner"], ["owner", "sales"]), true);
  assert.equal(rolesSetsEqual(["sales"], ["sales", "owner"]), false);
  assert.equal(rolesSetsEqual(["sales", "customer_service"], ["customer_service", "sales"]), true);
});

test("formatExtensionRoleLabels joins Owner, Sales, Customer Service in canonical order", () => {
  assert.equal(formatExtensionRoleLabels(["customer_service", "owner"]), "Owner, Customer Service");
  assert.equal(formatExtensionRoleLabels(["sales", "customer_service"]), "Sales, Customer Service");
  assert.equal(formatExtensionRoleLabels(["owner", "sales", "customer_service"]), "Owner, Sales, Customer Service");
});
