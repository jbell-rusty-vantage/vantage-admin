import assert from "node:assert/strict";
import test from "node:test";
import { numberNextPage, numberPageOffset, numberPreviousPage, pageWindow } from "../../components/sales-intelligence/lib/paging";

test("a page window is the rows on this page, and number paging walks a cursor stack", () => {
  assert.deepEqual(pageWindow(0, 50), { start: 1, end: 50 });
  assert.deepEqual(pageWindow(50, 40), { start: 51, end: 90 });
  assert.equal(pageWindow(0, 0), null);
  assert.equal(numberPageOffset(0, false, 50), 0);
  assert.equal(numberPageOffset(0, true, 50), 50);
  assert.equal(numberPageOffset(1, true, 50), 100);
  const second = numberNextPage([], null, "c1");
  assert.deepEqual(second, { cursor: "c1", before: [] });
  const third = numberNextPage(second.before, second.cursor, "c2");
  assert.deepEqual(third, { cursor: "c2", before: ["c1"] });
  assert.deepEqual(numberPreviousPage(third.before), { cursor: "c1", before: [] });
  assert.deepEqual(numberPreviousPage([]), { cursor: null, before: [] });
});
