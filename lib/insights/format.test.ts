import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsMetric } from "@/lib/api/insights";
import {
  bucketLabel,
  coverageNote,
  deltaView,
  formatDayKey,
  formatMetricValue,
  formatMonthKey,
  periodCaption,
  rankChangeView,
  signedDifference,
  wasLine,
} from "./format";

const metric = (patch: Partial<InsightsMetric>): InsightsMetric => ({
  value: 231,
  comparison_value: 196,
  delta: 35,
  delta_pct: 35 / 196,
  kind: "count",
  better: "up",
  tone: "good",
  small_base: false,
  ...patch,
});

test("formatMetricValue speaks each kind", () => {
  assert.equal(formatMetricValue(1740, "count"), "1,740");
  assert.equal(formatMetricValue(82410.4, "money"), "$82,410");
  assert.equal(formatMetricValue(0.134, "rate"), "13.4%");
  assert.equal(formatMetricValue(0.874, "ratio"), "0.87×");
  assert.equal(formatMetricValue(4.53, "ratio", { ratio: "plain" }), "4.5");
  assert.equal(formatMetricValue(1, "days"), "1 day");
  assert.equal(formatMetricValue(2.5, "days"), "2.5 days");
  assert.equal(formatMetricValue(null, "money"), "—");
  assert.equal(formatMetricValue(Number.NaN, "count"), "—");
});

test("deltaView shows % for counts, coloured by tone not direction", () => {
  const up = deltaView(metric({}));
  assert.deepEqual([up?.direction, up?.tone, up?.text, up?.mode], ["up", "good", "18%", "pct"]);
  const costUp = deltaView(metric({ kind: "money", value: 453, comparison_value: 412, delta: 41, delta_pct: 41 / 412, better: "down", tone: "bad" }));
  assert.equal(costUp?.direction, "up");
  assert.equal(costUp?.tone, "bad");
  assert.equal(costUp?.text, "10%");
  const small = deltaView(metric({ value: 4, comparison_value: 1, delta: 3, delta_pct: 0.031 }));
  assert.equal(small?.text, "3.1%");
});

test("deltaView shows points for rates and never a percent of a percent", () => {
  const view = deltaView(metric({ kind: "rate", value: 0.134, comparison_value: 0.122, delta: 0.012, delta_pct: null }));
  assert.equal(view?.mode, "pts");
  assert.equal(view?.text, "1.2 pts");
  const flat = deltaView(metric({ kind: "rate", value: 0.1, comparison_value: 0.1, delta: 0, delta_pct: null, tone: "bad" }));
  assert.equal(flat?.direction, "even");
  assert.equal(flat?.tone, "neutral");
});

test("deltaView falls back to the raw comparison on a small base or a missing percent", () => {
  const small = deltaView(metric({ value: 7, comparison_value: 3, delta: 4, delta_pct: null, small_base: true }));
  assert.equal(small?.mode, "was");
  assert.equal(small?.text, "was 3");
  const fromZero = deltaView(metric({ value: 40, comparison_value: 0, delta: 40, delta_pct: null }));
  assert.equal(fromZero?.text, "was 0");
  assert.equal(deltaView(metric({ comparison_value: null })), null);
  assert.equal(deltaView(null), null);
});

test("signedDifference and wasLine", () => {
  assert.equal(signedDifference(metric({})), "+35");
  assert.equal(signedDifference(metric({ kind: "money", value: 412, comparison_value: 453, delta: -41 })), "−$41");
  assert.equal(signedDifference(metric({ kind: "rate", value: 0.134, comparison_value: 0.122, delta: 0.012 })), "+1.2 pts");
  assert.equal(wasLine(metric({})), "was 196 · +35");
  assert.equal(wasLine(metric({ kind: "rate", value: 0.134, comparison_value: 0.122, delta: 0.012 })), "was 12.2%");
  assert.equal(wasLine(metric({ comparison_value: null })), null);
});

test("rankChangeView: up, down, same, new", () => {
  assert.equal(rankChangeView({ rank_change: 2, is_new: false })?.text, "▲2");
  assert.equal(rankChangeView({ rank_change: -1, is_new: false })?.text, "▼1");
  assert.equal(rankChangeView({ rank_change: 0, is_new: false })?.kind, "even");
  assert.equal(rankChangeView({ rank_change: null, is_new: true })?.text, "new");
  assert.equal(rankChangeView({ rank_change: 3, is_new: false }, false), null);
});

test("day keys format without a time-zone shift", () => {
  assert.equal(formatDayKey("2026-09-07"), "Sep 7");
  assert.equal(formatDayKey("2026-04-30", true), "Apr 30, 2026");
  assert.equal(formatDayKey("bad"), "—");
  assert.equal(bucketLabel("2026-09-07", "week"), "Wk of Sep 7");
  assert.equal(formatMonthKey("2025-07"), "Jul 2025");
});

test("periodCaption and coverageNote", () => {
  assert.equal(periodCaption({ label: "Sep 7 – Oct 6, 2026" }, { label: "Aug 8 – Sep 6, 2026" }), "Sep 7 – Oct 6, 2026 · vs Aug 8 – Sep 6, 2026");
  assert.equal(periodCaption({ label: "Sep 7 – Oct 6, 2026" }, null), "Sep 7 – Oct 6, 2026 · no comparison");
  assert.equal(coverageNote({ coverage: "full", mode: "previous" }), null);
  assert.equal(coverageNote({ coverage: "partial", mode: "last_year" }), "Same period last year has no data before Apr 30, 2026, so it is only partly covered.");
  assert.match(coverageNote({ coverage: "none", mode: "last_year" }) ?? "", /has no data: records start Apr 30, 2026/);
  assert.equal(coverageNote(null), null);
});

test("rankChangeView: an unranked row that is not new shows no chip", () => {
  assert.equal(rankChangeView({ rank_change: null, is_new: false }), null);
  assert.equal(rankChangeView({ rank_change: null, is_new: true })?.text, "new");
});
