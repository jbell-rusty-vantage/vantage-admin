"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { FilterField } from "@/components/filters/filter-field";
import { Input } from "@/components/ui/input";
import type {
  LeadSourceSetupCommand,
  LeadSourceSetupPreview,
  LeadSourceSetupResult,
} from "@/lib/api/leadSources";
import { DEFAULT_GRANOT_SMS_TEMPLATE, renderGranotLeadSmsPreview } from "@/lib/operations-registry/smsPreview";
import { normalizeNameReceivedFromGranot } from "@/lib/operations-registry/granotReviewSentence";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export const SETUP_DEFAULT_REASON = "Owner created this draft lead source from the guided setup";

export type SetupWizardState = {
  name: string;
  owner_label: string;
  aliasesText: string;
  channel: "form" | "call";
  splitMoveTypes: boolean;
  feed_display_name: string;
  crm_label: string;
  includeGranot: boolean | null;
  granotName: string;
  when_lead_arrives: "watch_only" | "existing_only" | "create_if_missing";
  textConfigured: boolean;
  reason: string;
};

const EMPTY_STATE: SetupWizardState = {
  name: "",
  owner_label: "",
  aliasesText: "",
  channel: "form",
  splitMoveTypes: false,
  feed_display_name: "",
  crm_label: "",
  includeGranot: null,
  granotName: "",
  when_lead_arrives: "existing_only",
  textConfigured: false,
  reason: SETUP_DEFAULT_REASON,
};

export function defaultFeedName(channel: "form" | "call"): string {
  return channel === "call" ? "Inbound calls" : "Web forms";
}

export function buildSetupCommand(state: SetupWizardState): LeadSourceSetupCommand {
  const aliases = state.aliasesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    name: state.name.trim(),
    owner_label: (state.owner_label.trim() || state.name.trim()) || undefined,
    aliases: aliases.length ? aliases : undefined,
    channel: state.channel,
    feed_display_name: state.feed_display_name.trim() || defaultFeedName(state.channel),
    crm_label: state.crm_label.trim(),
    move_type: state.channel === "form" && state.splitMoveTypes ? "local" : undefined,
    granot:
      state.includeGranot === true
        ? {
            name_received_from_granot: state.granotName.trim(),
            when_lead_arrives: state.when_lead_arrives,
          }
        : null,
    reason: state.reason.trim(),
  };
}

