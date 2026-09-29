"use client";
import { useState, type FormEvent } from "react";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";

const modes = [
  ["", "Any"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["within:7", "Within 7 days"],
  ["within:14", "Within 14 days"], ["within:30", "Within 30 days"], ["within:60", "Within 60 days"], ["within:90", "Within 90 days"],
  ["within:custom", "Custom days out…"], ["future", "Future moves only"], ["today_onward", "Today onward"],
  ["exact", "Exact date…"], ["range", "Custom range…"], ["past", "Past"], ["unknown", "Unknown"],
] as const;
const day = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function MoveDateMenu({ value, onChange, available }: { value: DeskUrlState; onChange: (patch: DeskUrlPatch) => void; available: boolean }) {
  const [days, setDays] = useState(value.move_days?.toString() ?? "");
  const [on, setOn] = useState(value.move_on ?? "");
  const [from, setFrom] = useState(value.move_from ?? "");
  const [through, setThrough] = useState(value.move_through ?? "");
  const [draftMode, setDraftMode] = useState<string | null>(null);
  const selected = draftMode ?? (value.move_date_mode === "within" ? `within:${[7, 14, 30, 60, 90].includes(value.move_days ?? -1) ? value.move_days : "custom"}` : value.move_date_mode ?? "");
  const base: DeskUrlPatch = { move_date_mode: null, move_days: null, move_on: null, move_from: null, move_through: null, move_date_within: null, move_date_passed: false };
  const pick = (mode: string) => {
    if (["within:custom", "exact", "range"].includes(mode)) { setDraftMode(mode); return; }
    setDraftMode(null);
    onChange(mode.startsWith("within:") ? { ...base, move_date_mode: "within", move_days: Number(mode.split(":")[1]) } : { ...base, move_date_mode: mode || null });
  };
  const valid = selected === "within:custom" ? /^\d+$/.test(days) && Number(days) <= 366 : selected === "exact" ? day(on) : selected === "range" ? day(from) && day(through) && from <= through : false;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onChange(selected === "within:custom" ? { ...base, move_date_mode: "within", move_days: Number(days) }
      : selected === "exact" ? { ...base, move_date_mode: "exact", move_on: on }
      : { ...base, move_date_mode: "range", move_from: from, move_through: through });
    setDraftMode(null);
  };
  return <div className="si-searchctl" data-control="move-date">
    <label>Move date <select className="si-input si-select" value={selected} disabled={!available} title={!available ? "Not available yet" : undefined} onChange={(event) => pick(event.target.value)}>
      {modes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    {!available && <small>Not available yet</small>}
    {available && ["within:custom", "exact", "range"].includes(selected) && <form onSubmit={apply} className="si-searchctl__draft">
      {selected === "within:custom" && <label>Days out <input className="si-input" type="number" min="0" max="366" step="1" value={days} onChange={(event) => setDays(event.target.value)} /></label>}
      {selected === "exact" && <label>Date <input className="si-input" type="date" value={on} onChange={(event) => setOn(event.target.value)} /></label>}
      {selected === "range" && <><label>From <input className="si-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Through <input className="si-input" type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label></>}
      <button type="submit" className="si-btn si-btn--secondary si-hit" disabled={!valid}>Apply</button>
    </form>}
  </div>;
}
