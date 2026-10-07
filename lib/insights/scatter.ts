/**
 * The Sources scatter (doc 09: "the single best visual for this decision"): booking rate (x) against cost per
 * booking (y), bubble size = spend, one bubble per source company. High rate and low cost (bottom right) is where to
 * buy more. Pure shaping; the chart is `components/insights/analytics/source-scatter.tsx`.
 */
import type { InsightsRow } from "@/lib/api/insights";
import { isPinnedRow, metricNumber } from "./table";

export type ScatterPoint = {
  key: string;
  label: string;
  /** Booking rate 0–1. */
  x: number;
  /** Cost per booking in dollars; 0 for a free source. */
  y: number;
  spend: number;
  leads: number;
  booked: number;
  /** $0 lead cost: sits on the floor and is labelled "free". */
  free: boolean;
};

export type ScatterShape = {
  points: ScatterPoint[];
  /** Sources with leads but no booking yet: no cost per booking to plot, so they are named under the chart. */
  notPlotted: Array<{ key: string; label: string; leads: number; spend: number }>;
  /** The guides: overall booking rate and cost per booking across every plotted and unplotted source. */
  overallRate: number | null;
  overallCostPerBooking: number | null;
};

/**
 * Plotted: source companies (no Referrals / No lead) with at least one lead and one booking. Uses the cohort
 * metrics (`booked`, `booking_rate`, `cost_per_booking`, `spend`).
 */
export function scatterShape(companies: readonly InsightsRow[]): ScatterShape {
  const points: ScatterPoint[] = [];
  const notPlotted: ScatterShape["notPlotted"] = [];
  let leadsTotal = 0;
  let bookedTotal = 0;
  let spendTotal = 0;
  for (const row of companies) {
    if (isPinnedRow(row)) continue;
    const leads = metricNumber(row, "leads") ?? 0;
    if (leads <= 0) continue;
    const booked = metricNumber(row, "booked") ?? 0;
    const spend = metricNumber(row, "spend") ?? 0;
    leadsTotal += leads;
    bookedTotal += booked;
    spendTotal += spend;
    if (booked <= 0) {
      notPlotted.push({ key: row.key, label: row.label, leads, spend });
      continue;
    }
    const rate = metricNumber(row, "booking_rate") ?? booked / leads;
    const cost = metricNumber(row, "cost_per_booking") ?? spend / booked;
    points.push({ key: row.key, label: row.label, x: rate, y: Math.max(0, cost), spend, leads, booked, free: spend <= 0 });
  }
  return {
    points,
    notPlotted,
    overallRate: leadsTotal > 0 ? bookedTotal / leadsTotal : null,
    overallCostPerBooking: bookedTotal > 0 ? spendTotal / bookedTotal : null,
  };
}

/** Which quadrant a point sits in against the guides; "buy_more" = higher rate and lower cost than overall. */
export function scatterQuadrant(point: Pick<ScatterPoint, "x" | "y">, shape: Pick<ScatterShape, "overallRate" | "overallCostPerBooking">): "buy_more" | "watch" | "costly" | "cut" | null {
  if (shape.overallRate === null || shape.overallCostPerBooking === null) return null;
  const highRate = point.x >= shape.overallRate;
  const lowCost = point.y <= shape.overallCostPerBooking;
  if (highRate && lowCost) return "buy_more";
  if (highRate) return "costly";
  if (lowCost) return "watch";
  return "cut";
}

/** A tidy upper bound for an axis (1, 2, 2.5, 5 × 10^n), at least `floor`. */
export function niceCeiling(value: number, floor = 1): number {
  const target = Math.max(value, floor);
  const power = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= target) return step * power;
  }
  return 10 * power;
}
