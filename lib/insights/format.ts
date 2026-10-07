/**
 * Insights › Analytics display rules (dashboard-redesign-proposal/09-analytics-redesign.md, "How a comparison is
 * shown"). Pure: no React. Every number carries its comparison; counts and money change in %, rates in points, and a
 * small base (either side under 20) shows the raw "was X" instead of a headline percent. Colour comes from the
 * metric's `tone` (good or bad for the business), never from up or down.
 */
import type {
  InsightsBucket,
  InsightsCompareMode,
  InsightsComparison,
  InsightsMetric,
  InsightsMetricKind,
  InsightsPeriod,
  InsightsRow,
  InsightsTone,
} from "@/lib/api/insights";
import { INSIGHTS_COMPARE_LABELS } from "@/lib/api/insights";

/** The first recorded lead (form leads start here); comparisons before it have no data. */
export const FIRST_RECORDED_LEAD_DAY = "2026-04-30";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });

export type RatioStyle = "times" | "plain";

export type ValueOptions = {
  /** `times` (default) for return on spend ("0.87×"), `plain` for a rating ("4.5"). */
  ratio?: RatioStyle;
  /** Decimals for a rate (default 1). */
  rateDigits?: number;
};

const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/** A metric value in Owner words: "1,740", "$82,410", "10.5%", "0.87×", "3 days"; missing is "—". */
export function formatMetricValue(value: number | null | undefined, kind: InsightsMetricKind, options: ValueOptions = {}): string {
  if (!finite(value)) return "—";
  switch (kind) {
    case "count":
      return integer.format(value);
    case "money":
      return money0.format(value);
    case "rate":
      return `${(value * 100).toFixed(options.rateDigits ?? 1)}%`;
    case "ratio":
      return options.ratio === "plain" ? value.toFixed(1) : `${value.toFixed(2)}×`;
    case "days":
      return value === 1 ? "1 day" : `${oneDecimal.format(value)} days`;
    default:
      return String(value);
  }
}

export function formatValue(metric: InsightsMetric | null | undefined, options: ValueOptions = {}): string {
  return metric ? formatMetricValue(metric.value, metric.kind, options) : "—";
}

export function formatComparisonValue(metric: InsightsMetric | null | undefined, options: ValueOptions = {}): string {
  return metric ? formatMetricValue(metric.comparison_value, metric.kind, options) : "—";
}

/** Signed absolute difference: "+35", "−$41", "+1.2 pts", "−0.12×". Null when either side is missing. */
export function signedDifference(metric: InsightsMetric | null | undefined, options: ValueOptions = {}): string | null {
  if (!metric || !finite(metric.value) || !finite(metric.comparison_value)) return null;
  const delta = finite(metric.delta) ? metric.delta : metric.value - metric.comparison_value;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  if (metric.kind === "rate") return `${sign}${Math.abs(delta * 100).toFixed(1)} pts`;
  return `${sign}${formatMetricValue(Math.abs(delta), metric.kind, options)}`;
}

export type DeltaDirection = "up" | "down" | "even";

export type DeltaView = {
  direction: DeltaDirection;
  tone: InsightsTone;
  /** The chip text without the glyph: "18%", "1.2 pts", "was 3". */
  text: string;
  /** How the change is expressed. */
  mode: "pct" | "pts" | "was";
  /** A plain sentence for the title / screen readers. */
  title: string;
};

const EVEN_EPSILON: Record<InsightsMetricKind, number> = { count: 1e-9, money: 0.005, rate: 0.0005, ratio: 0.005, days: 0.05 };

function formatPctChange(pct: number): string {
  const abs = Math.abs(pct) * 100;
  if (abs >= 1000) return `${integer.format(Math.round(abs))}%`;
  return abs < 10 ? `${abs.toFixed(1).replace(/\.0$/, "")}%` : `${Math.round(abs)}%`;
}

/**
 * The comparison chip for a metric (rules 1–3 of doc 09). Null when there is nothing to compare (no comparison
 * period, or a side is missing).
 */
