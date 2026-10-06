"use client";
/** The Roster part of a person: rename, Granot username, deactivate (with its dependency preview and reason) and reactivate; and the first step of Add person. */
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRegistryError } from "@/lib/api/registryRequest";
import {
  createRegistryCatalogItem,
  updateRegistryCatalogItem,
  type CatalogUpdateInput,
  type RegistryCatalogItem,
} from "@/lib/api/registryAgents";
import { ActivationBlock } from "./catalog-activation";
import { PEOPLE_COPY } from "./people-copy";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.rosterSheet;

const normalizeUsername = (value: string) => value.trim().toUpperCase();

/** The PATCH body for a roster edit: only what changed, plus the reason; null when nothing changed. Pure so a test covers it. */
export function rosterUpdateBody(agent: Pick<RegistryCatalogItem, "name" | "granot_crm_username">, draft: { name: string; granot: string; reason: string }): CatalogUpdateInput | null {
  const nameChanged = draft.name.trim() !== agent.name;
  const username = normalizeUsername(draft.granot);
  const usernameChanged = username !== normalizeUsername(agent.granot_crm_username ?? "") && username !== "";
  if (!nameChanged && !usernameChanged) return null;
  return {
    ...(nameChanged ? { name: draft.name.trim() } : {}),
    ...(usernameChanged ? { granot_crm_username: username } : {}),
    ...(draft.reason.trim() ? { reason: draft.reason.trim() } : {}),
  };
}

export function RosterEditBlock({ agent, onSaved }: { agent: RegistryCatalogItem; onSaved: (message: string) => void }) {
  const ids = { name: useId(), granot: useId(), reason: useId() };
  const queryClient = useQueryClient();
  const [name, setName] = useState(agent.name);
  const [granot, setGranot] = useState(agent.granot_crm_username ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const body = rosterUpdateBody(agent, { name, granot, reason });

  const save = useMutation({
    mutationFn: (input: CatalogUpdateInput) => updateRegistryCatalogItem("agents", agent.id, input),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setError(null);
      setReason("");
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
            <p className="su-row__hint">{c.granotHint}</p>
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

/** Add person, step 1: name and Granot username. The card appears once this succeeds. */
export function RosterCreateBlock({ onCreated }: { onCreated: (agent: RegistryCatalogItem) => void }) {
  const ids = { name: useId(), granot: useId() };
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [granot, setGranot] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createRegistryCatalogItem("agents", { name: name.trim(), ...(normalizeUsername(granot) ? { granot_crm_username: normalizeUsername(granot) } : {}) }),
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
      <div className="su-actions">
        <button type="submit" className="crm-button crm-button--primary" disabled={create.isPending}>
          {create.isPending ? PEOPLE_COPY.sheet.saving : c.create}
        </button>
      </div>
    </form>
  );
}
