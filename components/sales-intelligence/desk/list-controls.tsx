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
import type { AttentionCapabilities } from "@/lib/api/salesIntelligence";
import type { DeskUrlState } from "../data/url-state";
import type { RailRep } from "../rail";
import { MoveDateMenu } from "../rail/move-date-menu";
import { LocationFilter } from "../rail/location-filter";
import { RepPicker } from "../rail/rep-picker";
import { FollowupFilter } from "../rail/followup-filter";

type SortWords = { label: string; asc: string | null; desc: string | null; null: string | null };

export function sortOptions(view: DeskView): { key: string; words: SortWords }[] {
  const data = copy.ui1.data;
  if (view === "closed") return CLOSED_SORTS.map((key) => ({ key, words: data.closedSorts[key] }));
  return DESK_SORT_ORDER.map((key) => ({ key, words: data.sorts[key] }));
}

/** All additive search controls share the URL writer; a missing capability leaves their saved URL state visible. */
export function SearchControls({ state, onChange, reps, capabilities, rep, closed }: {
  state: DeskUrlState; onChange: (patch: DeskUrlPatch) => void; reps: readonly RailRep[];
  capabilities: AttentionCapabilities | null; rep: boolean; closed: boolean;
}) {
  const cap = closed ? capabilities?.closed_history : capabilities;
  return <div className="si-searchcontrols" aria-label="Outreach filters">
    <MoveDateMenu key={[state.move_date_mode,state.move_days,state.move_on,state.move_from,state.move_through].join("|")} value={state} onChange={onChange} available={cap?.move_date === true} />
    <LocationFilter key={[state.loc_side,state.loc_city,state.loc_state,state.loc_zip].join("|")} value={state} onChange={onChange} available={cap?.location === true} />
    {!rep && <RepPicker value={state} reps={reps} onChange={onChange} available={cap?.assignment === true && capabilities?.roster === true} />}
    {!closed && <FollowupFilter value={state} onChange={onChange} available={cap?.work === true} />}
    {!rep && !closed && <details className="si-searchctl si-searchctl__more"><summary>More filters</summary>
      <label>Involvement <select className="si-input si-select" value={state.relationship ?? "involved"} disabled={cap?.relationship !== true} onChange={(event) => onChange({ relationship: event.target.value as DeskUrlState["relationship"], agent: state.agent })}>
        <option value="involved">Rep involved (assigned, follow-up or promised)</option><option value="assigned">Assigned</option><option value="followup">Follow-up</option>
      </select></label>
      <select aria-label="Involved rep" className="si-input si-select" value={state.agent ?? ""} disabled={cap?.relationship !== true || capabilities?.roster !== true} onChange={(event) => onChange({ agent: event.target.value || null, relationship: event.target.value ? state.relationship ?? "involved" : null })}>
        <option value="">Any rep</option>{reps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {cap?.relationship !== true && <small>Not available yet</small>}
      <label>Follow-up assignee <select className="si-input si-select" value={state.followup_agent_id[0] ?? ""} disabled={cap?.work !== true || capabilities?.roster !== true} onChange={(event) => onChange({ followup_agent_id: event.target.value ? [event.target.value] : [] })}>
        <option value="">Any rep</option>{reps.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {cap?.work !== true && <small>Not available yet</small>}
    </details>}
  </div>;
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
  moveDateAvailable = false,
  onChange,
}: {
  view: DeskView;
  /** The sort and direction the list is read with (after any fallback). */
  sort: string;
  direction: "asc" | "desc";
  freshness: "fresh" | null;
  moveDateAvailable?: boolean;
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
            <option key={option.key} value={option.key} disabled={option.key === "move_date" && !moveDateAvailable}>{option.words.label}{option.key === "move_date" && !moveDateAvailable ? " · Not available yet" : ""}</option>
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
