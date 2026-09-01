"use client";

import type { DatabaseScope } from "@/lib/api/types";
import {
  DATABASE_SCOPE_LABELS,
  DATABASE_SCOPE_OPTIONS,
  OPERATIONAL_DATABASE_SCOPE_OPTIONS,
} from "@/lib/constants/domain";
import { cn } from "@/lib/utils";

const SCOPE_DOT_CLASS: Record<DatabaseScope, string> = {
  production: "bg-emerald-500",
  historical: "bg-amber-500",
  combined: "bg-steel",
};

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
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", SCOPE_DOT_CLASS[value])} aria-hidden="true" />
      <select
        aria-label="Database scope"
        value={value}
        onChange={(event) => onChange(event.target.value as DatabaseScope)}
        className={cn(
          "h-9 w-auto min-w-[9.5rem] rounded-md border border-steel-200 bg-white px-2 text-sm text-navy",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {DATABASE_SCOPE_LABELS[option.value]}
          </option>
        ))}
      </select>
    </div>
  );
}
