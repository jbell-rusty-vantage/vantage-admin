"use client";

import { Input } from "@/components/ui/input";

export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from?: string; to?: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="date"
        value={from ?? ""}
        aria-label="From date"
        onChange={(event) => onChange({ from: event.target.value || undefined, to })}
      />
      <Input
        type="date"
        value={to ?? ""}
        aria-label="To date"
        onChange={(event) => onChange({ from, to: event.target.value || undefined })}
      />
    </div>
  );
}
