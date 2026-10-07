import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsMetric, InsightsRow } from "@/lib/api/insights";
import { compareColor, compareMetricRows, compareSeriesRows, selectedEntities, toggleCompareKey, topCompareKeys } from "./compare";

const m = (value: number | null, better: InsightsMetric["better"] = "up", kind: InsightsMetric["kind"] = "count"): InsightsMetric => ({
  value,
  comparison_value: null,
  delta: null,
  delta_pct: null,
  kind,
  better,
  tone: "neutral",
  small_base: false,
});

const row = (key: string, rank: number, metrics: Record<string, InsightsMetric>, patch: Partial<InsightsRow> = {}): InsightsRow => ({
  key,
  label: key,
  rank,
  rank_change: 0,
  is_new: false,
  metrics,
  ...patch,
});

test("toggleCompareKey adds, removes and refuses a fifth", () => {
  assert.deepEqual(toggleCompareKey([], "a"), { keys: ["a"], refused: false });
  assert.deepEqual(toggleCompareKey(["a", "b"], "a"), { keys: ["b"], refused: false });
  assert.deepEqual(toggleCompareKey(["a", "b", "c", "d"], "e"), { keys: ["a", "b", "c", "d"], refused: true });
});

test("topCompareKeys skips pseudo and unassigned rows", () => {
  const rows = [row("ref", 1, {}, { notes: { pseudo: true } }), row("b", 3, {}), row("a", 2, {}), row("u", 4, {}, { notes: { unassigned: true } }), row("c", 5, {})];
  assert.deepEqual(topCompareKeys(rows), ["a", "b", "c"]);
  assert.deepEqual(selectedEntities(rows, ["c", "missing", "a"]).map((r) => r.key), ["c", "a"]);
});

test("compareMetricRows shares one scale and marks the best by direction", () => {
  const entities = [
    row("a", 1, { leads: m(100), cost: m(400, "down", "money"), spend: m(10, "none", "money") }),
    row("b", 2, { leads: m(50), cost: m(200, "down", "money"), spend: m(20, "none", "money") }),
    row("c", 3, { leads: m(null), cost: m(null, "down", "money"), spend: m(20, "none", "money") }),
  ];
  const [leads, cost, spend] = compareMetricRows(entities, [
    { key: "leads", label: "Leads" },
    { key: "cost", label: "Cost/booking" },
    { key: "spend", label: "Spend" },
  ]);
  assert.deepEqual(leads?.cells.map((cell) => [cell.share, cell.best, cell.display]), [
    [1, true, "100"],
    [0.5, false, "50"],
    [0, false, "—"],
  ]);
  assert.deepEqual(cost?.cells.map((cell) => cell.best), [false, true, false]);
  assert.equal(cost?.kind, "money");
  assert.deepEqual(spend?.cells.map((cell) => cell.best), [false, false, false]);
});

test("compareSeriesRows overlays series by day", () => {
  const entities = [
    row("a", 1, {}, { series: [{ day: "2026-09-02", value: 3, secondary: 1 }, { day: "2026-09-01", value: 2 }] }),
    row("b", 2, {}, { series: [{ day: "2026-09-01", value: 5, secondary: 2 }] }),
  ];
  assert.deepEqual(compareSeriesRows(entities, "value"), [
    { day: "2026-09-01", a: 2, b: 5 },
    { day: "2026-09-02", a: 3, b: null },
  ]);
  assert.deepEqual(compareSeriesRows(entities, "secondary")[0], { day: "2026-09-01", a: 0, b: 2 });
});

test("compareColor is stable per position", () => {
  assert.equal(compareColor(0), "#2a78d6");
  assert.equal(compareColor(4), compareColor(0));
});
