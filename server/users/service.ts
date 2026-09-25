import { createHash } from "node:crypto";
import {
  UsersError,
  type AdminUserRecord,
  type AdminUserView,
  type InviteDeliveryStatus,
  type UsersActor,
  type UsersAuditEntry,
  type UsersDeps,
} from "./types";
import {
  acceptInviteSchema,
  createUserSchema,
  inviteTokenSchema,
  parseOrThrow,
  setPasswordSchema,
  updateUserSchema,
  userIdSchema,
} from "./validation";

/**
 * Admin user management (S8-USERS, addendum §4.1, E8/E28). Owner-only; the
 * route layer checks the session and this service re-checks the actor.
 *
 * Invariants:
 * - there is always at least one active Owner;
 * - email is unique (stored lowercase);
 * - a rep has an `agent_id` that is an active main-server Agent, and no two
 *   active reps share one (service guard + partial unique index);
 * - a password set, a deactivation or a role change increments
 *   `token_version`, which ends the user's existing sessions;
 * - invite tokens are stored only as SHA-256, work once, expire after 72 h;
 * - audit rows carry allowlisted fields only: never a password, token or hash.
 */

export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
export const ACCEPT_INVITE_PATH = "/accept-invite";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function toAdminUserView(user: AdminUserRecord): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    agent_id: user.agent_id,
    active: user.active,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
    last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
    password_changed_at: user.password_changed_at.toISOString(),
  };
}

function assertOwner(actor: UsersActor | null): asserts actor is UsersActor {
  if (!actor) throw new UsersError("unauthorized", "Sign in again.");
  if (actor.role !== "owner") throw new UsersError("forbidden", "Only the Owner manages users.");
}

async function loadUser(deps: UsersDeps, id: string): Promise<AdminUserRecord> {
  const parsedId = parseOrThrow(userIdSchema, id);
  const user = await deps.users.findById(parsedId.toLowerCase());
  if (!user) throw new UsersError("not_found", "User not found.");
  return user;
}

async function assertEmailFree(deps: UsersDeps, email: string, exceptId?: string): Promise<void> {
  const existing = await deps.users.findByEmail(email);
  if (existing && existing.id !== exceptId) {
    throw new UsersError("email_taken", "Another user already has this email.");
  }
}

async function assertRepAgent(deps: UsersDeps, actor: UsersActor, agentId: string, exceptId?: string): Promise<void> {
  const holder = await deps.users.findActiveRepByAgent(agentId);
  if (holder && holder.id !== exceptId) {
    throw new UsersError("agent_taken", "Another active rep is already linked to this Agent.");
  }
  const active = await deps.agents.isActiveAgent(agentId, actor);
  if (!active) {
    throw new UsersError("agent_inactive", "The linked Agent must be an active Agent.");
  }
}

async function audit(deps: UsersDeps, entry: UsersAuditEntry): Promise<void> {
  await deps.audit(entry);
}

async function withFailureAudit<T>(
  deps: UsersDeps,
  base: Omit<UsersAuditEntry, "ok" | "status" | "error_code">,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof UsersError && error.code !== "unauthorized" && error.code !== "forbidden") {
      await audit(deps, { ...base, ok: false, status: error.status, error_code: error.code });
    }
    throw error;
  }
}

export async function listAdminUsers(deps: UsersDeps, actor: UsersActor | null): Promise<AdminUserView[]> {
  assertOwner(actor);
  const users = await deps.users.list();
  return users.map(toAdminUserView);
}

export async function createAdminUser(
  deps: UsersDeps,
  actor: UsersActor | null,
  body: unknown,
): Promise<AdminUserView> {
  assertOwner(actor);
  const input = parseOrThrow(createUserSchema, body);
  const active = input.active ?? true;
  const agentId = input.role === "rep" ? (input.agent_id ?? null) : null;
  const base = {
    actor: { id: actor.id, email: actor.email },
    action: "admin_user_create",
    payload: { email: input.email, role: input.role, agent_id: agentId, active },
  };

  return withFailureAudit(deps, base, async () => {
    if (input.role !== "rep" && input.agent_id) {
      throw new UsersError("agent_not_allowed", "Only a rep is linked to an Agent.");
    }
    if (input.role === "rep" && !agentId) {
      throw new UsersError("agent_required", "A rep must be linked to an Agent.");
    }
    await assertEmailFree(deps, input.email);
    if (agentId && active) {
      await assertRepAgent(deps, actor, agentId);
    }
    const now = deps.now();
    const created = await deps.users.insert({
      email: input.email,
      password_hash: await deps.hashPassword(input.password),
      role: input.role,
      agent_id: agentId,
      active,
      token_version: 0,
      created_at: now,
      updated_at: now,
      password_changed_at: now,
    });
    await audit(deps, { ...base, entity_id: created.id, ok: true, status: 201 });
    return toAdminUserView(created);
  });
}

