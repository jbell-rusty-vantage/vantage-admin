/**
 * Bookings & cancellations shaping (doc 09 tab 4): the booking mix as two 100 % bars with the comparison shares,
 * time-to-book buckets as shares of each period, and the cancellation summary in words. Pure.
 */
import type { InsightsNamedCount, InsightsTimeToBook } from "@/lib/api/insights";

export type MixPart = {
  key: string;
  label: string;
  count: number;
  comparisonCount: number;
  amount: number | null;
  share: number;
  comparisonShare: number | null;
};

export type MixGroup = { key: string; title: string; total: number; comparisonTotal: number; parts: MixPart[] };

const MIX_GROUPS: ReadonlyArray<{ key: string; title: string; parts: readonly string[] }> = [
  { key: "origin", title: "Where bookings came from", parts: ["with_lead", "referral", "no_lead"] },
  { key: "move", title: "Local or long distance", parts: ["local", "long_distance"] },
];

/** The two 100 % bars. A group with no bookings in either period is left out. */
export function mixGroups(mix: readonly InsightsNamedCount[] | undefined, hasComparison: boolean): MixGroup[] {
  const byKey = new Map((mix ?? []).map((entry) => [entry.key, entry]));
  const groups: MixGroup[] = [];
  for (const group of MIX_GROUPS) {
    const entries = group.parts.map((key) => byKey.get(key)).filter((entry): entry is InsightsNamedCount => Boolean(entry));
    const total = entries.reduce((sum, entry) => sum + (entry.count || 0), 0);
    const comparisonTotal = entries.reduce((sum, entry) => sum + (entry.comparison_count || 0), 0);
    if (total === 0 && comparisonTotal === 0) continue;
    groups.push({
      key: group.key,
      title: group.title,
      total,
      comparisonTotal,
      parts: entries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        count: entry.count || 0,
        comparisonCount: entry.comparison_count || 0,
        amount: typeof entry.amount === "number" ? entry.amount : null,
        share: total > 0 ? (entry.count || 0) / total : 0,
        comparisonShare: hasComparison && comparisonTotal > 0 ? (entry.comparison_count || 0) / comparisonTotal : null,
      })),
    });
  }
  return groups;
}

export type BucketShare = { key: string; label: string; count: number; comparisonCount: number; share: number; comparisonShare: number | null };

/** Time-to-book buckets as shares of each period (so periods of different volume compare fairly). */
export function timeToBookShares(timeToBook: InsightsTimeToBook | undefined, hasComparison: boolean): BucketShare[] {
  const buckets = timeToBook?.buckets ?? [];
  const total = buckets.reduce((sum, bucket) => sum + (bucket.count || 0), 0);
  const comparisonTotal = buckets.reduce((sum, bucket) => sum + (bucket.comparison_count || 0), 0);
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: bucket.count || 0,
    comparisonCount: bucket.comparison_count || 0,
    share: total > 0 ? (bucket.count || 0) / total : 0,
    comparisonShare: hasComparison && comparisonTotal > 0 ? (bucket.comparison_count || 0) / comparisonTotal : null,
  }));
}

/** "Median 1 day (was 2 days)": the sales cycle in words. */
export function medianSentence(timeToBook: InsightsTimeToBook | undefined, hasComparison: boolean): string {
  const days = (value: number) => (value === 0 ? "same day" : value === 1 ? "1 day" : `${Math.round(value * 10) / 10} days`);
  const median = timeToBook?.median_days;
  if (median === null || median === undefined) return "Not enough bookings with a lead to measure.";
  const was = timeToBook?.comparison_median_days;
  const base = `Half of the bookings came within ${days(median)} of the lead arriving`;
  if (!hasComparison || was === null || was === undefined) return `${base}.`;
  if (was === median) return `${base}, the same as before.`;
  return `${base} (before: ${days(was)}).`;
}

/** Reasons sorted by count with a share of the period's cancellations. */
export function rankedReasons(reasons: readonly InsightsNamedCount[] | undefined): Array<InsightsNamedCount & { share: number }> {
  const list = [...(reasons ?? [])].filter((reason) => reason.count > 0 || reason.comparison_count > 0);
  const max = list.reduce((top, reason) => Math.max(top, reason.count), 0);
  return list.sort((a, b) => b.count - a.count || b.comparison_count - a.comparison_count).map((reason) => ({ ...reason, share: max > 0 ? reason.count / max : 0 }));
}
