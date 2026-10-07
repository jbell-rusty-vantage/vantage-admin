"use client";
/**
 * Head to head (doc 09; the Owner's "performance comparisons"): up to four sources or reps side by side. One column
 * per entity, each metric drawn on one shared scale with the best value marked, and the entities' trends overlaid.
 * Every entity keeps one tone-neutral colour across the tray, the chart and the table's checkbox row.
 */
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy, X } from "lucide-react";
import type { InsightsBucket, InsightsMetricKind, InsightsRow } from "@/lib/api/insights";
import { compareMetricRows, compareSeriesRows, partialKey, type CompareMetricSpec, type CompareSeriesRow } from "@/lib/insights/compare";
import { bucketLabel, formatMetricValue } from "@/lib/insights/format";
import { CrmCard, Segmented } from "@/components/ui/crm";
import { AXIS_TICK, axisCount, axisMoney, CHART, ChartLegend, EmptyChart, TooltipBox } from "./chart-parts";
import { DeltaChip } from "./delta-chip";

export type CompareSeriesOption = { field: "value" | "secondary"; label: string; kind: InsightsMetricKind };

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: CompareSeriesRow }> };

export function CompareTray({
  entities,
  colorFor,
  metrics,
  seriesOptions,
  bucket,
  hasComparison,
  partialLast = false,
  noun,
  onRemove,
  onClear,
}: {
  entities: readonly InsightsRow[];
  colorFor: (key: string) => string;
  metrics: readonly CompareMetricSpec[];
  seriesOptions: readonly CompareSeriesOption[];
  bucket: InsightsBucket;
  hasComparison: boolean;
  /** The period includes today: each line's last bucket is drawn dotted (still filling up). */
  partialLast?: boolean;
  /** "sources" / "reps". */
  noun: string;
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const [field, setField] = useState<"value" | "secondary">(seriesOptions[0]?.field ?? "value");
  if (entities.length === 0) return null;
  const option = seriesOptions.find((candidate) => candidate.field === field) ?? seriesOptions[0];
  const rows = compareMetricRows(entities, metrics);
  const series = option ? compareSeriesRows(entities, option.field, { partialLast }) : [];
  const withSeries = entities.filter((entity) => (entity.series?.length ?? 0) > 0);
  const columns = `minmax(120px, 0.8fr) repeat(${entities.length}, minmax(130px, 1fr))`;
  const format = (value: number | null) => formatMetricValue(value, option?.kind ?? "count");
  const seriesEmpty = series.every((row) => withSeries.every((entity) => !row[entity.key]));

  const renderTooltip = ({ active, payload }: TooltipProps) => {
    const point = active ? payload?.[0]?.payload : undefined;
    if (!point) return null;
    return (
      <TooltipBox
        title={bucketLabel(point.day, bucket)}
        rows={withSeries.map((entity) => ({ key: entity.key, label: entity.label, value: format(typeof point[entity.key] === "number" ? (point[entity.key] as number) : null), color: colorFor(entity.key) }))}
      />
    );
  };

  return (
    <CrmCard
      className="ia-card ia-tray"
      testId="compare-tray"
      title="Head to head"
      subtitle={`${entities.length} ${noun} side by side. Each row shares one scale; the best value is marked.${entities.length < 2 ? ` Tick another to compare.` : ""}`}
      tools={
        <button type="button" className="crm-button crm-button--quiet crm-button--sm" onClick={onClear}>
          Clear
        </button>
      }
    >
      <div className="ia-table-wrap">
        <div className="ia-tray__grid" style={{ gridTemplateColumns: columns }} role="table" aria-label={`Head to head of ${entities.map((entity) => entity.label).join(", ")}`}>
          <div role="row" style={{ display: "contents" }}>
            <div className="ia-tray__cell ia-tray__cell--head" role="columnheader">
              Metric
            </div>
            {entities.map((entity) => (
              <div key={entity.key} className="ia-tray__cell ia-tray__cell--head" role="columnheader">
                <span className="ia-tray__name">
                  <span className="ia-swatch" style={{ background: colorFor(entity.key) }} aria-hidden="true" />
                  <span title={entity.label}>{entity.label}</span>
                </span>
                <button type="button" className="ia-remove" onClick={() => onRemove(entity.key)} aria-label={`Remove ${entity.label} from the comparison`}>
                  <X aria-hidden="true" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.key} role="row" style={{ display: "contents" }}>
              <div className="ia-tray__cell ia-tray__cell--label" role="rowheader">
                {row.label}
              </div>
              {row.cells.map((cell) => (
                <div key={cell.entityKey} className={`ia-tray__cell${cell.best ? " ia-tray__cell--best" : ""}`} role="cell">
                  <span className="ia-tray__value">
                    {cell.display}
                    {hasComparison ? <DeltaChip metric={cell.metric} /> : null}
                  </span>
                  <span className="ia-tray__bar" style={{ width: `${Math.max(cell.value === null ? 0 : 2, cell.share * 100).toFixed(1)}%`, background: colorFor(cell.entityKey) }} aria-hidden="true" />
                  {cell.best ? (
                    <span className="ia-tray__best">
                      <Trophy aria-hidden="true" width={11} height={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                      Best
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="ia-card__body" style={{ paddingTop: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h3 className="crm-card__subtitle" style={{ margin: 0, color: "var(--crm-ink)", fontWeight: 800, fontSize: 14 }}>
            {option?.label ?? "Trend"} per {bucket === "week" ? "week" : "day"}
          </h3>
          {seriesOptions.length > 1 ? <Segmented size="sm" label="Trend metric" value={field} onChange={setField} options={seriesOptions.map((candidate) => ({ value: candidate.field, label: candidate.label }))} /> : null}
        </div>
        {withSeries.length === 0 || seriesEmpty ? (
          <EmptyChart height={140}>No {option?.label.toLowerCase() ?? "activity"} to chart for these {noun} in this period.</EmptyChart>
        ) : (
          <>
            <ChartLegend items={withSeries.map((entity) => ({ key: entity.key, label: entity.label, color: colorFor(entity.key) }))} />
            <div className="ia-chart" style={{ height: 220 }} role="img" aria-label={`${option?.label ?? "Trend"} per ${bucket} for ${withSeries.map((entity) => entity.label).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(day: string) => bucketLabel(day, "day")} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.axis }} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={option?.kind === "money" ? 52 : 36} allowDecimals={false} tickFormatter={(value: number) => (option?.kind === "money" ? axisMoney(value) : axisCount(value))} />
                  <Tooltip content={renderTooltip} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
                  {withSeries.map((entity) => (
                    <Line key={entity.key} type="monotone" dataKey={entity.key} name={entity.label} stroke={colorFor(entity.key)} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
                  ))}
                  {partialLast
                    ? withSeries.map((entity) => (
                        <Line key={partialKey(entity.key)} type="linear" dataKey={partialKey(entity.key)} legendType="none" stroke={colorFor(entity.key)} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} />
                      ))
                    : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </CrmCard>
  );
}