export function deltaView(metric: InsightsMetric | null | undefined, options: ValueOptions = {}): DeltaView | null {
  if (!metric || !finite(metric.value) || !finite(metric.comparison_value)) return null;
  // Nothing then and nothing now is not a change worth a chip.
  if (metric.value === 0 && metric.comparison_value === 0) return null;
  const delta = finite(metric.delta) ? metric.delta : metric.value - metric.comparison_value;
  const even = Math.abs(delta) < EVEN_EPSILON[metric.kind];
  const direction: DeltaDirection = even ? "even" : delta > 0 ? "up" : "down";
  const tone: InsightsTone = even ? "neutral" : metric.tone;
  const now = formatMetricValue(metric.value, metric.kind, options);
  const was = formatMetricValue(metric.comparison_value, metric.kind, options);
  const title = `Now ${now}, was ${was}${even ? " (no change)" : ` (${signedDifference(metric, options)})`}`;
  if (metric.small_base) return { direction, tone, text: `was ${was}`, mode: "was", title: `${title}. Too few to compare in %.` };
  if (metric.kind === "rate") return { direction, tone, text: `${Math.abs(delta * 100).toFixed(1)} pts`, mode: "pts", title };
  if (finite(metric.delta_pct)) return { direction, tone, text: formatPctChange(metric.delta_pct), mode: "pct", title };
  return { direction, tone, text: `was ${was}`, mode: "was", title };
}

/** The scorecard's quiet second line: "was 196 · +35" (rates: "was 12.2%"). */
export function wasLine(metric: InsightsMetric | null | undefined, options: ValueOptions = {}): string | null {
  if (!metric || !finite(metric.comparison_value)) return null;
  const was = `was ${formatMetricValue(metric.comparison_value, metric.kind, options)}`;
  if (metric.kind === "rate") return was;
  const difference = signedDifference(metric, options);
  return difference ? `${was} · ${difference}` : was;
}

export type RankChangeView = { kind: "up" | "down" | "even" | "new"; text: string; title: string };

/** Rank change against the comparison period: ▲2, ▼1, new, or –. */
export function rankChangeView(row: Pick<InsightsRow, "rank_change" | "is_new">, hasComparison = true): RankChangeView | null {
  if (!hasComparison) return null;
  if (row.is_new) return { kind: "new", text: "new", title: "Not ranked in the comparison period" };
  // Unranked rows (Referrals, No lead): nothing to compare a place against.
  if (row.rank_change === null) return null;
  if (row.rank_change === 0) return { kind: "even", text: "–", title: "Same rank as before" };
  const n = Math.abs(row.rank_change);
  return row.rank_change > 0
    ? { kind: "up", text: `▲${n}`, title: `Up ${n} ${n === 1 ? "place" : "places"}` }
    : { kind: "down", text: `▼${n}`, title: `Down ${n} ${n === 1 ? "place" : "places"}` };
}

const dayDate = (day: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "Sep 7" (or "Sep 7, 2026") for a New York business-date key `YYYY-MM-DD`. Formats in UTC so it never shifts. */
export function formatDayKey(day: string | null | undefined, withYear = false): string {
  const date = day ? dayDate(day.slice(0, 10)) : null;
  if (!date) return "—";
  return (withYear ? monthDayYear : monthDay).format(date);
}

/** "Jul 2025" for a month key `YYYY-MM`. */
export function formatMonthKey(month: string): string {
  const date = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-15T12:00:00Z`) : null;
  return date && !Number.isNaN(date.getTime()) ? monthYear.format(date) : month;
}

/** An x-axis label for a series bucket: "Sep 7", or "Wk of Sep 7" for week buckets. */
export function bucketLabel(day: string, bucket: InsightsBucket): string {
  return bucket === "week" ? `Wk of ${formatDayKey(day)}` : formatDayKey(day);
}

/** "Sep 7 – Oct 6, 2026 · vs Aug 8 – Sep 6, 2026". */
export function periodCaption(period: Pick<InsightsPeriod, "label">, comparison: Pick<InsightsComparison, "label"> | null): string {
  return comparison ? `${period.label} · vs ${comparison.label}` : `${period.label} · no comparison`;
}

/** A note when the comparison is not fully covered by recorded data; null when it is. */
export function coverageNote(comparison: Pick<InsightsComparison, "coverage" | "mode"> | null, mode?: InsightsCompareMode): string | null {
  if (!comparison || comparison.coverage === "full") return null;
  const name = INSIGHTS_COMPARE_LABELS[mode ?? comparison.mode];
  const first = formatDayKey(FIRST_RECORDED_LEAD_DAY, true);
  return comparison.coverage === "none"
    ? `${name} has no data: records start ${first}.`
    : `${name} has no data before ${first}, so it is only partly covered.`;
}

export function formatCount(value: number | null | undefined): string {
  return finite(value) ? integer.format(value) : "—";
}

export function formatMoney(value: number | null | undefined): string {
  return finite(value) ? money0.format(value) : "—";
}

/** "82%" (share 0–1). */
export function formatShare(value: number | null | undefined, digits = 0): string {
  return finite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}
