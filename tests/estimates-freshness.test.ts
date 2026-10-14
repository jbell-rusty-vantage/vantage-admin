import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EstimatesFreshnessView } from "../components/automations/estimates-freshness";
import { fetchEstimatesFreshness, type EstimatesFreshness } from "../lib/api/granotAutomation";

const data: EstimatesFreshness = {
  observed_at: "2026-10-14T17:00:00Z", last_complete_coverage_at: null,
  latest_slot: { _id: "private-slot", expected_windows: 13, discovered_windows: 13, collected_windows: 3, completed_windows: 2, failed_windows: 1, latest_collection_at: "2026-10-14T16:58:00Z", created_at: "2026-10-14T12:00:00Z" },
  warnings: ["partial_scan", "failed_windows"], older_scope: "all_observed_provider_open_date_months", coverage_limit: "Unknown historical dates are uncovered.",
};

test("scheduled freshness distinguishes collection, processing and delayed/failed scope", () => {
  const html = renderToStaticMarkup(createElement(EstimatesFreshnessView, { data, failed: false }));
  assert.match(html, /3 of 13 date ranges collected/);
  assert.match(html, /2 finished processing/);
  assert.match(html, /Some date ranges failed/);
  assert.match(html, /No complete scheduled collection recorded yet/);
  assert.doesNotMatch(html, /private-slot|partial_scan|failed_windows/);
  const failed = renderToStaticMarkup(createElement(EstimatesFreshnessView, { failed: true }));
  assert.match(failed, /could not load/);
  assert.doesNotMatch(failed, /Last complete collection/);
  const held = renderToStaticMarkup(createElement(EstimatesFreshnessView, { data: { ...data, warnings: ["held_rows"] }, failed: false }));
  assert.match(held, /could not be matched or need review/);
  assert.doesNotMatch(held, /incomplete or delayed/);
});

test("freshness uses Owner proxy and rejects malformed completeness claims", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => { assert.equal(String(input), "/api/proxy/api/v1/admin/granot-automation/runs/freshness"); return new Response(JSON.stringify({ ok: true, data })); };
    assert.deepEqual(await fetchEstimatesFreshness(), data);
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, data: { ...data, latest_slot: { ...data.latest_slot, expected_windows: "13" } } }));
    await assert.rejects(fetchEstimatesFreshness());
  } finally { globalThis.fetch = original; }
});
