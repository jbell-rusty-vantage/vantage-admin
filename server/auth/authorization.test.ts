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
  assert.equal(canAccessDashboardPath("admin", "/ingestion"), true);
  assert.equal(canAccessDashboardPath("admin", "/ingestion/granot"), false);
  assert.equal(canAccessDashboardPath("owner", "/settings"), true);
  assert.equal(canAccessDashboardPath("owner", "/ingestion/granot"), true);
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
      path: "api/v1/admin/granot-crm-sources",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "PATCH",
      path: "api/v1/admin/granot-crm-sources/aaaaaaaaaaaaaaaaaaaaaaaa",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "PATCH",
      path: "api/v1/admin/granot-crm-sources/aaaaaaaaaaaaaaaaaaaaaaaa/activation",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "PATCH",
      path: "api/v1/admin/granot-crm-sources/aaaaaaaaaaaaaaaaaaaaaaaa",
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
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/reporting/destinations/dest-1",
    }),
    true,
  );
  for (const path of [
    "api/v1/admin/reporting/definitions",
    "api/v1/admin/reporting/definitions/report-1/preview",
    "api/v1/admin/reporting/definitions/report-1/revisions",
    "api/v1/admin/reporting/definitions/report-1/run",
    "api/v1/admin/reporting/destinations",
    "api/v1/admin/reporting/destinations/dest-1/verify",
    "api/v1/admin/reporting/runs/run-1/cancel",
  ]) {
    assert.equal(canProxyVantagePath({ role: "admin", method: "POST", path }), false);
    assert.equal(canProxyVantagePath({ role: "owner", method: "POST", path }), true);
  }
});

test("admin cannot proxy owner-only Google Drive routes", () => {
  for (const path of [
    "api/v1/admin/google-drive/status",
    "api/v1/admin/google-drive/oauth/authorize",
    "api/v1/admin/google-drive/picker/bootstrap",
    "api/v1/admin/google-drive/picker/selections/verify",
    "api/v1/admin/google-drive/folders",
    "api/v1/admin/google-drive/test-spreadsheet",
    "api/v1/admin/google-drive/connection",
  ]) {
    assert.equal(canProxyVantagePath({ role: "admin", method: "GET", path }), false);
    assert.equal(canProxyVantagePath({ role: "admin", method: "POST", path }), false);
    assert.equal(canProxyVantagePath({ role: "admin", method: "DELETE", path }), false);
    assert.equal(canProxyVantagePath({ role: "owner", method: "GET", path }), true);
    assert.equal(canProxyVantagePath({ role: "owner", method: "POST", path }), true);
    assert.equal(canProxyVantagePath({ role: "owner", method: "DELETE", path }), true);
  }
});

test("admin cannot mutate reporting destinations including archive delete", () => {
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "DELETE",
      path: "api/v1/admin/reporting/destinations/dest-1",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "DELETE",
      path: "api/v1/admin/reporting/destinations/dest-1",
    }),
    true,
  );
});

test("Granot automation plans and mutations are owner-only", () => {
  for (const [method, path] of [
    ["GET", "api/v1/admin/granot-automation/runs"],
    ["GET", "api/v1/admin/granot-automation/runs/run-1"],
    ["POST", "api/v1/admin/granot-automation/runs"],
    ["POST", "api/v1/admin/granot-automation/run-groups"],
    ["POST", "api/v1/admin/granot-automation/runs/run-1/approve"],
  ] as const) {
    assert.equal(canProxyVantagePath({ role: "admin", method, path }), false);
    assert.equal(canProxyVantagePath({ role: "owner", method, path }), true);
  }
});

test("Granot lifecycle standard reads allow admin while candidates and all writes stay owner-only", () => {
  for (const path of [
    "api/v1/admin/granot-lifecycle/cases?state=open",
    "api/v1/admin/granot-lifecycle/cases/case-1",
    "api/v1/admin/granot-lifecycle/jobs/SYNTHETIC%20JOB",
  ]) {
    assert.equal(canProxyVantagePath({ role: "admin", method: "GET", path }), true);
  }
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "GET",
      path: "api/v1/admin/granot-lifecycle/cases/case-1/candidates?scope=source",
    }),
    false,
  );
  assert.equal(
    canProxyVantagePath({
      role: "owner",
      method: "GET",
      path: "api/v1/admin/granot-lifecycle/cases/case-1/candidates?scope=all",
    }),
    true,
  );
  assert.equal(
    canProxyVantagePath({
      role: "admin",
      method: "POST",
      path: "api/v1/admin/granot-lifecycle/cases/case-1",
    }),
    false,
  );
});

test("[AC-32] exact Granot confirm path is Owner-only at the proxy", () => {
  const path = "api/v1/admin/granot-lifecycle/booking-cases/case-1/confirm-booking";
  assert.equal(canProxyVantagePath({ role: "owner", method: "POST", path }), true);
  assert.equal(canProxyVantagePath({ role: "admin", method: "POST", path }), false);
});

test("Granot lifecycle pages remain owner-only in the Admin UI", () => {
  assert.equal(canAccessDashboardPath("admin", "/ingestion/granot/lifecycle"), false);
  assert.equal(canAccessDashboardPath("admin", "/ingestion/granot/lifecycle/cases/case-1"), false);
  assert.equal(canAccessDashboardPath("owner", "/ingestion/granot/lifecycle"), true);
});
