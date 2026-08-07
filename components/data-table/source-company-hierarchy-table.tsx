"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  SourceCompanyMetricRow,
  SourceGranularityMetricRow,
} from "@/lib/api/admin";
import { cn } from "@/lib/utils";

export type SourceCompanyHierarchyColumn = {
  key: string;
  header: React.ReactNode;
  cell: (row: SourceCompanyMetricRow | SourceGranularityMetricRow) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export function formatSourceHierarchyLabel(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sourceCompanyRowLabel(row: SourceCompanyMetricRow): string {
  return (
    (typeof row.source_company_label === "string" && row.source_company_label.trim()
      ? row.source_company_label
      : undefined) ??
    formatSourceHierarchyLabel(row.source_company)
  );
}

export function sourceGranularityRowLabel(row: SourceGranularityMetricRow): string {
  return (
    (typeof row.source_granularity_label === "string" && row.source_granularity_label.trim()
      ? row.source_granularity_label
      : undefined) ??
    formatSourceHierarchyLabel(row.source_granularity_key)
  );
}

export function hasSourceGranularities(row: SourceCompanyMetricRow): boolean {
  return Array.isArray(row.granularities) && row.granularities.length > 0;
}

export function isSourceCompanyHierarchyReport(report: string): boolean {
  return (
    report === "source-company-performance" ||
    report === "source-company-funnel"
  );
}

export function shouldUseSourceCompanyHierarchy(
  report: string,
  rows: readonly Record<string, unknown>[],
): boolean {
  return (
    isSourceCompanyHierarchyReport(report) &&
    rows.some((row) => typeof row.source_company === "string")
  );
}

export function sourceCompanyParentKey(
  row: SourceCompanyMetricRow,
  index: number,
): string {
  const sourceCompany = row.source_company?.trim().toLowerCase();
  return sourceCompany || `unknown-${index}`;
}

export function sourceCompanyChartLabel(
  row: Record<string, unknown>,
  genericLabel?: unknown,
): string {
  for (const value of [
    row.source_company_label,
    row.source_label,
    row.source_company,
    genericLabel,
  ]) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return "Unknown";
}

export function sourceCompanyChartRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== "granularities"),
    )
  );
}

export function SourceCompanyHierarchyTable({
  rows,
  columns,
  getParentKey = sourceCompanyParentKey,
  defaultExpanded = true,
  compact = false,
  stickyHeader = false,
}: {
  rows: SourceCompanyMetricRow[];
  columns: SourceCompanyHierarchyColumn[];
  getParentKey?: (row: SourceCompanyMetricRow, index: number) => string;
  defaultExpanded?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isExpanded(key: string): boolean {
    return overrides[key] ?? defaultExpanded;
  }

  function toggle(key: string) {
    setOverrides((current) => ({
      ...current,
      [key]: !(current[key] ?? defaultExpanded),
    }));
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-max text-sm">
        <thead
          className={cn(
            "bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground",
            stickyHeader ? "sticky top-0 z-20 shadow-sm" : undefined,
          )}
        >
          <tr>
            <th className={cn(compact ? "px-3 py-2" : "px-4 py-3", "font-medium")}>
              Source
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  compact ? "px-3 py-2" : "px-4 py-3",
                  "font-medium",
                  column.className,
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const parentKey = getParentKey(row, index);
            const children = Array.isArray(row.granularities) ? row.granularities : [];
            const expandable = children.length > 0;
            const expanded = expandable && isExpanded(parentKey);

            return (
              <SourceHierarchyRows
                key={parentKey}
                row={row}
                parentKey={parentKey}
                columns={columns}
                granularities={children}
                expandable={expandable}
                expanded={expanded}
                compact={compact}
                onToggle={() => toggle(parentKey)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SourceHierarchyRows({
  row,
  parentKey,
  columns,
  granularities,
  expandable,
  expanded,
  compact,
  onToggle,
}: {
  row: SourceCompanyMetricRow;
  parentKey: string;
  columns: SourceCompanyHierarchyColumn[];
  granularities: SourceGranularityMetricRow[];
  expandable: boolean;
  expanded: boolean;
  compact: boolean;
  onToggle: () => void;
}) {
  const cellPadding = compact ? "px-3 py-2" : "px-4 py-3";
  const childRowIdPrefix = useId();
  const controlledRowIds = granularities
    .map((_, index) => `${childRowIdPrefix}-child-${index}`)
    .join(" ");

  return (
    <>
      <tr className="border-t bg-muted/20">
        <td className={cn(cellPadding, "font-semibold")}>
          <div className="flex items-center gap-1.5">
            {expandable ? (
              <button
                type="button"
                className="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${sourceCompanyRowLabel(row)}`}
                aria-expanded={expanded}
                aria-controls={controlledRowIds}
                onClick={onToggle}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}
            <span>{sourceCompanyRowLabel(row)}</span>
          </div>
        </td>
        {columns.map((column) => (
          <td
            key={column.key}
            className={cn(cellPadding, "align-top font-medium", column.className, column.cellClassName)}
          >
            {column.cell(row)}
          </td>
        ))}
      </tr>
      {granularities.map((child, childIndex) => (
            <tr
              key={`${parentKey}-${child.source_granularity_key ?? "unknown"}-${childIndex}`}
              id={`${childRowIdPrefix}-child-${childIndex}`}
              className="border-t"
              hidden={!expanded}
            >
              <td className={cn(cellPadding, "text-muted-foreground")}>
                <div className="pl-9">{sourceGranularityRowLabel(child)}</div>
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(cellPadding, "align-top", column.className, column.cellClassName)}
                >
                  {column.cell(child)}
                </td>
              ))}
            </tr>
          ))}
    </>
  );
}
