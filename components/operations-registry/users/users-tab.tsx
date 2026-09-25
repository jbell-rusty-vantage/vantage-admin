"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { DelayedSkeleton } from "@/components/sales-intelligence/primitives/skeleton";
import { RegionProgress } from "@/components/sales-intelligence/primitives/region";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { fetchRegistryCatalog } from "@/lib/api/registryAgents";
import { queryKeys } from "@/lib/query/keys";
import { InviteResultDialog } from "./invite-result";
import { DeactivateDialog, SetPasswordDialog } from "./user-dialogs";
import { UserFormDialog } from "./user-form-dialog";
import {
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUsers,
  sendAdminUserInvite,
  setAdminUserPassword,
  updateAdminUser,
  usersQueryKey,
  UsersApiError,
  type AdminUser,
  type InviteResult,
} from "./users-api";
import { errorSentence, unseenPassword, updateBody, type AgentOption, type UserDraft } from "./users-logic";
import { UsersTableSkeleton, UsersTableView, type UserAction } from "./users-table";

const u = copy.ui2.users;

type Open =
  | { kind: "add" }
  | { kind: "edit"; user: AdminUser }
  | { kind: "setPassword"; user: AdminUser }
  | { kind: "deactivate"; user: AdminUser }
  | { kind: "invite"; email: string; result: InviteResult };

type Notice = { tone: "done" | "refused"; text: string } | null;

/** `Couldn't load users.` + the code + `Try again` (UI-0 §2.4). */
export function UsersLoadError({ code, onRetry }: { code: string; onRetry: () => void }) {
  return (
    <div className="si-regionerror" role="alert">
      <p className="si-regionerror__text">{u.loadError}</p>
      <p className="si-regionerror__code si-text--sm si-text--subtle">
        <span className="si-sr">{u.errorCode}: </span>
        <code className="si-mono">{code}</code>
      </p>
      <Button variant="secondary" size="sm" className="si-hit" onClick={onRetry}>{u.tryAgain}</Button>
    </div>
  );
}

/** The heading, intro and `Add user` above the table. */
export function UsersHeader({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="si-users__head">
      <div>
        <h2 className="si-heading si-heading--2">{u.title}</h2>
        <p className="si-users__intro">{u.intro}</p>
      </div>
      <Button type="button" variant="primary" className="si-hit" onClick={onAdd} disabled={disabled}>
        <UserPlus size={16} aria-hidden />
        {u.actions.add}
      </Button>
    </div>
  );
}

const codeOf = (error: unknown) => (error instanceof UsersApiError ? error.code : "network_error");

/**
 * UI2-USERS: the Owner's Users tab (`/operations-registry?tab=users`). Reads `GET /api/admin-users` and the
 * Agent catalog (inactive included, so a deactivated Agent still has a name); every write re-reads the list.
 */
export function UsersPanel() {
  const client = useQueryClient();
  const users = useQuery({ queryKey: usersQueryKey, queryFn: fetchAdminUsers, retry: false });
  const agentsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.agents(true),
    queryFn: () => fetchRegistryCatalog("agents", { includeInactive: true }),
  });
  const agents: AgentOption[] | null = agentsQuery.data
    ? agentsQuery.data.map((agent) => ({ id: agent.id ?? agent._id ?? "", name: agent.name, active: agent.active }))
    : null;
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [inviting, setInviting] = useState<string | null>(null);

  const refresh = () => client.invalidateQueries({ queryKey: usersQueryKey });
  const close = () => setOpen(null);

  async function invite(user: { id: string; email: string }, afterCreate = false) {
    setInviting(user.id);
    try {
      const result = await sendAdminUserInvite(user.id);
      setOpen({ kind: "invite", email: user.email, result });
    } catch (error) {
      const sentence = errorSentence(codeOf(error));
      setNotice({ tone: "refused", text: afterCreate ? u.inviteAfterCreate(sentence) : sentence });
    } finally {
      setInviting(null);
      void refresh();
    }
  }

  async function submitForm(draft: UserDraft, user?: AdminUser) {
    if (!user) {
      const withInvite = draft.access === "invite";
      const created = await createAdminUser({
        email: draft.email.trim(),
        role: draft.role,
        password: withInvite ? unseenPassword() : draft.password,
        ...(draft.role === "rep" ? { agent_id: draft.agentId } : {}),
      });
      setOpen(null);
      setNotice({ tone: "done", text: u.created(created.email) });
      await refresh();
      if (withInvite) await invite(created, true);
      return;
    }
    const body = updateBody(user, draft);
    const saved = Object.keys(body).length ? await updateAdminUser(user.id, body) : user;
    setOpen(null);
    setNotice({ tone: "done", text: u.saved(saved.email) });
    await refresh();
  }

  function onAction(action: UserAction, user: AdminUser) {
    setNotice(null);
    if (action === "invite") void invite(user);
    else setOpen({ kind: action, user });
  }

  const list = users.data ?? [];
  return (
    <div className="si-root si-users">
      <UsersHeader onAdd={() => { setNotice(null); setOpen({ kind: "add" }); }} disabled={!users.data} />
      {notice && (
        <p className={notice.tone === "refused" ? "si-users__refusal" : "si-users__done"} role={notice.tone === "refused" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
      {agentsQuery.isError && (
        <p className="si-users__agentsnote" role="status">
          {u.agentsLoadError}{" "}
          <button type="button" className="si-link si-hit" onClick={() => void agentsQuery.refetch()}>{u.tryAgain}</button>
        </p>
      )}
      <div className="si-region si-users__region" aria-busy={users.isFetching || inviting ? true : undefined}>
        <RegionProgress active={(users.isFetching && Boolean(users.data)) || Boolean(inviting)} />
        {users.isPending ? (
          <DelayedSkeleton><UsersTableSkeleton /></DelayedSkeleton>
        ) : users.isError && !users.data ? (
          <UsersLoadError code={codeOf(users.error)} onRetry={() => void users.refetch()} />
        ) : (
          <UsersTableView users={list} agents={agents} onAction={onAction} />
        )}
      </div>

      {open?.kind === "add" && (
        <UserFormDialog
          mode="add"
          users={list}
          agents={agents}
          agentsFailed={agentsQuery.isError}
          onRetryAgents={() => void agentsQuery.refetch()}
          onSubmit={(draft) => submitForm(draft)}
          onClose={close}
        />
      )}
      {open?.kind === "edit" && (
        <UserFormDialog
          mode="edit"
          user={open.user}
          users={list}
          agents={agents}
          agentsFailed={agentsQuery.isError}
          onRetryAgents={() => void agentsQuery.refetch()}
          onSubmit={(draft) => submitForm(draft, open.user)}
          onClose={close}
        />
      )}
      {open?.kind === "setPassword" && (
        <SetPasswordDialog
          user={open.user}
          onClose={close}
          onSubmit={async (password) => {
            const saved = await setAdminUserPassword(open.user.id, password);
            setOpen(null);
            setNotice({ tone: "done", text: u.setPassword.done(saved.email) });
            await refresh();
          }}
        />
      )}
      {open?.kind === "deactivate" && (
        <DeactivateDialog
          user={open.user}
          onClose={close}
          onConfirm={async () => {
            const saved = await deactivateAdminUser(open.user.id);
            setOpen(null);
            setNotice({ tone: "done", text: u.deactivate.done(saved.email) });
            await refresh();
          }}
        />
      )}
      {open?.kind === "invite" && <InviteResultDialog email={open.email} result={open.result} onClose={close} />}
    </div>
  );
}
