import assert from "node:assert/strict";
import test from "node:test";
import type { InsightsMetric, InsightsRow } from "@/lib/api/insights";
import { niceCeiling, scatterQuadrant, scatterShape } from "./scatter";

const m = (value: number | null): InsightsMetric => ({ value, comparison_value: null, delta: null, delta_pct: null, kind: "count", better: "up", tone: "neutral", small_base: false });

const company = (key: string, leads: number, booked: number, spend: number, notes: InsightsRow["notes"] = {}): InsightsRow => ({
  key,
  label: key,
  rank: 1,
  rank_change: 0,
  is_new: false,
  notes,
  metrics: {
    leads: m(leads),
    booked: m(booked),
    spend: m(spend),
    booking_rate: m(leads ? booked / leads : null),
    cost_per_booking: m(booked ? spend / booked : null),
  },
});

test("scatterShape plots paying and free sources, names the unbooked, skips pseudo and empty rows", () => {
  const shape = scatterShape([
    company("paid", 100, 10, 20_000),
    company("free", 50, 10, 0),
    company("cold", 20, 0, 4_000),
    company("none", 0, 0, 0),
    company("referral", 0, 7, 0, { pseudo: true }),
  ]);
  assert.deepEqual(shape.points.map((point) => [point.key, point.x, point.y, point.free]), [
    ["paid", 0.1, 2000, false],
    ["free", 0.2, 0, true],
  ]);
  assert.deepEqual(shape.notPlotted.map((entry) => entry.key), ["cold"]);
  assert.equal(shape.overallRate, 20 / 170);
  assert.equal(shape.overallCostPerBooking, 24_000 / 20);
});

test("scatterQuadrant: high rate and low cost is buy more", () => {
  const guides = { overallRate: 0.1, overallCostPerBooking: 1000 };
  assert.equal(scatterQuadrant({ x: 0.2, y: 500 }, guides), "buy_more");
  assert.equal(scatterQuadrant({ x: 0.2, y: 1500 }, guides), "costly");
  assert.equal(scatterQuadrant({ x: 0.05, y: 500 }, guides), "watch");
  assert.equal(scatterQuadrant({ x: 0.05, y: 1500 }, guides), "cut");
  assert.equal(scatterQuadrant({ x: 0.05, y: 1500 }, { overallRate: null, overallCostPerBooking: 1 }), null);
});

test("niceCeiling rounds an axis up to a tidy number", () => {
  assert.equal(niceCeiling(2_340), 2_500);
  assert.equal(niceCeiling(0.137, 0.01), 0.2);
  assert.equal(niceCeiling(0, 1), 1);
});
