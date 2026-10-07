"use client";
/**
 * The period trend (doc 09): the current period as a solid blue line and the comparison as a dashed gray one,
 * aligned day 1 to day 1, with a metric switcher. One axis, one metric at a time.
 */
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsAnalyticsReport } from "@/lib/api/insights";
import { bucketLabel, formatMetricValue } from "@/lib/insights/format";
import { alignSeries, isEmptySeries, seriesTotal, TREND_METRIC_LABELS, type AlignedPoint, type TrendMetric } from "@/lib/insights/series";
import { CrmCard, Segmented } from "@/components/ui/crm";
import { AXIS_TICK, axisCount, axisMoney, CHART, ChartLegend, EmptyChart, TooltipBox } from "./chart-parts";

const MONEY_METRICS = new Set<TrendMetric>(["spend", "binder", "deposits"]);

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: AlignedPoint }> };

export function TrendChart({
  report,
  metrics,
  title,
  subtitle,
  height = 260,
}: {
  report: Pick<InsightsAnalyticsReport, "series" | "period" | "comparison">;
  metrics: readonly TrendMetric[];
  title: string;
  subtitle?: string;
  height?: number;
}) {
  const [picked, setPicked] = useState<TrendMetric>(metrics[0] ?? "leads");
  const metric = metrics.includes(picked) ? picked : (metrics[0] ?? "leads");
  const bucket = report.series?.bucket ?? report.period.bucket;
  const hasComparison = Boolean(report.comparison) && (report.series?.comparison?.length ?? 0) > 0;
  const partialLast = Boolean(report.period.includes_today);
  const data = alignSeries(report.series?.current, hasComparison ? report.series?.comparison : [], metric, { partialLast });
  const kind = MONEY_METRICS.has(metric) ? "money" : "count";
  const format = (value: number | null) => formatMetricValue(value, kind);
  const empty = isEmptySeries(report.series?.current, metric) && (!hasComparison || isEmptySeries(report.series?.comparison, metric));
  const totalNow = seriesTotal(report.series?.current, metric);
  const totalThen = hasComparison ? seriesTotal(report.series?.comparison, metric) : null;
  const label = TREND_METRIC_LABELS[metric];

  const renderTooltip = ({ active, payload }: TooltipProps) => {
    const point = active ? payload?.[0]?.payload : undefined;
    if (!point) return null;
    return (
      <TooltipBox
        title={bucketLabel(point.day, bucket)}
        rows={[
          { key: "now", label: point.inProgress ? "This period (so far)" : "This period", value: format(point.inProgress ? point.partial : point.current), color: CHART.current },
          ...(hasComparison ? [{ key: "then", label: point.comparisonDay ? bucketLabel(point.comparisonDay, bucket) : "Comparison", value: format(point.comparison), color: CHART.comparison, dashed: true }] : []),
        ]}
      />
    );
  };

  return (
    <CrmCard
      className="ia-card"
      title={title}
      subtitle={`${subtitle ?? `${label} per ${bucket === "week" ? "week" : "day"}, ${hasComparison ? "this period against the comparison, day 1 to day 1" : "this period"}.`}${partialLast ? ` The dotted end is the ${bucket === "week" ? "week" : "day"} still in progress.` : ""}`}
      tools={metrics.length > 1 ? <Segmented size="sm" label="Metric" value={metric} onChange={setPicked} options={metrics.map((value) => ({ value, label: TREND_METRIC_LABELS[value] }))} /> : null}
    >
      <div className="ia-card__body">
        {empty ? (
          <EmptyChart height={height - 40}>No {label.toLowerCase()} in this period{hasComparison ? " or the comparison" : ""}.</EmptyChart>
        ) : (
          <>
            <ChartLegend
              items={[
                { key: "now", label: `This period: ${format(totalNow)} (${report.period.label})`, color: CHART.current },
                ...(hasComparison && report.comparison ? [{ key: "then", label: `Comparison: ${format(totalThen)} (${report.comparison.label})`, color: CHART.comparison, dashed: true }] : []),
              ]}
            />
            <div className="ia-chart" style={{ height }} role="img" aria-label={`${label} trend: ${format(totalNow)} this period${hasComparison ? `, ${format(totalThen)} in the comparison` : ""}.`}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(day: string) => bucketLabel(day, "day")} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axis }} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={kind === "money" ? 52 : 40} tickFormatter={(value: number) => (kind === "money" ? axisMoney(value) : axisCount(value))} allowDecimals={false} />
                  <Tooltip content={renderTooltip} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
                  {hasComparison ? <Line type="monotone" dataKey="comparison" name="Comparison" stroke={CHART.comparison} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} connectNulls isAnimationActive={false} /> : null}
                  <Line type="monotone" dataKey="current" name="This period" stroke={CHART.current} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
                  {partialLast ? (
                    <Line type="linear" dataKey="partial" name="So far" legendType="none" stroke={CHART.current} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </CrmCard>
  );
}
