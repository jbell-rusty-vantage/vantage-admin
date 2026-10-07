"use client";
/**
 * A scorecard (doc 09): the value, its comparison chip, "was X · +N", a tiny current-vs-comparison sparkline and the
 * metric's definition under ⓘ.
 */
import type { InsightsMetric } from "@/lib/api/insights";
import { formatValue, wasLine, type ValueOptions } from "@/lib/insights/format";
import { cx, HelpPopover, SkeletonLine } from "@/components/ui/crm";
import { DeltaChip } from "./delta-chip";
import { Sparkline } from "./sparkline";

export function Scorecard({
  label,
  metric,
  definition,
  sparkline,
  quiet = false,
  format,
  prefix,
  testId,
}: {
  label: string;
  metric: InsightsMetric | null | undefined;
  definition?: string;
  sparkline?: ReadonlyArray<{ current: number | null; comparison?: number | null }> | null;
  quiet?: boolean;
  format?: ValueOptions;
  /** Text before the value (e.g. a star). */
  prefix?: string;
  testId?: string;
}) {
  const was = wasLine(metric, format);
  return (
    <section className={cx("crm-card ia-score", quiet && "ia-score--quiet")} data-testid={testId} aria-label={label}>
      <div className="ia-score__head">
        <h3 style={{ margin: 0, font: "inherit" }}>{label}</h3>
        {definition ? <HelpPopover label={`What “${label}” means`}>{definition}</HelpPopover> : null}
      </div>
      <p className="ia-score__value">
        <span>
          {prefix ? <span className="ia-stars" aria-hidden="true">{prefix} </span> : null}
          {formatValue(metric, format)}
        </span>
        <DeltaChip metric={metric} format={format} />
      </p>
      {was ? <p className="ia-score__was">{was}</p> : null}
      {!quiet && sparkline && sparkline.length > 1 ? (
        <div className="ia-score__spark">
          <Sparkline data={sparkline} width={160} height={28} />
        </div>
      ) : null}
    </section>
  );
}

export function ScorecardSkeleton({ quiet = false }: { quiet?: boolean }) {
  return (
    <div className={cx("crm-card ia-score", quiet && "ia-score--quiet")} aria-hidden="true">
      <SkeletonLine width="45%" height={11} />
      <SkeletonLine width="60%" height={quiet ? 18 : 24} />
      {quiet ? null : <SkeletonLine width="80%" height={10} />}
      {quiet ? null : <SkeletonLine width="100%" height={24} />}
    </div>
  );
}
