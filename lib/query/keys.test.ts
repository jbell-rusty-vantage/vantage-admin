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
  assert.deepEqual(queryKeys.operationsRegistry.granotCrmSources(), [
    "operations-registry",
    "granot-crm-sources",
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.granotCrmSourceDetail("s1"), [
    "operations-registry",
    "granot-crm-sources",
    "detail",
    "s1",
  ]);
  assert.equal(
    queryKeys.operationsRegistry.granotCrmSources()[0],
    queryKeys.operationsRegistry.all[0],
  );
  assert.deepEqual(queryKeys.operationsRegistry.leadSources(), [
    "operations-registry",
    "lead-sources",
  ]);
  assert.deepEqual(queryKeys.operationsRegistry.leadSourceDetail("ls1"), [
    "operations-registry",
    "lead-sources",
    "detail",
    "ls1",
  ]);
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
  assert.deepEqual(queryKeys.granotAutomation.runGroup("group-1"), [
    "granot-automation",
    "run-groups",
    "group-1",
  ]);
  assert.deepEqual(queryKeys.granotAutomation.run("run-1"), [
    "granot-automation",
    "runs",
    "detail",
    "run-1",
  ]);
});

test("[AC-20] Granot lifecycle keys isolate stable case, candidate, Job, and Lead reads", () => {
  const first = queryKeys.granotLifecycle.cases({ state: "open", cursor: "opaque", q: "" });
  const second = queryKeys.granotLifecycle.cases({ q: "", cursor: "opaque", state: "open" });
  assert.deepEqual(first, second);
  assert.deepEqual(first, ["granot-lifecycle", "cases", { cursor: "opaque", state: "open" }]);
  assert.deepEqual(queryKeys.granotLifecycle.caseDetail("case-1"), [
    "granot-lifecycle", "cases", "detail", "case-1",
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.creatingObservation("case-1"), [
    "granot-lifecycle", "cases", "case-1", "creating-observation",
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.candidates("case-1", { scope: "source" }), [
    "granot-lifecycle", "cases", "case-1", "candidates", { scope: "source" },
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.jobTimeline("JOB 1", { limit: 100 }), [
    "granot-lifecycle", "jobs", "JOB 1", "timeline", { limit: 100 },
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.leadTimeline("FormLead", "lead-1"), [
    "granot-lifecycle", "leads", "FormLead", "lead-1", "timeline", {},
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.discrepancies(), [
    "granot-lifecycle", "discrepancies", {},
  ]);
  assert.deepEqual(queryKeys.granotLifecycle.health(), ["granot-lifecycle", "health"]);
  const receiptsFirst = queryKeys.granotLifecycle.receipts({
    job_no: "P5562401",
    route_event_class: "booking_status_changed",
    empty: "",
  });
  const receiptsSecond = queryKeys.granotLifecycle.receipts({
    empty: "",
    route_event_class: "booking_status_changed",
    job_no: "P5562401",
  });
  assert.deepEqual(receiptsFirst, receiptsSecond);
  assert.deepEqual(receiptsFirst, [
    "granot-lifecycle",
    "receipts",
    { job_no: "P5562401", route_event_class: "booking_status_changed" },
  ]);
});

test("Job Number timeline keys live in their own namespace", () => {
  const first = queryKeys.jobNumberTimeline.page("5562924", {
    source_granularity_id: "g1",
    empty: "",
  });
  const second = queryKeys.jobNumberTimeline.page("5562924", {
    empty: "",
    source_granularity_id: "g1",
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first, [
    "job-number-timeline",
    "page",
    "5562924",
    { source_granularity_id: "g1" },
  ]);
  assert.equal(queryKeys.jobNumberTimeline.all[0], "job-number-timeline");
  assert.notEqual(queryKeys.jobNumberTimeline.all[0], queryKeys.granotLifecycle.all[0]);
  assert.deepEqual(queryKeys.jobNumberTimeline.recentOfficialBookings(), [
    "job-number-timeline",
    "recent-official-bookings",
  ]);
  assert.equal(JSON.stringify(first).includes("view"), false);
});

test("Lead Conversation keys isolate list and detail and never cache an audio URL", () => {
  assert.deepEqual(queryKeys.conversations.list(), ["conversations", "list"]);
  assert.deepEqual(queryKeys.conversations.detail("6a905b5cf7dda52cfacb721e"), [
    "conversations",
    "detail",
    "6a905b5cf7dda52cfacb721e",
  ]);
  assert.equal(queryKeys.conversations.all[0], "conversations");
  assert.equal("audio" in queryKeys.conversations, false);
});

test("Extension User keys isolate the list", () => {
  assert.deepEqual(queryKeys.extensionUsers.list(), ["extension-users", "list"]);
  assert.equal(queryKeys.extensionUsers.all[0], "extension-users");
});
