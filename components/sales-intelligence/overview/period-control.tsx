"use client";
import { useId, useState } from "react";
import { copy } from "../sales-intelligence-copy";

export type PeriodChoice = { key: string; from: string | null; through: string | null };
const names = copy.oi.overview.periodNames;
const keys = ["today", "yesterday", "last_7_days", "this_week", "last_30_days", "this_month", "custom"];
const dayTime = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(time.getTime()) || time.toISOString().slice(0, 10) !== day ? null : time.getTime();
};

export function customRangeError(from: string, through: string): string | null {
  const t = copy.oi.overview;
  if (!from || !through) return t.rangeIncomplete;
  const start = dayTime(from);
  const end = dayTime(through);
  if (start === null || end === null) return t.rangeInvalid;
  if (end < start) return t.rangeOrder;
  if ((end - start) / 86_400_000 + 1 > 92) return t.rangeTooLong;
  return null;
}

export function PeriodControl({ label, value, onChange }: { label: string; value: PeriodChoice; onChange: (choice: PeriodChoice) => void }) {
  const id = useId();
  const [draft, setDraft] = useState({ from: value.from ?? "", through: value.through ?? "" });
  const [customOpen, setCustomOpen] = useState(value.key === "custom");
  const rangeError = customRangeError(draft.from, draft.through);
  return <div className="si-oi-period">
    <label htmlFor={id}>{label}</label>
    <select id={id} value={customOpen ? "custom" : value.key} onChange={(event) => { if (event.target.value === "custom") setCustomOpen(true); else { setCustomOpen(false); onChange({ key: event.target.value, from: null, through: null }); } }}>
      {keys.map((key) => <option key={key} value={key}>{names[key] ?? key}</option>)}
    </select>
    {customOpen && <form onSubmit={(event) => { event.preventDefault(); if (!rangeError) onChange({ key: "custom", ...draft }); }}>
      <label>{copy.oi.overview.from}<input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
      <label>{copy.oi.overview.through}<input type="date" value={draft.through} onChange={(event) => setDraft({ ...draft, through: event.target.value })} /></label>
      {rangeError && <p role="status" aria-live="polite">{rangeError}</p>}
      <button type="submit" disabled={!!rangeError}>{copy.oi.overview.apply}</button>
    </form>}
  </div>;
}
