import assert from "node:assert/strict";
import test from "node:test";
import {
  attentionPreviousCursor,
  decodeAttentionCursor,
  encodeAttentionCursor,
  LIST_PAGE_SIZE,
  numberNextPage,
  numberPageOffset,
  numberPreviousPage,
  pageWindow,
} from "../../components/sales-intelligence/lib/paging";

const page = { snapshot_id: "outreach:abc", offset: 200, digest: "digest-1" };

test("attention cursors round-trip in the server's base64url form", () => {
  const encoded = encodeAttentionCursor(page);
  assert.equal(encoded, Buffer.from(JSON.stringify(page)).toString("base64url"));
  assert.deepEqual(decodeAttentionCursor(encoded), page);
  assert.equal(decodeAttentionCursor(null), null);
  assert.equal(decodeAttentionCursor("not-a-cursor"), null);
});

test("previous stays on the same attention snapshot, including the first page", () => {
  const encoded = encodeAttentionCursor(page);
  const back = attentionPreviousCursor(encoded);
  assert.deepEqual(decodeAttentionCursor(back), { ...page, offset: 100 });
  const first = attentionPreviousCursor(back);
  assert.deepEqual(decodeAttentionCursor(first), { ...page, offset: 0 });
  assert.equal(attentionPreviousCursor(first), null);
  assert.equal(attentionPreviousCursor(null), null);
  assert.equal(LIST_PAGE_SIZE, 100);
});

test("a page window is the rows on this page, and number paging walks a cursor stack", () => {
  assert.deepEqual(pageWindow(0, 100), { start: 1, end: 100 });
  assert.deepEqual(pageWindow(100, 40), { start: 101, end: 140 });
  assert.equal(pageWindow(0, 0), null);
  assert.equal(numberPageOffset(0, false), 0);
  assert.equal(numberPageOffset(0, true), 100);
  assert.equal(numberPageOffset(1, true), 200);
  const second = numberNextPage([], null, "c1");
  assert.deepEqual(second, { cursor: "c1", before: [] });
  const third = numberNextPage(second.before, second.cursor, "c2");
  assert.deepEqual(third, { cursor: "c2", before: ["c1"] });
  assert.deepEqual(numberPreviousPage(third.before), { cursor: "c1", before: [] });
  assert.deepEqual(numberPreviousPage([]), { cursor: null, before: [] });
});
