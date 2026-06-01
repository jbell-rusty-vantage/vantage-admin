"use client";

import type { SelectOption } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function SelectFilter<TValue extends string>({
  value,
  options,
  placeholder = "Any",
  onChange,
  className,
}: {
  value?: TValue | "";
  options: readonly SelectOption<TValue>[];
  placeholder?: string;
  onChange: (value: TValue | "") => void;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value as TValue | "")}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
