"use client";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";
const options = [["overdue_followup", "Overdue"], ["due_today", "Due today"], ["no_next_step", "No next step"], ["blocked", "Blocked from calling"]] as const;
export function FollowupFilter({ value, onChange, available }: { value: DeskUrlState; onChange: (patch: DeskUrlPatch) => void; available: boolean }) {
  return <details className="si-searchctl si-searchctl__compact" data-control="followup"><summary aria-disabled={!available} onClick={(event) => { if (!available) event.preventDefault(); }}><span>Follow-up</span><strong>{available ? value.work.length ? `${value.work.length} selected` : "Any" : "Not available yet"}</strong></summary>
    <fieldset className="si-searchctl__followup si-searchctl__panel" disabled={!available}><legend className="si-sr">Follow-up</legend>
    {options.map(([key, label]) => <label key={key} className="si-check"><input type="checkbox" checked={value.work.includes(key)} onChange={() => onChange({ work: value.work.includes(key) ? value.work.filter((item) => item !== key) : [...value.work, key] })} />{label}</label>)}
    {!available && <small>Not available yet</small>}
    </fieldset>
  </details>;
}
