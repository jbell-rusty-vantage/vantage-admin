"use client";
/**
 * UI1-RAIL: the controls inside each sidebar section (final spec §7.3, §8 for Closed; the 2026-09-29 cleanup moved the
 * Priority bar and the OI-A4 search bar in here). Every control writes a `RailPatch`; nothing here reads the browser
 * clock (windows start from `asOf`). An OI-A4 family the server hasn't advertised stays visible, disabled, with
 * `Not available yet`, so a saved URL selection is never hidden.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { AttentionCapabilities, PriorityCounts } from "@/lib/api/salesIntelligence";
import { BandBadge, type BandNumber } from "../primitives";
import { countFor, leadChange, priorityLabel, priorityOptions, priorityToggle } from "../desk/preset-bar";
import { copy } from "../sales-intelligence-copy";
import { useIsRep } from "../rep/viewer";
import { cx } from "../lib/format";
import { FOLLOWUP_WORK_OPTIONS } from "./followup-filter";
import {
  BAND_OPTIONS, CLOSED_WINDOWS, OUTCOME_OPTIONS, RECEIVED_WINDOWS, SCORE_STEPS, STATUS_OPTIONS,
  customRange, matchWindow, rangeDates, windowFrom,
  type RailPatch, type RailRegion, type RailRep, type RailValue, type WindowTable,
} from "./regions";

const r = copy.ui1.desk.rail;
const p = copy.ui1.prim;

export type RegionProps = {
  value: RailValue;
  onChange: (patch: RailPatch) => void;
  reps: readonly RailRep[];
  asOf: string | null | undefined;
  /** The list's advertised filter families; absent → the OI-A4 controls read `Not available yet`. */
  capabilities?: AttentionCapabilities | null;
  /** `data.priority_counts` of the current list; absent → the Priority options show no counts. */
  priorityCounts?: PriorityCounts | null;
};
type SectionProps = RegionProps & { region: RailRegion };

const NOT_YET = "Not available yet";
const UNASSIGNED = "__unassigned__";
const fmt = (n: number) => n.toLocaleString("en-US");
/** The OI-A4 families the section's desk advertises (Closed reads its own `closed_history` block). */
const familiesOf = (region: RailRegion, capabilities: AttentionCapabilities | null | undefined) =>
  region.view === "closed" ? capabilities?.closed_history : capabilities;

const toggle = (list: readonly string[], item: string) => (list.includes(item) ? list.filter((v) => v !== item) : [...list, item]);

function Check({ checked, onChange, children, data, disabled }: { checked: boolean; onChange: () => void; children: ReactNode; data?: string; disabled?: boolean }) {
  return (
    <label className={cx("si-check si-rail__check", disabled && "is-disabled")} data-rail-option={data}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      {children}
    </label>
  );
}

function Radio({ name, checked, onChange, disabled, children, data }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; children: ReactNode; data?: string }) {
  return (
    <label className={cx("si-check si-rail__check", disabled && "is-disabled")} data-rail-option={data}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} />
      {children}
    </label>
  );
}

function Group({ legend, children }: { legend?: string; children: ReactNode }) {
  return (
    <fieldset className="si-rail__group">
      {legend && <legend className="si-rail__legend">{legend}</legend>}
      {children}
    </fieldset>
  );
}

function Unavailable({ when }: { when: boolean }) {
  return when ? <small className="si-rail__hint">{NOT_YET}</small> : null;
}

