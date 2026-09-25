"use client";

import { useEffect, useRef, useState } from "react";
import { acceptAdminInvite, UsersApiError } from "@/components/operations-registry/users/users-api";
import { acceptOutcome, acceptProblem, readInviteToken } from "@/components/operations-registry/users/users-logic";
import { AcceptInviteView, initialAcceptState, type AcceptViewState } from "./accept-invite-view";

/**
 * UI2-USERS: reads the token from `location.hash` only (`#token=…`, never the query string), then clears the
 * fragment from the address bar. A missing or malformed token shows `states.malformed` with no request.
 * The token lives only in a ref; it is never logged, rendered or stored.
 */
export function AcceptInviteClient() {
  const token = useRef<string | null>(null);
  const [state, setState] = useState<AcceptViewState>(initialAcceptState);

  useEffect(() => {
    const read = readInviteToken(window.location.hash);
    token.current = read;
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    // One-time read of the fragment after mount (it isn't available during the server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((old) => ({ ...old, phase: read ? "form" : "malformed" }));
  }, []);

  async function submit() {
    const problem = acceptProblem(state.password, state.confirm);
    if (problem) {
      setState((old) => ({ ...old, error: problem }));
      return;
    }
    if (!token.current) {
      setState((old) => ({ ...old, phase: "malformed" }));
      return;
    }
    setState((old) => ({ ...old, submitting: true, error: null }));
    try {
      await acceptAdminInvite(token.current, state.password);
      token.current = null;
      setState({ ...initialAcceptState, phase: "success" });
    } catch (error) {
      const outcome = acceptOutcome(error instanceof UsersApiError ? error.code : "network_error");
      if (outcome === "invalid") {
        token.current = null;
        setState({ ...initialAcceptState, phase: "invalid" });
      } else {
        setState((old) => ({ ...old, submitting: false, error: outcome }));
      }
    }
  }

  return (
    <AcceptInviteView
      state={state}
      onChange={(field, value) => setState((old) => ({ ...old, [field]: value, error: null }))}
      onSubmit={() => void submit()}
    />
  );
}
