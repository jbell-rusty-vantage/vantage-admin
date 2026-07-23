import assert from "node:assert/strict";
import test from "node:test";
import { setTrustedAdminHeaders } from "./trustedProxyHeaders";

test("trusted admin headers include owner identity for proxied requests", () => {
  const headers = new Headers();

  setTrustedAdminHeaders(headers, {
    id: "admin_123",
    email: "owner@example.test",
    role: "owner",
  });

  assert.equal(headers.get("x-vantage-admin-user-id"), "admin_123");
  assert.equal(headers.get("x-vantage-admin-email"), "owner@example.test");
  assert.equal(headers.get("x-vantage-admin-role"), "owner");
});