/** Granot Priority (every code with its count; `Any priority` clears) and the Lead toggle. `No Lead` clears and disables Priority. */
function PriorityRegion({ value, onChange, priorityCounts, region }: SectionProps) {
  const noteId = useId();
  const noLead = value.attachment === "none";
  const preset = { priority: value.priority, attachment: value.attachment };
  const noLeadCount = countFor(priorityCounts, "no_lead", region.view);
  const leads = [
    { value: null, label: copy.ui1.desk.lead.all },
    { value: "lead", label: copy.ui1.desk.lead.hasLead },
    { value: "none", label: copy.ui1.desk.lead.noLead },
  ] as const;
  return (
    <>
      <Group>
        <Check data="priority:any" checked={!noLead && value.priority.length === 0} disabled={noLead} onChange={() => onChange({ priority: [] })}>{r.anyPriority}</Check>
        {priorityOptions(priorityCounts, ["0", "1", ...value.priority]).map((key) => {
          const count = countFor(priorityCounts, key, region.view);
          return (
            <label key={key} className={cx("si-check si-rail__check", noLead && "is-disabled")} data-rail-option={`priority:${key}`}>
              <input type="checkbox" checked={value.priority.includes(key)} disabled={noLead} aria-describedby={noLead ? noteId : undefined}
                onChange={() => onChange({ priority: priorityToggle(key, preset).priority })} />
              <span className="si-rail__optlabel">{priorityLabel(key)}</span>
              {count != null && <span className="si-rail__optcount">{fmt(count)}</span>}
            </label>
          );
        })}
      </Group>
      <Group legend={copy.ui1.desk.lead.label}>
        <div className="si-seg si-rail__seg" role="group" aria-label={copy.ui1.desk.lead.label}>
          {leads.map((option) => {
            const active = value.attachment === option.value;
            return (
              <button key={option.label} type="button" className={cx("si-seg__btn", active && "is-active")} aria-pressed={active} data-lead-btn={option.value ?? "all"}
                onClick={() => onChange(leadChange(option.value, preset))}>
                {option.label}
                {option.value === "none" && noLeadCount != null && <span className="si-seg__count">{fmt(noLeadCount)}</span>}
              </button>
            );
          })}
        </div>
      </Group>
      {noLead && <p id={noteId} className="si-rail__hint">{copy.ui1.desk.lead.noLeadDisablesPresets}</p>}
    </>
  );
}

function RepSelect({ label, value, reps, onPick, disabled, unassigned = false, any = r.anyRep }: {
  label: string; value: string; reps: readonly RailRep[]; onPick: (id: string) => void; disabled: boolean; unassigned?: boolean; any?: string;
}) {
  const id = useId();
  // A rep id from the URL that isn't in `reps` still shows (as Unknown rep) so the select never lies.
  const known = value === "" || value === UNASSIGNED || reps.some((rep) => rep.id === value);
  return (
    <label className="si-rail__field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="si-input si-select si-rail__select" value={value} disabled={disabled} onChange={(event) => onPick(event.target.value)}>
        <option value="">{any}</option>
        {unassigned && <option value={UNASSIGNED}>{r.unassigned}</option>}
        {reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}{rep.active === false ? " (inactive)" : ""}</option>)}
        {!known && <option value={value}>{r.unknownRep}</option>}
      </select>
    </label>
  );
}

/** Follow-up work (Overdue, Due today, No next step, Blocked) and, for the Owner, the follow-up assignee. */
function FollowupRegion({ value, onChange, reps, capabilities, region }: SectionProps) {
  const rep = useIsRep();
  const available = familiesOf(region, capabilities)?.work === true;
  return (
    <>
      <Group>
        {FOLLOWUP_WORK_OPTIONS.map(([key, label]) => (
          <Check key={key} data={`work:${key}`} checked={value.work.includes(key)} disabled={!available} onChange={() => onChange({ work: toggle(value.work, key) })}>{label}</Check>
        ))}
      </Group>
      {!rep && <RepSelect label="Follow-up assignee" value={value.followup_agent_id[0] ?? ""} reps={reps} disabled={!available || capabilities?.roster !== true}
        onPick={(id) => onChange({ followup_agent_id: id ? [id] : [] })} />}
      <Unavailable when={!available} />
    </>
  );
}

/**
 * The Owner's rep filters in one place: the assigned rep (with Unassigned) and, on the active desks, a rep by
 * involvement (assigned, follow-up or promised). `relationship` is only sent with an `agent`, so a type chosen
 * before a rep waits here instead of blocking the list. Old `agent_id` bookmarks still apply and show as chips.
 */
function RepRegion({ value, onChange, reps, capabilities, region }: SectionProps) {
  const roster = capabilities?.roster === true;
  const assignedAvailable = familiesOf(region, capabilities)?.assignment === true && roster;
  const involvementAvailable = region.view !== "closed" && capabilities?.relationship === true;
  const [draft, setDraft] = useState<RailValue["relationship"]>(null);
  const relationship = value.relationship ?? draft ?? "involved";
  return (
    <div className="si-rail__stack">
      <RepSelect label="Assigned rep" any="All" unassigned value={value.assignment === "unassigned" ? UNASSIGNED : value.assigned_agent_id[0] ?? ""} reps={reps} disabled={!assignedAvailable}
        onPick={(id) => onChange(id === UNASSIGNED ? { assigned_agent_id: [], assignment: "unassigned" } : { assigned_agent_id: id ? [id] : [], assignment: null })} />
      <Unavailable when={!assignedAvailable} />
      {region.view !== "closed" && (
        <>
          <label className="si-rail__field">
            <span>Involvement</span>
            <select className="si-input si-select si-rail__select" value={relationship} disabled={!involvementAvailable} onChange={(event) => {
              const next = event.target.value as RailValue["relationship"];
              setDraft(next);
              if (value.agent) onChange({ relationship: next, agent: value.agent });
            }}>
              <option value="involved">Rep involved (assigned, follow-up or promised)</option>
              <option value="assigned">Assigned</option>
              <option value="followup">Follow-up</option>
            </select>
          </label>
          <RepSelect label="Involved rep" value={value.agent ?? ""} reps={reps} disabled={!involvementAvailable || !roster}
            onPick={(id) => onChange({ agent: id || null, relationship: id ? relationship : null })} />
          <Unavailable when={!involvementAvailable} />
        </>
      )}
    </div>
  );
}

