"use client";
/**
 * UI1-PRESET (UI-1 §3.2, addendum §5, UX7, UX24): the Priority preset bar, the only Priority control on the
 * page. `All · New · Quoted · Other` (plus a highlighted, non-pressable `Custom` when the multi-select matches
 * none of them), a disclosure popover listing every Priority key in `priority_counts` with its count for the
 * current view, and the Lead toggle `All · Has a Lead · No Lead`.
 *
 * Counts are the server's (`priority_counts[key][attention | active | closed]`); nothing is summed or derived.
 * Choosing `No Lead` clears the Priority selection (a record with no Lead has no code, so any code would empty
 * the list) and disables the presets and the multi-select, saying why.
 *
 * `usePresetSelection({ userId })` is the URL-backed state for the desk and the Overview: the URL is the source
 * of truth, a change writes both the URL and per-user storage, and a page opened with neither `priority` nor
 * `attachment` gets the remembered choice (all three through `useDeskUrlState`).
 */
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { PriorityCounts } from "@/lib/api/salesIntelligence";
import { presetOf, presetPriority, type PriorityPreset } from "../data/preset-storage";
import { useDeskUrlState } from "../data/use-url-state";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

export type PresetView = "overview" | "attention" | "all_outreach" | "closed";
export type PresetValue = { priority: string[]; attachment: "lead" | "none" | null };
export type PresetBarProps = {
  /** `data.priority_counts`; absent without ATTENTION_V2, then the options show no counts. */
  counts: PriorityCounts | null | undefined;
  view: PresetView;
  value: PresetValue;
  onChange: (next: PresetValue) => void;
  className?: string;
};

const p = copy.ui1.desk.preset;
const PRESETS = ["all", "new", "quoted", "other"] as const;
const LEADS = [
  { value: null, label: copy.ui1.desk.lead.all },
  { value: "lead", label: copy.ui1.desk.lead.hasLead },
  { value: "none", label: copy.ui1.desk.lead.noLead },
] as const;

/** Which `priority_counts` column a view reads: Needs Attention → attention, Closed → closed, else active. */
export function countField(view: PresetView): "attention" | "active" | "closed" {
  return view === "attention" ? "attention" : view === "closed" ? "closed" : "active";
}

/** `0 Fresh` … `8 CRM dead`, `{n} Unknown meaning`, `Not set`, `No Lead` (COPY-UI1 §5). */
export function priorityLabel(key: string): string {
  const known = (copy.ui1.desk.priority as Record<string, unknown>)[key];
  if (typeof known === "string") return known;
  return copy.ui1.desk.priority.unknown(key);
}

