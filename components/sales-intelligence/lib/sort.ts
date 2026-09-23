import {
  ATTENTION_SORT_DEFAULT_DIRECTION,
  isScoreSort,
  parseAttentionSort,
  scoreLabel,
  type AttentionRow,
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
const HIGHEST_LOWEST = { asc: "Lowest first", desc: "Highest first" } as const;

export const OUTREACH_SORT_OPTIONS: readonly SortOption<AttentionSort>[] = [
  { value: "attention", label: "Attention order", kind: "order", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.attention },
  { value: "next_action_due", label: "Next action due", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.next_action_due, directions: SOONEST_LATEST, nullLabel: "No next action" },
  { value: "lead_received", label: "Lead received", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.lead_received, directions: NEWEST_OLDEST, nullLabel: "Not a Lead" },
  { value: "last_human_contact", label: "Last human contact", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.last_human_contact, directions: NEWEST_OLDEST, nullLabel: "No conversation observed" },
  { value: "last_lead_progress", label: "Last Lead progress", kind: "time", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.last_lead_progress, directions: NEWEST_OLDEST, nullLabel: "Time unknown" },
  // Move assessment §8.2: score sorts rank across all bands (`view=all_outreach`); a newly selected score starts Highest first.
  { value: "transaction_intent", label: "Transaction intent", kind: "score", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.transaction_intent, directions: HIGHEST_LOWEST, nullLabel: "Unknown" },
  { value: "move_likelihood", label: "Move likelihood", kind: "score", defaultDirection: ATTENTION_SORT_DEFAULT_DIRECTION.move_likelihood, directions: HIGHEST_LOWEST, nullLabel: "Unknown" },
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

/** `fresh` is the optional `Fresh assessments only` filter; it only exists in score mode. */
export type OutreachSortState = { sort: AttentionSort; direction: SortDirection; fresh?: boolean };
export type NumberSortState = { sort: NumberSort; direction: SortDirection };

/**
 * URL keys `sort` / `direction` / `freshness`. Unknown values fall back to Attention order with its
 * default direction. The server `view` is not a URL key of its own (the workspace tab already owns
 * `view`): it follows from `sort`, so the URL alone still fully determines the request.
 */
export function outreachSortFromParams(params: URLSearchParams): OutreachSortState {
  const sort = parseAttentionSort(params.get("sort"));
  const direction = parseDirection(params.get("direction"), ATTENTION_SORT_DEFAULT_DIRECTION[sort]);
  return isScoreSort(sort) ? { sort, direction, fresh: params.get("freshness") === "fresh" } : { sort, direction };
}

/** The Attention read's `view`: score sorts rank the whole eligible Outreach population; everything else stays in Attention. */
export function outreachView(sort: AttentionSort): "attention" | "all_outreach" {
  return isScoreSort(sort) ? "all_outreach" : "attention";
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
  // Time sorts keep the server default `view=attention` implicitly (the LP-07 request shape);
  // only a score sort names `all_outreach`, and only it may narrow to fresh assessments.
  if (outreachView(state.sort) === "all_outreach") {
    query.set("view", "all_outreach");
    if (state.fresh) query.set("freshness", "fresh");
  }
}

/**
 * The URL change for a `Sort by` choice. Entering score mode clears the band selection (the ranking is
 * across all bands); a band the Owner re-selects afterwards survives direction and score-to-score changes.
 * Leaving score mode drops `freshness`. Every change restarts at page one.
 */
export function outreachSortUpdate(current: OutreachSortState, next: { sort: AttentionSort; direction: SortDirection }) {
  const entering = isScoreSort(next.sort) && !isScoreSort(current.sort);
  return {
    sort: next.sort === "attention" ? null : next.sort,
    direction: next.sort === "attention" ? null : next.direction,
    ...(entering ? { bands: [] as string[] } : {}),
    ...(isScoreSort(next.sort) ? {} : { freshness: null }),
    attention_cursor: null,
    sort_unavailable: null,
  };
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

export type CardScore = { key: "transaction_intent" | "move_likelihood"; label: string; value: ReturnType<typeof scoreLabel>; numeric: boolean };
export type CardScores = { scores: [CardScore, CardScore]; stale: boolean; limited: boolean };

/**
 * §8.1 card score row, from server facts only. The frozen snapshot `sort_keys` win whenever the
 * server sent them (even as null) so the card shows the number the list was ranked by; the
 * Outreach `move_assessment` projection fills in for snapshots published before the score keys.
 * Limited evidence = both scores present and both at `low` confidence.
 */
export function cardScores(row: Pick<AttentionRow, "sort_keys" | "outreach">): CardScores {
  const keys = row.sort_keys;
  const assessment = row.outreach?.move_assessment ?? null;
  const status = keys?.assessment_status !== undefined ? keys.assessment_status : assessment?.status ?? null;
  const pick = (key: CardScore["key"]) => (keys && keys[key] !== undefined ? keys[key] : assessment?.[key] ?? null);
  const score = (key: CardScore["key"], label: string): CardScore => {
    const value = scoreLabel(status, pick(key), assessment?.applicability);
    return { key, label, value, numeric: value.endsWith(" / 100") };
  };
  const transaction = score("transaction_intent", "Transaction intent");
  const move = score("move_likelihood", "Move likelihood");
  const stale = (keys?.assessment_stale ?? assessment?.stale) === true;
  const limited = transaction.numeric && move.numeric
    && assessment?.transaction_intent_confidence === "low" && assessment?.move_likelihood_confidence === "low";
  return { scores: [transaction, move], stale, limited };
}

/** One line of text for the card score row (and for tests): `Transaction intent 75 / 100 · Move likelihood 100 / 100`. */
export function cardScoresText(value: CardScores): string {
  return value.scores.map((item) => `${item.label} ${item.value}`).join(" · ");
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
