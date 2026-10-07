/**
 * Head-to-head compare (doc 09; the Owner's "performance comparisons"): up to four sources or reps side by side.
 * Each metric is drawn on one scale across the entities, the best value is marked by the metric's own `better`
 * direction, and every entity keeps one tone-neutral colour across the tray, the chart and the table.
 */
import type { InsightsMetric, InsightsMetricKind, InsightsRow } from "@/lib/api/insights";
import { formatMetricValue, type ValueOptions } from "./format";
import { isPinnedRow, metricOf } from "./table";
import { COMPARE_MAX } from "./url";

/**
 * Entity colours: four categorical slots validated all-pairs for colour-blind separation on white (dataviz
 * validator: worst CVD ΔE 9.2, normal-vision 16.3). The aqua slot is under 3:1 on white, so every use is paired with
 * the entity's name (legend, column head).
 */
export const COMPARE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"] as const;

export function compareColor(index: number): string {
  return COMPARE_COLORS[((index % COMPARE_COLORS.length) + COMPARE_COLORS.length) % COMPARE_COLORS.length];
}

/** Rows that can be compared: real entities (not Referrals / No lead / Unassigned). */
export function isComparable(row: InsightsRow): boolean {
  return !isPinnedRow(row);
}

export type ToggleResult = { keys: string[]; refused: boolean };

/** Adds or removes a key; adding a fifth is refused (the selection stays as it was). */
export function toggleCompareKey(keys: readonly string[], key: string, max = COMPARE_MAX): ToggleResult {
  if (keys.includes(key)) return { keys: keys.filter((existing) => existing !== key), refused: false };
  if (keys.length >= max) return { keys: [...keys], refused: true };
  return { keys: [...keys, key], refused: false };
}

/** "Compare top 3": the first comparable rows in rank order. */
export function topCompareKeys(rows: readonly InsightsRow[], n = 3): string[] {
  return [...rows]
    .filter(isComparable)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n)
    .map((row) => row.key);
}

/** The selected keys that exist in this table, in selection order. */
export function selectedEntities(rows: readonly InsightsRow[], keys: readonly string[]): InsightsRow[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return keys.map((key) => byKey.get(key)).filter((row): row is InsightsRow => Boolean(row));
}

export type CompareMetricSpec = { key: string; label: string; format?: ValueOptions };

export type CompareCell = {
  entityKey: string;
  value: number | null;
  display: string;
  /** Bar fill 0–1 on the metric's shared scale. */
  share: number;
  best: boolean;
  metric: InsightsMetric | null;
};

export type CompareMetricRow = { key: string; label: string; kind: InsightsMetricKind; cells: CompareCell[] };

/**
 * One row per metric, one cell per entity, on a shared scale (the largest value = a full bar). "Best" follows the
 * metric's `better` direction and is only marked when the values differ.
 */
export function compareMetricRows(entities: readonly InsightsRow[], specs: readonly CompareMetricSpec[]): CompareMetricRow[] {
  return specs.map((spec) => {
    const metrics = entities.map((entity) => metricOf(entity, spec.key));
    const kind = metrics.find((metric) => metric)?.kind ?? "count";
    const better = metrics.find((metric) => metric)?.better ?? "none";
    const values = metrics.map((metric) => (typeof metric?.value === "number" && Number.isFinite(metric.value) ? metric.value : null));
    const present = values.filter((value): value is number => value !== null);
    const max = present.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
    const distinct = new Set(present).size > 1;
    const bestValue = !distinct || better === "none" ? null : better === "up" ? Math.max(...present) : Math.min(...present);
    return {
      key: spec.key,
      label: spec.label,
      kind,
      cells: entities.map((entity, index) => {
        const value = values[index] ?? null;
        return {
          entityKey: entity.key,
          value,
          display: formatMetricValue(value, kind, spec.format),
          share: value === null || max <= 0 ? 0 : Math.min(1, Math.abs(value) / max),
          best: bestValue !== null && value === bestValue,
          metric: metrics[index] ?? null,
        };
      }),
    };
  });
}

export type CompareSeriesRow = { day: string } & Record<string, number | string | null>;

/**
 * The entities' series overlaid: one row per bucket with a column per entity key. `field` picks the row series'
 * primary value (sources: leads; reps: binder) or its secondary (sources: booked; reps: bookings).
 */
/** The column holding an entity's still-moving last bucket (drawn dotted). */
export const partialKey = (key: string): string => `${key}~partial`;

export function compareSeriesRows(entities: readonly InsightsRow[], field: "value" | "secondary", options: { partialLast?: boolean } = {}): CompareSeriesRow[] {
  const days: string[] = [];
  for (const entity of entities) {
    for (const point of entity.series ?? []) if (!days.includes(point.day)) days.push(point.day);
  }
  days.sort();
  const last = days.length - 1;
  const split = Boolean(options.partialLast) && days.length >= 2;
  return days.map((day, index) => {
    const row: CompareSeriesRow = { day };
    for (const entity of entities) {
      const point = entity.series?.find((candidate) => candidate.day === day);
      const raw = point ? (field === "value" ? point.value : point.secondary) : undefined;
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : point ? 0 : null;
      row[entity.key] = split && index === last ? null : value;
      if (split) row[partialKey(entity.key)] = index >= last - 1 ? value : null;
    }
    return row;
  });
}
