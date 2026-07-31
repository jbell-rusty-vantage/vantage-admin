import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PROXY_HEADER_NAMES,
  buildCanonicalAdminActorPayload,
  computeAdminActorSignature,
  normalizeAdminPath,
} from "./proxySigning";

const TEST_SECRET = "test-signing-secret";

const BASE_FIELDS = {
  adminId: "admin_123",
  email: "Owner@Example.test",
  role: "owner",
  timestamp: "1700000000000",
  requestId: "req_abc123",
  method: "GET",
  path: "/api/v1/admin/operations-registry/overview",
};

test("canonical payload normalizes email, role, method, and path byte-for-byte with server", () => {
  const payload = buildCanonicalAdminActorPayload({
    adminId: " admin_123 ",
    email: " Owner@Example.test ",
    role: " Owner ",
    timestamp: "1700000000000",
    requestId: "req_abc123",
    method: "get",
    path: "/api/v1/admin/operations-registry/overview/",
  });

  assert.equal(
    payload,
    [
      "admin_123",
      "owner@example.test",
      "owner",
      "1700000000000",
      "req_abc123",
      "GET",
      "/api/v1/admin/operations-registry/overview",
    ].join("\n"),
  );
});

test("normalizeAdminPath strips query and trailing slash while keeping root", () => {
  assert.equal(
    normalizeAdminPath("api/v1/admin/agents?include_inactive=true"),
    "/api/v1/admin/agents",
  );
  assert.equal(normalizeAdminPath("/"), "/");
});

test("signature is deterministic lowercase hex HMAC-SHA256", () => {
  const signature = computeAdminActorSignature(BASE_FIELDS, TEST_SECRET);
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(computeAdminActorSignature(BASE_FIELDS, TEST_SECRET), signature);
});

test("tampered method or path changes the signature", () => {
  const valid = computeAdminActorSignature(BASE_FIELDS, TEST_SECRET);
  assert.notEqual(
    computeAdminActorSignature({ ...BASE_FIELDS, method: "POST" }, TEST_SECRET),
    valid,
  );
  assert.notEqual(
    computeAdminActorSignature(
      { ...BASE_FIELDS, path: "/api/v1/admin/operations-registry/health" },
      TEST_SECRET,
    ),
    valid,
  );
});

test("header names match the S1 contract", () => {
  assert.deepEqual(ADMIN_PROXY_HEADER_NAMES, {
    userId: "x-vantage-admin-user-id",
    email: "x-vantage-admin-email",
    role: "x-vantage-admin-role",
    requestId: "x-vantage-admin-request-id",
    timestamp: "x-vantage-admin-timestamp",
    signature: "x-vantage-admin-signature",
  });
});
