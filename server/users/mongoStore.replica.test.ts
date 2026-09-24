import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { setTestEnv } from "@/tests/setup-env";
import { resetServerEnvForTests } from "@/lib/env/server";
import { connectAdminMongo } from "@/lib/db/adminMongo";
import { AdminUser, AdminUserInvite } from "@/server/models";
import { hashPassword } from "@/server/auth/password";
import {
  authenticateAdmin,
  getAdminFromAccessToken,
  getSessionUserFromAccessToken,
  refreshAdminSession,
} from "@/server/auth/session";
import { createMongoAdminUserInvitesStore, createMongoAdminUsersStore } from "./mongoStore";
import {
  acceptAdminUserInvite,
  createAdminUser,
  deactivateAdminUser,
  sendAdminUserInvite,
  setAdminUserPassword,
} from "./service";
import { UsersError, type UsersActor, type UsersAuditEntry, type UsersDeps } from "./types";

/**
 * Replica proof for the Mongo stores and the real session layer (S8-USERS, C15).
 * Skipped unless ADMIN_USERS_REPLICA_URI is set, so `pnpm test` never needs Mongo:
 *   ADMIN_USERS_REPLICA_URI="mongodb://127.0.0.1:27189/?replicaSet=csi01" \
 *     node --import tsx --test server/users/mongoStore.replica.test.ts
 * Uses its own database `testvantagemovers_t3admusers` and drops it before and after.
 */
const REPLICA_URI = process.env.ADMIN_USERS_REPLICA_URI?.trim();
const DB_NAME = "testvantagemovers_t3admusers";
const skip = !REPLICA_URI;
const AGENT_A = "65f0000000000000000000aa";
const REP_PASSWORD = "replica-rep-password-1";

const audits: UsersAuditEntry[] = [];
const tokens: string[] = [];
let owner: UsersActor;
let now = new Date();

function deps(): UsersDeps {
  return {
    users: createMongoAdminUsersStore(),
    invites: createMongoAdminUserInvitesStore(),
    agents: { isActiveAgent: async (agentId) => agentId === AGENT_A },
    mailer: { sendInvite: async () => "not_configured" },
    audit: async (entry) => {
      audits.push(entry);
    },
    hashPassword,
    now: () => now,
    randomToken: () => {
      const token = randomBytes(32).toString("base64url");
      tokens.push(token);
      return token;
    },
  };
}

before(async () => {
  if (skip) return;
  setTestEnv();
  process.env.MONGODB_URI = REPLICA_URI;
  process.env.ADMIN_AUTH_DB_NAME = DB_NAME;
  resetServerEnvForTests();
  await connectAdminMongo();
  assert.equal(mongoose.connection.name, DB_NAME);
  await mongoose.connection.dropDatabase();
  await AdminUser.createIndexes();
  await AdminUserInvite.createIndexes();
  const created = await AdminUser.create({
    email: "owner@example.invalid",
    password_hash: await hashPassword("replica-owner-password"),
    role: "owner",
    active: true,
  });
  owner = { id: created._id.toString(), email: created.email, role: "owner" };
});

