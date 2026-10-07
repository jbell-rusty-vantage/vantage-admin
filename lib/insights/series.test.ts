import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsSeriesPoint } from "@/lib/api/insights";
import { alignSeries, isEmptySeries, scorecardSparkline, seriesTotal } from "./series";

const point = (day: string, patch: Partial<InsightsSeriesPoint> = {}): InsightsSeriesPoint => ({ day, leads: 0, bookings: 0, spend: 0, binder: 0, deposits: 0, cancellations: 0, ...patch });

const current = [point("2026-09-07", { leads: 10, bookings: 2, spend: 1000 }), point("2026-09-08", { leads: 5, bookings: 0, spend: 500 })];
const comparison = [point("2026-08-08", { leads: 8, bookings: 1, spend: 800 })];

test("alignSeries pairs day 1 with day 1 by index", () => {
  assert.deepEqual(alignSeries(current, comparison, "leads"), [
    { index: 0, day: "2026-09-07", comparisonDay: "2026-08-08", current: 10, comparison: 8, partial: null, inProgress: false },
    { index: 1, day: "2026-09-08", comparisonDay: null, current: 5, comparison: null, partial: null, inProgress: false },
  ]);
  assert.deepEqual(alignSeries(undefined, undefined, "leads"), []);
});

test("seriesTotal and isEmptySeries", () => {
  assert.equal(seriesTotal(current, "spend"), 1500);
  assert.equal(isEmptySeries(current, "cancellations"), true);
  assert.equal(isEmptySeries(current, "leads"), false);
});

test("scorecardSparkline derives ratios per bucket and leaves undefined ones empty", () => {
  const rate = scorecardSparkline({ current, comparison }, "booking_rate");
  assert.deepEqual(rate, [
    { index: 0, current: 0.2, comparison: 0.125 },
    { index: 1, current: 0, comparison: null },
  ]);
  assert.equal(scorecardSparkline({ current, comparison }, "cost_per_booking")?.[1]?.current, null);
  assert.equal(scorecardSparkline({ current, comparison }, "duplicates"), null);
  assert.equal(scorecardSparkline({ current: [], comparison: [] }, "leads"), null);
});

test("alignSeries draws the still-moving last bucket apart (partial) when the period includes today", () => {
  const rows = alignSeries([point("2026-10-04", { leads: 10 }), point("2026-10-05", { leads: 12 }), point("2026-10-06", { leads: 3 })], [], "leads", { partialLast: true });
  assert.deepEqual(
    rows.map((row) => [row.current, row.partial, row.inProgress]),
    [
      [10, null, false],
      [12, 12, false],
      [null, 3, true],
    ],
  );
});
