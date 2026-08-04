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

test("admin cannot delete operational bookings or cancellations", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "DELETE",
      path: "api/v1/booked-leads/507f1f77bcf86cd799439011",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "DELETE",
      path: "api/v1/cancelled-leads/507f1f77bcf86cd799439011",
    }),
    false,
  );
});

test("admin dashboard paths hide owner-only local pages", () => {
  assert.equal(canAccessDashboardPath("admin", "/settings"), false);
  assert.equal(canAccessDashboardPath("admin", "/audit-log"), false);
  assert.equal(canAccessDashboardPath("admin", "/bookings/reconciliation"), false);
  assert.equal(canAccessDashboardPath("admin", "/form-leads"), true);
  assert.equal(canAccessDashboardPath("admin", "/operations-registry"), true);
  assert.equal(canAccessDashboardPath("admin", "/operations-registry?tab=cpl"), true);
  assert.equal(canAccessDashboardPath("owner", "/settings"), true);
});

test("admin can read registry endpoints but cannot mutate them", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/operations-registry/overview",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/operations-registry/health",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/operations-registry/changes",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/agents",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/agents",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/agents/abc/activation",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/cpl/simple-schedule",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/source-resolution/preview",
    }),
    true,
  );
  // Correction preview is Owner-only on the server; proxy must match.
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/cpl-corrections/preview",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "POST",
      path: "api/v1/admin/cpl-corrections/preview",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "POST",
      path: "api/v1/admin/source-companies",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/ringcentral/inbound-routes",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/ringcentral/inbound-routes",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/ringcentral/inbound-routes/abc/validate",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "POST",
      path: "api/v1/admin/ringcentral/inbound-routes/abc/reassign",
    }),
    true,
  );
});


test("admin can inspect Best Relocation ingestion health but cannot mutate it", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/ingestion/connections/best-relocation",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/ingestion/connections/best-relocation/inspect",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/ingestion/connections/best-relocation/preview",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "PATCH",
      path: "api/v1/admin/ingestion/connections/best-relocation",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/ingestion/conflicts/507f1f77bcf86cd799439011/resolve",
    }),
    false,
  );
});

test("admin cannot proxy owner-only booking reconciliation endpoints", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/booking-lead-reconciliations",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "POST",
      path: "api/v1/admin/booking-lead-reconciliations/case-1/resolve",
    }),
    true,
  );
});

test("admin can read reporting but every reporting mutation is owner-only", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/reporting/definitions/report-1",
    }),
    true,
  );
  for (const path of [
    "api/v1/admin/reporting/definitions",
    "api/v1/admin/reporting/definitions/report-1/preview",
    "api/v1/admin/reporting/definitions/report-1/revisions",
    "api/v1/admin/reporting/definitions/report-1/run",
  ]) {
    assert.equal(canProxyVantagePath({ role: "admin", method: "POST", path }), false);
    assert.equal(canProxyVantagePath({ role: "owner", method: "POST", path }), true);
  }
});