export async function updateAdminUser(
  deps: UsersDeps,
  actor: UsersActor | null,
  id: string,
  body: unknown,
  action = "admin_user_update",
): Promise<AdminUserView> {
  assertOwner(actor);
  const patch = parseOrThrow(updateUserSchema, body);
  const current = await loadUser(deps, id);
  const base = {
    actor: { id: actor.id, email: actor.email },
    action,
    entity_id: current.id,
    payload: { ...patch } as Record<string, unknown>,
  };

  return withFailureAudit(deps, base, async () => {
    const next = {
      email: patch.email ?? current.email,
      role: patch.role ?? current.role,
      active: patch.active ?? current.active,
      agent_id: current.agent_id,
    };
    if (next.role === "rep") {
      next.agent_id = patch.agent_id !== undefined ? patch.agent_id : current.agent_id;
      if (!next.agent_id) throw new UsersError("agent_required", "A rep must be linked to an Agent.");
    } else {
      if (patch.agent_id) throw new UsersError("agent_not_allowed", "Only a rep is linked to an Agent.");
      next.agent_id = null;
    }

    const leavesOwners = current.role === "owner" && current.active && (next.role !== "owner" || !next.active);
    if (leavesOwners && (await deps.users.countActiveOwners()) <= 1) {
      throw new UsersError("last_owner", "The last active Owner can't be demoted or deactivated.");
    }

    const emailChanged = next.email !== current.email;
    const roleChanged = next.role !== current.role;
    const agentChanged = next.agent_id !== current.agent_id;
    const activeChanged = next.active !== current.active;
    if (!emailChanged && !roleChanged && !agentChanged && !activeChanged) {
      return toAdminUserView(current);
    }
    if (emailChanged) await assertEmailFree(deps, next.email, current.id);
    if (next.role === "rep" && next.active && next.agent_id && (roleChanged || agentChanged || activeChanged)) {
      await assertRepAgent(deps, actor, next.agent_id, current.id);
    }

    const deactivated = current.active && !next.active;
    const now = deps.now();
    const updated = await deps.users.update(current.id, {
      set: {
        ...(emailChanged ? { email: next.email } : {}),
        ...(roleChanged ? { role: next.role } : {}),
        ...(agentChanged ? { agent_id: next.agent_id } : {}),
        ...(activeChanged ? { active: next.active } : {}),
      },
      // Role changes and deactivation end existing sessions.
      incrementTokenVersion: roleChanged || deactivated,
      now,
      // V-T3 M10: an Owner step-down applies only to the state the guard read, so a racer can't
      // write over (or later revert) a change that another caller already made and reported.
      ...(leavesOwners ? { expect: { role: current.role, active: current.active } } : {}),
    });
    if (!updated && leavesOwners && (await deps.users.findById(current.id))) {
      throw new UsersError("user_changed", "This user was changed by someone else. Reload and try again.");
    }
    if (!updated) throw new UsersError("not_found", "User not found.");
    if (leavesOwners) await compensateIfNoOwnerLeft(deps, current, updated, now);
    if (deactivated) await deps.invites.revokeOutstanding(current.id, now);

    const changed = [
      ...(emailChanged ? ["email"] : []),
      ...(roleChanged ? ["role"] : []),
      ...(agentChanged ? ["agent_id"] : []),
      ...(activeChanged ? ["active"] : []),
    ];
    await audit(deps, {
      ...base,
      payload: {
        changed_fields: changed,
        before: pickChanged(current, changed),
        after: pickChanged(updated, changed),
        sessions_ended: roleChanged || deactivated,
      },
      ok: true,
      status: 200,
    });
    return toAdminUserView(updated);
  });
}

/**
 * V-T3 M10: the count above and the update are separate operations (the admin database may not
 * run transactions), so two Owners stepping each other down at the same time could both pass the
 * count. After the write, re-count: if no active Owner is left, put this user's role and active
 * flag back (only while the stored user still holds the values written here) and refuse. Every
 * racing caller whose re-count sees zero reverts, so at least one active Owner always remains;
 * both racers may be refused, and the Owner can simply retry. The token_version bump is kept, so
 * the restored Owner signs in again. An email change in the same patch is put back best-effort.
 */
async function compensateIfNoOwnerLeft(
  deps: UsersDeps,
  before: AdminUserRecord,
  written: AdminUserRecord,
  now: Date,
): Promise<void> {
  if ((await deps.users.countActiveOwners()) >= 1) return;
  await deps.users.update(before.id, {
    set: { role: before.role, active: before.active, agent_id: before.agent_id },
    incrementTokenVersion: false,
    now,
    expect: { role: written.role, active: written.active },
  });
  if (written.email !== before.email) {
    await deps.users
      .update(before.id, { set: { email: before.email }, incrementTokenVersion: false, now, expect: { role: before.role, active: before.active } })
      .catch(() => null);
  }
  throw new UsersError("last_owner", "The last active Owner can't be demoted or deactivated.");
}

function pickChanged(user: AdminUserRecord, fields: string[]): Record<string, unknown> {
  const allowed: Record<string, unknown> = {
    email: user.email,
    role: user.role,
    agent_id: user.agent_id,
    active: user.active,
  };
  return Object.fromEntries(fields.map((field) => [field, allowed[field]]));
}

