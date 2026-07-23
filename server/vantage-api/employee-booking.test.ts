import assert from "node:assert/strict";
import test from "node:test";
import { setTestEnv } from "@/tests/setup-env";
import { buildEmployeeBookingApiUrl, resolveEmployeeBookingApiBaseUrl } from "./employee-booking";

test("employee booking public flag supports enabled and disabled deployments", async () => {
  setTestEnv();
  const { getServerEnv, resetServerEnvForTests } = await import("@/lib/env/server");
  assert.equal(getServerEnv().EMPLOYEE_BOOKING_PUBLIC_ENABLED, true);

  process.env.EMPLOYEE_BOOKING_PUBLIC_ENABLED = "false";
  resetServerEnvForTests();
  assert.equal(getServerEnv().EMPLOYEE_BOOKING_PUBLIC_ENABLED, false);
});

test("employee booking API uses the explicit override when configured", () => {
  setTestEnv();

  const url = resolveEmployeeBookingApiBaseUrl();

  assert.equal(url.href, "https://employee-bookings-main-server.test/");
});

test("employee booking API falls back to the default Vantage base URL", () => {
  setTestEnv();
  delete process.env.EMPLOYEE_BOOKING_API_BASE_URL;

  const url = resolveEmployeeBookingApiBaseUrl();

  assert.equal(url.href, "https://vantage-movers-main-server.test/");
});

test("employee booking API rejects invalid override URLs", async () => {
  setTestEnv();
  process.env.EMPLOYEE_BOOKING_API_BASE_URL = "ftp://example.test";

  const { resetServerEnvForTests } = await import("@/lib/env/server");
  resetServerEnvForTests();

  assert.throws(
    () => resolveEmployeeBookingApiBaseUrl(),
    /EMPLOYEE_BOOKING_API_BASE_URL: Must use http:\/\/ or https:\/\//,
  );
});

test("employee booking API keeps relative paths on the configured host", () => {
  setTestEnv();

  const url = buildEmployeeBookingApiUrl("/api/v1/employee-booking-submissions");

  assert.equal(url.href, "https://employee-bookings-main-server.test/api/v1/employee-booking-submissions");
});

test("employee booking API rejects absolute attacker paths", () => {
  setTestEnv();

  assert.throws(
    () => buildEmployeeBookingApiUrl("https://attacker.example/api/v1/employee-booking-submissions"),
    /configured host/,
  );
});
