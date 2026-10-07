/**
 * Pure helpers for the live "Lead spend today" metric (Today > Operations and the Pulse Spend tile).
 * Spend is neutral: more spend usually means more leads, so the pace chip is blue/gray, never red/green.
 */
import type { InsightsLeadSpendDay } from "@/lib/api/insights";

export type SpendPace = {
  /** Whole-number percent change vs yesterday by this hour; null when yesterday had no spend by now. */
  pct: number | null;
  direction: "up" | "down" | "flat";
  label: string;
};

export function spendPace(spend: Pick<InsightsLeadSpendDay["spend"], "today" | "yesterday_by_now">): SpendPace {
  const now = spend.today;
  const before = spend.yesterday_by_now;
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) {
    return { pct: null, direction: "flat", label: "No yesterday figure by now" };
  }
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { pct, direction: "flat", label: "Same as yesterday by now" };
  return pct > 0
    ? { pct, direction: "up", label: `${pct} % vs yesterday by now` }
    : { pct, direction: "down", label: `${Math.abs(pct)} % vs yesterday by now` };
}

/** Running totals of an hourly array. Hours after `throughHour` are null (the future stays empty). */
export function cumulativeByHour(hourly: readonly number[] | undefined, throughHour: number): Array<number | null> {
  let total = 0;
  return Array.from({ length: 24 }, (_, hour) => {
    total += hourly?.[hour] ?? 0;
    return hour <= throughHour ? total : null;
  });
}

export function leadSpendHasData(day: InsightsLeadSpendDay | null | undefined): day is InsightsLeadSpendDay {
  return Boolean(day && day.spend && day.hourly && day.leads);
}

/** Paid sources first, biggest spend first; sources with $0 spend (free) come last. */
export function topSpendSources(day: InsightsLeadSpendDay, limit = 4): InsightsLeadSpendDay["by_company"] {
  return [...(day.by_company ?? [])].sort((a, b) => b.spend - a.spend || b.leads - a.leads).slice(0, limit);
}

/** True when the error is the Owner-only 403: the block hides instead of showing an error. */
export function isForbidden(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { status?: number }).status === 403);
}
