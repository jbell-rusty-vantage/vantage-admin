import assert from "node:assert/strict";
import test from "node:test";
import { handleAdminUsersOperation } from "./http";
import {
  acceptAdminUserInvite,
  createAdminUser,
  INVITE_TTL_MS,
  lastInviteView,
  listAdminUsers,
  sendAdminUserInvite,
  setAdminUserPassword,
} from "./service";
import { createMemoryInvitesStore, createMemoryUsersStore } from "./testStores";
import type { AdminUserListView, AdminUserRecord, UsersActor, UsersDeps } from "./types";

/*
 * UI2-USERS: the additive `last_invite` on the Owner's list read. The newest invite per user decides the
 * state: `used_at` → accepted, `revoked_at` → revoked, `expires_at` ≤ now → expired, else pending. The read
 * never carries a token, its hash or the link. In-memory stores only (no database).
 */

const T0 = new Date("2026-09-24T15:00:00.000Z");
const OWNER_ID = "0000000000000000000000a1";
const AGENT_A = "65f0000000000000000000aa";
const OWNER: UsersActor = { id: OWNER_ID, email: "owner@example.invalid", role: "owner" };
const BASE = { baseUrl: "https://admin.example.invalid" };

function owner(): AdminUserRecord {
  return {
    id: OWNER_ID,
    email: "owner@example.invalid",
    role: "owner",
    agent_id: null,
    active: true,
    token_version: 0,
    password_hash: "fake$owner",
    created_at: T0,
    updated_at: T0,
    last_login_at: null,
    password_changed_at: T0,
  };
}

function harness() {
  let now = T0;
  let counter = 0;
  const tokens: string[] = [];
  const users = createMemoryUsersStore([owner()]);
  const invites = createMemoryInvitesStore();
  const deps: UsersDeps = {
    users,
    invites,
    agents: { isActiveAgent: async (id) => id === AGENT_A },
    mailer: { sendInvite: async () => "not_configured" },
    audit: async () => {},
    hashPassword: async (password) => `fake$${password}`,
    now: () => now,
    randomToken: () => {
      counter += 1;
      const token = `Inv${String(counter).padStart(3, "0")}${"y".repeat(40)}`.slice(0, 43);
      tokens.push(token);
      return token;
    },
  };
  return { deps, invites, tokens, setNow: (value: Date) => { now = value; } };
}

async function rep(deps: UsersDeps) {
  return createAdminUser(deps, OWNER, { email: "rep@example.invalid", password: "rep-password-1", role: "rep", agent_id: AGENT_A });
}

const rowOf = (rows: AdminUserListView[], id: string) => rows.find((row) => row.id === id)!;

test("last_invite: none → null for a user who never had an invite", async () => {
  const h = harness();
  const created = await rep(h.deps);
  const rows = await listAdminUsers(h.deps, OWNER);
  assert.equal(rowOf(rows, created.id).last_invite, null);
  assert.equal(rowOf(rows, OWNER_ID).last_invite, null);
});

test("last_invite: pending with created_at and the 72 h expires_at", async () => {
  const h = harness();
  const created = await rep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  const row = rowOf(await listAdminUsers(h.deps, OWNER), created.id);
  assert.deepEqual(row.last_invite, {
    state: "pending",
    created_at: T0.toISOString(),
    expires_at: new Date(T0.getTime() + INVITE_TTL_MS).toISOString(),
  });
});

test("last_invite: expired once now reaches expires_at", async () => {
  const h = harness();
  const created = await rep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  h.setNow(new Date(T0.getTime() + INVITE_TTL_MS - 1));
  assert.equal(rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite?.state, "pending");
  h.setNow(new Date(T0.getTime() + INVITE_TTL_MS));
  assert.equal(rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite?.state, "expired");
});

test("last_invite: accepted after the invite is used (and stays accepted after it would have expired)", async () => {
  const h = harness();
  const created = await rep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  h.setNow(new Date(T0.getTime() + 60_000));
  await acceptAdminUserInvite(h.deps, { token: h.tokens[0], password: "new-password-123" });
  assert.equal(rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite?.state, "accepted");
  h.setNow(new Date(T0.getTime() + INVITE_TTL_MS * 2));
  assert.equal(rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite?.state, "accepted");
});

test("last_invite: revoked after a password set; a newer invite replaces the older one as the newest", async () => {
  const h = harness();
  const created = await rep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  h.setNow(new Date(T0.getTime() + 60_000));
  await setAdminUserPassword(h.deps, OWNER, created.id, { password: "owner-set-password-1" });
  assert.equal(rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite?.state, "revoked");

  h.setNow(new Date(T0.getTime() + 120_000));
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  const last = rowOf(await listAdminUsers(h.deps, OWNER), created.id).last_invite;
  assert.equal(last?.state, "pending");
  assert.equal(last?.created_at, new Date(T0.getTime() + 120_000).toISOString());
  assert.equal(h.invites.rows.filter((row) => row.user_id === created.id).length, 2);
});

test("lastInviteView: used wins over revoked and the clock; revoked wins over the clock", () => {
  const base = { id: "i", user_id: "u", token_sha256: "h", created_by: OWNER_ID, created_at: T0, expires_at: new Date(T0.getTime() + 1000) };
  const late = new Date(T0.getTime() + 5000);
  assert.equal(lastInviteView({ ...base, used_at: T0, revoked_at: T0 }, late)?.state, "accepted");
  assert.equal(lastInviteView({ ...base, used_at: null, revoked_at: T0 }, late)?.state, "revoked");
  assert.equal(lastInviteView({ ...base, used_at: null, revoked_at: null }, late)?.state, "expired");
  assert.equal(lastInviteView({ ...base, used_at: null, revoked_at: null }, T0)?.state, "pending");
  assert.equal(lastInviteView(null, T0), null);
});

test("the list response carries last_invite but never a token, token hash or link", async () => {
  const h = harness();
  const created = await rep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, created.id, BASE);
  const response = await handleAdminUsersOperation(OWNER, { kind: "list" }, h.deps);
  const text = await response.text();
  const body = JSON.parse(text) as { data: { users: AdminUserListView[] } };
  assert.equal(rowOf(body.data.users, created.id).last_invite?.state, "pending");
  assert.ok(!text.includes(h.tokens[0]!), "no token");
  assert.ok(!text.includes(h.invites.rows[0]!.token_sha256), "no token hash");
  assert.ok(!/token|accept-invite|link/i.test(text), "no token field or link");
});
