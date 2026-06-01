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
  ]);
});
