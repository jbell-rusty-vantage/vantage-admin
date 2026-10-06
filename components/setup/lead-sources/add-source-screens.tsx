/**
 * Add a lead source, screens 1 to 3 and the review (doc 19): today's wizard's questions and words kept, re-laid on the
 * CRM sheet blocks, plus screen 2's "Both" and Local / Long distance split and screen 3's landing for a split form
 * source. Presentational (state in, state out) so `tests/lead-source-setup.test.ts` renders each to static markup.
 */
import { DEFAULT_GRANOT_SMS_TEMPLATE, renderGranotLeadSmsPreview } from "@/lib/operations-registry/smsPreview";
import { normalizeNameReceivedFromGranot } from "@/lib/operations-registry/granotReviewSentence";
import type { LeadSourceSetupPreview } from "@/lib/api/leadSources";
import { ADD_COPY as COPY, ARRIVAL_HINTS, ARRIVAL_LABELS, type GranotArrivalValue } from "./lead-sources-copy";
import {
  arrivalChoiceOf,
  defaultFeedName,
  splitCrmDefaults,
  splitFeedDefaults,
  withArrivalChoice,
  type ArrivalChoice,
  type SetupWizardState,
} from "./add-source-flow";
import { Field, SheetBlock } from "./sheet-parts";

type ScreenProps = { state: SetupWizardState; onChange: (next: SetupWizardState) => void };

export function SetupStepLeadSource({ state, onChange }: ScreenProps) {
  return (
    <SheetBlock id="ls-add-1" title={COPY.q1}>
      <fieldset className="su-fields">
        <Field label={COPY.nameLabel} htmlFor="ls-add-name" hint={COPY.nameHint}>
          <input
            id="ls-add-name"
            className="su-input"
            value={state.name}
            onChange={(event) =>
              onChange({
                ...state,
                name: event.target.value,
                owner_label: state.owner_label || event.target.value,
                crm_label: state.crm_label || event.target.value,
              })
            }
          />
        </Field>
        <Field label={COPY.showAsLabel} htmlFor="ls-add-showas" hint={COPY.showAsHint}>
          <input id="ls-add-showas" className="su-input" value={state.owner_label} onChange={(event) => onChange({ ...state, owner_label: event.target.value })} />
        </Field>
        <Field label={COPY.spellingsLabel} htmlFor="ls-add-aliases" hint={COPY.spellingsHint}>
          <input
            id="ls-add-aliases"
            className="su-input"
            value={state.aliasesText}
            placeholder={COPY.spellingsPlaceholder}
            onChange={(event) => onChange({ ...state, aliasesText: event.target.value })}
          />
        </Field>
      </fieldset>
    </SheetBlock>
  );
}

const ARRIVAL_OPTIONS: ReadonlyArray<{ value: ArrivalChoice; label: string }> = [
  { value: "form", label: COPY.arrivalForm },
  { value: "call", label: COPY.arrivalCall },
  { value: "both", label: COPY.arrivalBoth },
];

