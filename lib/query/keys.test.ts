import assert from "node:assert/strict";
import test from "node:test";
import { queryKeys } from "./keys";

test("list query keys sort filter object keys for stable cache keys", () => {
  const first = queryKeys.lists.resource("form-leads", {
    q: "smith",
    page: 1,
    empty: "",
  });
  const second = queryKeys.lists.resource("form-leads", {
    empty: "",
    page: 1,
    q: "smith",
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first[2], { page: 1, q: "smith" });
});

test("detail query keys include resource id and database scope", () => {
  assert.deepEqual(queryKeys.details.resource("booked-leads", "abc", "historical"), [
    "details",
    "booked-leads",
    "abc",
    "historical",
    {},
  ]);
});

test("observability query keys are stable across filter ordering", () => {
  const first = queryKeys.observability.events({ level: "error", page: 2, q: "" });
  const second = queryKeys.observability.events({ page: 2, q: "", level: "error" });

  assert.deepEqual(first, second);
  assert.deepEqual(first, ["observability", "events", { level: "error", page: 2 }]);
});

test("observability detail and sheet-sync keys nest under the observability root", () => {
  assert.deepEqual(queryKeys.observability.incidentDetail("inc1"), [
    "observability",
    "incidents",
    "detail",
    "inc1",
  ]);
  assert.deepEqual(queryKeys.observability.sheetSync.jobs({ status: "failed" }), [
    "observability",
    "sheet-sync",
    "jobs",
    { status: "failed" },
  ]);
  // Invalidate-all on the observability root must cover sheet-sync keys too.
  assert.equal(queryKeys.observability.sheetSync.all[0], queryKeys.observability.all[0]);
});

test("booking reconciliation query keys are stable across filter ordering", () => {
  const first = queryKeys.bookingReconciliation.list({ status: "pending", q: "job-1", empty: "" });
  const second = queryKeys.bookingReconciliation.list({ q: "job-1", empty: "", status: "pending" });

  assert.deepEqual(first, second);
  assert.deepEqual(first, ["booking-reconciliation", "list", { q: "job-1", status: "pending" }]);
});

test("booking reconciliation candidate keys include case id", () => {
  assert.deepEqual(queryKeys.bookingReconciliation.candidates("case-1", { limit: 10 }), [
    "booking-reconciliation",
    "candidates",
    "case-1",
    { limit: 10 },
  ]);
});

test("operations registry query keys nest under a shared root", () => {
  assert.deepEqual(queryKeys.operationsRegistry.overview(), [
    "operations-registry",
    "overview",
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.health(), [
    "operations-registry",
    "health",
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.changes({ page: 1, entity_type: "agent" }), [
    "operations-registry",
    "changes",
    { entity_type: "agent", page: 1 },
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.agents(true), [
    "operations-registry",
    "agents",
    "all",
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.cplSnapshot(), [
    "operations-registry",
    "cpl",
    "snapshot",
  ]);
  assert.equal(queryKeys.operationsRegistry.cplPeriods("g1")[0], queryKeys.operationsRegistry.all[0]);
  assert.deepEqual(queryKeys.operationsRegistry.ringCentralRoutes({ includeInactive: true }), [
    "operations-registry",
    "ringcentral",
    "routes",
    { includeInactive: true },
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.ringCentralRouteDetail("r1"), [
    "operations-registry",
    "ringcentral",
    "routes",
    "detail",
    "r1",
  ]);
  assert.equal(
    queryKeys.operationsRegistry.ringCentralRouteDependencies("r1")[0],
    queryKeys.operationsRegistry.all[0],
  );
});

test("booking reconciliation queue pages and filters have isolated cache keys", () => {
  const firstPage = queryKeys.bookingReconciliation.list({
    status: "pending",
    lead_source_company: "company-a",
  });
  const secondPage = queryKeys.bookingReconciliation.list({
    status: "pending",
    lead_source_company: "company-a",
    cursor: "page-2",
  });
  const otherFilter = queryKeys.bookingReconciliation.list({
    status: "pending",
    lead_source_company: "company-b",
  });

  assert.notDeepEqual(firstPage, secondPage);
  assert.notDeepEqual(firstPage, otherFilter);
});

test("reporting keys isolate catalog, definition detail, and run history", () => {
  assert.deepEqual(queryKeys.reporting.catalog(), ["reporting", "catalog"]);
  assert.deepEqual(queryKeys.reporting.definition("definition-1"), [
    "reporting",
    "definitions",
    "detail",
    "definition-1",
  ]);
  assert.deepEqual(queryKeys.reporting.runs({ status: "queued", empty: "" }), [
    "reporting",
    "runs",
    { status: "queued" },
  ]);
});

test("Granot automation keys isolate run history and detail", () => {
  assert.deepEqual(queryKeys.granotAutomation.sources(), ["granot-automation", "sources"]);
  assert.deepEqual(queryKeys.granotAutomation.runs(), ["granot-automation", "runs"]);
  assert.deepEqual(queryKeys.granotAutomation.run("run-1"), [
    "granot-automation",
    "runs",
    "detail",
    "run-1",
  ]);
});
