"use client";

import type { ObservabilityDeleteResponse } from "@/lib/api/admin";

export function formatDeleteResult(result: ObservabilityDeleteResponse): string {
  if (result.skipped.length > 0) {
    return `Deleted ${result.deleted} record(s); skipped ${result.skipped.length}.`;
  }
  return `Deleted ${result.deleted} record(s).`;
}

export function confirmDeleteRecords(label: string, count: number): boolean {
  return window.confirm(
    `Delete ${count} ${label} record${count === 1 ? "" : "s"}? This cannot be undone.`,
  );
}

export function SelectionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-input"
    />
  );
}
