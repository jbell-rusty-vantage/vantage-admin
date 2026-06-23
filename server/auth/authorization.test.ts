import assert from "node:assert/strict";
import test from "node:test";
import { canAccessDashboardPath, canProxyVantagePath } from "./authorization";

test("owner can proxy any Vantage path", () => {
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "DELETE",
      path: "api/v1/admin/observability/events/abc",
    }),
    true,
  );
});

test("admin can read proxy resources and use expected operational writes", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/form-leads",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "PATCH",
      path: "api/v1/form-leads/507f1f77bcf86cd799439011",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/booked-leads/from-source",
    }),
    true,
  );
});

test("admin cannot proxy destructive observability requests", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "DELETE",
      path: "api/v1/admin/observability/events/abc",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/observability/events/delete",
    }),
    false,
  );
});

test("admin dashboard paths hide owner-only local pages", () => {
  assert.equal(canAccessDashboardPath("admin", "/settings"), false);
  assert.equal(canAccessDashboardPath("admin", "/audit-log"), false);
  assert.equal(canAccessDashboardPath("admin", "/form-leads"), true);
  assert.equal(canAccessDashboardPath("owner", "/settings"), true);
});