export function SetupStepLeadSource({
  state,
  onChange,
}: {
  state: SetupWizardState;
  onChange: (next: SetupWizardState) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-navy">Who sends you these leads?</p>
      <FilterField label="Lead source name">
        <Input
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
        <p className="mt-1 text-xs text-muted-foreground">
          The partner&apos;s real name, for example Best Relocation. For our records. Customer texts
          still say Vantage Movers.
        </p>
      </FilterField>
      <FilterField label="Show it as">
        <Input
          value={state.owner_label}
          onChange={(event) => onChange({ ...state, owner_label: event.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          What you will pick in filters and reports. Defaults to the name above.
        </p>
      </FilterField>
      <FilterField label="Also accept these spellings">
        <Input
          value={state.aliasesText}
          onChange={(event) => onChange({ ...state, aliasesText: event.target.value })}
          placeholder="Separate with commas"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Used only when an incoming lead does not match exactly. Not shown anywhere and not used in
          reports.
        </p>
      </FilterField>
    </div>
  );
}

export function SetupStepHowLeadsArrive({
  state,
  onChange,
}: {
  state: SetupWizardState;
  onChange: (next: SetupWizardState) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-navy">Where do these leads come from?</p>
      <FilterField label="How the leads arrive">
        <select
          className={selectClassName}
          value={state.channel}
          onChange={(event) => {
            const channel = event.target.value as "form" | "call";
            onChange({
              ...state,
              channel,
              splitMoveTypes: channel === "call" ? false : state.splitMoveTypes,
              feed_display_name: defaultFeedName(channel),
            });
          }}
        >
          <option value="form">Web forms</option>
          <option value="call">Inbound calls</option>
        </select>
      </FilterField>
      {state.channel === "form" ? (
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={state.splitMoveTypes}
            onChange={(event) => onChange({ ...state, splitMoveTypes: event.target.checked })}
          />
          Do local and long-distance moves need to be tracked separately?
        </label>
      ) : null}
      {state.channel === "form" && state.splitMoveTypes ? (
        <FeedbackMessage tone="info">
          This draft saves one feed. Add the long-distance feed after you save.
        </FeedbackMessage>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Once this feed is activated, its kind — web forms or inbound calls — cannot be changed.
      </p>
      <FilterField label="Name this feed">
        <Input
          value={state.feed_display_name}
          onChange={(event) => onChange({ ...state, feed_display_name: event.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">Defaults to &quot;Web forms&quot; or &quot;Inbound calls&quot;.</p>
      </FilterField>
      <FilterField label="What Vantage sends to Granot">
        <Input
          value={state.crm_label}
          onChange={(event) => onChange({ ...state, crm_label: event.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          The exact label Vantage puts on every lead from this feed when it posts to Granot. This is
          also the spelling that appears in the Source Company column of your sheet. It must not
          match any other active feed of the same kind.
        </p>
      </FilterField>
      <FeedbackMessage tone="info">
        Add separate feeds after this draft is saved. This setup creates one feed. Extra feeds use
        the existing feed records, then you connect the Granot name.
      </FeedbackMessage>
    </div>
  );
}

export function SetupStepGranotName({
  state,
  onChange,
}: {
  state: SetupWizardState;
  onChange: (next: SetupWizardState) => void;
}) {
  const normalized = normalizeNameReceivedFromGranot(state.granotName);
  const changed = Boolean(state.granotName.trim()) && normalized !== state.granotName.trim().toLowerCase();
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-navy">
        Does Granot send you leads under a name for this source?
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={state.includeGranot === true ? "default" : "outline"}
          onClick={() => onChange({ ...state, includeGranot: true })}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={state.includeGranot === false ? "default" : "outline"}
          onClick={() => onChange({ ...state, includeGranot: false })}
        >
          Not yet
        </Button>
      </div>
      {state.includeGranot === false ? (
        <FeedbackMessage tone="info">
          Leads will still arrive through the form or the phone number. The Lead Source detail will
          show connect a Granot name as a next step.
        </FeedbackMessage>
      ) : null}
      {state.includeGranot === true ? (
        <>
          <FilterField label="Name received from Granot">
            <Input
              value={state.granotName}
              onChange={(event) => onChange({ ...state, granotName: event.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Type it exactly as Granot spells it. If it differs by even one character, leads under
              that name will not be recognized here.
            </p>
          </FilterField>
          {changed ? (
            <FeedbackMessage tone="warning">
              We will match this as `{normalized}`. Your entry had extra spacing.
            </FeedbackMessage>
          ) : null}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-navy">When a lead arrives</legend>
            <label className="block rounded-md border p-3 text-sm">
              <input
                type="radio"
                className="mr-2"
                checked={state.when_lead_arrives === "watch_only"}
                onChange={() => onChange({ ...state, when_lead_arrives: "watch_only" })}
              />
              Watch only
              <span className="mt-1 block text-xs text-muted-foreground">
                We record it as evidence. Nothing is created or changed.
              </span>
            </label>
            <label className="block rounded-md border p-3 text-sm">
              <input
                type="radio"
                className="mr-2"
                checked={state.when_lead_arrives === "existing_only"}
                onChange={() => onChange({ ...state, when_lead_arrives: "existing_only" })}
              />
              Use an existing lead only
              <span className="mt-1 block text-xs text-muted-foreground">
                We attach it to a lead we already have. We never create one.
              </span>
            </label>
            <label className="block rounded-md border p-3 text-sm">
              <input
                type="radio"
                className="mr-2"
                checked={state.when_lead_arrives === "create_if_missing"}
                onChange={() => onChange({ ...state, when_lead_arrives: "create_if_missing" })}
              />
              Use an existing lead, or create it if missing
              <span className="mt-1 block text-xs text-muted-foreground">
                If we have no matching lead, we create one in this feed. This is the only choice that
                can text the customer.
              </span>
            </label>
          </fieldset>
          {state.when_lead_arrives === "create_if_missing" ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium text-navy">Text the customer</p>
              <p className="text-sm text-muted-foreground">Off by default.</p>
              <p className="text-sm">{renderGranotLeadSmsPreview({ template: DEFAULT_GRANOT_SMS_TEMPLATE })}</p>
              <FeedbackMessage tone="info">
                Texting is set up after the Granot name is saved. We will bring you back to this on
                the next screen.
              </FeedbackMessage>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function SetupStepReview({
  preview,
  crmLabel,
}: {
  preview: LeadSourceSetupPreview | null;
  crmLabel?: string;
}) {
  if (!preview) {
    return <FeedbackMessage tone="warning">Review comes from the server preview.</FeedbackMessage>;
  }
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-navy">You are creating</p>
      <p>
        {preview.derived.owner_label} — lead source
        <br />
        {preview.derived.feed_display_name} — feed
        <br />
        What Vantage sends to Granot: {crmLabel ?? preview.derived.owner_label}
        <br />
        Sheet Source Company column: {crmLabel ?? preview.derived.owner_label}
      </p>
      <p>Internal key: {preview.derived.company_slug}</p>
      <p>Feed key: {preview.derived.granularity_key}</p>
      {preview.derived.normalized_granot_label ? (
        <p>
          Granot name lands in: {preview.derived.owner_label} → {preview.derived.feed_display_name}
        </p>
      ) : (
        <p>No Granot name yet. Connect a Granot name later from the detail page.</p>
      )}
      {preview.collisions.length > 0 ? (
        <FeedbackMessage tone="error">
          {preview.collisions.map((item) => item.message).join(" ")}
        </FeedbackMessage>
      ) : (
        <FeedbackMessage tone="info">Nothing is live yet. After saving you will:</FeedbackMessage>
      )}
      <ol className="list-decimal space-y-1 pl-5">
        {preview.readiness_plan.map((row) => (
          <li key={row.gate}>
            {row.gate}
            {row.blocked_until ? ` — waiting on ${row.blocked_until}` : ""}
            {row.suggested ? " (suggested)" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function LeadSourceSetupWizard({
  onPreview,
  onCommit,
  onCancel,
  isPending,
}: {
  onPreview: (command: LeadSourceSetupCommand) => Promise<LeadSourceSetupPreview>;
  onCommit: (command: LeadSourceSetupCommand) => Promise<LeadSourceSetupResult>;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<SetupWizardState>(EMPTY_STATE);
  const [preview, setPreview] = useState<LeadSourceSetupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canContinue = useMemo(() => {
    if (step === 1) return state.name.trim().length > 0;
    if (step === 2) return state.crm_label.trim().length > 0;
    if (step === 3) {
      if (state.includeGranot === null) return false;
      if (state.includeGranot === false) return true;
      return state.granotName.trim().length > 0;
    }
    return preview?.valid === true;
  }, [preview?.valid, state, step]);

  async function goNext() {
    setError(null);
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (step === 3) {
      try {
        const next = await onPreview(buildSetupCommand(state));
        setPreview(next);
        setStep(4);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Preview failed.");
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New lead source</CardTitle>
        <CardDescription>
          One flow. Save as draft first. Turning it on happens on the next screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
        {step === 1 ? <SetupStepLeadSource state={state} onChange={setState} /> : null}
        {step === 2 ? <SetupStepHowLeadsArrive state={state} onChange={setState} /> : null}
        {step === 3 ? <SetupStepGranotName state={state} onChange={setState} /> : null}
        {step === 4 ? <SetupStepReview preview={preview} crmLabel={state.crm_label} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < 4 ? (
            <Button type="button" disabled={!canContinue || isPending} onClick={() => void goNext()}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!preview?.valid || isPending}
              onClick={() => void onCommit(buildSetupCommand(state))}
            >
              Save as draft
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
