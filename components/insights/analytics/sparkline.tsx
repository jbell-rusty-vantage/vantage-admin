"use client";
/**
 * A tiny trend line drawn as plain SVG (cheap enough for a table column of small multiples). The current period is a
 * solid line, the comparison a dashed gray line aligned by index. Decorative: the numbers are always next to it.
 */
import { CHART } from "./chart-parts";

type Point = { current: number | null; comparison?: number | null };

function pathFor(values: Array<number | null>, width: number, height: number, min: number, max: number): string {
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  let path = "";
  let pen = false;
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      pen = false;
      return;
    }
    const x = values.length > 1 ? index * step : width / 2;
    const y = height - 2 - ((value - min) / span) * (height - 4);
    path += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  });
  return path;
}

export function Sparkline({ data, width = 120, height = 30, color = CHART.current, label }: { data: readonly Point[]; width?: number; height?: number; color?: string; label?: string }) {
  const current = data.map((point) => (typeof point.current === "number" && Number.isFinite(point.current) ? point.current : null));
  const comparison = data.map((point) => (typeof point.comparison === "number" && Number.isFinite(point.comparison) ? point.comparison : null));
  const all = [...current, ...comparison].filter((value): value is number => value !== null);
  if (all.length === 0) return null;
  const min = Math.min(0, ...all);
  const max = Math.max(...all);
  const now = pathFor(current, width, height, min, max);
  const then = pathFor(comparison, width, height, min, max);
  return (
    <svg className="ia-sparkline" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ maxWidth: width * 2, display: "block" }}>
      {then ? <path d={then} fill="none" stroke={CHART.comparison} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" /> : null}
      {now ? <path d={now} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /> : null}
    </svg>
  );
}
