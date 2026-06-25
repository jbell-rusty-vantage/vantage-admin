import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteBookedLead,
  deleteCancelledLead,
  observabilityEventsExportUrl,
  observabilityIncidentsExportUrl,
  observabilityReportExportUrl,
} from "./admin";

test("observability events export URL carries the active filters through the proxy", () => {
  const url = observabilityEventsExportUrl({
    level: "error",
    lead_phone: "5551234567",
    q: "drain failed",
    empty: "",
    missing: undefined,
  });

  assert.ok(url.startsWith("/api/proxy/api/v1/admin/exports/observability/events.csv?"));
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("level"), "error");
  assert.equal(params.get("lead_phone"), "5551234567");
  assert.equal(params.get("q"), "drain failed");
  assert.equal(params.has("empty"), false);
  assert.equal(params.has("missing"), false);
});

test("observability incidents export URL targets the incidents CSV route", () => {
  const url = observabilityIncidentsExportUrl({ status: "open", severity: "critical" });
  assert.ok(url.startsWith("/api/proxy/api/v1/admin/exports/observability/incidents.csv?"));
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("status"), "open");
  assert.equal(params.get("severity"), "critical");
});

test("observability report export URL encodes the run id", () => {
  assert.equal(
    observabilityReportExportUrl("66f0a1b2c3d4e5f6a7b8c9d0"),
    "/api/proxy/api/v1/admin/exports/observability/reports/66f0a1b2c3d4e5f6a7b8c9d0.csv",
  );
});

test("deleteBookedLead calls the public booked-leads endpoint with cascade option", async () => {
  const { calls, restore } = stubFetch();
  try {
    await deleteBookedLead("66f0a1b2c3d4e5f6a7b8c9d0", { cascade: true });
  } finally {
    restore();
  }

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url,
    "/api/proxy/api/v1/booked-leads/66f0a1b2c3d4e5f6a7b8c9d0?cascade=true",
  );
  assert.equal(calls[0]?.init?.method, "DELETE");
});

test("deleteCancelledLead calls the public cancelled-leads endpoint", async () => {
  const { calls, restore } = stubFetch();
  try {
    await deleteCancelledLead("66f0a1b2c3d4e5f6a7b8c9d0");
  } finally {
    restore();
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/api/proxy/api/v1/cancelled-leads/66f0a1b2c3d4e5f6a7b8c9d0");
  assert.equal(calls[0]?.init?.method, "DELETE");
});

function stubFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
