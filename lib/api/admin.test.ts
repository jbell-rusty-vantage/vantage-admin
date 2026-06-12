import assert from "node:assert/strict";
import test from "node:test";
import {
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
