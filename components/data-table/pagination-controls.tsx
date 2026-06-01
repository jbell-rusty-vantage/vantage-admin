"use client";

import { Button } from "@/components/ui/button";
import { SelectFilter } from "@/components/filters/select-filter";
import { PAGE_SIZE_OPTIONS } from "@/lib/api/filters";
import type { SelectOption } from "@/lib/api/types";

const pageSizeOptions: SelectOption<string>[] = PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: `${size} rows`,
}));

export function PaginationControls({
  page,
  limit,
  hasNextPage,
  total,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  hasNextPage?: boolean;
  total?: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const totalPages = typeof total === "number" ? Math.max(Math.ceil(total / limit), 1) : undefined;
  const disableNext = totalPages ? page >= totalPages : hasNextPage === false;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Page {page}
        {totalPages ? ` of ${totalPages}` : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-36">
          <SelectFilter
            value={String(limit)}
            options={pageSizeOptions}
            onChange={(value) => onLimitChange(Number(value))}
          />
        </div>
        <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={disableNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
