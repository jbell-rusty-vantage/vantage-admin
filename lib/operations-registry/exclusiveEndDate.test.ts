import assert from "node:assert/strict";
import test from "node:test";
import { exclusiveEndDate } from "./exclusiveEndDate";

test("exclusiveEndDate advances date-only inputs by one day", () => {
  assert.equal(exclusiveEndDate("2026-06-12"), "2026-06-13");
  assert.equal(exclusiveEndDate("2026-12-31"), "2027-01-01");
  assert.equal(exclusiveEndDate("2026-06-12T15:30:00.000Z"), "2026-06-12T15:30:00.000Z");
  assert.equal(exclusiveEndDate(undefined), undefined);
});
