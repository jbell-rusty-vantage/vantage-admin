"use client";

import { Button } from "@/components/ui/button";
import type { SortDirection } from "@/lib/api/types";

export function SortableHeader({
  field,
  label,
  activeSort,
  direction,
  onSort,
}: {
  field: string;
  label: string;
  activeSort?: string;
  direction?: SortDirection;
  onSort: (field: string, direction: SortDirection) => void;
}) {
  const isActive = activeSort === field;
  const nextDirection: SortDirection = isActive && direction === "asc" ? "desc" : "asc";

  return (
    <Button
      variant="ghost"
      className="-ml-3 h-auto px-3 py-1 text-xs uppercase tracking-wide"
      onClick={() => onSort(field, nextDirection)}
    >
      {label}
      {isActive ? <span className="ml-1">{direction === "asc" ? "↑" : "↓"}</span> : null}
    </Button>
  );
}
