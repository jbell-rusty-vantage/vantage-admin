"use client";

import { useId, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { DelayedSkeleton, SkeletonLines } from "@/components/sales-intelligence/primitives/skeleton";

const a = copy.ui2.acceptInvite;

/**
 * UI2-USERS: the accept-invite page's states (UI-2 §8). `reading` is the first render, before the token has
 * been read from `location.hash`; `malformed` and `invalid` have no form; `form` shows the two password
 * fields with the policy; `success` links to sign in (the response carries no email, so it can't sign in
 * by itself).
 */
export type AcceptPhase = "reading" | "malformed" | "form" | "invalid" | "success";
export type AcceptFormError = "weak" | "mismatch" | "generic" | null;

export type AcceptViewState = {
  phase: AcceptPhase;
  password: string;
  confirm: string;
  error: AcceptFormError;
  submitting: boolean;
};

export const initialAcceptState: AcceptViewState = { phase: "reading", password: "", confirm: "", error: null, submitting: false };

function SignIn() {
  return (
    <Link href="/login" className="si-btn si-btn--primary si-btn--md si-hit si-accept__signin">
      {a.signIn}
    </Link>
  );
}

export function AcceptInviteView({
  state,
  onChange,
  onSubmit,
}: {
  state: AcceptViewState;
  onChange?: (field: "password" | "confirm", value: string) => void;
  onSubmit?: () => void;
}) {
  const ids = { password: useId(), confirm: useId(), policy: useId(), error: useId() };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!state.submitting) onSubmit?.();
  };
  const filled = state.password.length > 0 && state.confirm.length > 0;
  const errorText = state.error ? a.states[state.error] : null;

  let body;
  if (state.phase === "reading") {
    body = (
      <DelayedSkeleton>
        <SkeletonLines lines={3} widths={["70%", "100%", "100%"]} />
      </DelayedSkeleton>
    );
  } else if (state.phase === "malformed" || state.phase === "invalid") {
    body = <p className="si-accept__state" role="alert" data-state={state.phase}>{a.states[state.phase]}</p>;
  } else if (state.phase === "success") {
    body = (
      <div className="si-accept__done" role="status" data-state="success">
        <p>{a.success}</p>
        <SignIn />
      </div>
    );
  } else {
    body = (
      <form className="si-accept__form" onSubmit={submit} noValidate data-state="form">
        {errorText && <p id={ids.error} className="si-users__refusal" role="alert">{errorText}</p>}
        <div className="si-field">
          <label className="si-field__label" htmlFor={ids.password}>{a.password}</label>
          <input
            id={ids.password}
            className="si-input si-users__input"
            type="password"
            autoComplete="new-password"
            value={state.password}
            disabled={state.submitting}
            aria-invalid={state.error === "weak" ? true : undefined}
            aria-describedby={`${ids.policy}${state.error === "weak" ? ` ${ids.error}` : ""}`}
            onChange={(event) => onChange?.("password", event.target.value)}
          />
          <p id={ids.policy} className="si-field__hint">{a.policy}</p>
        </div>
        <div className="si-field">
          <label className="si-field__label" htmlFor={ids.confirm}>{a.confirm}</label>
          <input
            id={ids.confirm}
            className="si-input si-users__input"
            type="password"
            autoComplete="new-password"
            value={state.confirm}
            disabled={state.submitting}
            aria-invalid={state.error === "mismatch" ? true : undefined}
            aria-describedby={state.error === "mismatch" ? ids.error : undefined}
            onChange={(event) => onChange?.("confirm", event.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" className="si-hit si-accept__submit" disabled={!filled || state.submitting}>
          {state.submitting ? a.submitting : a.submit}
        </Button>
      </form>
    );
  }

  return (
    <section className="si-accept__card" aria-labelledby="si-accept-title" aria-busy={state.phase === "reading" || state.submitting ? true : undefined}>
      <h1 id="si-accept-title" className="si-heading si-heading--1">{a.title}</h1>
      {(state.phase === "form" || state.phase === "reading") && <p className="si-accept__intro">{a.intro}</p>}
      {body}
    </section>
  );
}
