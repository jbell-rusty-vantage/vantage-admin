"use client";
/**
 * UI1-OVERVIEW (UI-1 §4.1, E18): the period picker. `Today · Yesterday · Last 7 days · This week · Last 30 days ·
 * This month · Custom` → `period=` (plus `from` / `to` ET days for Custom). With no period chosen the server applies
 * two defaults (activity Today, spend and outcomes Last 7 days); the picker then reads the split label built from
 * `periods.activity.key` and `periods.spend.key`. Choosing a period sets both. The URL is the only store.
 */
import { useId, useState } from "react";
import type { Overview } from "@/lib/api/salesIntelligence";
import { OVERVIEW_PERIODS } from "../data/requests";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { SkeletonBlock } from "../primitives";

const t = copy.ui1.overview.period;
export type PeriodPatch = { period: string | null; from: string | null; to: string | null };
type Periods = Overview["periods"];

/** `Last 7 days`; an unknown key prints as sent. */
export const periodWord = (key: string): string => t.names[key] ?? key;

/** One label when both periods are the same, else `Today · spend and outcomes: last 7 days`. */
export function periodLabel(periods: Periods | null | undefined): string {
  if (!periods) return t.splitDefault(periodWord("today"), periodWord("last_7_days"));
  const { activity, spend } = periods;
  return activity.key === spend.key ? periodWord(activity.key) : t.splitDefault(periodWord(activity.key), periodWord(spend.key));
}

/** The URL patch for a choice: one `period` for both, `from` / `to` only with Custom. */
export function periodPatch(key: string, range: { from: string | null; to: string | null } = { from: null, to: null }): PeriodPatch {
  if (!key) return { period: null, from: null, to: null };
  return key === "custom" ? { period: "custom", from: range.from, to: range.to } : { period: key, from: null, to: null };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function PeriodPicker({
  value,
  from,
  to,
  periods,
  onChange,
  className,
}: {
  /** The URL's `period`; null → the server's split default. */
  value: string | null;
  from: string | null;
  to: string | null;
  /** The response's `periods`; null while loading or with the feature off. */
  periods: Periods | null | undefined;
  onChange: (patch: PeriodPatch) => void;
  className?: string;
}) {
  const id = useId();
  const [customOpen, setCustomOpen] = useState(value === "custom");
  const [draft, setDraft] = useState({ from: from ?? periods?.activity.from_day ?? "", to: to ?? periods?.activity.to_day ?? "" });
  const showCustom = customOpen || value === "custom";
  const selected = showCustom ? "custom" : value ?? "";
  const valid = DAY.test(draft.from) && DAY.test(draft.to) && draft.from <= draft.to;

  return (
    <div className={cx("si-ovperiod", className)} data-period={value ?? "default"}>
      <label className="si-ovperiod__label" htmlFor={`${id}-select`}>{t.label}</label>
      <select
        id={`${id}-select`}
        className="si-ovperiod__select"
        value={selected}
        onChange={(event) => {
          const key = event.target.value;
          if (key === "custom") { setCustomOpen(true); return; }
          setCustomOpen(false);
          onChange(periodPatch(key));
        }}
      >
        {value == null && <option value="">{periodLabel(periods)}</option>}
        {OVERVIEW_PERIODS.map((key) => (
          <option key={key} value={key}>{periodWord(key)}</option>
        ))}
      </select>
      {showCustom && (
        <form
          className="si-ovperiod__custom"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onChange(periodPatch("custom", draft));
          }}
        >
          <label className="si-ovperiod__field">
            <span>{t.from}</span>
            <input type="date" className="si-ovperiod__date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </label>
          <label className="si-ovperiod__field">
            <span>{t.to}</span>
            <input type="date" className="si-ovperiod__date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </label>
          <button type="submit" className="si-ovperiod__apply" disabled={!valid}>{t.apply}</button>
          <span className="si-ovperiod__hint">{t.customHint}</span>
        </form>
      )}
    </div>
  );
}

export function PeriodPickerSkeleton() {
  return (
    <div className="si-ovperiod is-skeleton" aria-hidden>
      <SkeletonBlock height={36} width={280} />
    </div>
  );
}
PeriodPicker.Skeleton = PeriodPickerSkeleton;
