/**
 * Reviews shaping (doc 09 tab 5): the star histogram (all time vs this period), the monthly chart rows and the BBB
 * freshness line, which turns amber when the last refresh is more than 14 days old. Pure.
 */
import type { InsightsReviewsReport } from "@/lib/api/insights";
import { formatMonthKey } from "./format";

export const REVIEWS_STALE_DAYS = 14;

export type StarRow = { stars: number; allTime: number; period: number; comparison: number; allTimeShare: number; periodShare: number };

/** Five rows, 5★ first, with each column's share of its own total (bars compare shapes, not volumes). */
export function starRows(stars: InsightsReviewsReport["stars"] | undefined): StarRow[] {
  const byStars = new Map((stars ?? []).map((row) => [row.stars, row]));
  const rows = [5, 4, 3, 2, 1].map((n) => {
    const row = byStars.get(n);
    return { stars: n, allTime: row?.all_time ?? 0, period: row?.period ?? 0, comparison: row?.comparison ?? 0 };
  });
  const allTimeTotal = rows.reduce((sum, row) => sum + row.allTime, 0);
  const periodTotal = rows.reduce((sum, row) => sum + row.period, 0);
  return rows.map((row) => ({
    ...row,
    allTimeShare: allTimeTotal > 0 ? row.allTime / allTimeTotal : 0,
    periodShare: periodTotal > 0 ? row.period / periodTotal : 0,
  }));
}

export type MonthlyRow = { month: string; label: string; count: number; average: number | null };

export function monthlyRows(monthly: InsightsReviewsReport["monthly"] | undefined): MonthlyRow[] {
  return [...(monthly ?? [])]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({ month: row.month, label: formatMonthKey(row.month), count: row.count || 0, average: typeof row.average_rating === "number" ? row.average_rating : null }));
}

export type Freshness = { label: string; stale: boolean; days: number | null };

const absoluteDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/** "Last refreshed from BBB: Jul 9, 2026" (+ "more than 14 days ago" when stale). */
export function reviewsFreshness(lastIngestedAt: string | null | undefined, stale: boolean | undefined, nowMs: number): Freshness {
  if (!lastIngestedAt) return { label: "Never refreshed from BBB", stale: true, days: null };
  const at = new Date(lastIngestedAt);
  if (Number.isNaN(at.getTime())) return { label: "Never refreshed from BBB", stale: true, days: null };
  const days = Number.isFinite(nowMs) ? Math.max(0, Math.floor((nowMs - at.getTime()) / 86_400_000)) : null;
  const isStale = stale ?? (days !== null && days > REVIEWS_STALE_DAYS);
  return { label: `Last refreshed from BBB: ${absoluteDay.format(at)}`, stale: isStale, days };
}

/** "★★★★☆" for a rating (rounded to the nearest star). */
export function starGlyphs(rating: number | null | undefined): string {
  const n = typeof rating === "number" && Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}
