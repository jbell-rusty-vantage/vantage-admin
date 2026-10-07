/**
 * Trend shaping (doc 09 Overview): the current period as a solid line and the comparison as a dashed one, aligned
 * day 1 to day 1 by index (both periods have the same number of buckets). Scorecard sparklines derive ratios per
 * bucket from the same series. Pure.
 */
import type { InsightsScorecardKey, InsightsSeriesPoint } from "@/lib/api/insights";

export type TrendMetric = "leads" | "bookings" | "spend" | "binder" | "deposits" | "cancellations";

export const TREND_METRIC_LABELS: Record<TrendMetric, string> = {
  leads: "Leads",
  bookings: "Bookings",
  spend: "Lead spend",
  binder: "Binder",
  deposits: "Deposits",
  cancellations: "Cancellations",
};

export type AlignedPoint = {
  index: number;
  day: string;
  comparisonDay: string | null;
  current: number | null;
  comparison: number | null;
  /** The still-moving last bucket (and the point before it, to join the line), drawn dotted. */
  partial: number | null;
  /** True on the bucket that is still in progress (today, or this week). */
  inProgress: boolean;
};

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * Index-aligned current and comparison values for one metric. Extra comparison buckets are dropped. With
 * `partialLast` (the period includes today) the last bucket is still filling up: its value moves to `partial`, so the
 * chart draws it dotted instead of a solid line plunging at the end.
 */
export function alignSeries(
  current: readonly InsightsSeriesPoint[] | undefined,
  comparison: readonly InsightsSeriesPoint[] | undefined,
  metric: TrendMetric,
  options: { partialLast?: boolean } = {},
): AlignedPoint[] {
  const now = current ?? [];
  const then = comparison ?? [];
  const last = now.length - 1;
  const split = Boolean(options.partialLast) && now.length >= 2;
  return now.map((point, index) => {
    const value = num(point[metric]);
    return {
      index,
      day: point.day,
      comparisonDay: then[index]?.day ?? null,
      current: split && index === last ? null : value,
      comparison: then[index] ? num(then[index]![metric]) : null,
      partial: split && index >= last - 1 ? value : null,
      inProgress: Boolean(options.partialLast) && index === last,
    };
  });
}

export function seriesTotal(points: readonly InsightsSeriesPoint[] | undefined, metric: TrendMetric): number {
  return (points ?? []).reduce((sum, point) => sum + (num(point[metric]) ?? 0), 0);
}

/** True when the current period has no activity at all for the metric (the chart says so in words). */
export function isEmptySeries(points: readonly InsightsSeriesPoint[] | undefined, metric: TrendMetric): boolean {
  return seriesTotal(points, metric) === 0;
}

const ratio = (top: number, bottom: number): number | null => (bottom > 0 ? top / bottom : null);

/** One bucket's value of a scorecard; null where it is undefined (a ratio with nothing below it) or has no series. */
export function scorecardPointValue(point: InsightsSeriesPoint, key: InsightsScorecardKey): number | null {
  switch (key) {
    case "leads":
      return point.leads;
    case "bookings":
      return point.bookings;
    case "binder":
      return point.binder;
    case "deposits":
      return point.deposits;
    case "lead_spend":
      return point.spend;
    case "booking_rate":
      return ratio(point.bookings, point.leads);
    case "cost_per_booking":
      return ratio(point.spend, point.bookings);
    case "cancellation_rate":
      return ratio(point.cancellations, point.bookings);
    case "cost_per_lead":
      return ratio(point.spend, point.leads);
    case "return_on_spend":
      return ratio(point.binder, point.spend);
    case "average_binder":
      return ratio(point.binder, point.bookings);
    default:
      return null;
  }
}

/** Sparkline data for a scorecard (current and comparison by index), or null when the metric has no series. */
export function scorecardSparkline(
  series: { current: readonly InsightsSeriesPoint[]; comparison: readonly InsightsSeriesPoint[] } | undefined,
  key: InsightsScorecardKey,
): Array<{ index: number; current: number | null; comparison: number | null }> | null {
  if (!series || key === "duplicates" || !series.current?.length) return null;
  return series.current.map((point, index) => ({
    index,
    current: scorecardPointValue(point, key),
    comparison: series.comparison?.[index] ? scorecardPointValue(series.comparison[index]!, key) : null,
  }));
}
