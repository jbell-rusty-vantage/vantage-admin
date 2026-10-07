"use client";
/**
 * Where to buy (doc 09 Sources): booking rate (x) against cost per booking (y), bubble size = lead spend, one bubble
 * per source company. Dashed guides at the overall booking rate and cost per booking; the bottom-right quadrant
 * (higher rate, lower cost) is labelled "Buy more here". Free ($0) sources sit on the floor, labelled.
 */
import { CartesianGrid, LabelList, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { InsightsRow } from "@/lib/api/insights";
import { formatCount, formatMetricValue, formatMoney } from "@/lib/insights/format";
import { niceCeiling, scatterQuadrant, scatterShape, type ScatterPoint } from "@/lib/insights/scatter";
import { CrmCard } from "@/components/ui/crm";
import { AXIS_TICK, axisMoney, CHART, ChartLegend, EmptyChart, TooltipBox } from "./chart-parts";

const QUADRANT_WORDS = {
  buy_more: "Buy more here: books better and costs less than average",
  costly: "Books well, but each booking costs more than average",
  watch: "Cheap per booking, but books less often than average",
  cut: "Books less and costs more than average",
} as const;

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: ScatterPoint }> };

export function SourceScatter({ companies, colorFor }: { companies: readonly InsightsRow[]; colorFor: (key: string) => string | null }) {
  const shape = scatterShape(companies);
  const xMax = niceCeiling(Math.max(0.05, ...shape.points.map((point) => point.x)) * 1.1, 0.05);
  const yMax = niceCeiling(Math.max(100, ...shape.points.map((point) => point.y)) * 1.1, 100);
  const data = shape.points.map((point) => ({ ...point, name: point.free ? `${point.label} (free)` : point.label }));

  const renderTooltip = ({ active, payload }: TooltipProps) => {
    const point = active ? payload?.[0]?.payload : undefined;
    if (!point) return null;
    const quadrant = scatterQuadrant(point, shape);
    return (
      <TooltipBox
        title={point.label}
        rows={[
          { key: "rate", label: "Booking rate", value: formatMetricValue(point.x, "rate") },
          { key: "cost", label: "Cost per booking", value: point.free ? "$0 (free source)" : formatMoney(point.y) },
          { key: "spend", label: "Lead spend", value: formatMoney(point.spend) },
          { key: "leads", label: "Leads → booked", value: `${formatCount(point.leads)} → ${formatCount(point.booked)}` },
        ]}
        foot={quadrant ? QUADRANT_WORDS[quadrant] : undefined}
      />
    );
  };

  return (
    <CrmCard
      className="ia-card"
      title="Where to buy more"
      subtitle="Each bubble is a source: further right books more of its leads, lower costs less per booking, bigger means more spend. Hover a bubble for its numbers."
    >
      <div className="ia-card__body">
        {data.length === 0 ? (
          <EmptyChart height={220}>No source has a booking from this period&apos;s leads yet, so there is nothing to place.</EmptyChart>
        ) : (
          <>
            <ChartLegend
              items={[
                { key: "src", label: "A source (size = lead spend)", color: CHART.current, dot: true },
                ...(shape.overallRate !== null ? [{ key: "avg", label: `Overall: ${formatMetricValue(shape.overallRate, "rate")} booked, ${formatMoney(shape.overallCostPerBooking)} per booking`, color: CHART.guide, dashed: true }] : []),
              ]}
            />
            <div className="ia-chart" style={{ height: 340 }} role="img" aria-label={`Booking rate against cost per booking for ${data.length} sources. ${data.map((point) => `${point.label}: ${formatMetricValue(point.x, "rate")}, ${formatMoney(point.y)} per booking`).join("; ")}.`}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ScatterChart margin={{ top: 18, right: 24, bottom: 22, left: 4 }}>
                  <CartesianGrid stroke={CHART.grid} />
                  {shape.overallRate !== null && shape.overallCostPerBooking !== null ? (
                    <ReferenceArea x1={shape.overallRate} x2={xMax} y1={0} y2={shape.overallCostPerBooking} fill={CHART.good} fillOpacity={0.06} stroke="none" label={{ value: "Buy more here", position: "insideBottomRight", fill: "#1f7a3a", fontSize: 12, fontWeight: 800 }} />
                  ) : null}
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, xMax]}
                    tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: CHART.axis }}
                    label={{ value: "Booking rate →", position: "insideBottom", offset: -14, fill: CHART.tick, fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, yMax]}
                    tickFormatter={axisMoney}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    label={{ value: "Cost per booking", angle: -90, position: "insideLeft", offset: 10, fill: CHART.tick, fontSize: 12, style: { textAnchor: "middle" } }}
                  />
                  <ZAxis type="number" dataKey="spend" range={[90, 1100]} />
                  {shape.overallRate !== null ? <ReferenceLine x={shape.overallRate} stroke={CHART.guide} strokeDasharray="4 4" /> : null}
                  {shape.overallCostPerBooking !== null ? <ReferenceLine y={shape.overallCostPerBooking} stroke={CHART.guide} strokeDasharray="4 4" /> : null}
                  <Tooltip content={renderTooltip} cursor={{ strokeDasharray: "3 3", stroke: CHART.axis }} />
                  <Scatter
                    data={data}
                    isAnimationActive={false}
                    shape={(props: unknown) => {
                      const { cx, cy, size, payload } = props as { cx?: number; cy?: number; size?: number; payload?: ScatterPoint };
                      if (typeof cx !== "number" || typeof cy !== "number" || !payload) return <g />;
                      const radius = Math.max(5, Math.sqrt((size ?? 100) / Math.PI));
                      const color = colorFor(payload.key) ?? CHART.current;
                      return <circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={0.55} stroke="#fff" strokeWidth={2} />;
                    }}
                  >
                    <LabelList
                      dataKey="name"
                      content={(props: unknown) => {
                        // One line, never wrapped: recharts' default label wraps long source names into a column.
                        const { x, y, width, value } = props as { x?: number | string; y?: number | string; width?: number | string; value?: unknown };
                        if (value === undefined || value === null) return null;
                        const left = Number(x ?? 0) + Number(width ?? 0) / 2;
                        return (
                          <text x={left} y={Number(y ?? 0) - 8} textAnchor="middle" fill="#1d2943" fontSize={11.5} fontWeight={700} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                            {String(value)}
                          </text>
                        );
                      }}
                    />
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        <div className="ia-scatter-notes">
          {shape.points.some((point) => point.free) ? <p className="ia-note">Free sources ($0 lead cost) sit on the floor: every booking from them costs nothing.</p> : null}
          {shape.notPlotted.length ? (
            <p className="ia-note">
              Not placed (no booking from this period&apos;s leads yet): {shape.notPlotted.map((entry) => `${entry.label} (${formatCount(entry.leads)} leads, ${formatMoney(entry.spend)})`).join(", ")}.
            </p>
          ) : null}
          <p className="ia-note">Referrals and bookings with no lead are left out: they have no lead cost.</p>
        </div>
      </div>
    </CrmCard>
  );
}
