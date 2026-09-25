"use client";

import { useId, useState } from "react";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { cx } from "@/components/sales-intelligence/lib/format";
import { UsersApiError, type AdminUser } from "./users-api";
import {
  codeField,
  draftFromUser,
  emptyDraft,
  errorSentence,
  issueFieldErrors,
  pickerAgents,
  roleWord,
  USER_ROLES,
  validateDraft,
  type AgentOption,
  type FieldErrors,
  type UserDraft,
  type UserRole,
} from "./users-logic";
import { UsersDialog } from "./users-dialog";

const u = copy.ui2.users;
const f = u.form;

/** A refusal → the sentence and the fields it marks (from `issues[]` and from the code). */
export function refusalState(error: unknown): { sentence: string; fields: FieldErrors } {
  if (error instanceof UsersApiError) {
    const fields = issueFieldErrors(error.issues);
    const field = codeField(error.code);
    const sentence = errorSentence(error.code);
    if (field && !fields[field]) fields[field] = sentence;
    return { sentence, fields };
  }
  return { sentence: errorSentence("generic"), fields: {} };
}

export type UserFormSubmit = (draft: UserDraft) => Promise<void>;

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return <p id={id} className="si-field__error">{text}</p>;
}

/**
 * Add user / Edit (UI-2 §8). Agent is shown and required only for a rep; the picker lists active Agents not
 * held by another active rep (the edited rep's own Agent stays). Add chooses `Set a password now` (with the
 * policy) or `Send an invite link`. Client checks mirror the server; refusals print `users.errors[code]`.
 */