export function SetupStepHowLeadsArrive({ state, onChange }: ScreenProps) {
  const choice = arrivalChoiceOf(state);
  const hasForm = state.channel === "form";
  const splitCrm = splitCrmDefaults(state.name);
  return (
    <SheetBlock id="ls-add-2" title={COPY.q2}>
      <fieldset className="su-fields">
        <legend className="su-row__label">{COPY.arrivalLabel}</legend>
        {ARRIVAL_OPTIONS.map((option) => (
          <label key={option.value} className="su-choice">
            <input type="radio" name="ls-add-arrival" checked={choice === option.value} onChange={() => onChange(withArrivalChoice(state, option.value))} />
            <span className="su-choice__text">{option.label}</span>
          </label>
        ))}
        <p className="su-quiet">{COPY.arrivalDefaultNote}</p>
      </fieldset>

      {hasForm ? (
        <fieldset className="su-fields">
          <legend className="su-row__label">{COPY.splitLegend}</legend>
          <label className="su-choice">
            <input
              type="radio"
              name="ls-add-split"
              checked={!state.splitMoveTypes}
              onChange={() => onChange({ ...state, splitMoveTypes: false, feed_display_name: state.feed_display_name || defaultFeedName("form") })}
            />
            <span className="su-choice__text">{COPY.splitOne}</span>
          </label>
          <label className="su-choice">
            <input
              type="radio"
              name="ls-add-split"
              checked={state.splitMoveTypes}
              onChange={() => {
                const names = splitFeedDefaults(state.feed_display_name || defaultFeedName("form"));
                onChange({
                  ...state,
                  splitMoveTypes: true,
                  feed_display_name: names.local,
                  long_feed_display_name: state.long_feed_display_name || names.long,
                  crm_label: !state.crm_label || state.crm_label === state.name ? splitCrm.local : state.crm_label,
                  long_crm_label: state.long_crm_label || splitCrm.long,
                });
              }}
            />
            <span className="su-choice__text">
              {COPY.splitTwo}
              <span className="su-choice__hint">{COPY.splitTwoHint}</span>
            </span>
          </label>
          {state.splitMoveTypes ? <p className="su-quiet">{COPY.splitTwoNote}</p> : null}
        </fieldset>
      ) : null}

      <p className="su-quiet">{COPY.feedKindNote}</p>

      <fieldset className="su-fields">
        {hasForm ? (
          <>
            <Field label={state.splitMoveTypes ? COPY.feedNameLocal : COPY.feedNameForm} htmlFor="ls-add-feedname" hint={COPY.feedNameHint}>
              <input id="ls-add-feedname" className="su-input" value={state.feed_display_name} onChange={(event) => onChange({ ...state, feed_display_name: event.target.value })} />
            </Field>
            <Field label={COPY.granotSendsLabel} htmlFor="ls-add-crm" hint={COPY.granotSendsHint}>
              <input id="ls-add-crm" className="su-input" value={state.crm_label} onChange={(event) => onChange({ ...state, crm_label: event.target.value })} />
            </Field>
            {state.splitMoveTypes ? (
              <>
                <Field label={COPY.feedNameLong} htmlFor="ls-add-longname">
                  <input id="ls-add-longname" className="su-input" value={state.long_feed_display_name} onChange={(event) => onChange({ ...state, long_feed_display_name: event.target.value })} />
                </Field>
                <Field label={COPY.granotSendsLabel} htmlFor="ls-add-longcrm">
                  <input id="ls-add-longcrm" className="su-input" value={state.long_crm_label} onChange={(event) => onChange({ ...state, long_crm_label: event.target.value })} />
                </Field>
              </>
            ) : null}
          </>
        ) : null}
        {state.channel === "call" ? (
          <>
            <Field label={COPY.feedNameCall} htmlFor="ls-add-callname" hint={COPY.feedNameHint}>
              <input id="ls-add-callname" className="su-input" value={state.feed_display_name} onChange={(event) => onChange({ ...state, feed_display_name: event.target.value })} />
            </Field>
            <Field label={COPY.granotSendsLabel} htmlFor="ls-add-callcrm" hint={COPY.granotSendsHint}>
              <input id="ls-add-callcrm" className="su-input" value={state.crm_label} onChange={(event) => onChange({ ...state, crm_label: event.target.value })} />
            </Field>
          </>
        ) : null}
        {state.alsoCalls && hasForm ? (
          <>
            <Field label={COPY.feedNameCall} htmlFor="ls-add-alsocallname">
              <input
                id="ls-add-alsocallname"
                className="su-input"
                value={state.call_feed_display_name}
                placeholder={defaultFeedName("call")}
                onChange={(event) => onChange({ ...state, call_feed_display_name: event.target.value })}
              />
            </Field>
            <Field label={COPY.callGranotSendsLabel} htmlFor="ls-add-alsocallcrm">
              <input
                id="ls-add-alsocallcrm"
                className="su-input"
                value={state.call_crm_label}
                placeholder={state.name ? `${state.name} Inbounds` : ""}
                onChange={(event) => onChange({ ...state, call_crm_label: event.target.value })}
              />
            </Field>
          </>
        ) : null}
      </fieldset>
    </SheetBlock>
  );
}

