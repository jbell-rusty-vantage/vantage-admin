"use client";

import { copy, BANDS } from "./sales-intelligence-copy";
import { bandLabel, classificationLabel, formatDateTime, label } from "./lib/format";
import { Button } from "./atoms/button";
import { Checkbox, Field, FilterChip, Select } from "./chrome";
import { easternInput, easternInstant } from "./lib/commands";

export type AttentionFilterValue = {
  band: string;
  needs_review: boolean;
  state: string;
  agent_id: string;
};

export function AttentionFilters({
  value,
  onChange,
  agents,
}: {
  value: AttentionFilterValue;
  onChange: (next: Partial<AttentionFilterValue> & { attention_cursor?: null }) => void;
  agents: { id: string; name: string }[];
}) {
  const active = Boolean(value.band || value.needs_review || value.state || value.agent_id);
  return (
    <div className="si-filters">
      <Field label={copy.fields.band} hint={copy.filters.bandHint}>
        {({ id }) => (
          <Select id={id} value={value.band} onChange={(event) => onChange({ band: event.target.value, attention_cursor: null })}>
            <option value="">{copy.fields.allBands}</option>
            {([1, 2, 3, 4, 5, 6, 7] as const).map((band) => (
              <option key={band} value={band}>{band} · {BANDS[band]}</option>
            ))}
          </Select>
        )}
      </Field>
      <Checkbox
        label={copy.needsReview.title}
        hint={copy.filters.needsReviewHint}
        checked={value.needs_review}
        onChange={(checked) => onChange({ needs_review: checked, attention_cursor: null })}
      />
      <Field label={copy.fields.status} hint={copy.filters.statusHint}>
        {({ id }) => (
          <Select id={id} value={value.state} onChange={(event) => onChange({ state: event.target.value, attention_cursor: null })}>
            <option value="">{copy.fields.any}</option>
            {(["unworked", "open", "waiting_on_customer", "identity_review", "closed"] as const).map((state) => (
              <option key={state} value={state}>{copy.outreachState[state]}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={copy.fields.rep} hint={copy.filters.repHint}>
        {({ id }) => (
          <Select id={id} value={value.agent_id} onChange={(event) => onChange({ agent_id: event.target.value, attention_cursor: null })}>
            <option value="">{copy.fields.anyRep}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </Select>
        )}
      </Field>
      {active && (
        <Button variant="link" size="sm" onClick={() => onChange({ band: "", needs_review: false, state: "", agent_id: "", attention_cursor: null })}>
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
  if (value.band) chips.push({ key: "band", label: `Band ${value.band} · ${bandLabel(Number(value.band))}`, clear: () => onChange({ band: "", attention_cursor: null }) });
  if (value.needs_review) chips.push({ key: "review", label: copy.needsReview.title, clear: () => onChange({ needs_review: false, attention_cursor: null }) });
  if (value.state) chips.push({ key: "state", label: `${copy.fields.status}: ${copy.outreachState[value.state as keyof typeof copy.outreachState] ?? label(value.state)}`, clear: () => onChange({ state: "", attention_cursor: null }) });
  if (value.agent_id) chips.push({ key: "agent", label: agents.find((agent) => agent.id === value.agent_id)?.name ?? copy.fields.rep, clear: () => onChange({ agent_id: "", attention_cursor: null }) });
  return chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />);
}

export type NumberFilterValue = {
  classification: string;
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
  const active = Boolean(value.classification || (value.attachment && value.attachment !== "any") || value.hygiene || value.active_from || value.active_to);
  return (
    <div className="si-filters">
      <Field label={copy.fields.classification} hint={copy.filters.classificationHint}>
        {({ id }) => (
          <Select id={id} value={value.classification} onChange={(event) => onChange({ classification: event.target.value, number_cursor: null })}>
            <option value="">{copy.fields.any}</option>
            {(["unknown", "customer", "company", "non_customer"] as const).map((item) => (
              <option key={item} value={item}>{copy.classification[item]}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={copy.fields.leadMatch} hint={copy.filters.leadMatchHint}>
        {({ id }) => (
          <Select id={id} value={value.attachment || "any"} onChange={(event) => onChange({ attachment: event.target.value, number_cursor: null })}>
            <option value="any">{copy.attachment.any}</option>
            <option value="linked">{copy.attachment.linked}</option>
            <option value="unlinked">{copy.attachment.unlinked}</option>
          </Select>
        )}
      </Field>
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
        <Button variant="link" size="sm" onClick={() => onChange({ classification: "", attachment: "any", hygiene: false, active_from: "", active_to: "", number_cursor: null })}>
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
  if (value.classification) chips.push({ key: "classification", label: `${copy.fields.classification}: ${classificationLabel(value.classification)}`, clear: () => onChange({ classification: "", number_cursor: null }) });
  if (value.attachment && value.attachment !== "any") chips.push({ key: "attachment", label: `${copy.fields.leadMatch}: ${copy.attachment[value.attachment as keyof typeof copy.attachment] ?? value.attachment}`, clear: () => onChange({ attachment: "any", number_cursor: null }) });
  if (value.hygiene) chips.push({ key: "hygiene", label: copy.fields.includeOurNumbers, clear: () => onChange({ hygiene: false, number_cursor: null }) });
  if (value.active_from) chips.push({ key: "from", label: `${copy.fields.activityFrom} ${formatDateTime(value.active_from)}`, clear: () => onChange({ active_from: "", number_cursor: null }) });
  if (value.active_to) chips.push({ key: "to", label: `${copy.fields.activityTo} ${formatDateTime(value.active_to)}`, clear: () => onChange({ active_to: "", number_cursor: null }) });
  return chips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.clear} />);
}
