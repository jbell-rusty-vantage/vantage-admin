import assert from "node:assert/strict";
import { test } from "node:test";
import { saveReturnMemory, takeReturnMemory, totalReturnPages, totalReturnRows } from "../../components/sales-intelligence/desk/return-memory";

test("return bookmark is scoped to the exact desk URL and consumed once", () => {
  const items = new Map<string, string>();
  const previous = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  } });
  try {
    const href = "/sales-intelligence?view=closed&sort=closed";
    const memory = { scrollTop: 451, outreachId: "abc", pagesLoaded: 3, rowsLoaded: 125 };
    saveReturnMemory(href, memory);
    assert.equal(takeReturnMemory("/sales-intelligence?view=closed"), null);
    assert.deepEqual(takeReturnMemory(href), memory);
    assert.equal(takeReturnMemory(href), null);
    items.set(`si:return:${href}`, JSON.stringify({ ...memory, pagesLoaded: -1 }));
    assert.equal(takeReturnMemory(href), null);
    const older = { ...memory, pagesLoaded: 1, rowsLoaded: 50, history: { pagesLoaded: 3, rowsLoaded: 101, params: { closed_before: "2026-06-30T00:00:00Z", q: "Jordan" } } };
    saveReturnMemory(href, older);
    const restored = takeReturnMemory(href);
    assert.deepEqual(restored, older);
    assert.equal(totalReturnPages(restored!), 4);
    assert.equal(totalReturnRows(restored!), 151);
    assert.equal(totalReturnPages({ ...older, history: { ...older.history, pagesLoaded: 4 } }), 5);
    assert.equal(totalReturnRows({ ...older, history: { ...older.history, rowsLoaded: 151 } }), 201);
    saveReturnMemory(href, { ...older, rowsLoaded: 0 });
    assert.equal(takeReturnMemory(href)?.history?.pagesLoaded, 3, "older history survives an empty current partition");
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: previous });
  }
});
import { attentionQuery, closedHistoryQuery } from "../../components/sales-intelligence/data/requests";

test("four default Outreach pages stay within the 200-row Back restoration budget", () => {
  assert.equal(Number(attentionQuery({ view: "all_outreach" }).get("limit")) * 4, 200);
  assert.equal(Number(attentionQuery({ view: "closed" }).get("limit")) * 4, 200);
  assert.equal(Number(closedHistoryQuery({}).get("limit")) * 4, 200);
});
