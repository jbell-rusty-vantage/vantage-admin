"use client";
/**
 * The Roster part of a person: rename, set, correct or clear the Granot username, deactivate (with its dependency preview
 * and reason) and reactivate; the first step of Add an Agent (with or without a Granot username); and the Outreach Desk
 * control (`DeskBlock`: Automatic, Always on, Off).
 */
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRegistryError } from "@/lib/api/registryRequest";
import {
  createRegistryCatalogItem,
  updateRegistryCatalogItem,
  type CatalogUpdateInput,
  type OutreachDeskSetting,
  type RegistryCatalogItem,
} from "@/lib/api/registryAgents";
import { ActivationBlock } from "./catalog-activation";
import { PEOPLE_COPY } from "./people-copy";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.rosterSheet;

const normalizeUsername = (value: string) => value.trim().toUpperCase();

/**
 * The PATCH body for a roster edit: only what changed, plus the reason; null when nothing changed. An emptied Granot
 * username is sent as `null` (clear). Pure so a test covers it.
 */
export function rosterUpdateBody(agent: Pick<RegistryCatalogItem, "name" | "granot_crm_username">, draft: { name: string; granot: string; reason: string }): CatalogUpdateInput | null {
  const nameChanged = draft.name.trim() !== agent.name;
  const username = normalizeUsername(draft.granot);
  const usernameChanged = username !== normalizeUsername(agent.granot_crm_username ?? "");
  if (!nameChanged && !usernameChanged) return null;
  return {
    ...(nameChanged ? { name: draft.name.trim() } : {}),
    ...(usernameChanged ? { granot_crm_username: username || null } : {}),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  };
}

const DESK_SETTINGS: readonly OutreachDeskSetting[] = ["auto", "on", "off"];