export function UserFormDialog({
  mode,
  user,
  users,
  agents,
  agentsFailed = false,
  onRetryAgents,
  onSubmit,
  onClose,
  inline,
  initialDraft,
  initialError,
}: {
  mode: "add" | "edit";
  user?: AdminUser;
  users: AdminUser[];
  /** `null` while the Agent list is loading or failed. */
  agents: AgentOption[] | null;
  agentsFailed?: boolean;
  onRetryAgents?: () => void;
  onSubmit: UserFormSubmit;
  onClose: () => void;
  inline?: boolean;
  /** Gallery and tests: start from this draft / refusal. */
  initialDraft?: UserDraft;
  initialError?: unknown;
}) {
  const ids = { email: useId(), role: useId(), agent: useId(), password: useId(), roleHint: useId(), agentHint: useId(), policy: useId() };
  const [draft, setDraft] = useState<UserDraft>(() => initialDraft ?? (mode === "edit" && user ? draftFromUser(user) : emptyDraft()));
  const initial = initialError ? refusalState(initialError) : null;
  const [fields, setFields] = useState<FieldErrors>(initial?.fields ?? {});
  const [sentence, setSentence] = useState<string | null>(initial?.sentence ?? null);
  const [busy, setBusy] = useState(false);

  const options = agents ? pickerAgents(agents, users, mode === "edit" ? (user?.id ?? null) : null) : [];
  const set = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setFields((old) => ({ ...old, [key === "agentId" ? "agent" : key]: undefined }));
    setSentence(null);
  };

  async function submit() {
    const errors = validateDraft(draft, mode);
    if (Object.keys(errors).length) {
      setFields(errors);
      setSentence(null);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(draft);
    } catch (error) {
      const state = refusalState(error);
      setFields(state.fields);
      setSentence(state.sentence);
      setBusy(false);
    }
  }

  const title = mode === "add" ? f.addTitle : f.editTitle(user?.email ?? "");
  const describedBy = (...list: (string | false | undefined)[]) => list.filter(Boolean).join(" ") || undefined;

  return (
    <UsersDialog
      title={title}
      busy={busy}
      inline={inline}
      onClose={onClose}
      onSubmit={() => void submit()}
      size="md"
      footer={
        <>
          <Button type="submit" variant="primary" className="si-hit" disabled={busy}>
            {mode === "add" ? f.create : f.save}
          </Button>
          <Button type="button" className="si-hit" disabled={busy} onClick={onClose}>{f.cancel}</Button>
        </>
      }
    >
      {sentence && <p className="si-users__refusal" role="alert">{sentence}</p>}
      <fieldset className="si-users__fieldset" disabled={busy}>
        <div className="si-field">
          <label className="si-field__label" htmlFor={ids.email}>{f.email}</label>
          <input
            id={ids.email}
            className="si-input si-users__input"
            type="email"
            autoComplete="off"
            inputMode="email"
            value={draft.email}
            aria-invalid={fields.email ? true : undefined}
            aria-describedby={describedBy(fields.email && `${ids.email}-err`)}
            onChange={(event) => set("email", event.target.value)}
          />
          <FieldError id={`${ids.email}-err`} text={fields.email} />
        </div>

        <div className="si-field">
          <label className="si-field__label" htmlFor={ids.role}>{f.role}</label>
          <select
            id={ids.role}
            className="si-input si-select si-users__input"
            value={draft.role}
            aria-describedby={ids.roleHint}
            aria-invalid={fields.role ? true : undefined}
            onChange={(event) => set("role", event.target.value as UserRole)}
          >
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>{roleWord(role)}</option>
            ))}
          </select>
          <p id={ids.roleHint} className="si-field__hint">{u.roleHint[draft.role]}</p>
          <FieldError id={`${ids.role}-err`} text={fields.role} />
        </div>

        {draft.role === "rep" && (
          <div className="si-field">
            <label className="si-field__label" htmlFor={ids.agent}>{f.agent}</label>
            <select
              id={ids.agent}
              className="si-input si-select si-users__input"
              value={draft.agentId}
              disabled={!agents}
              aria-invalid={fields.agent ? true : undefined}
              aria-describedby={describedBy(ids.agentHint, fields.agent && `${ids.agent}-err`)}
              onChange={(event) => set("agentId", event.target.value)}
            >
              <option value="">{f.agentPlaceholder}</option>
              {options.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.active ? agent.name : u.agentInactive(agent.name)}</option>
              ))}
            </select>
            <p id={ids.agentHint} className="si-field__hint">{agents && options.length === 0 ? f.noAgentsFree : f.agentHint}</p>
            {agentsFailed && (
              <p className="si-field__error" role="alert">
                {u.agentsLoadError}{" "}
                {onRetryAgents && (
                  <button type="button" className="si-link si-hit" onClick={onRetryAgents}>{u.tryAgain}</button>
                )}
              </p>
            )}
            <FieldError id={`${ids.agent}-err`} text={fields.agent} />
          </div>
        )}

        {mode === "edit" && (
          <label className="si-check si-hit">
            <input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />
            {f.activeLabel}
          </label>
        )}

        {mode === "add" && (
          <fieldset className="si-users__access">
            <legend className="si-field__label">{f.access}</legend>
            <label className="si-check si-hit">
              <input type="radio" name="access" value="invite" checked={draft.access === "invite"} onChange={() => set("access", "invite")} />
              {f.accessInvite}
            </label>
            <label className="si-check si-hit">
              <input type="radio" name="access" value="password" checked={draft.access === "password"} onChange={() => set("access", "password")} />
              {f.accessPassword}
            </label>
            {draft.access === "password" && (
              <div className={cx("si-field", "si-users__pwfield")}>
                <label className="si-field__label" htmlFor={ids.password}>{f.password}</label>
                <input
                  id={ids.password}
                  className="si-input si-users__input"
                  type="password"
                  autoComplete="new-password"
                  value={draft.password}
                  aria-invalid={fields.password ? true : undefined}
                  aria-describedby={describedBy(ids.policy, fields.password && `${ids.password}-err`)}
                  onChange={(event) => set("password", event.target.value)}
                />
                <p id={ids.policy} className="si-field__hint">{f.passwordPolicy}</p>
                <FieldError id={`${ids.password}-err`} text={fields.password} />
              </div>
            )}
          </fieldset>
        )}
      </fieldset>
    </UsersDialog>
  );
}
