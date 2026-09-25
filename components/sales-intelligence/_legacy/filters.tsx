"use client";

import { copy, BANDS } from "../sales-intelligence-copy";
import { bandLabel, classificationLabel, formatDateTime, label } from "../lib/format";
import { Button } from "../atoms/button";
import { CircleCheck } from "../atoms/circle-check";
import { TooltipCard } from "../atoms/tooltip-card";
import { Checkbox, Field, FilterChip } from "../chrome";
import { easternInput, easternInstant } from "../lib/commands";
import { toggleValue, type AttentionFilterValue } from "../lib/filter-state";

export type { AttentionFilterValue };

const STATUSES = ["unworked", "open", "waiting_on_customer", "identity_review", "closed"] as const;
const CLASSIFICATIONS = ["unknown", "customer", "company", "non_customer"] as const;

export function AttentionFilters({
  value,
  onChange,
  agents,
}: {
  value: AttentionFilterValue;
  onChange: (next: Partial<AttentionFilterValue> & { attention_cursor?: null }) => void;
  agents: { id: string; name: string }[];
}) {
  const active = Boolean(value.bands.length || value.needs_review || value.states.length || value.agent_ids.length);
  return (
    <div className="si-filters">
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.band}</legend>
        <p className="si-field__hint">{copy.filters.bandHint}</p>
        {([1, 2, 3, 4, 5, 6, 7] as const).map((band) => (
          <CircleCheck
            key={band}
            checked={value.bands.includes(String(band))}
            onChange={() => onChange({ bands: toggleValue(value.bands, String(band)), attention_cursor: null })}
            label={
              <TooltipCard title={`${band} · ${BANDS[band]}`} guideTopic="bands" label={<span>{band} · {BANDS[band]}</span>}>
                {copy.bandSoWhat[band]} {copy.bandSoWhat.once}
              </TooltipCard>
            }
          />
        ))}
      </fieldset>
      <CircleCheck
        checked={value.needs_review}
        onChange={(checked) => onChange({ needs_review: checked, attention_cursor: null })}
        label={copy.needsReview.title}
        hint={copy.filters.needsReviewOnly}
      />
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.status}</legend>
        <p className="si-field__hint">{copy.filters.statusHint}</p>
        {STATUSES.map((state) => (
          <CircleCheck
            key={state}
            checked={value.states.includes(state)}
            onChange={() => onChange({ states: toggleValue(value.states, state), attention_cursor: null })}
            label={
              <TooltipCard title={copy.outreachState[state]} guideTopic="statuses" label={copy.outreachState[state]}>
                {copy.statusSoWhat[state]}
              </TooltipCard>
            }
          />
        ))}
      </fieldset>
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.rep}</legend>
        <p className="si-field__hint">{copy.filters.repHint}</p>
        {agents.map((agent) => (
          <CircleCheck
            key={agent.id}
            checked={value.agent_ids.includes(agent.id)}
            onChange={() => onChange({ agent_ids: toggleValue(value.agent_ids, agent.id), attention_cursor: null })}
            label={agent.name}
          />
        ))}
      </fieldset>
      {active && (
        <Button variant="link" size="sm" onClick={() => onChange({ bands: [], needs_review: false, states: [], agent_ids: [], attention_cursor: null })}>
          {copy.actions.clearFilters}
        </Button>
      )}
    </div>
  );
}

export function attentionChips(
  value: AttentionFilterValue,
  agents: { id: string; name: string }[],
  onChange: (next: Partial<AttentionFilterValue> & { attention_cursor?: null }) => void,
) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  for (const band of value.bands) {
    chips.push({ key: `band-${band}`, label: `Band ${band} · ${bandLabel(Number(band))}`, clear: () => onChange({ bands: value.bands.filter((item) => item !== band), attention_cursor: null }) });
  }
  if (value.needs_review) chips.push({ key: "review", label: copy.needsReview.title, clear: () => onChange({ needs_review: false, attention_cursor: null }) });
  for (const state of value.states) {
    chips.push({ key: `state-${state}`, label: `${copy.fields.status}: ${copy.outreachState[state as keyof typeof copy.outreachState] ?? label(state)}`, clear: () => onChange({ states: value.states.filter((item) => item !== state), attention_cursor: null }) });
  }
  for (const agentId of value.agent_ids) {
    chips.push({ key: `agent-${agentId}`, label: agents.find((agent) => agent.id === agentId)?.name ?? copy.fields.rep, clear: () => onChange({ agent_ids: value.agent_ids.filter((item) => item !== agentId), attention_cursor: null }) });
  }
  return chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />);
}

