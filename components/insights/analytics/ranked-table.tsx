"use client";
/**
 * A ranked table (doc 09): rank + rank change, sortable columns, in-cell data bars on volume and money columns,
 * expandable children (a source's feeds), optional row checkboxes for the head-to-head compare and a per-table CSV
 * built in the browser. Pseudo rows (Referrals, No lead, Unassigned) stay at the bottom, muted. The table scrolls
 * sideways inside its card on a phone; the page never does.
 */
import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Download } from "lucide-react";
import type { InsightsRow } from "@/lib/api/insights";
import { formatValue, type ValueOptions } from "@/lib/insights/format";
import { barShare, columnMax, csvFileName, isPinnedRow, metricOf, nextSort, rowsToCsv, sortRows, type CsvColumn, type SortState } from "@/lib/insights/table";
import { CrmCard, cx } from "@/components/ui/crm";
import { DeltaChip, RankCell } from "./delta-chip";

export type RankedColumn = {
  key: string;
  label: string;
  /** Header tooltip in Owner words. */
  title?: string;
  /** The metric this column shows (defaults to `key`). */
  metric?: string;
  format?: ValueOptions;
  /** In-cell data bar against the column's largest value. */
  bar?: boolean;
  /** The comparison chip next to the value. */
  delta?: boolean;
  /** A custom cell (the column still sorts by `metric`). */
  render?: (row: InsightsRow) => ReactNode;
  sortable?: boolean;
  /** Leave the column out of the CSV, or write it with a custom value. */
  csv?: false | Pick<CsvColumn, "value">;
};

export type RankedSelection = {
  keys: readonly string[];
  onToggle: (key: string) => void;
  colorFor: (key: string) => string | null;
  canSelect: (row: InsightsRow) => boolean;
  max: number;
};

