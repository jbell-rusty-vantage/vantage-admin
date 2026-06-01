"use client";

import type { DatabaseScope } from "@/lib/api/types";
import {
  DATABASE_SCOPE_LABELS,
  DATABASE_SCOPE_OPTIONS,
  OPERATIONAL_DATABASE_SCOPE_OPTIONS,
} from "@/lib/constants/domain";
import { SelectFilter } from "@/components/filters/select-filter";
import { StatusBadge } from "@/components/data-table/status-badge";

export function DatabaseScopeSelector({
  value,
  onChange,
  includeCombined = false,
}: {
  value: DatabaseScope;
  onChange: (value: DatabaseScope) => void;
  includeCombined?: boolean;
}) {
  const options = includeCombined ? DATABASE_SCOPE_OPTIONS : OPERATIONAL_DATABASE_SCOPE_OPTIONS;

  return (
    <div className="flex items-center gap-3">
      <StatusBadge tone={value === "historical" ? "warning" : value === "combined" ? "muted" : "success"}>
        {DATABASE_SCOPE_LABELS[value]}
      </StatusBadge>
      <div className="w-56">
        <SelectFilter value={value} options={options} onChange={(next) => onChange(next || "production")} />
      </div>
    </div>
  );
}
