"use client";
/**
 * Transportation pricing building blocks: the distance × move-size rate table (read or edit) and one surcharge group
 * card. Each part edits itself and hands a finished value to its `onSave`; the section turns that into a live save.
 */
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MILEAGE, MILEAGE_LABELS, STATES, VOLUME, VOLUME_LABELS, parseRate, parseRates, rateText, type Group, type Rates } from "@/lib/transportation-pricing";

export type RateTexts = Record<string, Record<string, string>>;
export function toTexts(rates: Record<string, Rates>): RateTexts {
  return Object.fromEntries(MILEAGE.map(band => [band, Object.fromEntries(VOLUME.map(tier => [tier, rateText(rates[band]?.[tier])]))]));
}
export function money(value: string | null | undefined): string {
  const text = rateText(value);
  return text === "" ? "—" : `$${text}`;
}

export function RateInput({ value, onChange, label, disabled }: { value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  const parsed = parseRate(value);
  const state = parsed === undefined ? "invalid" : parsed === null ? "empty" : "filled";
  return (
    <label className={`tp-rate tp-rate-${state}`} title={state === "invalid" ? "Use a number like 3.25" : state === "empty" ? "Empty — use 0 for no charge" : undefined}>
      <span aria-hidden="true">$</span>
      <input aria-label={label} aria-invalid={state === "invalid"} inputMode="decimal" autoComplete="off" placeholder="–" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

/** Rows are distance, columns are move size; every cell is the dollars per cubic foot for the whole load. */
export function RateTable({ rates, texts, onText, disabled }: { rates?: Record<string, Rates>; texts?: RateTexts; onText?: (band: string, tier: string, value: string) => void; disabled?: boolean }) {
  return (
    <div className="tp-table-scroll" tabIndex={0} aria-label="Base rates by distance and move size">
      <table className="tp-table">
        <thead>
          <tr>
            <th scope="col" className="tp-corner"><span>Distance (miles)</span><small>Move size (cu ft) →</small></th>
            {VOLUME.map((tier, i) => <th scope="col" key={tier}>{VOLUME_LABELS[i]}<small>cu ft</small></th>)}
          </tr>
        </thead>
        <tbody>
          {MILEAGE.map((band, i) => (
            <tr key={band}>
              <th scope="row">{MILEAGE_LABELS[i]}<small>miles</small></th>
              {VOLUME.map((tier, j) => (
                <td key={tier}>
                  {texts && onText
                    ? <RateInput label={`${MILEAGE_LABELS[i]} miles, ${VOLUME_LABELS[j]} cubic feet, dollars per cubic foot`} value={texts[band][tier]} disabled={disabled} onChange={value => onText(band, tier, value)} />
                    : <span className={rates?.[band]?.[tier] == null ? "tp-cell-missing" : "tp-cell"}>{money(rates?.[band]?.[tier])}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type GroupEdit = { name: string; active: boolean; states: string[]; texts: Record<string, string> };
function startEdit(group: Group): GroupEdit {
  return { name: group.name, active: group.active, states: [...group.states], texts: Object.fromEntries(VOLUME.map(tier => [tier, rateText(group.rates[tier])])) };
}
/** Why this group can't be saved yet, in one sentence, or null when it can. */
export function groupProblem(group: Group, others: Group[], parsed: { empty: number; invalid: number }): string | null {
  const name = group.name.trim();
  if (!name) return "Give the group a name.";
  if (others.some(other => other.name.trim().toLowerCase() === name.toLowerCase())) return `Another group is already called “${name}”.`;
  if (group.states.length === 0) return "Pick at least one state.";
  if (parsed.invalid) return "Each rate must be a number like 0.50.";
  if (parsed.empty) return `Fill all 7 rates (${parsed.empty} empty). Use 0 for no extra charge.`;
  if (group.active) {
    for (const other of others.filter(o => o.active)) {
      const shared = group.states.find(state => other.states.includes(state));
      if (shared) return `${shared} is already in the active group “${other.name}”. Take it out there first, or turn this group off.`;
    }
  }
  return null;
}

export function GroupCard({ group, others, isNew = false, busy, onSave, onDelete, onCancelNew }: {
  group: Group; others: Group[]; isNew?: boolean; busy: boolean;
  onSave: (group: Group, note: string, success: string) => Promise<boolean>;
  onDelete?: () => Promise<void>; onCancelNew?: () => void;
}) {
  const [edit, setEdit] = useState<GroupEdit | null>(isNew ? startEdit(group) : null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!edit) return;
    const parsed = parseRates(edit.texts);
    const next: Group = { group_id: group.group_id, name: edit.name.trim(), active: edit.active, states: [...edit.states].sort(), rates: parsed.rates };
    const problem = groupProblem(next, others, parsed);
    if (problem) { toastProblem(problem); return; }
    setSaving(true);
    const ok = await onSave(next, isNew ? `Added surcharge group “${next.name}”` : `Updated surcharge group “${next.name}”`, isNew ? `Surcharge group “${next.name}” added` : `Surcharge group “${next.name}” saved`);
    setSaving(false);
    if (ok && !isNew) setEdit(null);
  }
  async function toggleActive() {
    const next = { ...group, active: !group.active };
    const problem = groupProblem(next, others, { empty: 0, invalid: 0 });
    if (problem) { toastProblem(problem); return; }
    setSaving(true);
    await onSave(next, `${next.active ? "Turned on" : "Turned off"} surcharge group “${group.name}”`, `“${group.name}” is ${next.active ? "on" : "off"}`);
    setSaving(false);
  }

  if (!edit) {
    return (
      <article className={`tp-group ${group.active ? "" : "tp-group-off"}`}>
        <header className="tp-group-head">
          <div>
            <h4>{group.name}</h4>
            <p>{group.states.length} state{group.states.length === 1 ? "" : "s"}</p>
          </div>
          <div className="tp-group-tools">
            <Switch checked={group.active} disabled={busy} onChange={() => void toggleActive()} label={group.active ? "On" : "Off"} title={group.active ? "Turn this surcharge off" : "Turn this surcharge on"} />
            <button type="button" className="tp-button" disabled={busy} onClick={() => setEdit(startEdit(group))}><Pencil size={15} />Edit</button>
            {onDelete && <button type="button" className="tp-icon-button" disabled={busy} aria-label={`Delete ${group.name}`} title="Delete group" onClick={() => void onDelete()}><Trash2 size={16} /></button>}
          </div>
        </header>
        <div className="tp-chip-row">{group.states.map(state => <span className="tp-chip" key={state}>{state}</span>)}</div>
        <dl className="tp-group-rates">
          {VOLUME.map((tier, i) => <div key={tier}><dt>{VOLUME_LABELS[i]} cu ft</dt><dd>+{money(group.rates[tier])}</dd></div>)}
        </dl>
        {saving && <p className="tp-saving-line">Saving…</p>}
      </article>
    );
  }

  const set = (value: Partial<GroupEdit>) => setEdit({ ...edit, ...value });
  return (
    <article className="tp-group tp-group-editing">
      <div className="tp-group-edit-head">
        <label className="tp-field">Group name
          <input className="tp-input" value={edit.name} maxLength={80} placeholder="e.g. Mountain states" autoFocus={isNew} onChange={e => set({ name: e.target.value })} />
        </label>
        <Switch checked={edit.active} onChange={() => set({ active: !edit.active })} label={edit.active ? "On — agents' prices include it" : "Off — not applied"} />
      </div>
      <div className="tp-field">
        <span>States <small>{edit.states.length} picked</small></span>
        <div className="tp-state-grid" role="group" aria-label="States in this group">
          {STATES.map(state => {
            const picked = edit.states.includes(state);
            return <button type="button" key={state} aria-pressed={picked} className={`tp-state ${picked ? "tp-state-on" : ""}`} onClick={() => set({ states: picked ? edit.states.filter(s => s !== state) : [...edit.states, state] })}>{state}</button>;
          })}
        </div>
      </div>
      <div className="tp-field">
        <span>Extra per cubic foot, by move size</span>
        <div className="tp-group-rate-inputs">
          {VOLUME.map((tier, i) => (
            <div key={tier}><small>{VOLUME_LABELS[i]} cu ft</small><RateInput label={`${VOLUME_LABELS[i]} cubic feet surcharge`} value={edit.texts[tier]} onChange={value => set({ texts: { ...edit.texts, [tier]: value } })} /></div>
          ))}
        </div>
      </div>
      <footer className="tp-edit-actions">
        <button type="button" className="tp-button" disabled={saving} onClick={() => isNew ? onCancelNew?.() : setEdit(null)}><X size={15} />Cancel</button>
        <button type="button" className="tp-button tp-button-primary" disabled={busy || saving} onClick={() => void save()}>{saving ? "Saving…" : <><Check size={15} />{isNew ? "Add group" : "Save group"}</>}</button>
      </footer>
    </article>
  );
}

export function AddGroupButton({ disabled, onClick, hint }: { disabled: boolean; onClick: () => void; hint?: string }) {
  return <div className="tp-add-row"><button type="button" className="tp-button tp-button-dashed" disabled={disabled} onClick={onClick}><Plus size={16} />Add surcharge group</button>{hint && <span className="tp-muted">{hint}</span>}</div>;
}

export function Switch({ checked, onChange, label, disabled, title }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`tp-switch ${checked ? "tp-switch-on" : ""}`} disabled={disabled} title={title} onClick={onChange}>
      <span className="tp-switch-track"><span /></span>{label}
    </button>
  );
}

function toastProblem(message: string) { toast.error("Not saved", { description: message }); }
