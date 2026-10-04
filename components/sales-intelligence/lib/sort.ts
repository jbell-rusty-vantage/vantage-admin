import type { NumberSort } from "@/lib/api/salesIntelligence";

/**
 * LP-07 (§14.3–14.4). One `Sort by` control for the Numbers list. The server owns the order: Admin sends
 * `sort`/`direction`, renders the page in the order it arrives and never sorts a loaded page locally.
 */
export type SortDirection = "asc" | "desc";
export type SortOption<Value extends string> = {
  value: Value;
  label: string;
  defaultDirection: SortDirection;
  /** Visible direction words. Absent means the option has no direction toggle. */
  directions?: { asc: string; desc: string };
};

const NEWEST_OLDEST = { asc: "Oldest first", desc: "Newest first" } as const;
const MOST_FEWEST = { asc: "Fewest first", desc: "Most first" } as const;

export const NUMBER_SORT_OPTIONS: readonly SortOption<NumberSort>[] = [
  { value: "last_activity", label: "Last call activity", defaultDirection: "desc", directions: NEWEST_OLDEST },
  { value: "last_human_conversation", label: "Last human conversation", defaultDirection: "desc", directions: NEWEST_OLDEST },
  { value: "first_observed", label: "First observed", defaultDirection: "desc", directions: NEWEST_OLDEST },
  { value: "interactions", label: "Calls", defaultDirection: "desc", directions: MOST_FEWEST },
];

export function sortOption<Value extends string>(options: readonly SortOption<Value>[], value: string | null | undefined): SortOption<Value> | undefined {
  return options.find((option) => option.value === value);
}

export function directionLabel(option: SortOption<string> | undefined, direction: SortDirection): string | null {
  return option?.directions ? option.directions[direction] : null;
}

export const flipDirection = (direction: SortDirection): SortDirection => (direction === "asc" ? "desc" : "asc");
