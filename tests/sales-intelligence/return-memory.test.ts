import assert from "node:assert/strict";
import { test } from "node:test";
import { saveReturnMemory, takeReturnMemory } from "../../components/sales-intelligence/desk/return-memory";

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
    const memory = { scrollTop: 451, outreachId: "abc", pagesLoaded: 3 };
    saveReturnMemory(href, memory);
    assert.equal(takeReturnMemory("/sales-intelligence?view=closed"), null);
    assert.deepEqual(takeReturnMemory(href), memory);
    assert.equal(takeReturnMemory(href), null);
    items.set(`si:return:${href}`, JSON.stringify({ ...memory, pagesLoaded: -1 }));
    assert.equal(takeReturnMemory(href), null);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: previous });
  }
});