export async function deactivateAdminUser(
  deps: UsersDeps,
  actor: UsersActor | null,
  id: string,
): Promise<AdminUserView> {
  return updateAdminUser(deps, actor, id, { active: false }, "admin_user_deactivate");
}

export async function setAdminUserPassword(
  deps: UsersDeps,
  actor: UsersActor | null,
  id: string,
  body: unknown,
): Promise<AdminUserView> {
  assertOwner(actor);
  const { password } = parseOrThrow(setPasswordSchema, body);
  const current = await loadUser(deps, id);
  const now = deps.now();
  const updated = await deps.users.update(current.id, {
    set: { password_hash: await deps.hashPassword(password), password_changed_at: now },
    incrementTokenVersion: true,
    now,
  });
  if (!updated) throw new UsersError("not_found", "User not found.");
  await deps.invites.revokeOutstanding(current.id, now);
  await audit(deps, {
    actor: { id: actor.id, email: actor.email },
    action: "admin_user_set_password",
    entity_id: current.id,
    payload: { email: current.email, sessions_ended: true },
    ok: true,
    status: 200,
  });
  return toAdminUserView(updated);
}

export type InviteResult = {
  emailed: boolean;
  delivery: InviteDeliveryStatus;
  expires_at: string;
  /** Present only when the email was not sent: for the Owner to copy. Never logged. */
  link?: string;
};

export async function sendAdminUserInvite(
  deps: UsersDeps,
  actor: UsersActor | null,
  id: string,
  options: { baseUrl: string | null },
): Promise<InviteResult> {
  assertOwner(actor);
  const user = await loadUser(deps, id);
  const base = {
    actor: { id: actor.id, email: actor.email },
    action: "admin_user_invite",
    entity_id: user.id,
    payload: { email: user.email } as Record<string, unknown>,
  };
  return withFailureAudit(deps, base, async () => {
    // V-T3 m16: no configured origin, no link (never the request's Host).
    const baseUrl = options.baseUrl;
    if (!baseUrl) {
      throw new UsersError(
        "not_configured",
        "Invite links are not configured. Set ADMIN_PUBLIC_BASE_URL to the admin's public origin (for example https://admin.example.com).",
        [{ path: "ADMIN_PUBLIC_BASE_URL", code: "missing_env" }],
      );
    }
    if (!user.active) throw new UsersError("user_inactive", "Reactivate the user before inviting them.");
    const now = deps.now();
    const token = deps.randomToken();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    await deps.invites.revokeOutstanding(user.id, now);
    await deps.invites.insert({
      user_id: user.id,
      token_sha256: sha256Hex(token),
      expires_at: expiresAt,
      created_by: actor.id,
      created_at: now,
    });
    // The token rides in the fragment so it never reaches request logs or Referer headers.
    const link = `${baseUrl.replace(/\/+$/, "")}${ACCEPT_INVITE_PATH}#token=${token}`;
    let delivery: InviteDeliveryStatus;
    try {
      delivery = await deps.mailer.sendInvite({ actor, to: user.email, link, expiresAt });
    } catch {
      delivery = "unreachable";
    }
    const emailed = delivery === "sent";
    await audit(deps, {
      ...base,
      payload: { email: user.email, emailed, delivery, expires_at: expiresAt.toISOString() },
      ok: true,
      status: 200,
    });
    return { emailed, delivery, expires_at: expiresAt.toISOString(), ...(emailed ? {} : { link }) };
  });
}

/**
 * Public: sets the password from a single-use invite token. Every failure is
 * the same `invite_invalid`, so a caller can't learn whether a token or an
 * email exists. The token is looked up cheaply first; the atomic consume
 * (`used_at: null`, unrevoked, `expires_at > now`) makes it single use.
 */
export async function acceptAdminUserInvite(deps: UsersDeps, body: unknown): Promise<void> {
  const { token, password } = parseOrThrow(acceptInviteSchema, body);
  const invalid = () => new UsersError("invite_invalid", "This link is invalid or has expired.");
  if (!inviteTokenSchema.safeParse(token).success) throw invalid();
  const tokenSha = sha256Hex(token);
  const now = deps.now();
  const invite = await deps.invites.findUsable(tokenSha, now);
  if (!invite) throw invalid();
  const user = await deps.users.findById(invite.user_id);
  if (!user || !user.active) throw invalid();
  const passwordHash = await deps.hashPassword(password);
  const consumed = await deps.invites.consume(tokenSha, now);
  if (!consumed) throw invalid();
  const updated = await deps.users.update(user.id, {
    set: { password_hash: passwordHash, password_changed_at: now },
    incrementTokenVersion: true,
    now,
  });
  if (!updated) throw invalid();
  await deps.invites.revokeOutstanding(user.id, now);
  await audit(deps, {
    actor: { id: user.id, email: user.email },
    action: "admin_user_invite_accept",
    entity_id: user.id,
    payload: { email: user.email, sessions_ended: true },
    ok: true,
    status: 200,
  });
}
