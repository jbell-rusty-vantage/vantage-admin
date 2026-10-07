"use client";
/**
 * The Dashboard login part of a person: add, edit role and Agent, set a password, send an invite (with the invite
 * result), deactivate. Today's Users rules are kept as they were in `users-logic.ts`: a Rep login requires an Agent, one
 * Agent holds one active Rep login, passwords are 10 characters to 72 bytes, and every refusal prints its sentence.
 * From a person's card the Agent is fixed; from Not matched to a person the Agent is picked from the free ones.
 */
import { useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createAdminUser,
  deactivateAdminUser,
  sendAdminUserInvite,
  setAdminUserPassword,
  updateAdminUser,
  type AdminUser,
  type InviteResult,
} from "@/components/operations-registry/users/users-api";
import {
  draftFromUser,
  emptyDraft,
  passwordOk,
  pickerAgents,
  roleWord,
  rowActions,
  unseenPassword,
  updateBody,
  USER_ROLES,
  validateDraft,
  type AgentOption,
  type FieldErrors,
  type UserDraft,
  type UserRole,
} from "@/components/operations-registry/users/users-logic";
import { InviteResultView } from "./invite-result";
import { loginSentence, refusalState, loginErrorCode } from "./login-errors";
import { PEOPLE_COPY } from "./people-copy";
import { invalidatePeople } from "./use-people";

const c = PEOPLE_COPY.loginSheet;

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

function FieldRow({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="su-row">
      <label className="su-row__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="su-row__hint su-missing" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className="su-row__hint">{hint}</p>
      ) : null}
    </div>
  );
}

export type LoginBlockProps = {
  /** The person's Agent when opened from a card; `null` lets the Owner pick one (Not matched to a person). */
  agent: AgentOption | null;
  user: AdminUser | null;
  users: AdminUser[];
  agents: AgentOption[] | null;
  agentsFailed?: boolean;
  /** Tests: start from this draft / refusal. */
  initialDraft?: UserDraft;
  initialError?: unknown;
  /** Called after a write lands (the parent may close or advance). */
  onChanged?: (user: AdminUser) => void;
};

/** The whole Dashboard login sheet body: the form, then Password and invite and Deactivate for an active login. */
export function LoginBlock(props: LoginBlockProps) {
  const [created, setCreated] = useState<AdminUser | null>(null);
  const [invite, setInvite] = useState<{ email: string; result: InviteResult } | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const current = props.user ?? created;

  return (
    <div className="su-sheet">
      <section className="su-block">
        <FlashLine flash={flash} />
        {invite ? <InviteResultView email={invite.email} result={invite.result} /> : null}
        <LoginForm
          key={current ? `${current.id}-${current.updated_at}` : "add"}
          {...props}
          user={current}
          onFlash={setFlash}
          onInvite={(email, result) => setInvite({ email, result })}
          onCreated={(user) => {
            setCreated(user);
            props.onChanged?.(user);
          }}
        />
      </section>
      {current && current.active && rowActions(current).includes("setPassword") ? (
        <section className="su-block">
          <h4 className="su-block__head">{c.passwordBlock}</h4>
          <PasswordAndInvite user={current} onFlash={setFlash} onInvite={(email, result) => setInvite({ email, result })} onChanged={props.onChanged} />
        </section>
      ) : null}
      {current && current.active ? (
        <section className="su-block">
          <h4 className="su-block__head">{c.deactivateBlock}</h4>
          <DeactivateLogin user={current} onFlash={setFlash} onChanged={props.onChanged} />
        </section>
      ) : null}
    </div>
  );
}