function BandRegion({ value, onChange }: SectionProps) {
  return (
    <Group>
      {BAND_OPTIONS.map((band) => (
        <Check key={band} data={`band:${band}`} checked={value.band.includes(String(band))} onChange={() => onChange({ band: toggle(value.band, String(band)) })}>
          <BandBadge band={band as BandNumber} />
        </Check>
      ))}
      <Check data="needs_review" checked={value.needs_review} onChange={() => onChange({ needs_review: !value.needs_review })}>
        <BandBadge band={null} variant="needs_review" />
      </Check>
    </Group>
  );
}

function StatusRegion({ value, onChange }: SectionProps) {
  return (
    <Group>
      {STATUS_OPTIONS.map((state) => (
        <Check key={state} data={`state:${state}`} checked={value.state.includes(state)} onChange={() => onChange({ state: toggle(value.state, state) })}>
          {p.states[state]}
        </Check>
      ))}
    </Group>
  );
}

function ScoreRadios({ legend, value, onPick, data }: { legend: string; value: number | null; onPick: (n: number | null) => void; data: string }) {
  const name = useId();
  return (
    <Group legend={legend}>
      <div className="si-rail__inline">
        <Radio name={name} data={`${data}:any`} checked={value == null} onChange={() => onPick(null)}>{r.any}</Radio>
        {SCORE_STEPS.map((step) => (
          <Radio key={step} name={name} data={`${data}:${step}`} checked={value === step} onChange={() => onPick(step)}>{step}</Radio>
        ))}
      </div>
    </Group>
  );
}

function AnalysisRegion({ value, onChange }: SectionProps) {
  return (
    <>
      <Group>
        <Check data="has_recording" checked={value.has_recording} onChange={() => onChange({ has_recording: !value.has_recording })}>{r.hasRecording}</Check>
        <Check data="has_assessment" checked={value.has_assessment} onChange={() => onChange({ has_assessment: !value.has_assessment })}>{r.hasAssessment}</Check>
        <Check data="newer_call" checked={value.newer_call} onChange={() => onChange({ newer_call: !value.newer_call })}>{r.newerCall}</Check>
      </Group>
      <ScoreRadios legend={r.tiMin} data="ti_min" value={value.ti_min} onPick={(n) => onChange({ ti_min: n })} />
      <ScoreRadios legend={r.mlMin} data="ml_min" value={value.ml_min} onPick={(n) => onChange({ ml_min: n })} />
    </>
  );
}

/** Any · window · … · Custom range, with two ET date inputs for the custom range. */
function RangeControl({ legend, windows, labels, from, to, asOf, onPick, data }: {
  legend: string; windows: WindowTable; labels: Record<string, string>; from: string | null; to: string | null;
  asOf: string | null | undefined; onPick: (from: string | null, to: string | null) => void; data: string;
}) {
  const name = useId();
  const match = matchWindow(from, to, asOf, windows);
  const [customOpen, setCustomOpen] = useState(false);
  const custom = match === "custom" || customOpen;
  const days = rangeDates(from, to);
  const [draft, setDraft] = useState(days);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const range = customRange(draft.from, draft.to);
    if (!range.from && !range.to) return;
    setCustomOpen(false);
    onPick(range.from, range.to);
  };
  return (
    <Group legend={legend}>
      <Radio name={name} data={`${data}:any`} checked={!match && !customOpen} onChange={() => { setCustomOpen(false); onPick(null, null); }}>{r.any}</Radio>
      {Object.entries(windows).map(([key, ms]) => (
        <Radio key={key} name={name} data={`${data}:${key}`} checked={match === key && !customOpen} disabled={!asOf}
          onChange={() => { setCustomOpen(false); onPick(asOf ? windowFrom(asOf, ms) : null, null); }}>
          {labels[key]}
        </Radio>
      ))}
      <Radio name={name} data={`${data}:custom`} checked={custom} onChange={() => { setDraft(days); setCustomOpen(true); }}>{labels.custom}</Radio>
      {custom && (
        <form className="si-rail__range" onSubmit={submit}>
          <label className="si-rail__date">
            <span>{r.from}</span>
            <input type="date" className="si-input" value={draft.from} pattern="\d{4}-\d{2}-\d{2}" placeholder="YYYY-MM-DD"
              onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))} />
          </label>
          <label className="si-rail__date">
            <span>{r.to}</span>
            <input type="date" className="si-input" value={draft.to} pattern="\d{4}-\d{2}-\d{2}" placeholder="YYYY-MM-DD"
              onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))} />
          </label>
          <p className="si-rail__hint">{r.dateHint}</p>
          <button type="submit" className="si-btn si-btn--secondary si-btn--sm si-hit">{r.apply}</button>
        </form>
      )}
    </Group>
  );
}

