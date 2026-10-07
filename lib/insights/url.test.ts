import assert from "node:assert/strict";
import test from "node:test";
import { analyticsSearch, parseAnalyticsUrl, parseCompareKeys, patchAnalyticsState } from "./url";

const params = (text: string) => new URLSearchParams(text);

test("defaults: Last 30 days vs Previous period on Overview", () => {
  const state = parseAnalyticsUrl(params(""));
  assert.equal(state.query.period, "last_30");
  assert.equal(state.query.compare, "previous");
  assert.equal(state.tab, "overview");
  assert.equal(state.basis, "cohort");
  assert.deepEqual(state.cmp, []);
  assert.equal(analyticsSearch(state), "?period=last_30&compare=previous");
});

test("parseCompareKeys trims, de-duplicates and caps at four", () => {
  assert.deepEqual(parseCompareKeys(" a,b,,a,c,d,e"), ["a", "b", "c", "d"]);
  assert.deepEqual(parseCompareKeys(null), []);
});

test("round trip keeps tab, basis, sources and the selection", () => {
  const state = parseAnalyticsUrl(params("period=custom&from=2026-09-01&to=2026-09-30&compare=last_year&sources=top10,tbm&tab=sources&basis=activity&cmp=top10,tbm"));
  assert.equal(state.query.period, "custom");
  assert.deepEqual(state.query.sources, ["top10", "tbm"]);
  assert.equal(state.tab, "sources");
  assert.equal(state.basis, "activity");
  assert.deepEqual(state.cmp, ["top10", "tbm"]);
  assert.equal(
    analyticsSearch(state),
    "?period=custom&compare=last_year&from=2026-09-01&to=2026-09-30&sources=top10,tbm&tab=sources&basis=activity&cmp=top10,tbm",
  );
});

test("unknown tab falls back to Overview; changing tab clears the selection", () => {
  const state = parseAnalyticsUrl(params("tab=geography&cmp=a,b"));
  assert.equal(state.tab, "overview");
  const next = patchAnalyticsState({ ...state, tab: "sources" }, { tab: "team" });
  assert.deepEqual(next.cmp, []);
  assert.deepEqual(patchAnalyticsState(state, { cmp: ["x"] }).cmp, ["x"]);
});
