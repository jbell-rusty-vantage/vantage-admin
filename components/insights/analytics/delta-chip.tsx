"use client";
/**
 * The comparison chip (doc 09 "How a comparison is shown"): ▲/▼ with a % for counts and money, points for rates, or
 * "was X" on a small base. Colour is the metric's tone (good / bad for the business); the glyph is the direction.
 */
import type { InsightsMetric, InsightsRow } from "@/lib/api/insights";
import { deltaView, rankChangeView, type ValueOptions } from "@/lib/insights/format";
import { cx } from "@/components/ui/crm";

export function DeltaChip({ metric, format, plain = false }: { metric: InsightsMetric | null | undefined; format?: ValueOptions; plain?: boolean }) {
  const view = deltaView(metric, format);
  if (!view) return null;
  const glyph = view.direction === "up" ? "▲" : view.direction === "down" ? "▼" : "•";
  return (
    <span className={cx("ia-delta", `ia-delta--${view.tone}`, plain && "ia-delta--plain")} title={view.title} aria-label={view.title}>
      <span aria-hidden="true">{glyph}</span>
      <span aria-hidden="true">{view.text}</span>
    </span>
  );
}

/** "3 ▲2" — the rank and its change against the comparison period. */
export function RankCell({ row, hasComparison, rank }: { row: Pick<InsightsRow, "rank" | "rank_change" | "is_new">; hasComparison: boolean; rank?: number }) {
  const change = rankChangeView(row, hasComparison);
  return (
    <span className="ia-rank">
      <span className="ia-rank__n">{rank ?? row.rank}</span>
      {change ? (
        <span className={cx("ia-rank__change", `ia-rank__change--${change.kind}`)} title={change.title}>
          {change.text}
        </span>
      ) : null}
    </span>
  );
}