const MOVE_MODES = [
  ["", "Any"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["within:7", "Within 7 days"],
  ["within:14", "Within 14 days"], ["within:30", "Within 30 days"], ["within:60", "Within 60 days"], ["within:90", "Within 90 days"],
  ["within:custom", "Custom days out…"], ["future", "Future moves only"], ["today_onward", "Today onward"],
  ["exact", "Exact date…"], ["range", "Custom range…"], ["past", "Past"], ["unknown", "Unknown"],
] as const;
const DRAFT_MODES = ["within:custom", "exact", "range"];
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** The OI-A4 move date: preset windows apply at once; custom days, an exact date and a range apply with `Apply`. */
function MoveDateControl({ value, onChange, available }: { value: RailValue; onChange: (patch: RailPatch) => void; available: boolean }) {
  const id = useId();
  const [days, setDays] = useState(value.move_days?.toString() ?? "");
  const [on, setOn] = useState(value.move_on ?? "");
  const [from, setFrom] = useState(value.move_from ?? "");
  const [through, setThrough] = useState(value.move_through ?? "");
  const [draftMode, setDraftMode] = useState<string | null>(null);
  const selected = draftMode ?? (value.move_date_mode === "within" ? `within:${[7, 14, 30, 60, 90].includes(value.move_days ?? -1) ? value.move_days : "custom"}` : value.move_date_mode ?? "");
  const base: RailPatch = { move_date_mode: null, move_days: null, move_on: null, move_from: null, move_through: null, move_date_within: null, move_date_passed: false };
  const pick = (mode: string) => {
    if (DRAFT_MODES.includes(mode)) { setDraftMode(mode); return; }
    setDraftMode(null);
    onChange(mode.startsWith("within:") ? { ...base, move_date_mode: "within", move_days: Number(mode.split(":")[1]) } : { ...base, move_date_mode: mode || null });
  };
  const valid = selected === "within:custom" ? /^\d+$/.test(days) && Number(days) <= 366 : selected === "exact" ? isDay(on) : selected === "range" ? isDay(from) && isDay(through) && from <= through : false;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onChange(selected === "within:custom" ? { ...base, move_date_mode: "within", move_days: Number(days) }
      : selected === "exact" ? { ...base, move_date_mode: "exact", move_on: on }
      : { ...base, move_date_mode: "range", move_from: from, move_through: through });
    setDraftMode(null);
  };
  return (
    <Group legend="Move date">
      <label className="si-sr" htmlFor={id}>Move date</label>
      <select id={id} className="si-input si-select si-rail__select" data-control="move-date" value={selected} disabled={!available} onChange={(event) => pick(event.target.value)}>
        {MOVE_MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <Unavailable when={!available} />
      {available && DRAFT_MODES.includes(selected) && (
        <form onSubmit={apply} className="si-rail__range">
          {selected === "within:custom" && <label className="si-rail__date"><span>Days out</span><input className="si-input" type="number" min="0" max="366" step="1" value={days} onChange={(event) => setDays(event.target.value)} /></label>}
          {selected === "exact" && <label className="si-rail__date"><span>Date</span><input className="si-input" type="date" value={on} onChange={(event) => setOn(event.target.value)} /></label>}
          {selected === "range" && <>
            <label className="si-rail__date"><span>From</span><input className="si-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="si-rail__date"><span>Through</span><input className="si-input" type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
          </>}
          <button type="submit" className="si-btn si-btn--secondary si-btn--sm si-hit" disabled={!valid}>{r.apply}</button>
        </form>
      )}
    </Group>
  );
}

const moveKey = (value: RailValue) => [value.move_date_mode, value.move_days, value.move_on, value.move_from, value.move_through].join("|");

function TimeRegion({ value, onChange, asOf, capabilities, region }: SectionProps) {
  return (
    <>
      <RangeControl legend={r.received} data="received" windows={RECEIVED_WINDOWS} labels={r.receivedWindow} from={value.received_from} to={value.received_to} asOf={asOf}
        onPick={(from, to) => onChange({ received_from: from, received_to: to })} />
      <MoveDateControl key={moveKey(value)} value={value} onChange={onChange} available={familiesOf(region, capabilities)?.move_date === true} />
    </>
  );
}

const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

/** Pickup, delivery or either side; city contains, state, ZIP. Applies with `Apply`. */
function LocationForm({ value, onChange, available }: { value: RailValue; onChange: (patch: RailPatch) => void; available: boolean }) {
  const [side, setSide] = useState<string>(value.loc_side ?? "either");
  const [city, setCity] = useState(value.loc_city ?? "");
  const [state, setState] = useState(value.loc_state ?? "");
  const [zip, setZip] = useState(value.loc_zip ?? "");
  const valid = (!zip || /^\d{5}$/.test(zip)) && city.trim().length <= 100 && !!(city.trim() || state || zip);
  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onChange({ loc_side: side as RailValue["loc_side"], loc_city: city.trim() || null, loc_state: state || null, loc_zip: zip || null });
  };
  return (
    <form className="si-rail__stack" data-control="location" onSubmit={apply}>
      <label className="si-rail__field"><span>Side</span>
        <select className="si-input si-select si-rail__select" value={side} disabled={!available} onChange={(event) => setSide(event.target.value)}>
          <option value="either">Either</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option>
        </select>
      </label>
      <label className="si-rail__field"><span>City contains</span>
        <input className="si-input" maxLength={100} value={city} disabled={!available} onChange={(event) => setCity(event.target.value)} />
      </label>
      <div className="si-rail__pair">
        <label className="si-rail__field"><span>State</span>
          <select className="si-input si-select si-rail__select" value={state} disabled={!available} onChange={(event) => setState(event.target.value)}>
            <option value="">Any</option>{STATES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="si-rail__field"><span>ZIP</span>
          <input className="si-input" inputMode="numeric" maxLength={5} value={zip} disabled={!available} onChange={(event) => setZip(event.target.value)} />
        </label>
      </div>
      <button type="submit" className="si-btn si-btn--secondary si-btn--sm si-hit" disabled={!available || !valid}>{r.apply}</button>
      <Unavailable when={!available} />
    </form>
  );
}

function LocationRegion({ value, onChange, capabilities, region }: SectionProps) {
  return <LocationForm key={[value.loc_side, value.loc_city, value.loc_state, value.loc_zip].join("|")} value={value} onChange={onChange} available={familiesOf(region, capabilities)?.location === true} />;
}

function OutcomeRegion({ value, onChange }: SectionProps) {
  const rep = useIsRep();
  return (
    <Group>
      {OUTCOME_OPTIONS.map((outcome) => (
        <Check key={outcome} data={`outcome:${outcome}`} checked={value.outcome.includes(outcome)} onChange={() => onChange({ outcome: toggle(value.outcome, outcome) })}>
          {rep && outcome === "owner" ? copy.ui2.scope.ownerWords.closedBy : r.outcome[outcome]}
        </Check>
      ))}
    </Group>
  );
}

function ClosedTimeRegion({ value, onChange, asOf, capabilities, region }: SectionProps) {
  return (
    <>
      <RangeControl legend={r.closedIn} data="closed" windows={CLOSED_WINDOWS} labels={r.closedWindow} from={value.closed_from} to={value.closed_to} asOf={asOf}
        onPick={(from, to) => onChange({ closed_from: from, closed_to: to })} />
      <MoveDateControl key={moveKey(value)} value={value} onChange={onChange} available={familiesOf(region, capabilities)?.move_date === true} />
    </>
  );
}

export function RegionBody(props: SectionProps) {
  switch (props.region.id) {
    case "priority": return <PriorityRegion {...props} />;
    case "followup": return <FollowupRegion {...props} />;
    case "rep": return <RepRegion {...props} />;
    case "time": return <TimeRegion {...props} />;
    case "location": return <LocationRegion {...props} />;
    case "band": return <BandRegion {...props} />;
    case "status": return <StatusRegion {...props} />;
    case "analysis": return <AnalysisRegion {...props} />;
    case "outcome": return <OutcomeRegion {...props} />;
    case "closed_time": return <ClosedTimeRegion {...props} />;
  }
}
