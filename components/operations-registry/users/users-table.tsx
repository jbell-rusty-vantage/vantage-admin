"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/sales-intelligence/atoms/button";
import { TimeText } from "@/components/sales-intelligence/primitives/time-text";
import { SkeletonLines } from "@/components/sales-intelligence/primitives/skeleton";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { cx } from "@/components/sales-intelligence/lib/format";
import type { AdminUser, LastInvite } from "./users-api";
import { agentLabel, roleWord, type AgentOption } from "./users-logic";

const u = copy.ui2.users;

export type UserAction = "edit" | "setPassword" | "deactivate" | "invite";

/**
 * The invite column. `pending` prints the expiry as an exact ET time (the list read has no `as_of`, so no
 * relative phrase and no browser clock); the `<time>` carries `title` + `aria-label`.
 */
export function InviteCell({ invite }: { invite: LastInvite | null }) {
  if (!invite) return <span className="si-text--subtle">{u.invite.none}</span>;
  if (invite.state === "pending") {
    // The copy is a template around the time; split it so the time is a `<time>` element.
    const [before, after] = u.invite.pending("\u0000").split("\u0000");
    return (
      <span>
        {before}
        <TimeText t={invite.expires_at} asOf={null} mode="exact" />
        {after}
      </span>
    );
  }
  const word = invite.state === "accepted" ? u.invite.accepted : invite.state === "expired" ? u.invite.expired : invite.state === "revoked" ? u.invite.revoked : u.invite.none;
  return <span className={invite.state === "accepted" ? undefined : "si-text--subtle"}>{word}</span>;
}

/** The actions a row offers: a deactivated user can't be deactivated or invited (reactivate in Edit first). */
export function rowActions(user: AdminUser): UserAction[] {
  return user.active ? ["edit", "setPassword", "deactivate", "invite"] : ["edit", "setPassword"];
}

const actionWord: Record<UserAction, string> = {
  edit: u.actions.edit,
  setPassword: u.actions.setPassword,
  deactivate: u.actions.deactivate,
  invite: u.actions.invite,
};

/** `More actions`: the three secondary actions in a menu (the narrow layout). Escape closes it and returns focus. */
function MoreActions({ user, actions, onAction }: { user: AdminUser; actions: UserAction[]; onAction: (action: UserAction, user: AdminUser) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div className="si-users__more" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="si-btn si-btn--secondary si-btn--sm si-hit"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis size={16} aria-hidden />
        {u.actions.more}
      </button>
      {open && (
        <ul id={menuId} className="si-users__menu" aria-label={u.actionsFor(user.email)}>
          {actions.map((action) => (
            <li key={action}>
              <button
                type="button"
                className={cx("si-users__menuitem", action === "deactivate" && "si-text--danger")}
                onClick={() => {
                  setOpen(false);
                  // The dialog that opens returns focus here when it closes (the menu item is gone by then).
                  buttonRef.current?.focus();
                  onAction(action, user);
                }}
              >
                {actionWord[action]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RowActionsCell({ user, onAction }: { user: AdminUser; onAction: (action: UserAction, user: AdminUser) => void }) {
  const actions = rowActions(user);
  const secondary = actions.filter((action) => action !== "edit");
  return (
    <div className="si-users__actions" role="group" aria-label={u.actionsFor(user.email)}>
      <Button type="button" size="sm" className="si-hit" onClick={() => onAction("edit", user)}>
        {u.actions.edit}
      </Button>
      <span className="si-users__inline-actions">
        {secondary.map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === "deactivate" ? "ghost" : "secondary"}
            className={cx("si-hit", action === "deactivate" && "si-text--danger")}
            onClick={() => onAction(action, user)}
          >
            {actionWord[action]}
          </Button>
        ))}
      </span>
      <MoreActions user={user} actions={secondary} onAction={onAction} />
    </div>
  );
}

/** The Users table: email, role word, Agent name, Active / Deactivated, invite state, actions. */
export function UsersTableView({
  users,
  agents,
  onAction,
}: {
  users: AdminUser[];
  /** `null` while the Agent list isn't available (the cell then prints the raw id). */
  agents: AgentOption[] | null;
  onAction: (action: UserAction, user: AdminUser) => void;
}) {
  const c = u.columns;
  if (users.length === 0) return <p className="si-users__empty">{u.empty}</p>;
  return (
    <table className="si-users__table" aria-label={u.tableLabel}>
      <thead>
        <tr>
          <th scope="col">{c.email}</th>
          <th scope="col">{c.role}</th>
          <th scope="col">{c.agent}</th>
          <th scope="col">{c.active}</th>
          <th scope="col">{c.invite}</th>
          <th scope="col">{c.actions}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} data-user={user.id} className={cx(!user.active && "is-inactive")}>
            <th scope="row" className="si-users__email" data-label={c.email}>{user.email}</th>
            <td data-label={c.role}>{roleWord(user.role)}</td>
            <td data-label={c.agent} className={cx(!agents && user.agent_id && "si-mono")}>{agentLabel(user.agent_id, agents)}</td>
            <td data-label={c.active}>
              <span className={cx("si-badge", user.active ? "si-badge--blue" : "si-badge--neutral")}>{user.active ? u.active : u.inactive}</span>
            </td>
            <td data-label={c.invite}><InviteCell invite={user.last_invite} /></td>
            <td data-label={c.actions}><RowActionsCell user={user} onAction={onAction} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Shaped like three rows of the table (shown only after 150 ms by the caller's DelayedSkeleton). */
export function UsersTableSkeleton() {
  return (
    <div className="si-users__skeleton" aria-hidden>
      {[0, 1, 2].map((row) => (
        <SkeletonLines key={row} lines={1} widths={["100%"]} className="si-users__skelrow" />
      ))}
    </div>
  );
}