/** The three Outreach Desk choices as radios. */
function DeskChoices({ name, value, onChange }: { name: string; value: OutreachDeskSetting; onChange: (value: OutreachDeskSetting) => void }) {
  return (
    <fieldset className="su-fields">
      {DESK_SETTINGS.map((setting) => (
        <label key={setting} className="su-choice">
          <input type="radio" name={name} checked={value === setting} onChange={() => onChange(setting)} />
          <span className="su-choice__text">
            {PEOPLE_COPY.deskSheet.options[setting]!.label}
            <span className="su-choice__hint">{PEOPLE_COPY.deskSheet.options[setting]!.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** The Outreach Desk control of one Agent: Automatic (the default), Always on, Off, with where the Agent stands now. */
export function DeskBlock({ agent, onSaved }: { agent: RegistryCatalogItem; onSaved?: (message: string) => void }) {
  const queryClient = useQueryClient();
  const name = useId();
  const current = agent.outreach_desk ?? "auto";
  const [setting, setSetting] = useState<OutreachDeskSetting>(current);
  const [flash, setFlash] = useState<{ tone: "done" | "refused"; text: string } | null>(null);
  const membership = agent.desk_membership;

  const save = useMutation({
    mutationFn: () => updateRegistryCatalogItem("agents", agent.id, { outreach_desk: setting }),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setFlash({ tone: "done", text: PEOPLE_COPY.deskSheet.saved });
      onSaved?.(PEOPLE_COPY.deskSheet.saved);
    },
    onError: (failure) => setFlash({ tone: "refused", text: formatRegistryError(failure) }),
  });

  return (
    <div className="su-sheet">
      <section className="su-block">
        <p className="su-quiet">{PEOPLE_COPY.deskSheet.intro}</p>
        {membership ? (
          <p className="su-review" data-testid="desk-now">
            {PEOPLE_COPY.deskSheet.now(membership.on ? PEOPLE_COPY.desk.on : PEOPLE_COPY.desk.off, PEOPLE_COPY.desk.reason[membership.reason] ?? membership.reason)}
          </p>
        ) : null}
        {flash ? (
          <p className={flash.tone === "refused" ? "su-errors" : "su-review"} role={flash.tone === "refused" ? "alert" : "status"}>
            {flash.text}
          </p>
        ) : null}
        <DeskChoices name={name} value={setting} onChange={setSetting} />
        <div className="su-actions">
          <button type="button" className="crm-button crm-button--primary" disabled={setting === current || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? PEOPLE_COPY.sheet.saving : PEOPLE_COPY.deskSheet.save}
          </button>
        </div>
      </section>
    </div>
  );
}

export function RosterEditBlock({ agent, onSaved }: { agent: RegistryCatalogItem; onSaved: (message: string) => void }) {
  const ids = { name: useId(), granot: useId(), reason: useId() };
  const queryClient = useQueryClient();
  const [name, setName] = useState(agent.name);
  const [granot, setGranot] = useState(agent.granot_crm_username ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const body = rosterUpdateBody(agent, { name, granot, reason });

  const save = useMutation({
    mutationFn: (input: CatalogUpdateInput) => updateRegistryCatalogItem("agents", agent.id, input),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setError(null);
      setReason("");
      setSaved(c.saved);
      onSaved(c.saved);
    },
    onError: (failure) => setError(formatRegistryError(failure)),
  });

  return (
    <div className="su-sheet">
      <section className="su-block">
        {error ? (
          <p className="su-errors" role="alert">
            {error}
          </p>
        ) : saved ? (
          <p className="su-review" role="status">
            {saved}
          </p>
        ) : null}
        <div className="su-fields">
          <div className="su-row">
            <label className="su-row__label" htmlFor={ids.name}>
              {c.name}
            </label>
            <input id={ids.name} className="su-input" value={name} onChange={(event) => setName(event.target.value)} />
            <p className="su-row__hint">{c.nameHint}</p>
          </div>
          <div className="su-row">
            <label className="su-row__label" htmlFor={ids.granot}>
              {c.granot}
            </label>
            <input
              id={ids.granot}
              className="su-input"
              value={granot}
              onChange={(event) => setGranot(event.target.value.toUpperCase())}
              placeholder={c.granotPlaceholder}
              autoComplete="off"
            />
            <p className="su-row__hint">{agent.granot_crm_username && !granot.trim() ? c.granotClearNote : c.granotHint}</p>
          </div>
          <div className="su-row">
            <label className="su-row__label" htmlFor={ids.reason}>
              {c.reason}
            </label>
            <input id={ids.reason} className="su-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={c.reasonPlaceholder} />
          </div>
        </div>
        {agent.deactivation_reason ? <p className="su-quiet">{c.deactivationReason(agent.deactivation_reason)}</p> : null}
        <div className="su-actions">
          <button
            type="button"
            className="crm-button crm-button--primary"
            disabled={!body || !name.trim() || save.isPending}
            onClick={() => (body ? save.mutate(body) : undefined)}
          >
            {save.isPending ? PEOPLE_COPY.sheet.saving : c.save}
          </button>
        </div>
      </section>
      <section className="su-block">
        <ActivationBlock
          kind="agents"
          item={agent}
          reason={reason}
          onChanged={onSaved}
          copy={{ ...c, keepActive: c.keep, saving: PEOPLE_COPY.sheet.saving }}
        />
      </section>
    </div>
  );
}

/**
 * Add an Agent: name, an optional Granot username and the Outreach Desk choice. The card appears once this succeeds.
 * `compact` leaves the desk choice at Automatic (used inline when a login sheet adds the Agent it needs).
 */
export function RosterCreateBlock({ onCreated, compact = false }: { onCreated: (agent: RegistryCatalogItem) => void; compact?: boolean }) {
  const ids = { name: useId(), granot: useId(), desk: useId() };
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [granot, setGranot] = useState("");
  const [desk, setDesk] = useState<OutreachDeskSetting>("auto");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createRegistryCatalogItem("agents", {
        name: name.trim(),
        ...(normalizeUsername(granot) ? { granot_crm_username: normalizeUsername(granot) } : {}),
        ...(desk !== "auto" ? { outreach_desk: desk } : {}),
      }),
    onSuccess: async (agent) => {
      await invalidatePeople(queryClient);
      setError(null);
      onCreated(agent);
    },
    onError: (failure) => setError(formatRegistryError(failure)),
  });

  return (
    <form
      className="su-fields"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setError(c.nameRequired);
          return;
        }
        create.mutate();
      }}
    >
      {error ? (
        <p className="su-errors" role="alert">
          {error}
        </p>
      ) : null}
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.name}>
          {c.name}
        </label>
        <input id={ids.name} className="su-input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </div>
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.granot}>
          {c.granot}
        </label>
        <input id={ids.granot} className="su-input" value={granot} onChange={(event) => setGranot(event.target.value.toUpperCase())} placeholder={c.granotPlaceholder} autoComplete="off" />
        <p className="su-row__hint">{c.granotHint}</p>
      </div>
      {compact ? null : (
        <div className="su-row">
          <span className="su-row__label">{c.desk}</span>
          <DeskChoices name={ids.desk} value={desk} onChange={setDesk} />
        </div>
      )}
      <div className="su-actions">
        <button type="submit" className="crm-button crm-button--primary" disabled={create.isPending}>
          {create.isPending ? PEOPLE_COPY.sheet.saving : c.create}
        </button>
      </div>
    </form>
  );
}
