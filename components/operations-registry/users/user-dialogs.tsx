"use client";

import { useId, useState } from "react";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import type { AdminUser } from "./users-api";
import { refusalState } from "./user-form-dialog";
import { passwordOk } from "./users-logic";
import { UsersDialog } from "./users-dialog";

const u = copy.ui2.users;

/** Set password: the dialog says it signs the user out everywhere; the policy is checked before the request. */
export function SetPasswordDialog({
  user,
  onSubmit,
  onClose,
  inline,
  initialError,
}: {
  user: AdminUser;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
  inline?: boolean;
  initialError?: unknown;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sentence, setSentence] = useState<string | null>(initialError ? refusalState(initialError).sentence : null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!passwordOk(password)) {
      setFieldError(u.fieldErrors.password ?? null);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (error) {
      const state = refusalState(error);
      setSentence(state.sentence);
      setFieldError(state.fields.password ?? null);
      setBusy(false);
    }
  }

  return (
    <UsersDialog
      title={u.setPassword.title(user.email)}
      description={u.setPassword.body}
      busy={busy}
      inline={inline}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button type="submit" variant="primary" className="si-hit" disabled={busy}>{u.setPassword.confirm}</Button>
          <Button type="button" className="si-hit" disabled={busy} onClick={onClose}>{u.form.cancel}</Button>
        </>
      }
    >
      {sentence && <p className="si-users__refusal" role="alert">{sentence}</p>}
      <div className="si-field">
        <label className="si-field__label" htmlFor={id}>{u.form.password}</label>
        <input
          id={id}
          className="si-input si-users__input"
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={busy}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={`${id}-policy${fieldError ? ` ${id}-err` : ""}`}
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldError(null);
            setSentence(null);
          }}
        />
        <p id={`${id}-policy`} className="si-field__hint">{u.form.passwordPolicy}</p>
        {fieldError && <p id={`${id}-err`} className="si-field__error">{fieldError}</p>}
      </div>
    </UsersDialog>
  );
}

/** Deactivate: a confirm dialog. `last_owner` (and every other refusal) prints its sentence. */
export function DeactivateDialog({
  user,
  onConfirm,
  onClose,
  inline,
  initialError,
}: {
  user: AdminUser;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  inline?: boolean;
  initialError?: unknown;
}) {
  const [sentence, setSentence] = useState<string | null>(initialError ? refusalState(initialError).sentence : null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch (error) {
      setSentence(refusalState(error).sentence);
      setBusy(false);
    }
  }
  return (
    <UsersDialog
      title={u.deactivate.title(user.email)}
      description={u.deactivate.body}
      busy={busy}
      inline={inline}
      onClose={onClose}
      onSubmit={() => void confirm()}
      footer={
        <>
          <Button type="submit" variant="danger" className="si-hit" disabled={busy}>{u.deactivate.confirm}</Button>
          <Button type="button" className="si-hit" disabled={busy} onClick={onClose}>{u.form.cancel}</Button>
        </>
      }
    >
      {sentence ? <p className="si-users__refusal" role="alert">{sentence}</p> : null}
    </UsersDialog>
  );
}