export function downloadText(fileName: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvButton({ name, rows, columns, period, hasComparison }: { name: string; rows: readonly InsightsRow[]; columns: readonly RankedColumn[]; period: { start: string; end: string }; hasComparison: boolean }) {
  const csvColumns: CsvColumn[] = columns
    .filter((column) => column.csv !== false)
    .map((column) => (column.csv && column.csv.value ? { label: column.label, value: column.csv.value } : { label: column.label, metric: column.metric ?? column.key }));
  return (
    <button
      type="button"
      className="crm-button crm-button--quiet crm-button--sm"
      onClick={() => downloadText(csvFileName(name, period), rowsToCsv(rows, csvColumns, { withComparison: hasComparison }))}
      disabled={rows.length === 0}
      aria-label={`Download ${name} as CSV`}
    >
      <Download aria-hidden="true" width={14} height={14} />
      CSV
    </button>
  );
}

function MetricCell({ row, column, max }: { row: InsightsRow; column: RankedColumn; max: number }) {
  if (column.render) return <>{column.render(row)}</>;
  const metric = metricOf(row, column.metric ?? column.key);
  return (
    <span className="ia-cell">
      <span className="ia-cell__line">
        <span>{formatValue(metric, column.format)}</span>
        {column.delta ? <DeltaChip metric={metric} format={column.format} /> : null}
      </span>
      {column.bar ? (
        <span className="ia-bar" aria-hidden="true">
          <span className="ia-bar__fill" style={{ width: `${(barShare(metric?.value, max) * 100).toFixed(1)}%` }} />
        </span>
      ) : null}
    </span>
  );
}

export function RankedTable({
  id,
  title,
  subtitle,
  tools,
  foot,
  rows,
  columns,
  labelHeader,
  hasComparison,
  csvName,
  period,
  selection,
  emptyText = "Nothing in this period.",
  initialSort = null,
  showRank = true,
  rowNote,
  testId,
}: {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  foot?: ReactNode;
  rows: readonly InsightsRow[];
  columns: readonly RankedColumn[];
  labelHeader: string;
  hasComparison: boolean;
  csvName: string;
  period: { start: string; end: string };
  selection?: RankedSelection;
  emptyText?: string;
  initialSort?: SortState;
  showRank?: boolean;
  /** A small muted note after the name (e.g. "inactive", a lead cost). */
  rowNote?: (row: InsightsRow) => ReactNode;
  testId?: string;
}) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const sorted = sortRows(rows, sort);
  const maxima = new Map(columns.filter((column) => column.bar).map((column) => [column.key, columnMax(rows, column.metric ?? column.key)]));
  const childMaxima = new Map(
    columns.filter((column) => column.bar).map((column) => [column.key, columnMax(rows.flatMap((row) => row.children ?? []), column.metric ?? column.key)]),
  );
  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const header = (column: RankedColumn, left = false) => {
    const sortKey = column.key === "label" ? "label" : (column.metric ?? column.key);
    const active = sort?.key === sortKey;
    const ariaSort = active ? (sort?.dir === "asc" ? "ascending" : "descending") : "none";
    return (
      <th key={column.key} scope="col" className={cx(left && "ia-left")} aria-sort={column.sortable === false ? undefined : ariaSort} title={column.title}>
        {column.sortable === false ? (
          column.label
        ) : (
          <button type="button" className="ia-th-button" data-active={active ? "true" : undefined} onClick={() => setSort((current) => nextSort(current, sortKey))}>
            {column.label}
            {active ? sort?.dir === "asc" ? <ArrowUp aria-hidden="true" width={12} height={12} /> : <ArrowDown aria-hidden="true" width={12} height={12} /> : null}
          </button>
        )}
      </th>
    );
  };

  const renderRow = (row: InsightsRow, child: boolean, parentKey?: string): ReactNode => {
    const muted = isPinnedRow(row);
    const hasChildren = !child && (row.children?.length ?? 0) > 0;
    const isOpen = open.has(row.key);
    const selected = selection?.keys.includes(row.key) ?? false;
    const color = selected ? selection?.colorFor(row.key) : null;
    const selectable = !child && selection ? selection.canSelect(row) : false;
    const full = selection ? selection.keys.length >= selection.max && !selected : false;
    return (
      <tr key={`${parentKey ?? ""}${row.key}`} data-muted={muted ? "true" : undefined} data-child={child ? "true" : undefined} data-selected={selected ? "true" : undefined}>
        {selection ? (
          <td className="ia-left" style={{ width: 36, paddingRight: 0 }}>
            {selectable ? (
              <label className="ia-check" title={full ? `Up to ${selection.max} at a time` : `Compare ${row.label}`}>
                <input type="checkbox" checked={selected} disabled={full} onChange={() => selection.onToggle(row.key)} aria-label={`Compare ${row.label}`} />
              </label>
            ) : null}
          </td>
        ) : null}
        {showRank ? <td className="ia-left">{child ? null : <RankCell row={row} hasComparison={hasComparison} />}</td> : null}
        <td className="ia-left">
          <span className="ia-name">
            {hasChildren ? (
              <button type="button" className="ia-expand" aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} feeds of ${row.label}`} onClick={() => toggleOpen(row.key)}>
                <ChevronRight aria-hidden="true" width={14} height={14} />
              </button>
            ) : null}
            {color ? <span className="ia-swatch" style={{ background: color }} aria-hidden="true" /> : null}
            <span className="ia-name__text" title={row.label}>{row.label}</span>
            {rowNote ? <span className="ia-name__sub">{rowNote(row)}</span> : null}
          </span>
        </td>
        {columns.map((column) => (
          <td key={column.key}>
            <MetricCell row={row} column={column} max={(child ? childMaxima : maxima).get(column.key) ?? 0} />
          </td>
        ))}
      </tr>
    );
  };

  return (
    <CrmCard
      id={id}
      testId={testId}
      className="ia-card"
      title={title}
      subtitle={subtitle}
      tools={
        <>
          {tools}
          <CsvButton name={csvName} rows={sorted} columns={columns} period={period} hasComparison={hasComparison} />
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="ia-empty">{emptyText}</p>
      ) : (
        <div className="ia-table-wrap">
          <table className="ia-table">
            <thead>
              <tr>
                {selection ? (
                  <th scope="col" className="ia-left">
                    <span className="sr-only">Compare</span>
                  </th>
                ) : null}
                {showRank ? (
                  <th scope="col" className="ia-left" title="Rank, and its change against the comparison period">
                    #
                  </th>
                ) : null}
                {header({ key: "label", label: labelHeader }, true)}
                {columns.map((column) => header(column))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <Fragment key={row.key}>
                  {renderRow(row, false)}
                  {open.has(row.key) ? (row.children ?? []).map((child) => renderRow(child, true, `${row.key}:`)) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {foot ? <div className="ia-table__foot">{foot}</div> : null}
    </CrmCard>
  );
}