function LoginForm({
  agent,
  user,
  users,
  agents,
  agentsFailed = false,
  initialDraft,
  initialError,
  onFlash,
  onInvite,
  onCreated,
  onChanged,
}: LoginBlockProps & {
  onFlash: (flash: Flash) => void;
  onInvite: (email: string, result: InviteResult) => void;
  onCreated: (user: AdminUser) => void;
}) {
  const ids = { email: useId(), role: useId(), agent: useId(), password: useId() };
  const queryClient = useQueryClient();
  const mode = user ? "edit" : "add";
  const [draft, setDraft] = useState<UserDraft>(() => initialDraft ?? (user ? draftFromUser(user) : { ...emptyDraft(), agentId: agent?.id ?? "" }));
  const initial = initialError ? refusalState(initialError) : null;
  const [fields, setFields] = useState<FieldErrors>(initial?.fields ?? {});
  const [sentence, setSentence] = useState<string | null>(initial?.sentence ?? null);
  const [busy, setBusy] = useState(false);
  // An Agent handed in after mount (Add a dashboard login → Add the Agent inline) is taken without losing what was typed.
  const [seenAgentId, setSeenAgentId] = useState(agent?.id ?? null);
  if ((agent?.id ?? null) !== seenAgentId) {
    setSeenAgentId(agent?.id ?? null);
    if (agent && !user) setDraft((old) => ({ ...old, role: "rep", agentId: agent.id }));
  }

  const set = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setFields((old) => ({ ...old, [key === "agentId" ? "agent" : key]: undefined }));
    setSentence(null);
  };
  const options = agents ? pickerAgents(agents, users, user?.id ?? null) : [];

  async function submit() {
    const errors = validateDraft(draft, mode);
    if (Object.keys(errors).length) {
      setFields(errors);
      setSentence(null);
      return;
    }
    setBusy(true);
    onFlash(null);
    try {
      if (!user) {
        const withInvite = draft.access === "invite";
        const made = await createAdminUser({
          email: draft.email.trim(),
          role: draft.role,
          password: withInvite ? unseenPassword() : draft.password,
          ...(draft.role === "rep" ? { agent_id: draft.agentId } : {}),
        });
        await invalidatePeople(queryClient);
        onCreated(made);
        onFlash({ tone: "done", text: c.created(made.email) });
        if (withInvite) {
          try {
            onInvite(made.email, await sendAdminUserInvite(made.id));
          } catch (failure) {
            onFlash({ tone: "refused", text: c.inviteAfterCreate(loginSentence(loginErrorCode(failure))) });
          }
        }
        return;
      }
      const body = updateBody(user, draft);
      const saved = Object.keys(body).length ? await updateAdminUser(user.id, body) : user;
      await invalidatePeople(queryClient);
      onChanged?.(saved);
      onFlash({ tone: "done", text: c.saved(saved.email) });
      setBusy(false);
    } catch (failure) {
      const state = refusalState(failure);
      setFields(state.fields);
      setSentence(state.sentence);
      setBusy(false);
    }
  }

  const fixedAgent = agent && draft.role === "rep";
  return (
    <form
      className="su-fields"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {sentence ? (
        <p className="su-errors" role="alert">
          {sentence}
        </p>
      ) : null}
      <fieldset className="su-fields" disabled={busy}>
        <FieldRow id={ids.email} label={c.email} error={fields.email}>
          <input
            id={ids.email}
            className="su-input"
            type="email"
            autoComplete="off"
            inputMode="email"
            value={draft.email}
            aria-invalid={fields.email ? true : undefined}
            onChange={(event) => set("email", event.target.value)}
          />
        </FieldRow>
        <FieldRow id={ids.role} label={c.role} hint={c.roleHint[draft.role]} error={fields.role}>
          <select id={ids.role} className="su-input" value={draft.role} onChange={(event) => set("role", event.target.value as UserRole)}>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleWord(role)}
              </option>
            ))}
          </select>
        </FieldRow>
        {draft.role === "rep" ? (
          fixedAgent ? (
            <FieldRow id={ids.agent} label={c.agent} hint={c.agentFixed}>
              <input id={ids.agent} className="su-input" value={agent.name} readOnly />
            </FieldRow>
          ) : (
            <FieldRow id={ids.agent} label={c.agent} hint={agents && options.length === 0 ? c.noAgentsFree : c.agentHint} error={fields.agent}>
              <select
                id={ids.agent}
                className="su-input"
                value={draft.agentId}
                disabled={!agents}
                aria-invalid={fields.agent ? true : undefined}
                onChange={(event) => set("agentId", event.target.value)}
              >
                <option value="">{c.agentPlaceholder}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.active ? option.name : `${option.name} (inactive)`}
                  </option>
                ))}
              </select>
              {agentsFailed ? <p className="su-row__hint su-missing">{c.agentsLoadFailed}</p> : null}
            </FieldRow>
          )
        ) : agent ? (
          <p className="su-quiet">{c.notRepNote}</p>
        ) : null}

        {mode === "edit" ? (
          <label className="su-choice">
            <input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />
            <span className="su-choice__text">{c.active}</span>
          </label>
        ) : (
          <fieldset className="su-fields">
            <legend className="su-row__label">{c.access}</legend>
            <label className="su-choice">
              <input type="radio" name={`${ids.password}-access`} checked={draft.access === "invite"} onChange={() => set("access", "invite")} />
              <span className="su-choice__text">{c.accessInvite}</span>
            </label>
            <label className="su-choice">
              <input type="radio" name={`${ids.password}-access`} checked={draft.access === "password"} onChange={() => set("access", "password")} />
              <span className="su-choice__text">{c.accessPassword}</span>
            </label>
            {draft.access === "password" ? (
              <FieldRow id={ids.password} label={c.password} hint={c.passwordPolicy} error={fields.password}>
                <input
                  id={ids.password}
                  className="su-input"
                  type="password"
                  autoComplete="new-password"
                  value={draft.password}
                  aria-invalid={fields.password ? true : undefined}
                  onChange={(event) => set("password", event.target.value)}
                />
              </FieldRow>
            ) : null}
          </fieldset>
        )}
      </fieldset>
      <div className="su-actions">
        <button type="submit" className="crm-button crm-button--primary" disabled={busy}>
          {busy ? PEOPLE_COPY.sheet.saving : mode === "add" ? c.create : c.save}
        </button>
      </div>
    </form>
  );
}

