"use client";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";
const options = [["overdue_followup", "Overdue"], ["due_today", "Due today"], ["no_next_step", "No next step"], ["blocked", "Blocked from calling"]] as const;
export function FollowupFilter({ value, onChange, available }: { value: DeskUrlState; onChange: (patch: DeskUrlPatch) => void; available: boolean }) {
  return <fieldset className="si-searchctl si-searchctl__followup" disabled={!available} data-control="followup"><legend>Follow-up</legend>
    {options.map(([key, label]) => <label key={key} className="si-check"><input type="checkbox" checked={value.work.includes(key)} onChange={() => onChange({ work: value.work.includes(key) ? value.work.filter((item) => item !== key) : [...value.work, key] })} />{label}</label>)}
    {!available && <small>Not available yet</small>}
  </fieldset>;
}
