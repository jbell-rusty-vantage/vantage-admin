"use client";
/**
 * The Extension login part of a person (the Owner-only Extension users page, moved): create with email, password and roles
 * (Owner, Sales, Customer Service); edit roles with the password left blank to keep it; Remove, which is a hard delete and
 * says so before the confirm.
 */
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.extensionSheet;

function roleOptionLabel(role: CurrentExtensionRole): string {
  return role === "owner" ? EXTENSION_COPY.ownerOption : role === "sales" ? EXTENSION_COPY.salesOption : EXTENSION_COPY.customerServiceOption;
}

const toggleRole = (roles: CurrentExtensionRole[], role: CurrentExtensionRole) => (roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role]);
const normalizedEmail = (value: string) => value.trim().toLowerCase();

/** The PATCH body for an edit: only what changed (a blank password keeps the current one); null when nothing changed. Pure so a test covers it. */
export function extensionPatch(user: Pick<AdminExtensionUser, "email" | "roles">, draft: { email: string; password: string; roles: CurrentExtensionRole[] }): UpdateExtensionUserInput | null {
  const patch: UpdateExtensionUserInput = {};
  if (normalizedEmail(draft.email) !== normalizedEmail(user.email)) patch.email = draft.email.trim();
  if (draft.password !== "") patch.password = draft.password;
  if (!rolesSetsEqual(draft.roles, user.roles)) patch.roles = draft.roles;
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

export function ExtensionBlock({
  extensionUser,
  defaultEmail,
  onChanged,
}: {
  extensionUser: AdminExtensionUser | null;
  /** The dashboard login's email, offered as the starting point for a new extension login. */
  defaultEmail: string;
  onChanged?: () => void;
}) {
  const [created, setCreated] = useState<AdminExtensionUser | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [removed, setRemoved] = useState(false);
  const current = removed ? null : (extensionUser ?? created);

  return (
    <div className="su-sheet">
      <section className="su-block">
        <FlashLine flash={flash} />
        {current ? (
          <ExtensionEdit key={`${current.id}-${current.email}-${current.roles.join(",")}`} user={current} onFlash={setFlash} onChanged={onChanged} onRemoved={() => setRemoved(true)} />
        ) : (
          <ExtensionCreate
            defaultEmail={defaultEmail}
            onFlash={setFlash}
            onCreated={(user) => {
              setRemoved(false);
              setCreated(user);
              onChanged?.();
            }}
          />
        )}
      </section>
    </div>
  );
}

function ExtensionCreate({ defaultEmail, onFlash, onCreated }: { defaultEmail: string; onFlash: (flash: Flash) => void; onCreated: (user: AdminExtensionUser) => void }) {
  const ids = { email: useId(), password: useId(), roles: useId() };
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<CurrentExtensionRole[]>(["sales"]);

  const create = useMutation({
    mutationFn: () => createExtensionUser({ email, password, roles }),
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
      <div className="su-actions">
        <button type="submit" className="crm-button crm-button--primary" disabled={create.isPending}>
          {create.isPending ? c.creating : c.create}
        </button>
      </div>
    </form>
  );
}

function ExtensionEdit({ user, onFlash, onChanged, onRemoved }: { user: AdminExtensionUser; onFlash: (flash: Flash) => void; onChanged?: () => void; onRemoved: () => void }) {
  const ids = { email: useId(), password: useId(), roles: useId() };
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<CurrentExtensionRole[]>([...user.roles]);
  const [removing, setRemoving] = useState(false);

  const update = useMutation({
    mutationFn: (patch: UpdateExtensionUserInput) => updateExtensionUser(user.id, patch),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      setPassword("");
      onFlash({ tone: "done", text: c.updated });
      onChanged?.();
    },
    onError: (error) => onFlash({ tone: "refused", text: errorText(error, "Unable to update this extension login.") }),
  });
  const remove = useMutation({
    mutationFn: () => deleteExtensionUser(user.id),
    onSuccess: async () => {
      await invalidatePeople(queryClient);
      onFlash({ tone: "done", text: c.removed });
      onRemoved();
      onChanged?.();
    },
    onError: (error) => onFlash({ tone: "refused", text: errorText(error, "Unable to remove this extension login.") }),
  });

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
          const patch = extensionPatch(user, { email, password, roles });
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
        <div className="su-actions">
          <button type="submit" className="crm-button crm-button--primary" disabled={update.isPending}>
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
