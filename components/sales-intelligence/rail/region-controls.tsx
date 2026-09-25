"use client";
/**
 * UI1-RAIL: the controls inside each rail region (final spec §7.3 minus Lead attachment, §8 for Closed).
 * Every control writes a `RailPatch`; nothing here reads the browser clock (windows start from `asOf`).
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { BandBadge, type BandNumber } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { useIsRep } from "../rep/viewer";
import { cx } from "../lib/format";
import {
  BAND_OPTIONS, CLOSED_WINDOWS, MOVE_WITHIN, OUTCOME_OPTIONS, RECEIVED_WINDOWS, SCORE_STEPS, STATUS_OPTIONS,
  customRange, matchWindow, rangeDates, windowFrom,
  type RailPatch, type RailRegion, type RailRep, type RailValue, type WindowTable,
} from "./regions";

const r = copy.ui1.desk.rail;
const p = copy.ui1.prim;

export type RegionProps = { value: RailValue; onChange: (patch: RailPatch) => void; reps: readonly RailRep[]; asOf: string | null | undefined };

const toggle = (list: readonly string[], item: string) => (list.includes(item) ? list.filter((v) => v !== item) : [...list, item]);

function Check({ checked, onChange, children, data }: { checked: boolean; onChange: () => void; children: ReactNode; data?: string }) {
  return (
    <label className="si-check si-rail__check" data-rail-option={data}>
      <input type="checkbox" checked={checked} onChange={onChange} />
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

function BandRegion({ value, onChange }: RegionProps) {
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

function StatusRegion({ value, onChange }: RegionProps) {
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

const UNASSIGNED = "__unassigned__";

function RepRegion({ value, onChange, reps }: RegionProps) {
  const id = useId();
  const current = value.unassigned ? UNASSIGNED : value.agent_id[0] ?? "";
  // A rep id from the URL that isn't in `reps` still shows (as Unknown rep) so the select never lies.
  const known = reps.some((rep) => rep.id === current) || current === "" || current === UNASSIGNED;
  return (
    <div className="si-rail__group">
      <label htmlFor={id} className="si-sr">{r.rep}</label>
      <select
        id={id}
        className="si-input si-select si-rail__select"
        value={current}
        data-rail-option="rep"
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === UNASSIGNED ? { agent_id: [], unassigned: true } : { agent_id: next ? [next] : [], unassigned: false });
        }}
      >
        <option value="">{r.anyRep}</option>
        {reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
        {!known && <option value={current}>{r.unknownRep}</option>}
        <option value={UNASSIGNED}>{r.unassigned}</option>
      </select>
    </div>
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

function AnalysisRegion({ value, onChange }: RegionProps) {
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

function MoveDateRadios({ value, onChange }: RegionProps) {
  const name = useId();
  const pick = (within: number | null, passed: boolean) => onChange({ move_date_within: within, move_date_passed: passed });
  return (
    <Group legend={r.moveDate}>
      <Radio name={name} data="move:any" checked={value.move_date_within == null && !value.move_date_passed} onChange={() => pick(null, false)}>{r.any}</Radio>
      {MOVE_WITHIN.map((n) => (
        <Radio key={n} name={name} data={`move:${n}`} checked={value.move_date_within === n && !value.move_date_passed} onChange={() => pick(n, false)}>
          {n === 7 ? r.moveWithin7 : r.moveWithin30}
        </Radio>
      ))}
      <Radio name={name} data="move:passed" checked={value.move_date_passed} onChange={() => pick(null, true)}>{r.movePassed}</Radio>
    </Group>
  );
}

function TimeRegion(props: RegionProps) {
  const { value, onChange, asOf } = props;
  return (
    <>
      <RangeControl legend={r.received} data="received" windows={RECEIVED_WINDOWS} labels={r.receivedWindow} from={value.received_from} to={value.received_to} asOf={asOf}
        onPick={(from, to) => onChange({ received_from: from, received_to: to })} />
      <MoveDateRadios {...props} />
    </>
  );
}

function OutcomeRegion({ value, onChange }: RegionProps) {
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

function ClosedTimeRegion({ value, onChange, asOf }: RegionProps) {
  return (
    <RangeControl legend={r.closedIn} data="closed" windows={CLOSED_WINDOWS} labels={r.closedWindow} from={value.closed_from} to={value.closed_to} asOf={asOf}
      onPick={(from, to) => onChange({ closed_from: from, closed_to: to })} />
  );
}

export function RegionBody({ region, ...props }: RegionProps & { region: RailRegion }) {
  switch (region.id) {
    case "band": return <BandRegion {...props} />;
    case "status": return <StatusRegion {...props} />;
    case "rep": return <RepRegion {...props} />;
    case "analysis": return <AnalysisRegion {...props} />;
    case "time": return <TimeRegion {...props} />;
    case "outcome": return <OutcomeRegion {...props} />;
    case "closed_time": return <ClosedTimeRegion {...props} />;
  }
}
