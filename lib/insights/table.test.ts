import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsMetric, InsightsRow } from "@/lib/api/insights";
import { barShare, columnMax, csvCell, csvFileName, leaderboard, nextSort, rowsToCsv, sortRows } from "./table";

const m = (value: number | null, comparison: number | null = null, kind: InsightsMetric["kind"] = "count"): InsightsMetric => ({
  value,
  comparison_value: comparison,
  delta: value !== null && comparison !== null ? value - comparison : null,
  delta_pct: null,
  kind,
  better: "up",
  tone: "neutral",
  small_base: false,
});

const row = (key: string, rank: number, metrics: Record<string, InsightsMetric>, patch: Partial<InsightsRow> = {}): InsightsRow => ({
  key,
  label: key.toUpperCase(),
  rank,
  rank_change: 0,
  is_new: false,
  metrics,
  ...patch,
});

const rows: InsightsRow[] = [
  row("a", 1, { leads: m(100, 80), booked: m(5, 9), rate: m(0.05, 0.1, "rate") }),
  row("ref", 4, { leads: m(0), booked: m(30) }, { notes: { pseudo: true } }),
  row("b", 2, { leads: m(60, 90), booked: m(12, 4), rate: m(0.2, 0.04, "rate") }, {
    children: [row("b2", 2, { leads: m(10) }), row("b1", 1, { leads: m(50) })],
  }),
  row("c", 3, { leads: m(10, null), booked: m(1, null), rate: m(null) }),
];

test("sortRows keeps pseudo rows at the bottom and missing values last", () => {
  assert.deepEqual(sortRows(rows, null).map((r) => r.key), ["a", "b", "c", "ref"]);
  assert.deepEqual(sortRows(rows, { key: "booked", dir: "desc" }).map((r) => r.key), ["b", "a", "c", "ref"]);
  assert.deepEqual(sortRows(rows, { key: "booked", dir: "asc" }).map((r) => r.key), ["c", "a", "b", "ref"]);
  assert.deepEqual(sortRows(rows, { key: "rate", dir: "asc" }).map((r) => r.key), ["a", "b", "c", "ref"]);
  assert.deepEqual(sortRows(rows, { key: "label", dir: "desc" }).map((r) => r.key), ["c", "b", "a", "ref"]);
  const b = sortRows(rows, { key: "leads", dir: "desc" }).find((r) => r.key === "b");
  assert.deepEqual(b?.children?.map((r) => r.key), ["b1", "b2"]);
});

test("nextSort cycles desc → asc → rank", () => {
  assert.deepEqual(nextSort(null, "leads"), { key: "leads", dir: "desc" });
  assert.deepEqual(nextSort({ key: "leads", dir: "desc" }, "leads"), { key: "leads", dir: "asc" });
  assert.equal(nextSort({ key: "leads", dir: "asc" }, "leads"), null);
  assert.deepEqual(nextSort({ key: "leads", dir: "asc" }, "label"), { key: "label", dir: "asc" });
});

test("columnMax ignores pinned rows; barShare is capped", () => {
  assert.equal(columnMax(rows, "booked"), 12);
  assert.equal(barShare(6, 12), 0.5);
  assert.equal(barShare(20, 12), 1);
  assert.equal(barShare(null, 12), 0);
  assert.equal(barShare(5, 0), 0);
});

test("leaderboard ranks by one metric with rank change against that metric", () => {
  const top = leaderboard(rows, "booked", 5);
  assert.deepEqual(top.map((entry) => [entry.row.key, entry.rank, entry.rankChange]), [
    ["b", 1, 1],
    ["a", 2, -1],
    ["c", 3, null],
  ]);
  assert.equal(leaderboard(rows, "booked", 1).length, 1);
  assert.equal(leaderboard(rows, "booked", 5, false)[0]?.rankChange, null);
});

test("rowsToCsv writes children, comparisons and escapes text", () => {
  const csv = rowsToCsv([rows[2]!, row("x,y", 5, { leads: m(3), rate: m(0.125, 0.1, "rate") })], [{ label: "Leads", metric: "leads" }, { label: "Rate", metric: "rate" }, { label: "Note", value: () => 'say "hi"' }], { withComparison: true });
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Rank,Name,Part of,Leads,Leads before,Rate (%),Rate before (%),Note");
  assert.equal(lines[1], '2,B,,60,90,20,4,"say ""hi"""');
  assert.equal(lines[2], ',B2,B,10,,,,"say ""hi"""');
  assert.equal(lines[4], '5,"X,Y",,3,,12.5,10,"say ""hi"""');
  assert.equal(csvCell(null), "");
  assert.equal(csvFileName("Sources & feeds", { start: "2026-09-07", end: "2026-10-06" }), "vantage-sources-feeds-2026-09-07-to-2026-10-06.csv");
});
