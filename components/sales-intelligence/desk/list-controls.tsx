"use client";
/**
 * UI1-DESK (UI-1 §3.4, final spec §7.2, §8): the sort select, the direction toggle and `Fresh assessments only`.
 *
 * - Needs Attention and All Outreach offer the same nine sorts. Closed has three. Every view defaults to Lead received, newest first.
 * - The direction toggle uses the sort's words and resets to the sort's default when the sort changes
 *   (`deskUrlUpdate` drops `direction` with a new `sort`). Attention order has no direction.
 * - Score sorts show `Fresh assessments only` (`freshness=fresh`).
 * - Every change goes through the URL, which drops the list cursor.
 */
import { ArrowDownUp } from "lucide-react";
import { useId } from "react";
import {
  CLOSED_DEFAULT_SORT, CLOSED_SORTS, DESK_SORT_ORDER, DESK_DEFAULT_SORT, isScoreSort,
} from "@/lib/api/salesIntelligence";
import type { DeskUrlPatch } from "../data/url-state";
import type { DeskView } from "../data/requests";
import { copy } from "../sales-intelligence-copy";

type SortWords = { label: string; asc: string | null; desc: string | null; null: string | null };

export function sortOptions(view: DeskView): { key: string; words: SortWords }[] {
  const data = copy.ui1.data;
  if (view === "closed") return CLOSED_SORTS.map((key) => ({ key, words: data.closedSorts[key] }));
  return DESK_SORT_ORDER.map((key) => ({ key, words: data.sorts[key] }));
}

export function sortWords(view: DeskView, sort: string): SortWords | null {
  return sortOptions(view).find((option) => option.key === sort)?.words ?? null;
}

export function defaultSortOf(view: DeskView): string {
  return view === "closed" ? CLOSED_DEFAULT_SORT : DESK_DEFAULT_SORT;
}

/** The patch for a newly chosen sort: the view's default is written as no `sort` (and the direction resets). */
export function sortPatch(view: DeskView, sort: string): DeskUrlPatch {
  return { sort: sort === defaultSortOf(view) ? null : sort, direction: null };
}

export function ListControls({
  view,
  sort,
  direction,
  freshness,
  onChange,
}: {
  view: DeskView;
  /** The sort and direction the list is read with (after any fallback). */
  sort: string;
  direction: "asc" | "desc";
  freshness: "fresh" | null;
  onChange: (patch: DeskUrlPatch) => void;
}) {
  const id = useId();
  const d = copy.ui1;
  const words = sortWords(view, sort);
  const word = words ? words[direction] : null;
  return (
    <div className="si-desk__controls" data-sort={sort} data-direction={direction}>
      <label className="si-desk__sort" htmlFor={`${id}-sort`}>
        <span className="si-desk__sortlabel">{d.desk.sortLabel}</span>
        <select id={`${id}-sort`} className="si-input si-select si-desk__sortselect" value={sort} onChange={(event) => onChange(sortPatch(view, event.target.value))}>
          {sortOptions(view).map((option) => (
            <option key={option.key} value={option.key}>{option.words.label}</option>
          ))}
        </select>
      </label>
      {word && (
        <button
          type="button"
          className="si-btn si-btn--secondary si-btn--md si-hit si-desk__direction"
          aria-label={d.desk.directionLabel(word)}
          onClick={() => onChange({ direction: direction === "asc" ? "desc" : "asc" })}
        >
          <ArrowDownUp size={16} aria-hidden />
          {word}
        </button>
      )}
      {view !== "closed" && isScoreSort(sort) && (
        <label className="si-check si-desk__fresh">
          <input type="checkbox" checked={freshness === "fresh"} onChange={(event) => onChange({ freshness: event.target.checked ? "fresh" : null })} />
          {d.data.freshOnly}
        </label>
      )}
    </div>
  );
}
