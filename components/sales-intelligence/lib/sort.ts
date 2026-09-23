import {
  ATTENTION_SORT_DEFAULT_DIRECTION,
  parseAttentionSort,
  parseDirection,
  parseNumberSort,
  type AttentionSort,
  type NumberSort,
} from "@/lib/api/salesIntelligence";

/**
 * LP-07 (§14.3–14.4). One `Sort by` control per list. The server owns the order: Admin
 * sends `sort`/`direction`, renders the page in the order it arrives and never sorts
 * a loaded page locally.
 *
 * The Outreach option list is a typed array so MAUX-02 appends its score options
 * (`transaction_intent`, `move_likelihood`, "Highest first" / "Lowest first", kind "score")
 * to this same array instead of building a second control.
 */
export type SortDirection = "asc" | "desc";
export type SortOption<Value extends string> = {
  value: Value;
  label: string;
  /** "order" is the band grouping; "time" and (later) "score" render one flat list in server order. */
  kind: "order" | "time" | "score";
  defaultDirection: SortDirection;
  /** Visible direction words. Absent means the option has no direction toggle. */
  directions?: { asc: string; desc: string };
  /** §14.3: what a null key means for this sort. Null and unknown are different facts. */
  nullLabel?: string;
};

const SOONEST_LATEST = { asc: "Soonest first", desc: "Latest first" } as const;
const NEWEST_OLDEST = { asc: "Oldest first", desc: "Newest first" } as const;

export const OUTREACH_SORT_OPTIONS: readonly SortOption<AttentionSort>[] = [
  { value: "attention", label: "Attention order", kind: "order", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.attention },
  { value: "next_action_due", label: "Next action due", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.next_action_due, directions: SOONEST_LATEST, nullLabel: "No next action" },
  { value: "lead_received", label: "Lead received", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.lead_received, directions: NEWEST_OLDEST, nullLabel: "Not a Lead" },
  { value: "last_human_contact", label: "Last human contact", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.last_human_contact, directions: NEWEST_OLDEST, nullLabel: "No conversation observed" },
  { value: "last_lead_progress", label: "Last Lead progress", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.last_lead_progress, directions: NEWEST_OLDEST, nullLabel: "Time unknown" },
];

export const NUMBER_SORT_OPTIONS: readonly SortOption<NumberSort>[] = [
  { value: "last_activity", label: "Last call activity", kind: "time", defaultDirection: "desc", directions: NEWEST_OLDEST },
  { value: "last_human_conversation", label: "Last human conversation", kind: "time", defaultDirection: "desc", directions: NEWEST_OLDEST },
  { value: "first_observed", label: "First observed", kind: "time", defaultDirection: "desc", directions: NEWEST_OLDEST },
];

export const NUMBER_SORT_DEFAULT: { sort: NumberSort; direction: SortDirection } = { sort: "last_activity", direction: "desc" };

export function sortOption<Value extends string>(options: readonly SortOption<Value>[], value: string | null | undefined): SortOption<Value> | undefined {
  return options.find((option) => option.value === value);
}

export type OutreachSortState = { sort: AttentionSort; direction: SortDirection };
export type NumberSortState = { sort: NumberSort; direction: SortDirection };

/** URL keys `sort` / `direction`. Unknown values fall back to Attention order with its default direction. */
export function outreachSortFromParams(params: URLSearchParams): OutreachSortState {
  const sort = parseAttentionSort(params.get("sort"));
  return { sort, direction: parseDirection(params.get("direction"), ATTENTION_SORT_DEFAULT_DIRECTION[sort]) };
}

/** URL keys `number_sort` / `number_direction`. */
export function numberSortFromParams(params: URLSearchParams): NumberSortState {
  const sort = parseNumberSort(params.get("number_sort"));
  return { sort, direction: parseDirection(params.get("number_direction"), NUMBER_SORT_DEFAULT.direction) };
}

/**
 * Attention order is sent as no parameters at all, so a server without the sort
 * contract sees exactly the request it always saw.
 */
export function applyOutreachSort(query: URLSearchParams, state: OutreachSortState) {
  if (state.sort === "attention") return;
  query.set("sort", state.sort);
  query.set("direction", state.direction);
}

export function applyNumberSort(query: URLSearchParams, state: NumberSortState) {
  if (state.sort === NUMBER_SORT_DEFAULT.sort && state.direction === NUMBER_SORT_DEFAULT.direction) return;
  query.set("sort", state.sort);
  query.set("direction", state.direction);
}

export function isDefaultNumberSort(state: NumberSortState) {
  return state.sort === NUMBER_SORT_DEFAULT.sort && state.direction === NUMBER_SORT_DEFAULT.direction;
}

export function directionLabel(option: SortOption<string> | undefined, direction: SortDirection): string | null {
  return option?.directions ? option.directions[direction] : null;
}

/** The flat card's sort line: a date, the sort's own null wording, or Unknown when the key is absent. */
export function sortKeyText(option: SortOption<string> | undefined, value: string | null | undefined, format: (iso: string) => string, unknown: string): string {
  if (value === undefined) return unknown;
  if (value === null) return option?.nullLabel ?? unknown;
  return format(value);
}

export const flipDirection = (direction: SortDirection): SortDirection => (direction === "asc" ? "desc" : "asc");

/** The layout follows the order the server says it produced, never the order Admin asked for. */
export function outreachLayout(served: string | undefined): "bands" | "flat" {
  if (!served) return "bands";
  const option = sortOption(OUTREACH_SORT_OPTIONS, served);
  return option && option.kind === "order" ? "bands" : "flat";
}
