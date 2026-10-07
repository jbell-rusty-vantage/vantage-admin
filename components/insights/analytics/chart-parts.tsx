"use client";
/**
 * Shared chart chrome for Insights › Analytics (dataviz method): one blue for "this period", a quiet dashed gray for
 * the comparison, hairline recessive grid and axes, an HTML legend above every multi-series chart, and a tooltip in
 * text tokens (series colour only on the swatch).
 */
import type { ReactNode } from "react";
import { cx } from "@/components/ui/crm";

export const CHART = {
  current: "#2f6fe6",
  comparison: "#8a95aa",
  grid: "#edf1f6",
  axis: "#d3dbe7",
  tick: "#5f6c85",
  guide: "#8a95aa",
  good: "#2f9e4f",
} as const;

export const AXIS_TICK = { fontSize: 11.5, fill: CHART.tick } as const;

export type LegendItem = { key: string; label: ReactNode; color: string; dashed?: boolean; dot?: boolean };

export function ChartLegend({ items, label = "Legend" }: { items: readonly LegendItem[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className="ia-legend" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          {item.dot ? (
            <span className="ia-swatch" style={{ background: item.color }} aria-hidden="true" />
          ) : (
            <span className={cx("ia-legend__line", item.dashed && "ia-legend__line--dashed")} style={{ color: item.color }} aria-hidden="true" />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export type TooltipRow = { key: string; label: ReactNode; value: ReactNode; color?: string; dashed?: boolean };

export function TooltipBox({ title, rows, foot }: { title: ReactNode; rows: readonly TooltipRow[]; foot?: ReactNode }) {
  return (
    <div className="ia-tooltip">
      <p className="ia-tooltip__title">{title}</p>
      {rows.map((row) => (
        <p key={row.key} className="ia-tooltip__row">
          <span>
            {row.color ? <span className={cx(row.dashed ? "ia-legend__line ia-legend__line--dashed" : "ia-swatch")} style={row.dashed ? { color: row.color } : { background: row.color }} aria-hidden="true" /> : null}
            {row.label}
          </span>
          <strong>{row.value}</strong>
        </p>
      ))}
      {foot ? <p className="ia-tooltip__row" style={{ marginTop: 6 }}>{foot}</p> : null}
    </div>
  );
}

/** What a chart says when there is nothing to draw. */
export function EmptyChart({ children, height = 180 }: { children: ReactNode; height?: number }) {
  return (
    <p className="ia-empty" style={{ minHeight: height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </p>
  );
}

/** Compact axis money: $1.2k, $35k, $1.1M. */
export function axisMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `$${Math.round(value)}`;
}

export function axisCount(value: number): string {
  return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(value * 10) / 10);
}
