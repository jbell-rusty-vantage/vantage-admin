import assert from "node:assert/strict";
import test from "node:test";
import { resetServerEnvForTests } from "@/lib/env/server";
import { setTestEnv } from "../../tests/setup-env";
import {
  ADMIN_PROXY_HEADER_NAMES,
  computeAdminActorSignature,
  normalizeAdminPath,
} from "./proxySigning";
import { setTrustedAdminHeaders } from "./trustedProxyHeaders";

setTestEnv();

test("trusted admin headers include owner identity for proxied requests", () => {
  delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
  resetServerEnvForTests();
  const headers = new Headers();

  setTrustedAdminHeaders(headers, {
    id: "admin_123",
    email: "owner@example.test",
    role: "owner",
  });

  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.userId), "admin_123");
  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.email), "owner@example.test");
  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.role), "owner");
  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.signature), null);
});

test("signed headers bind method and path with the shared secret", () => {
  process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET = "proxy-signing-secret-for-tests-32chars";
  resetServerEnvForTests();

  const headers = new Headers();
  const requestId = "req_fixed_123";
  const timestampMs = 1_700_000_000_000;

  setTrustedAdminHeaders(
    headers,
    {
      id: "admin_123",
      email: "Owner@Example.test",
      role: "owner",
    },
    {
      method: "POST",
      path: "api/v1/admin/agents?include_inactive=true",
      requestId,
      timestampMs,
    },
  );

  const expected = computeAdminActorSignature(
    {
      adminId: "admin_123",
      email: "Owner@Example.test",
      role: "owner",
      timestamp: String(timestampMs),
      requestId,
      method: "POST",
      path: normalizeAdminPath("api/v1/admin/agents?include_inactive=true"),
    },
    "proxy-signing-secret-for-tests-32chars",
  );

  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.requestId), requestId);
  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.timestamp), String(timestampMs));
  assert.equal(headers.get(ADMIN_PROXY_HEADER_NAMES.signature), expected);

  delete process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET;
  resetServerEnvForTests();
});
