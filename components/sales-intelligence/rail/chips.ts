/**
 * UI1-RAIL: the active filters as removable chips (final spec §7.1, Owner correction D). The desk shows them
 * above the list so a selection stays visible when its region is collapsed. Only regions passed in are read,
 * so a Closed-only param never shows on an active desk and the other way round.
 */
import { BANDS, copy } from "../sales-intelligence-copy";
import { formatDate } from "../lib/time";
import {
  CLOSED_WINDOWS, RECEIVED_WINDOWS, matchWindow, rangeDates,
  type RailPatch, type RailRegion, type RailRep, type RailValue, type WindowTable,
} from "./regions";

export type FilterChip = {
  key: string;
  label: string;
  /** The patch that removes this chip's value (pure; tests read it). */
  patch: RailPatch;
  /** Calls `onChange(patch)` when one was given. */
  remove: () => void;
};

const r = copy.ui1.desk.rail;
const p = copy.ui1.prim;

export function repName(reps: readonly RailRep[], id: string): string {
  return reps.find((rep) => rep.id === id)?.name ?? r.unknownRep;
}

/** `last 7d`, `Sep 1 – Sep 7`, `since Sep 1`, `until Sep 7`. */
export function rangeText(from: string | null, to: string | null, asOf: string | null | undefined, windows: WindowTable): string {
  const match = matchWindow(from, to, asOf, windows);
  if (match && match !== "custom") return r.range.last(match);
  const days = rangeDates(from, to);
  const fmt = (d: string) => formatDate(d, asOf ?? undefined);
  if (days.from && days.to) return r.range.between(fmt(days.from), fmt(days.to));
  if (days.from) return r.range.since(fmt(days.from));
  return r.range.until(fmt(days.to));
}

export function activeFilterChips(
  value: RailValue,
  regions: readonly RailRegion[],
  reps: readonly RailRep[],
  { onChange, asOf }: { onChange?: (patch: RailPatch) => void; asOf?: string | null } = {},
): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: string, label: string, patch: RailPatch) => chips.push({ key, label, patch, remove: () => onChange?.(patch) });
  const without = (list: readonly string[], item: string) => list.filter((v) => v !== item);

  for (const region of regions) {
    switch (region.id) {
      case "band":
        for (const band of value.band) {
          const name = BANDS[Number(band) as keyof typeof BANDS];
          add(`band:${band}`, name ? p.bandTag(Number(band), name) : p.bandNumber(Number(band)), { band: without(value.band, band) });
        }
        if (value.needs_review) add("needs_review", p.needsReview, { needs_review: false });
        break;
      case "status":
        for (const state of value.state) {
          const label = (p.states as Record<string, string>)[state] ?? state.replaceAll("_", " ");
          add(`state:${state}`, label, { state: without(value.state, state) });
        }
        break;
      case "rep":
        for (const id of value.agent_id) add(`agent:${id}`, r.chip.rep(repName(reps, id)), { agent_id: without(value.agent_id, id) });
        if (value.unassigned) add("unassigned", r.unassigned, { unassigned: false });
        break;
      case "analysis":
        if (value.has_recording) add("has_recording", r.hasRecording, { has_recording: false });
        if (value.has_assessment) add("has_assessment", r.hasAssessment, { has_assessment: false });
        if (value.newer_call) add("newer_call", r.newerCall, { newer_call: false });
        if (value.ti_min != null) add("ti_min", r.chip.tiMin(value.ti_min), { ti_min: null });
        if (value.ml_min != null) add("ml_min", r.chip.mlMin(value.ml_min), { ml_min: null });
        break;
      case "time":
        if (value.received_from || value.received_to) {
          add("received", r.chip.received(rangeText(value.received_from, value.received_to, asOf, RECEIVED_WINDOWS)), { received_from: null, received_to: null });
        }
        if (value.move_date_within != null) add("move_date_within", r.chip.moveWithin(value.move_date_within), { move_date_within: null });
        if (value.move_date_passed) add("move_date_passed", r.chip.movePassed, { move_date_passed: false });
        break;
      case "outcome":
        for (const outcome of value.outcome) add(`outcome:${outcome}`, r.outcome[outcome] ?? outcome.replaceAll("_", " "), { outcome: without(value.outcome, outcome) });
        break;
      case "closed_time":
        if (value.closed_from || value.closed_to) {
          add("closed", r.chip.closed(rangeText(value.closed_from, value.closed_to, asOf, CLOSED_WINDOWS)), { closed_from: null, closed_to: null });
        }
        break;
    }
  }
  return chips;
}
