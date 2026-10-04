import assert from "node:assert/strict";
import test from "node:test";
import {
  adminExportUrl,
  analyticsExportUrl,
  deleteBookedLead,
  deleteCancelledLead,
  fetchAdminDetail,
  fetchAdminFacets,
  fetchOverviewReport,
} from "./admin";

test("list export URL carries the active filters through the proxy without a database scope", () => {
  const url = adminExportUrl("form-leads", {
    source_granularity_key: "main_site_form",
    q: "smith",
    empty: "",
    missing: undefined,
  });

  assert.ok(url.startsWith("/api/proxy/api/v1/admin/exports/form-leads.csv?"));
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("source_granularity_key"), "main_site_form");
  assert.equal(params.get("q"), "smith");
  assert.equal(params.has("empty"), false);
  assert.equal(params.has("database_scope"), false);
});

test("analytics export URL targets the report CSV route", () => {
  const url = analyticsExportUrl("agent-performance", { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(
    url,
    "/api/proxy/api/v1/admin/exports/analytics/agent-performance.csv?from=2026-09-01&to=2026-09-30",
  );
});

test("detail, facets and overview reads never send a database scope", async () => {
  const { calls, restore } = stubFetch(JSON.stringify({ ok: true, data: {} }), 200);
  try {
    await fetchAdminDetail("booked-leads", "66f0a1b2c3d4e5f6a7b8c9d0");
    await fetchAdminFacets();
    await fetchOverviewReport();
  } finally {
    restore();
  }

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/proxy/api/v1/admin/booked-leads/66f0a1b2c3d4e5f6a7b8c9d0",
      "/api/proxy/api/v1/admin/facets",
      "/api/proxy/api/v1/admin/analytics/overview",
    ],
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

function stubFetch(body: string | null = null, status = 204) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(body, { status });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