/** Every key in `counts` (minus `no_lead`, which lives on the Lead toggle) plus any selected key, numeric order, `not_set` last. */
export function priorityOptions(counts: PriorityCounts | null | undefined, selected: readonly string[] = []): string[] {
  const keys = new Set([...Object.keys(counts ?? {}), ...selected]);
  keys.delete("no_lead");
  const rank = (key: string) => (key === "not_set" ? Number.POSITIVE_INFINITY : Number.isFinite(Number(key)) ? Number(key) : Number.MAX_SAFE_INTEGER);
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function countFor(counts: PriorityCounts | null | undefined, key: string, view: PresetView): number | null {
  const row = counts?.[key];
  return row ? row[countField(view)] : null;
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** Pressing a preset: its codes, the Lead toggle unchanged. */
export const presetChange = (name: Exclude<PriorityPreset, "custom">, value: PresetValue): PresetValue => ({ priority: presetPriority(name), attachment: value.attachment });
/** The Lead toggle: `No Lead` clears Priority (no code applies); the other two keep it. */
export const leadChange = (attachment: PresetValue["attachment"], value: PresetValue): PresetValue => ({ priority: attachment === "none" ? [] : value.priority, attachment });
/** Checking / unchecking one code in the multi-select. */
export const priorityToggle = (key: string, value: PresetValue): PresetValue => ({
  priority: value.priority.includes(key) ? value.priority.filter((k) => k !== key) : [...value.priority, key],
  attachment: value.attachment,
});

export function PresetBar({ counts, view, value, onChange, className }: PresetBarProps) {
  const preset: PriorityPreset = presetOf(value.priority);
  const noLead = value.attachment === "none";
  const noteId = useId();
  const noLeadCount = countFor(counts, "no_lead", view);
  const disabledProps = noLead ? { disabled: true, "aria-describedby": noteId, title: copy.ui1.desk.lead.noLeadDisablesPresets } : {};

  return (
    <div className={cx("si-presetbar", noLead && "is-nolead", className)} data-view={view} data-preset={noLead ? "no_lead" : preset}>
      <div className="si-seg" role="group" aria-label={p.presetsLabel}>
        {PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            className={cx("si-seg__btn", !noLead && preset === name && "is-active")}
            aria-pressed={!noLead && preset === name}
            data-preset-btn={name}
            onClick={() => onChange(presetChange(name, value))}
            {...disabledProps}
          >
            {p[name]}
          </button>
        ))}
        {preset === "custom" && !noLead && (
          <span className="si-seg__btn si-seg__custom is-active" data-preset-btn="custom">{p.custom}</span>
        )}
      </div>
      <PriorityMenu counts={counts} view={view} value={value} onChange={onChange} disabled={noLead} noteId={noteId} />
      <div className="si-seg si-presetbar__lead" role="group" aria-label={copy.ui1.desk.lead.label}>
        {LEADS.map((option) => {
          const active = value.attachment === option.value;
          return (
            <button
              key={option.label}
              type="button"
              className={cx("si-seg__btn", active && "is-active")}
              aria-pressed={active}
              data-lead-btn={option.value ?? "all"}
              onClick={() => onChange(leadChange(option.value, value))}
            >
              {option.label}
              {option.value === "none" && noLeadCount != null && (
                <span className="si-seg__count" aria-label={p.countLabel(noLeadCount)}>{fmt(noLeadCount)}</span>
              )}
            </button>
          );
        })}
      </div>
      {noLead && <p id={noteId} className="si-presetbar__note">{copy.ui1.desk.lead.noLeadDisablesPresets}</p>}
    </div>
  );
}

function PriorityMenu({ counts, view, value, onChange, disabled, noteId }: PresetBarProps & { disabled: boolean; noteId: string }) {
  const [openState, setOpen] = useState(false);
  // Disabled (No Lead) always reads as closed, without an effect.
  const open = openState && !disabled;
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = priorityOptions(counts, value.priority);
  const n = new Set(value.priority).size;
  const triggerText = `${p.priorityLabel} · ${n ? p.selected(n) : p.all}`;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close(true);
    }
  };

  return (
    <div ref={wrapRef} className="si-prioritymenu" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="si-prioritymenu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        aria-describedby={disabled ? noteId : undefined}
        title={disabled ? copy.ui1.desk.lead.noLeadDisablesPresets : undefined}
        onClick={() => setOpen((on) => !on)}
      >
        <span>{triggerText}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      <div id={panelId} className="si-prioritymenu__panel" role="group" aria-label={p.optionsLabel} hidden={!open}>
        {options.map((key) => {
          const count = countFor(counts, key, view);
          return (
            <label key={key} className="si-check si-prioritymenu__option" data-priority-option={key}>
              <input type="checkbox" checked={value.priority.includes(key)} onChange={() => onChange(priorityToggle(key, value))} disabled={disabled} />
              <span className="si-prioritymenu__label">{priorityLabel(key)}</span>
              {count != null && <span className="si-prioritymenu__count" aria-label={p.countLabel(count)}>{fmt(count)}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PresetBarSkeleton() {
  return (
    <div className="si-presetbar is-skeleton" aria-hidden>
      <span className="si-skeleton si-presetbar__skseg" />
      <span className="si-skeleton si-presetbar__skpill" />
      <span className="si-skeleton si-presetbar__skpill" />
    </div>
  );
}

PresetBar.Skeleton = PresetBarSkeleton;

/**
 * The URL-backed preset selection for the desk and the Overview. Pass the signed-in admin's id so the choice is
 * remembered per user (without it the URL alone holds it). Only one caller per page should pass `userId`.
 */
export function usePresetSelection({ userId }: { userId?: string | null } = {}) {
  const { state, update, isPending } = useDeskUrlState({ userId });
  const { priority, attachment } = state;
  const value: PresetValue = useMemo(() => ({ priority, attachment }), [priority, attachment]);
  const setValue = useCallback((next: PresetValue) => update({ priority: next.priority, attachment: next.attachment }), [update]);
  const presetName: PriorityPreset | "no_lead" = attachment === "none" ? "no_lead" : presetOf(priority);
  return { value, setValue, presetName, isPending };
}