export type NumberFilterValue = {
  classifications: string[];
  attachment: string;
  hygiene: boolean;
  active_from: string;
  active_to: string;
};

function setEastern(value: string, apply: (iso: string | null) => void) {
  if (!value) {
    apply(null);
    return;
  }
  try {
    apply(easternInstant(value));
  } catch {
    /* incomplete or DST-ambiguous local time stays uncommitted */
  }
}

export function NumbersFilters({
  value,
  onChange,
}: {
  value: NumberFilterValue;
  onChange: (next: Partial<NumberFilterValue> & { number_cursor?: null }) => void;
}) {
  const active = Boolean(value.classifications.length || (value.attachment && value.attachment !== "any") || value.hygiene || value.active_from || value.active_to);
  return (
    <div className="si-filters">
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.classification}</legend>
        <p className="si-field__hint">{copy.filters.classificationHint}</p>
        {CLASSIFICATIONS.map((item) => (
          <CircleCheck
            key={item}
            checked={value.classifications.includes(item)}
            onChange={() => onChange({ classifications: toggleValue(value.classifications, item), number_cursor: null })}
            label={copy.classification[item]}
          />
        ))}
      </fieldset>
      <fieldset className="si-filters__set">
        <legend className="si-field__label">{copy.fields.leadMatch}</legend>
        <p className="si-field__hint">{copy.filters.leadMatchHint}</p>
        {(["linked", "unlinked"] as const).map((item) => (
          <CircleCheck
            key={item}
            checked={value.attachment === item}
            onChange={(checked) => onChange({ attachment: checked ? item : "any", number_cursor: null })}
            label={copy.attachment[item]}
          />
        ))}
      </fieldset>
      <Field label={<>{copy.fields.activityFrom} <span className="si-tz">({copy.time.tz})</span></>} hint={copy.filters.activityHint}>
        {({ id }) => (
          <input
            id={id}
            className="si-input"
            type="datetime-local"
            value={value.active_from ? easternInput(value.active_from) : ""}
            onChange={(event) => setEastern(event.target.value, (iso) => onChange({ active_from: iso ?? "", number_cursor: null }))}
          />
        )}
      </Field>
      <Field label={<>{copy.fields.activityTo} <span className="si-tz">({copy.time.tz})</span></>} hint={copy.filters.activityHint}>
        {({ id }) => (
          <input
            id={id}
            className="si-input"
            type="datetime-local"
            value={value.active_to ? easternInput(value.active_to) : ""}
            onChange={(event) => setEastern(event.target.value, (iso) => onChange({ active_to: iso ?? "", number_cursor: null }))}
          />
        )}
      </Field>
      <Checkbox
        label={copy.fields.includeOurNumbers}
        hint={copy.filters.includeOurHint}
        checked={value.hygiene}
        onChange={(checked) => onChange({ hygiene: checked, number_cursor: null })}
      />
      {active && (
        <Button variant="link" size="sm" onClick={() => onChange({ classifications: [], attachment: "any", hygiene: false, active_from: "", active_to: "", number_cursor: null })}>
          {copy.actions.clearFilters}
        </Button>
      )}
    </div>
  );
}

export function numberChips(
  value: NumberFilterValue,
  q: string,
  onChange: (next: Partial<NumberFilterValue> & { q?: string | null; number_cursor?: null }) => void,
) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (q) chips.push({ key: "q", label: `“${q}”`, clear: () => onChange({ q: null, number_cursor: null }) });
  for (const item of value.classifications) {
    chips.push({ key: `class-${item}`, label: `${copy.fields.classification}: ${classificationLabel(item)}`, clear: () => onChange({ classifications: value.classifications.filter((entry) => entry !== item), number_cursor: null }) });
  }
  if (value.attachment && value.attachment !== "any") chips.push({ key: "attachment", label: `${copy.fields.leadMatch}: ${copy.attachment[value.attachment as keyof typeof copy.attachment] ?? value.attachment}`, clear: () => onChange({ attachment: "any", number_cursor: null }) });
  if (value.hygiene) chips.push({ key: "hygiene", label: copy.fields.includeOurNumbers, clear: () => onChange({ hygiene: false, number_cursor: null }) });
  if (value.active_from) chips.push({ key: "from", label: `${copy.fields.activityFrom} ${formatDateTime(value.active_from)}`, clear: () => onChange({ active_from: "", number_cursor: null }) });
  if (value.active_to) chips.push({ key: "to", label: `${copy.fields.activityTo} ${formatDateTime(value.active_to)}`, clear: () => onChange({ active_to: "", number_cursor: null }) });
  return chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />);
}
