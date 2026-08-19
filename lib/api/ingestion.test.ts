import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchIngestionConflicts,
  fetchIngestionRuns,
  asIngestionList,
} from "./ingestion";

type FetchCall = { input: string | URL | Request };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push({ input });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

const run = {
  _id: "run-1",
  trigger: "manual",
  status: "completed",
  createdAt: "2026-08-18T12:00:00.000Z",
};

const conflict = {
  _id: "conflict-1",
  type: "ambiguous_lead_match",
  severity: "warning",
  status: "open",
  dataset_key: "leads",
  createdAt: "2026-08-18T12:00:00.000Z",
};

test("asIngestionList keeps a bare array and refuses a page object for .map", () => {
  assert.deepEqual(asIngestionList([run]), [run]);
  assert.deepEqual(asIngestionList({ items: [run] }), [run]);
  assert.deepEqual(asIngestionList({ runs: [run] }), [run]);
  assert.deepEqual(asIngestionList({ conflicts: [conflict] }), [conflict]);
  assert.deepEqual(asIngestionList({ ok: true, data: [run] }), [run]);
  assert.deepEqual(asIngestionList({ ok: true, data: { items: [run] } }), [run]);
  assert.deepEqual(asIngestionList({ next_cursor: null }), []);
  assert.ok(Array.isArray(asIngestionList({ next_cursor: null })));
  assert.doesNotThrow(() => asIngestionList({ next_cursor: null }).map((item) => item));
});

test("run history unwraps a nested proxy envelope or items page without throwing on .map", async () => {
  mockFetch({
    ok: true,
    data: { ok: true, data: { items: [run], next_cursor: null } },
  });
  const nested = await fetchIngestionRuns();
  assert.deepEqual(nested, [run]);
  assert.doesNotThrow(() => nested.map((item) => item._id));

  mockFetch({
    ok: true,
    data: { runs: [run] },
  });
  const aliased = await fetchIngestionRuns();
  assert.deepEqual(aliased, [run]);
});

test("open conflicts unwrap a page object so the dashboard can map rows", async () => {
  mockFetch({
    ok: true,
    data: { items: [conflict] },
  });
  const rows = await fetchIngestionConflicts();
  assert.deepEqual(rows, [conflict]);
  assert.doesNotThrow(() => rows.map((item) => item._id));
});
