/**
 * Ranked tables (doc 09): sorting with pinned pseudo rows, in-cell bar scales, leaderboards with rank change and a
 * client-side CSV. Pure: no React.
 */
import type { InsightsMetric, InsightsMetricKind, InsightsRow } from "@/lib/api/insights";

export type SortDir = "asc" | "desc";
/** null = the server's rank order. */
export type SortState = { key: string; dir: SortDir } | null;

/** Referrals / No lead / Unassigned rows: shown, but always at the bottom and muted. */
export function isPinnedRow(row: Pick<InsightsRow, "notes">): boolean {
  return row.notes?.pseudo === true || row.notes?.unassigned === true;
}

export function metricOf(row: Pick<InsightsRow, "metrics">, key: string): InsightsMetric | null {
  return row.metrics?.[key] ?? null;
}

export function metricNumber(row: Pick<InsightsRow, "metrics">, key: string): number | null {
  const value = row.metrics?.[key]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type SortValue = number | string | null;

const defaultSortValue = (row: InsightsRow, key: string): SortValue => {
  if (key === "label") return row.label.toLowerCase();
  if (key === "rank") return row.rank;
  return metricNumber(row, key);
};

/**
 * Sorts rows by a column. Pinned rows (pseudo, unassigned) stay at the bottom in their own order; missing values
 * sort last in either direction; ties keep the server rank. Children are sorted by the same column.
 */
export function sortRows(rows: readonly InsightsRow[], sort: SortState, valueOf: (row: InsightsRow, key: string) => SortValue = defaultSortValue): InsightsRow[] {
  const byRank = (a: InsightsRow, b: InsightsRow) => a.rank - b.rank;
  const compare = (a: InsightsRow, b: InsightsRow): number => {
    if (!sort) return byRank(a, b);
    const left = valueOf(a, sort.key);
    const right = valueOf(b, sort.key);
    if (left === null && right === null) return byRank(a, b);
    if (left === null) return 1;
    if (right === null) return -1;
    const order = typeof left === "string" || typeof right === "string" ? String(left).localeCompare(String(right)) : left - right;
    if (order === 0) return byRank(a, b);
    return sort.dir === "asc" ? order : -order;
  };
  const withChildren = (row: InsightsRow): InsightsRow => (row.children?.length ? { ...row, children: sortRows(row.children, sort, valueOf) } : row);
  const main = rows.filter((row) => !isPinnedRow(row)).sort(compare).map(withChildren);
  const pinned = rows.filter(isPinnedRow).map(withChildren);
  return [...main, ...pinned];
}

/** A header click: first click sorts descending (labels ascending), second flips, third returns to rank order. */
export function nextSort(current: SortState, key: string): SortState {
  const first: SortDir = key === "label" ? "asc" : "desc";
  if (!current || current.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === "desc" ? "asc" : "desc" };
  return null;
}

/** The largest value of a metric over unpinned rows (the 100 % of the in-cell bar). */
export function columnMax(rows: readonly InsightsRow[], key: string): number {
  let max = 0;
  for (const row of rows) {
    if (isPinnedRow(row)) continue;
    const value = metricNumber(row, key);
    if (value !== null && Math.abs(value) > max) max = Math.abs(value);
  }
  return max;
}

/** Bar fill 0–1 against the column max. */
export function barShare(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || max <= 0) return 0;
  return Math.min(1, Math.max(0, Math.abs(value) / max));
}

export type LeaderEntry = {
  row: InsightsRow;
  value: number;
  rank: number;
  /** Positive = moved up against the comparison ranking by the same metric; null = new. */
  rankChange: number | null;
};

/**
 * Top N rows by one metric, with rank change recomputed against the comparison values of that same metric (the
 * server's rank is by a different key). Pinned rows and rows with no value are left out.
 */
export function leaderboard(rows: readonly InsightsRow[], key: string, n = 5, hasComparison = true): LeaderEntry[] {
  const eligible = rows.filter((row) => !isPinnedRow(row) && (metricNumber(row, key) ?? 0) > 0);
  const now = [...eligible].sort((a, b) => (metricNumber(b, key) ?? 0) - (metricNumber(a, key) ?? 0) || a.rank - b.rank);
  const before = rows
    .filter((row) => !isPinnedRow(row) && (row.metrics?.[key]?.comparison_value ?? 0) > 0)
    .sort((a, b) => (b.metrics[key]!.comparison_value ?? 0) - (a.metrics[key]!.comparison_value ?? 0) || a.rank - b.rank);
  const priorRank = new Map(before.map((row, index) => [row.key, index + 1]));
  return now.slice(0, n).map((row, index) => {
    const prior = hasComparison ? priorRank.get(row.key) : undefined;
    return { row, value: metricNumber(row, key) ?? 0, rank: index + 1, rankChange: prior === undefined ? null : prior - (index + 1) };
  });
}

export type CsvColumn = {
  label: string;
  /** A metric key: writes the value and, when `withComparison`, a "(before)" column. */
  metric?: string;
  value?: (row: InsightsRow) => string | number | null | undefined;
};

/** A metric as a CSV number: rates in percent (one decimal), money to cents, counts as is. */
export function csvMetricNumber(value: number | null | undefined, kind: InsightsMetricKind): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (kind === "rate") return Math.round(value * 1000) / 10;
  if (kind === "money" || kind === "ratio" || kind === "days") return Math.round(value * 100) / 100;
  return value;
}

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function kindSuffix(rows: readonly InsightsRow[], key: string): string {
  const kind = rows.find((row) => row.metrics?.[key])?.metrics[key]!.kind;
  return kind === "rate" ? " (%)" : kind === "money" ? " ($)" : "";
}

/**
 * The table as CSV, children (feeds) written as their own rows with the parent named. Rates are percent numbers.
 */
export function rowsToCsv(rows: readonly InsightsRow[], columns: readonly CsvColumn[], options: { withComparison?: boolean } = {}): string {
  const flat: Array<{ row: InsightsRow; parent: string }> = [];
  for (const row of rows) {
    flat.push({ row, parent: "" });
    for (const child of row.children ?? []) flat.push({ row: child, parent: row.label });
  }
  const hasChildren = flat.some((entry) => entry.parent);
  const header: string[] = ["Rank", "Name", ...(hasChildren ? ["Part of"] : [])];
  for (const column of columns) {
    if (column.metric) {
      const suffix = kindSuffix(flat.map((entry) => entry.row), column.metric);
      header.push(`${column.label}${suffix}`);
      if (options.withComparison) header.push(`${column.label} before${suffix}`);
    } else {
      header.push(column.label);
    }
  }
  const lines = [header.map(csvCell).join(",")];
  for (const { row, parent } of flat) {
    const cells: Array<string | number | null | undefined> = [parent ? "" : row.rank, row.label, ...(hasChildren ? [parent] : [])];
    for (const column of columns) {
      if (column.metric) {
        const metric = row.metrics?.[column.metric];
        cells.push(metric ? csvMetricNumber(metric.value, metric.kind) : null);
        if (options.withComparison) cells.push(metric ? csvMetricNumber(metric.comparison_value, metric.kind) : null);
      } else {
        cells.push(column.value?.(row));
      }
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** "vantage-sources-2026-09-07-to-2026-10-06.csv". */
export function csvFileName(name: string, period: { start: string; end: string }): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `vantage-${slug || "table"}-${period.start}-to-${period.end}.csv`;
}
