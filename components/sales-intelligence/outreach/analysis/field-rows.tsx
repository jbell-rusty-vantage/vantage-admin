import type { ReactNode } from "react";

/**
 * Label/value rows on a per-row grid: each row is its own grid, so a wrapper can never land in the wrong column.
 * Moved from `_legacy/assessment-section.tsx` (UI1-TOP) so the kept `full-output.tsx` imports nothing from `_legacy/`.
 */
export function FieldRows({ rows, className }: { rows: { label: string; value: ReactNode }[]; className?: string }) {
  if (!rows.length) return null;
  return (
    <dl className={className ? `si-fields ${className}` : "si-fields"}>
      {rows.map((row) => (
        <div key={row.label} className="si-fields__row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
