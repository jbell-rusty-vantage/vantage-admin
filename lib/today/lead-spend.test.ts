import assert from "node:assert/strict";
import test from "node:test";
import { cumulativeByHour, isForbidden, spendPace, topSpendSources } from "./lead-spend";
import type { InsightsLeadSpendDay } from "../api/insights";

test("spendPace compares with yesterday by now", () => {
  assert.equal(spendPace({ today: 112, yesterday_by_now: 100 }).label, "12 % vs yesterday by now");
  assert.equal(spendPace({ today: 112, yesterday_by_now: 100 }).direction, "up");
  assert.equal(spendPace({ today: 50, yesterday_by_now: 100 }).direction, "down");
  assert.equal(spendPace({ today: 5, yesterday_by_now: 0 }).pct, null);
});

test("cumulativeByHour leaves the future empty", () => {
  const out = cumulativeByHour([1, 2, 3, 4], 1);
  assert.deepEqual(out.slice(0, 3), [1, 3, null]);
  assert.equal(out.length, 24);
});

test("topSpendSources sorts by spend", () => {
  const day = { by_company: [{ key: "a", label: "A", leads: 3, spend: 0, cpl_label: "$0" }, { key: "b", label: "B", leads: 1, spend: 9, cpl_label: "$9" }] } as unknown as InsightsLeadSpendDay;
  assert.equal(topSpendSources(day)[0].key, "b");
});

test("isForbidden reads status 403", () => {
  assert.equal(isForbidden({ status: 403 }), true);
  assert.equal(isForbidden(new Error("x")), false);
});