/** Set password (signs them out everywhere) and Send invite, for an active login. */
export function PasswordAndInvite({
  user,
  onFlash,
  onInvite,
  onChanged,
  initialError,
}: {
  user: AdminUser;
  onFlash: (flash: Flash) => void;
  onInvite: (email: string, result: InviteResult) => void;
  onChanged?: (user: AdminUser) => void;
  initialError?: unknown;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentence, setSentence] = useState<string | null>(initialError ? refusalState(initialError).sentence : null);
  const [busy, setBusy] = useState(false);

  async function setNew() {
    if (!passwordOk(password)) {
      setFieldError(PEOPLE_COPY.loginSheet.passwordPolicy);
      return;
    }
    setBusy(true);
    try {
      const saved = await setAdminUserPassword(user.id, password);
      await invalidatePeople(queryClient);
      setPassword("");
      setSentence(null);
      onFlash({ tone: "done", text: c.passwordDone(saved.email) });
      onChanged?.(saved);
    } catch (failure) {
      const state = refusalState(failure);
      setSentence(state.sentence);
      setFieldError(state.fields.password ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    setBusy(true);
    try {
      onInvite(user.email, await sendAdminUserInvite(user.id));
      await invalidatePeople(queryClient);
      setSentence(null);
    } catch (failure) {
      setSentence(loginSentence(loginErrorCode(failure)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="su-fields">
      <p className="su-quiet">{c.setPasswordBody}</p>
      {sentence ? (
        <p className="su-errors" role="alert">
          {sentence}
        </p>
      ) : null}
      <FieldRow id={id} label={c.password} hint={c.passwordPolicy} error={fieldError ?? undefined}>
        <input
          id={id}
          className="su-input"
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={busy}
          aria-invalid={fieldError ? true : undefined}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldError(null);
            setSentence(null);
          }}
        />
      </FieldRow>
      <div className="su-actions">
        <button type="button" className="crm-button" disabled={busy} onClick={() => void sendInvite()}>
          {c.sendInvite}
        </button>
        <button type="button" className="crm-button crm-button--primary" disabled={busy} onClick={() => void setNew()}>
          {c.setPassword}
        </button>
      </div>
    </div>
  );
}

/** Deactivate: a confirm step; `last_owner` (and every other refusal) prints its sentence. */
export function DeactivateLogin({
  user,
  onFlash,
  onChanged,
  initialError,
}: {
  user: AdminUser;
  onFlash: (flash: Flash) => void;
  onChanged?: (user: AdminUser) => void;
  initialError?: unknown;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(Boolean(initialError));
  const [sentence, setSentence] = useState<string | null>(initialError ? refusalState(initialError).sentence : null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const saved = await deactivateAdminUser(user.id);
      await invalidatePeople(queryClient);
      onFlash({ tone: "done", text: c.deactivateDone(saved.email) });
      onChanged?.(saved);
    } catch (failure) {
      setSentence(refusalState(failure).sentence);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="su-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="crm-button crm-button--danger" onClick={() => setConfirming(true)}>
          {c.deactivateConfirm}
        </button>
      </div>
    );
  }
  return (
    <div className="su-fields">
      <p className="su-review">{c.deactivateTitle(user.email)}</p>
      <p className="su-quiet">{c.deactivateBody}</p>
      {sentence ? (
        <p className="su-errors" role="alert">
          {sentence}
        </p>
      ) : null}
      <div className="su-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="crm-button crm-button--danger" disabled={busy} onClick={() => void confirm()}>
          {c.deactivateConfirm}
        </button>
        <button type="button" className="crm-button crm-button--quiet" disabled={busy} onClick={() => setConfirming(false)}>
          {PEOPLE_COPY.sheet.cancel}
        </button>
      </div>
    </div>
  );
}
