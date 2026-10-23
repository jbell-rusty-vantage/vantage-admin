import assert from "node:assert/strict";
import test from "node:test";
import { fetchDailyLeadSpend, fetchDailyLeadSpendSummary } from "./insights";
test("Daily Operations cached spend keeps the existing envelope; Pulse path remains unchanged", async () => {
  const original = globalThis.fetch;
  const paths: string[] = [];
  const data = { generated_at: "2026-10-23T20:00:00Z", today: "2026-10-23", spend: { today: 42 } };
  globalThis.fetch = (async input => { paths.push(String(input)); return Response.json({ ok: true, data }); }) as typeof fetch;
  try {
    assert.deepEqual(await fetchDailyLeadSpend(), data);
    assert.deepEqual(await fetchDailyLeadSpendSummary(), data);
    assert.deepEqual(paths, ["/api/proxy/api/v1/admin/daily-operations/lead-spend", "/api/proxy/api/v1/admin/daily-operations/lead-spend-summary"]);
  } finally { globalThis.fetch = original; }
});
