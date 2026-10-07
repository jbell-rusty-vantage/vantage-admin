"use client";
/**
 * The Extension login part of a person (the Owner-only Extension users page, moved): create with email, password, roles
 * (Owner, Sales, Customer Service) and the Agent it belongs to; edit roles with the password left blank to keep it;
 * connect or disconnect the Agent (bookkeeping only: it never signs the login out); Remove, which is a hard delete and
 * says so before the confirm. From a card the Agent is fixed; standalone, the Owner picks one, adds one, or leaves none.
 */
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentOption } from "@/components/operations-registry/users/users-logic";
import {
  CURRENT_EXTENSION_ROLES,
  createExtensionUser,
  deleteExtensionUser,
  rolesSetsEqual,
  updateExtensionUser,
  type AdminExtensionUser,
  type CurrentExtensionRole,
  type UpdateExtensionUserInput,
} from "@/lib/api/extensionUsers";
import { EXTENSION_COPY } from "./extension-copy";
import { PEOPLE_COPY } from "./people-copy";
import { RosterCreateBlock } from "./roster-block";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.extensionSheet;

function roleOptionLabel(role: CurrentExtensionRole): string {
  return role === "owner" ? EXTENSION_COPY.ownerOption : role === "sales" ? EXTENSION_COPY.salesOption : EXTENSION_COPY.customerServiceOption;
}

const toggleRole = (roles: CurrentExtensionRole[], role: CurrentExtensionRole) => (roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role]);
const normalizedEmail = (value: string) => value.trim().toLowerCase();

/**
 * The PATCH body for an edit: only what changed (a blank password keeps the current one; `agentId` undefined leaves the
 * Agent as it is, `""` or null disconnects); null when nothing changed. Pure so a test covers it.
 */
export function extensionPatch(
  user: Pick<AdminExtensionUser, "email" | "roles" | "agent_id">,
  draft: { email: string; password: string; roles: CurrentExtensionRole[]; agentId?: string | null },
): UpdateExtensionUserInput | null {
  const patch: UpdateExtensionUserInput = {};
  if (normalizedEmail(draft.email) !== normalizedEmail(user.email)) patch.email = draft.email.trim();
  if (draft.password !== "") patch.password = draft.password;
  if (!rolesSetsEqual(draft.roles, user.roles)) patch.roles = draft.roles;
  if (draft.agentId !== undefined && (draft.agentId || null) !== (user.agent_id ?? null)) patch.agent_id = draft.agentId || null;
  return Object.keys(patch).length === 0 ? null : patch;
}