export function SetupStepGranotName({ state, onChange }: ScreenProps) {
  const normalized = normalizeNameReceivedFromGranot(state.granotName);
  const changed = Boolean(state.granotName.trim()) && normalized !== state.granotName.trim().toLowerCase();
  const arrivals: GranotArrivalValue[] = ["existing_only", "create_if_missing", "watch_only"];
  const split = state.channel === "form" && state.splitMoveTypes;
  return (
    <SheetBlock id="ls-add-3" title={COPY.q3}>
      <div className="su-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className={`crm-button crm-button--sm${state.includeGranot === true ? " crm-button--primary" : ""}`} aria-pressed={state.includeGranot === true} onClick={() => onChange({ ...state, includeGranot: true })}>
          {COPY.yes}
        </button>
        <button type="button" className={`crm-button crm-button--sm${state.includeGranot === false ? " crm-button--primary" : ""}`} aria-pressed={state.includeGranot === false} onClick={() => onChange({ ...state, includeGranot: false })}>
          {COPY.notYet}
        </button>
      </div>
      {state.includeGranot === false ? <p className="su-quiet">{COPY.notYetNote}</p> : null}
      {state.includeGranot === true ? (
        <>
          <fieldset className="su-fields">
            <Field label={COPY.granotNameLabel} htmlFor="ls-add-granot" hint={COPY.granotNameHint}>
              <input id="ls-add-granot" className="su-input" value={state.granotName} onChange={(event) => onChange({ ...state, granotName: event.target.value })} />
            </Field>
          </fieldset>
          {changed ? <p className="ls-warning">We will match this as `{normalized}`. Your entry had extra spacing.</p> : null}
          <fieldset className="su-fields">
            <legend className="su-row__label">{COPY.arrivalLegend}</legend>
            {arrivals.map((value) => (
              <label key={value} className="su-choice">
                <input type="radio" name="ls-add-when" checked={state.when_lead_arrives === value} onChange={() => onChange({ ...state, when_lead_arrives: value })} />
                <span className="su-choice__text">
                  {ARRIVAL_LABELS[value]}
                  <span className="su-choice__hint">{ARRIVAL_HINTS[value]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {state.when_lead_arrives === "create_if_missing" ? (
            <div className="su-fields">
              <p className="su-review">{COPY.textLaterTitle}</p>
              <p className="su-quiet">{COPY.textLaterOff}</p>
              <p className="ls-bubble">{renderGranotLeadSmsPreview({ template: DEFAULT_GRANOT_SMS_TEMPLATE })}</p>
              <p className="su-quiet">{COPY.textLater}</p>
            </div>
          ) : null}
          {split ? (
            <fieldset className="su-fields">
              <legend className="su-row__label">{COPY.landingLegend}</legend>
              <label className="su-choice">
                <input type="radio" name="ls-add-landing" checked={state.landing === "both"} onChange={() => onChange({ ...state, landing: "both" })} />
                <span className="su-choice__text">{COPY.landingBoth}</span>
              </label>
              <label className="su-choice">
                <input type="radio" name="ls-add-landing" checked={state.landing === "local_only"} onChange={() => onChange({ ...state, landing: "local_only" })} />
                <span className="su-choice__text">{COPY.landingLocalOnly}</span>
              </label>
            </fieldset>
          ) : null}
        </>
      ) : null}
      {state.alsoCalls ? (
        <fieldset className="su-fields">
          <Field label={COPY.callGranotLabel} htmlFor="ls-add-callgranot" hint={COPY.callGranotHint}>
            <input id="ls-add-callgranot" className="su-input" value={state.callGranotName} onChange={(event) => onChange({ ...state, callGranotName: event.target.value })} />
          </Field>
        </fieldset>
      ) : null}
    </SheetBlock>
  );
}

/** What the commit creates beyond the one feed the server preview describes. */
export function reviewExtras(state: SetupWizardState): string[] {
  const lines: string[] = [];
  if (state.channel === "form" && state.splitMoveTypes) {
    lines.push(`${state.long_feed_display_name.trim() || splitFeedDefaults(state.feed_display_name).long} · ${COPY.reviewFeed}`);
    if (state.includeGranot === true && state.landing === "both") {
      lines.push(`Granot name lands in: ${state.feed_display_name.trim() || "Local"} and ${state.long_feed_display_name.trim() || "Long distance"}, by the move type`);
    }
  }
  if (state.alsoCalls) {
    lines.push(`${state.call_feed_display_name.trim() || defaultFeedName("call")} · ${COPY.reviewFeed}`);
    if (state.callGranotName.trim()) lines.push(`Granot name "${state.callGranotName.trim()}" lands in the call feed`);
  }
  return lines;
}

export function SetupStepReview({
  preview,
  crmLabel,
  extras = [],
  granotFollowsUp = false,
}: {
  preview: LeadSourceSetupPreview | null;
  crmLabel?: string;
  extras?: readonly string[];
  /** The Granot name is created by a follow-up command (it lands in two feeds), so the server preview shows none. */
  granotFollowsUp?: boolean;
}) {
  if (!preview) return <p className="ls-warning">{COPY.reviewNeedsPreview}</p>;
  return (
    <SheetBlock id="ls-add-review" title={COPY.reviewTitle}>
      <p className="su-review">
        {preview.derived.owner_label} · {COPY.reviewLeadSource}
        <br />
        {preview.derived.feed_display_name} · {COPY.reviewFeed}
      </p>
      {extras.map((line) => (
        <p key={line} className="su-review">
          {line}
        </p>
      ))}
      <p>{COPY.reviewSendsToGranot(crmLabel ?? preview.derived.owner_label)}</p>
      <p>{COPY.reviewSheetColumn(crmLabel ?? preview.derived.owner_label)}</p>
      <p className="su-quiet">{COPY.reviewKey(preview.derived.company_slug)}</p>
      <p className="su-quiet">{COPY.reviewFeedKey(preview.derived.granularity_key)}</p>
      {preview.derived.normalized_granot_label ? (
        <p>Granot name lands in: {preview.derived.owner_label} → {preview.derived.feed_display_name}</p>
      ) : granotFollowsUp ? null : (
        <p>{COPY.reviewNoGranot}</p>
      )}
      {preview.collisions.length > 0 ? (
        <div className="su-errors" role="alert">
          {preview.collisions.map((item) => item.message).join(" ")}
        </div>
      ) : (
        <p className="su-quiet">{COPY.reviewNothingLive}</p>
      )}
      <ol className="ls-checklist">
        {preview.readiness_plan.map((row) => (
          <li key={row.gate}>
            {row.gate}
            {row.blocked_until ? ` · ${COPY.reviewWaiting(row.blocked_until)}` : ""}
            {row.suggested ? ` ${COPY.reviewSuggested}` : ""}
          </li>
        ))}
      </ol>
    </SheetBlock>
  );
}