after(async () => {
  if (skip) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("replica: a created rep logs in; the session layer recognises it but no dashboard caller does", { skip }, async () => {
  const rep = await createAdminUser(deps(), owner, {
    email: "Rep.Replica@Example.Invalid",
    password: REP_PASSWORD,
    role: "rep",
    agent_id: AGENT_A,
  });
  const login = await authenticateAdmin("rep.replica@example.invalid", REP_PASSWORD);
  assert.ok(login);
  assert.equal(login.admin.role, "rep");
  assert.equal(login.admin.id, rep.id);
  assert.equal((await getSessionUserFromAccessToken(login.tokens.accessToken))?.role, "rep");
  assert.equal(await getAdminFromAccessToken(login.tokens.accessToken), null, "deny-by-default for pre-S8 callers");
  assert.equal(await authenticateAdmin("rep.replica@example.invalid", "wrong-password-1"), null);
});

test("replica: set-password and deactivate end existing sessions (access and refresh)", { skip }, async () => {
  const rep = await AdminUser.findOne({ email: "rep.replica@example.invalid" }).lean();
  assert.ok(rep);
  const first = await authenticateAdmin("rep.replica@example.invalid", REP_PASSWORD);
  assert.ok(first);
  await setAdminUserPassword(deps(), owner, rep._id.toString(), { password: "replica-new-password-2" });
  assert.equal(await getSessionUserFromAccessToken(first.tokens.accessToken), null);
  assert.equal(await refreshAdminSession(first.tokens.refreshToken), null);
  assert.equal(await authenticateAdmin("rep.replica@example.invalid", REP_PASSWORD), null);
  const second = await authenticateAdmin("rep.replica@example.invalid", "replica-new-password-2");
  assert.ok(second);

  await deactivateAdminUser(deps(), owner, rep._id.toString());
  assert.equal(await getSessionUserFromAccessToken(second.tokens.accessToken), null);
  assert.equal(await refreshAdminSession(second.tokens.refreshToken), null);
  assert.equal(await authenticateAdmin("rep.replica@example.invalid", "replica-new-password-2"), null);
  const stored = await AdminUser.findById(rep._id).lean();
  assert.equal(stored?.token_version, 2);
});

test("replica: the partial unique index allows one active rep per Agent; email is unique", { skip }, async () => {
  const active = await createAdminUser(deps(), owner, {
    email: "rep.active@example.invalid",
    password: REP_PASSWORD,
    role: "rep",
    agent_id: AGENT_A,
  });
  assert.equal(active.active, true);
  // Bypass the service guard: the index itself refuses a second active rep on the Agent.
  await assert.rejects(
    AdminUser.create({ email: "rep.dup@example.invalid", password_hash: "x", role: "rep", agent_id: AGENT_A, active: true }),
    (error: { code?: number }) => error.code === 11000,
  );
  const store = createMongoAdminUsersStore();
  await assert.rejects(
    store.insert({
      email: "rep.dup2@example.invalid",
      password_hash: "x",
      role: "rep",
      agent_id: AGENT_A,
      active: true,
      token_version: 0,
      created_at: now,
      updated_at: now,
      password_changed_at: now,
    }),
    (error: unknown) => error instanceof UsersError && error.code === "agent_taken",
  );
  await assert.rejects(
    store.insert({
      email: "REP.ACTIVE@example.invalid",
      password_hash: "x",
      role: "admin",
      agent_id: null,
      active: true,
      token_version: 0,
      created_at: now,
      updated_at: now,
      password_changed_at: now,
    }),
    (error: unknown) => error instanceof UsersError && error.code === "email_taken",
  );
  await assert.rejects(
    AdminUser.create({ email: "rep.noagent@example.invalid", password_hash: "x", role: "rep", active: true }),
    /agent_id is required/,
  );
  const indexes = await AdminUser.collection.indexes();
  const partial = indexes.find((index) => index.name === "admin_user_active_rep_agent_unique");
  assert.deepEqual(partial?.partialFilterExpression, { role: "rep", active: true, agent_id: { $type: "string" } });
});

test("replica: an invite is single use under a race, stored only as a hash, and expires at 72 h", { skip }, async () => {
  const rep = await AdminUser.findOne({ email: "rep.active@example.invalid" }).lean();
  assert.ok(rep);
  now = new Date();
  const result = await sendAdminUserInvite(deps(), owner, rep._id.toString(), { baseUrl: "https://admin.example.invalid" });
  assert.equal(result.emailed, false);
  const token = tokens.at(-1)!;
  assert.ok(result.link?.endsWith(`#token=${token}`));
  const raw = await AdminUserInvite.collection.find({ user_id: rep._id }).toArray();
  assert.equal(raw.length, 1);
  assert.equal(raw[0]?.token_sha256, createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify(raw).includes(token), false);

  const outcomes = await Promise.allSettled([
    acceptAdminUserInvite(deps(), { token, password: "race-password-one-1" }),
    acceptAdminUserInvite(deps(), { token, password: "race-password-two-2" }),
    acceptAdminUserInvite(deps(), { token, password: "race-password-three-3" }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const after = await AdminUser.findById(rep._id).lean();
  assert.equal(after?.token_version, 1);

  await sendAdminUserInvite(deps(), owner, rep._id.toString(), { baseUrl: "https://admin.example.invalid" });
  const late = tokens.at(-1)!;
  now = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  await assert.rejects(acceptAdminUserInvite(deps(), { token: late, password: "too-late-password-1" }), UsersError);

  const serialized = JSON.stringify(audits);
  for (const secret of [REP_PASSWORD, "race-password", token, late, "$2"]) {
    assert.equal(serialized.includes(secret), false);
  }
});