function RoleChecks({ idPrefix, roles, onChange }: { idPrefix: string; roles: CurrentExtensionRole[]; onChange: (roles: CurrentExtensionRole[]) => void }) {
  return (
    <fieldset className="su-fields">
      <legend className="su-row__label">{c.roles}</legend>
      {CURRENT_EXTENSION_ROLES.map((role) => (
        <label key={role} htmlFor={`${idPrefix}-${role}`} className="su-choice">
          <input id={`${idPrefix}-${role}`} type="checkbox" checked={roles.includes(role)} onChange={() => onChange(toggleRole(roles, role))} />
          <span className="su-choice__text">
            {roleOptionLabel(role)}
            <span className="su-choice__hint">{role === "owner" ? EXTENSION_COPY.ownerRole : role === "sales" ? EXTENSION_COPY.salesRole : EXTENSION_COPY.customerServiceRole}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

type Flash = { tone: "done" | "refused"; text: string } | null;

function FlashLine({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return flash.tone === "refused" ? (
    <p className="su-errors" role="alert">
      {flash.text}
    </p>
  ) : (
    <p className="su-review" role="status">
      {flash.text}
    </p>
  );
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Where the Agent comes from: fixed (a card), or picked by the Owner (standalone) from `options`. */
type AgentChoice = { fixed: AgentOption } | { options: AgentOption[] };

function AgentField({ id, choice, value, onChange }: { id: string; choice: AgentChoice; value: string; onChange: (agentId: string) => void }) {
  if ("fixed" in choice) {
    return (
      <div className="su-row">
        <label className="su-row__label" htmlFor={id}>
          {c.agent}
        </label>
        <input id={id} className="su-input" value={choice.fixed.name} readOnly />
        <p className="su-row__hint">{c.agentFixed}</p>
      </div>
    );
  }
  return (
    <div className="su-row">
      <label className="su-row__label" htmlFor={id}>
        {c.agent}
      </label>
      <select id={id} className="su-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{c.agentNone}</option>
        {choice.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.active ? option.name : `${option.name} (inactive)`}
          </option>
        ))}
      </select>
      <p className="su-row__hint">{c.agentHint}</p>
    </div>
  );
}

/** Standalone only: add the Agent this login belongs to without leaving the sheet. */
function NewAgentInline({ onCreated }: { onCreated: (agent: AgentOption) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="su-block" data-testid="extension-new-agent">
      <h4 className="su-block__head">{c.newAgentTitle}</h4>
      {open ? (
        <>
          <p className="su-quiet">{c.newAgentBody}</p>
          <RosterCreateBlock
            compact
            onCreated={(agent) => {
              setOpen(false);
              onCreated({ id: agent.id, name: agent.name, active: agent.active });
            }}
          />
        </>
      ) : (
        <div className="su-actions" style={{ justifyContent: "flex-start" }}>
          <button type="button" className="crm-button crm-button--sm" onClick={() => setOpen(true)}>
            {PEOPLE_COPY.rosterSheet.create}
          </button>
        </div>
      )}
    </div>
  );
}

export function ExtensionBlock({
  extensionUser,
  defaultEmail,
  agent = null,
  agents = null,
  onChanged,
}: {
  extensionUser: AdminExtensionUser | null;
  /** The dashboard login's email, offered as the starting point for a new extension login. */
  defaultEmail: string;
  /** The person's Agent when opened from a card: the login is connected to it. */
  agent?: AgentOption | null;
  /** Standalone: the Agents the Owner may connect (free of another extension login); null hides the Agent field. */
  agents?: AgentOption[] | null;
  onChanged?: (user: AdminExtensionUser | null) => void;
}) {
  const [created, setCreated] = useState<AdminExtensionUser | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [removed, setRemoved] = useState(false);
  const [added, setAdded] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState(extensionUser?.agent_id ?? "");
  const current = removed ? null : (extensionUser ?? created);
  const choice: AgentChoice | null = agent ? { fixed: agent } : agents ? { options: [...agents, ...added.filter((item) => !agents.some((option) => option.id === item.id))] } : null;

  return (
    <div className="su-sheet">
      <section className="su-block">
        <FlashLine flash={flash} />
        {current ? (
          <ExtensionEdit
            key={`${current.id}-${current.email}-${current.roles.join(",")}-${current.agent_id ?? ""}`}
            user={current}
            choice={choice}
            agentId={agentId}
            onAgentChange={setAgentId}
            onFlash={setFlash}
            onChanged={(user) => {
              if (user) setCreated(user);
              onChanged?.(user);
            }}
            onRemoved={() => setRemoved(true)}
          />
        ) : (
          <ExtensionCreate
            defaultEmail={defaultEmail}
            choice={choice}
            agentId={agentId}
            onAgentChange={setAgentId}
            onFlash={setFlash}
            onCreated={(user) => {
              setRemoved(false);
              setCreated(user);
              onChanged?.(user);
            }}
          />
        )}
      </section>
      {choice && "options" in choice && !current?.agent_id ? <NewAgentInline
          onCreated={(made) => {
            setAdded((old) => [...old, made]);
            setAgentId(made.id);
          }}
        /> : null}
    </div>
  );
}

function ExtensionCreate({
  defaultEmail,
  choice,
  agentId,
  onAgentChange,
  onFlash,
  onCreated,
}: {
  defaultEmail: string;
  choice: AgentChoice | null;
  agentId: string;
  onAgentChange: (agentId: string) => void;
  onFlash: (flash: Flash) => void;
  onCreated: (user: AdminExtensionUser) => void;
}) {
  const ids = { email: useId(), password: useId(), roles: useId(), agent: useId() };
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<CurrentExtensionRole[]>(["sales"]);
  const connectTo = choice && "fixed" in choice ? choice.fixed.id : agentId;

  const create = useMutation({
    mutationFn: () => createExtensionUser({ email, password, roles, ...(connectTo ? { agent_id: connectTo } : {}) }),
    onSuccess: async (user) => {
      await invalidatePeople(queryClient);
      onFlash({ tone: "done", text: c.created });
      onCreated(user);
    },
    onError: (error) => onFlash({ tone: "refused", text: errorText(error, "Unable to create this extension login.") }),
  });

  return (
    <form
      className="su-fields"
      onSubmit={(event) => {
        event.preventDefault();
        onFlash(null);
        if (roles.length === 0) {
          onFlash({ tone: "refused", text: c.rolesRequired });
          return;
        }
        create.mutate();
      }}
    >
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.email}>
          {c.email}
        </label>
        <input id={ids.email} className="su-input" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <p className="su-row__hint">{c.emailHint}</p>
      </div>
      <div className="su-row">
        <label className="su-row__label" htmlFor={ids.password}>
          {c.password}
        </label>
        <input id={ids.password} className="su-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className="su-row__hint">{c.passwordHint}</p>
      </div>
      <RoleChecks idPrefix={ids.roles} roles={roles} onChange={setRoles} />
      {choice ? <AgentField id={ids.agent} choice={choice} value={agentId} onChange={onAgentChange} /> : null}
      <div className="su-actions">
        <button type="submit" className="crm-button crm-button--primary" disabled={create.isPending}>
          {create.isPending ? c.creating : c.create}
        </button>
      </div>
    </form>
  );
}

function ExtensionEdit({
  user,
  choice,
  agentId,
  onAgentChange,
  onFlash,
  onChanged,
  onRemoved,
}: {
  user: AdminExtensionUser;
  choice: AgentChoice | null;
  agentId: string;
  onAgentChange: (agentId: string) => void;
  onFlash: (flash: Flash) => void;
  onChanged?: (user: AdminExtensionUser | null) => void;
  onRemoved: () => void;
}) {
  const ids = { email: useId(), password: useId(), roles: useId(), agent: useId() };
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<CurrentExtensionRole[]>([...user.roles]);
  const [removing, setRemoving] = useState(false);
  // From a card, saving also connects a login that only matched by email, so the link no longer rests on the email.
  const targetAgent = choice ? ("fixed" in choice ? choice.fixed.id : agentId) : undefined;

  const update = useMutation({
    mutationFn: (patch: UpdateExtensionUserInput) => updateExtensionUser(user.id, patch),
    onSuccess: async (saved) => {
      await invalidatePeople(queryClient);
      setPassword("");
      onFlash({ tone: "done", text: c.updated });
      onChanged?.(saved);
    },
    onError: (error) => onFlash({ tone: "refused", text: errorText(error, "Unable to update this extension login.") }),
  });
  const remove = useMutation({
    mutationFn: () => deleteExtensionUser(user.id),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      onFlash({ tone: "done", text: c.removed });
      onRemoved();
      onChanged?.(null);
    },
    onError: (error) => onFlash({ tone: "refused", text: errorText(error, "Unable to remove this extension login.") }),
  });
  const patch = extensionPatch(user, { email, password, roles, agentId: targetAgent });

  return (
    <div className="su-fields">
      <form
        className="su-fields"
        onSubmit={(event) => {
          event.preventDefault();
          onFlash(null);
          if (roles.length === 0) {
            onFlash({ tone: "refused", text: c.rolesRequired });
            return;
          }
          if (patch) update.mutate(patch);
        }}
      >
        <div className="su-row">
          <label className="su-row__label" htmlFor={ids.email}>
            {c.email}
          </label>
          <input id={ids.email} className="su-input" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="su-row">
          <label className="su-row__label" htmlFor={ids.password}>
            {c.password}
          </label>
          <input id={ids.password} className="su-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="su-row__hint">{c.passwordKeep}</p>
        </div>
        <RoleChecks idPrefix={ids.roles} roles={roles} onChange={setRoles} />
        {choice ? <AgentField id={ids.agent} choice={choice} value={agentId} onChange={onAgentChange} /> : null}
        <div className="su-actions">
          <button type="submit" className="crm-button crm-button--primary" disabled={!patch || update.isPending}>
            {update.isPending ? PEOPLE_COPY.sheet.saving : c.save}
          </button>
        </div>
      </form>
      <div className="su-block">
        <p className="su-quiet">{c.hardDelete}</p>
        {removing ? (
          <>
            <p className="su-review">{c.removeConfirm(user.email)}</p>
            <div className="su-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="crm-button crm-button--danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
                {c.removeConfirmButton}
              </button>
              <button type="button" className="crm-button crm-button--quiet" onClick={() => setRemoving(false)}>
                {c.keep}
              </button>
            </div>
          </>
        ) : (
          <div className="su-actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="crm-button crm-button--danger" onClick={() => setRemoving(true)}>
              {c.remove}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
