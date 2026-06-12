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
