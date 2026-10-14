import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { estimatesFreshnessSchema } from "../lib/api/granotAutomation";
import { EstimatesFreshnessView } from "../components/automations/estimates-freshness";

const observed = "2026-10-14T17:00:00.000Z";
const lane = {
  observed_at: observed,
  last_complete_coverage_at: null,
  latest_expected_slot: "2026-10-14:13",
  latest_slot: {
    _id: "pool-refresh-2026-10-14-13",
    expected_windows: 20, discovered_windows: 20, collected_windows: 17,
    completed_windows: 16, failed_windows: 1, latest_collection_at: observed, created_at: observed,
  },
  warnings: ["partial_scan", "failed_windows", "held_rows"],
  older_scope: "remembered_pool_months", coverage_limit: "declared_scope",
  oldest_uncovered_range: { from: "2020-01-01", to: "2020-01-31" },
  held_rows: 3, lag_ms: 7_200_000,
};

test("Automations exposes independent Pool lanes with incomplete scope, held rows and collection lag", () => {
  const input = { ...lane, last_complete_coverage_at: observed, warnings: [], pool_lanes: { refresh: lane, discovery: { ...lane, latest_slot: null } } };
  const data = estimatesFreshnessSchema.parse(input);
  assert.deepEqual(data, input);
  const html = renderToStaticMarkup(createElement(EstimatesFreshnessView, { data, failed: false }));
  assert.match(html, /Pool refresh/);
  assert.match(html, /Pool historical discovery/);
  assert.match(html, /17 of 20 date ranges collected/);
  assert.match(html, /Oldest uncovered range: 2020-01-01 through 2020-01-31/);
  assert.match(html, /3 rows held for review/);
  assert.match(html, /Collection lag: 120 minutes/);
  assert.match(html, /incomplete or delayed/);
  assert.match(html, /An absent Pool row does not prove a Lead left Pool/);
  assert.match(html, /January 1, 2020/);
  assert.match(html, /No complete collection recorded yet/);
});

test("an older server retains the ALL freshness view and read failures stay explicit", () => {
  const data = estimatesFreshnessSchema.parse(lane);
  assert.equal(data.pool_lanes, undefined);
  const html = renderToStaticMarkup(createElement(EstimatesFreshnessView, { data, failed: false }));
  assert.doesNotMatch(html, /Pool refresh/);
  const failed = renderToStaticMarkup(createElement(EstimatesFreshnessView, { failed: true }));
  assert.match(failed, /could not load/);
  assert.doesNotMatch(failed, /No complete collection recorded yet/);
});
