import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAttentionFilters,
  attentionFiltersFromParams,
  attentionQueryString,
  readList,
  toggleValue,
  writeList,
} from "../../components/sales-intelligence/lib/filter-state";

test("filter URL round-trip keeps multi-select and treats empty as all", () => {
  const params = new URLSearchParams();
  writeList(params, "band", ["1", "3"]);
  writeList(params, "state", ["open", "unworked"]);
  assert.equal(params.toString(), "band=1&band=3&state=open&state=unworked");
  assert.deepEqual(readList(params, "band"), ["1", "3"]);
  const parsed = attentionFiltersFromParams(params);
  assert.deepEqual(parsed.bands, ["1", "3"]);
  assert.deepEqual(parsed.states, ["open", "unworked"]);
  assert.equal(parsed.needs_review, false);
  const again = new URLSearchParams();
  applyAttentionFilters(again, parsed);
  assert.equal(again.toString(), "band=1&band=3&state=open&state=unworked");
  assert.equal(attentionQueryString({ bands: [], needs_review: false, states: [], agent_ids: [] }, null), "limit=100");
  assert.match(attentionQueryString(parsed, null), /band=1&band=3/);
  assert.deepEqual(toggleValue(["1"], "3"), ["1", "3"]);
  assert.deepEqual(toggleValue(["1", "3"], "1"), ["3"]);
});
