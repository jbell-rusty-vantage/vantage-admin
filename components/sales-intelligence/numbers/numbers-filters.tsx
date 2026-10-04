"use client";
/** The Numbers filter rail and its active-filter chips. Every value lives in the URL (`SiUrlState`). */
import { copy } from "../sales-intelligence-copy";
import { classificationLabel, formatDateTime } from "../lib/format";
import { Button } from "../atoms/button";
import { CircleCheck } from "../atoms/circle-check";
import { Checkbox, Field, FilterChip } from "../chrome";
import { easternInput, easternInstant } from "../lib/eastern";
import { toggleValue } from "../lib/filter-state";
import { NUMBER_CLASSIFICATIONS, clearNumberFilters, type SiUrlPatch, type SiUrlState } from "../data/url-state";

export type NumberFilterValue = Pick<SiUrlState, "classification" | "attachment" | "hygiene" | "has_recording" | "include_form_only" | "active_from" | "active_to">;

/** How many filters are on (search counts as one), for `Filters (n)`. */
export function numberFilterCount(value: NumberFilterValue & { q: string | null }): number {
  return [value.q, value.classification.length > 0, value.attachment !== "any", value.hygiene, value.has_recording, value.include_form_only, value.active_from, value.active_to].filter(Boolean).length;
}

/** A complete, unambiguous Eastern time commits; an incomplete or DST-ambiguous one stays uncommitted. */
function setEastern(value: string, apply: (iso: string | null) => void) {
  try {
    apply(easternInstant(value));
  } catch {
    /* not committed */
  }
}

export function NumbersFilters({ value, onChange }: { value: NumberFilterValue; onChange: (patch: SiUrlPatch) => void }) {
  const active = numberFilterCount({ ...value, q: null }) > 0;
  return (
    <div className="si-filters">
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.classification}</legend>
        <p className="si-field__hint">{copy.filters.classificationHint}</p>
        {NUMBER_CLASSIFICATIONS.map((item) => (
          <CircleCheck key={item} checked={value.classification.includes(item)} onChange={() => onChange({ classification: toggleValue(value.classification, item) })} label={copy.classification[item]} />
        ))}
      </fieldset>
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.leadMatch}</legend>
        <p className="si-field__hint">{copy.filters.leadMatchHint}</p>
        {(["linked", "unlinked"] as const).map((item) => (
          <CircleCheck key={item} checked={value.attachment === item} onChange={(checked) => onChange({ attachment: checked ? item : "any" })} label={copy.attachment[item]} />
        ))}
      </fieldset>
      <Field label={<>{copy.fields.activityFrom} <span className="si-tz">({copy.time.tz})</span></>} hint={copy.filters.activityHint}>
        {({ id }) => (
          <input id={id} className="si-input" type="datetime-local" value={value.active_from ? easternInput(value.active_from) : ""}
            onChange={(event) => setEastern(event.target.value, (iso) => onChange({ active_from: iso }))} />
        )}
      </Field>
      <Field label={<>{copy.fields.activityTo} <span className="si-tz">({copy.time.tz})</span></>} hint={copy.filters.activityHint}>
        {({ id }) => (
          <input id={id} className="si-input" type="datetime-local" value={value.active_to ? easternInput(value.active_to) : ""}
            onChange={(event) => setEastern(event.target.value, (iso) => onChange({ active_to: iso }))} />
        )}
      </Field>
      <Checkbox label={copy.filters.hasRecording} hint={copy.filters.hasRecordingHint} checked={value.has_recording} onChange={(checked) => onChange({ has_recording: checked })} />
      <Checkbox label={copy.filters.includeFormOnly} hint={copy.filters.includeFormOnlyHint} checked={value.include_form_only} onChange={(checked) => onChange({ include_form_only: checked })} />
      <Checkbox label={copy.fields.includeOurNumbers} hint={copy.filters.includeOurHint} checked={value.hygiene} onChange={(checked) => onChange({ hygiene: checked })} />
      {active && (
        <Button variant="link" size="sm" onClick={() => onChange(clearNumberFilters())}>
          {copy.actions.clearFilters}
        </Button>
      )}
    </div>
  );
}

export function numberChips(value: NumberFilterValue & { q: string | null }, onChange: (patch: SiUrlPatch) => void) {
  const chips: { key: string; label: string; clear: SiUrlPatch }[] = [];
  if (value.q) chips.push({ key: "q", label: `“${value.q}”`, clear: { q: null } });
  for (const item of value.classification) {
    chips.push({ key: `class-${item}`, label: `${copy.fields.classification}: ${classificationLabel(item)}`, clear: { classification: value.classification.filter((entry) => entry !== item) } });
  }
  if (value.attachment !== "any") chips.push({ key: "attachment", label: `${copy.fields.leadMatch}: ${copy.attachment[value.attachment]}`, clear: { attachment: "any" } });
  if (value.has_recording) chips.push({ key: "recording", label: copy.filters.hasRecording, clear: { has_recording: false } });
  if (value.include_form_only) chips.push({ key: "form-only", label: copy.filters.includeFormOnly, clear: { include_form_only: false } });
  if (value.hygiene) chips.push({ key: "hygiene", label: copy.fields.includeOurNumbers, clear: { hygiene: false } });
  if (value.active_from) chips.push({ key: "from", label: `${copy.fields.activityFrom} ${formatDateTime(value.active_from)}`, clear: { active_from: null } });
  if (value.active_to) chips.push({ key: "to", label: `${copy.fields.activityTo} ${formatDateTime(value.active_to)}`, clear: { active_to: null } });
  return chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={() => onChange(chip.clear)} />);
}
