import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { setTestEnv } from "@/tests/setup-env";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { signAccessToken, verifyAccessToken } from "@/server/auth/tokens";
import {
  acceptAdminUserInvite,
  createAdminUser,
  deactivateAdminUser,
  INVITE_TTL_MS,
  listAdminUsers,
  sendAdminUserInvite,
  setAdminUserPassword,
  updateAdminUser,
} from "./service";
import { handleAcceptInvite, handleAdminUsersOperation, inviteBaseUrl, type AdminUsersOperation } from "./http";
import { createMemoryInvitesStore, createMemoryUsersStore } from "./testStores";
import {
  UsersError,
  type AdminUserRecord,
  type InviteDeliveryStatus,
  type UsersActor,
  type UsersAuditEntry,
  type UsersDeps,
} from "./types";

const T0 = new Date("2026-09-24T15:00:00.000Z");
const OWNER_ID = "0000000000000000000000a1";
const AGENT_A = "65f0000000000000000000aa";
const AGENT_B = "65f0000000000000000000bb";
const INACTIVE_AGENT = "65f0000000000000000000cc";
const REP_PASSWORD = "rep-password-Secret-1";

function ownerRecord(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: OWNER_ID,
    email: "owner@example.invalid",
    role: "owner",
    agent_id: null,
    active: true,
    token_version: 0,
    password_hash: "fake$owner-original",
    created_at: T0,
    updated_at: T0,
    last_login_at: null,
    password_changed_at: T0,
    ...overrides,
  };
}

const OWNER: UsersActor = { id: OWNER_ID, email: "owner@example.invalid", role: "owner" };

function harness(options: {
  seed?: AdminUserRecord[];
  delivery?: InviteDeliveryStatus | "throw";
  agentsUnavailable?: boolean;
  realHash?: boolean;
} = {}) {
  let now = T0;
  let tokenCounter = 0;
  const tokens: string[] = [];
  const audits: UsersAuditEntry[] = [];
  const mails: Array<{ to: string; link: string }> = [];
  const users = createMemoryUsersStore(options.seed ?? [ownerRecord()]);
  const invites = createMemoryInvitesStore();
  const deps: UsersDeps = {
    users,
    invites,
    agents: {
      async isActiveAgent(agentId) {
        if (options.agentsUnavailable) throw new UsersError("agent_check_unavailable");
        return agentId === AGENT_A || agentId === AGENT_B;
      },
    },
    mailer: {
      async sendInvite({ to, link }) {
        if (options.delivery === "throw") throw new Error("network down");
        mails.push({ to, link });
        return options.delivery ?? "sent";
      },
    },
    audit: async (entry) => {
      audits.push(entry);
    },
    hashPassword: options.realHash ? hashPassword : async (password) => `fake$${password}`,
    now: () => now,
    randomToken: () => {
      tokenCounter += 1;
      const token = `Tok${String(tokenCounter).padStart(3, "0")}${"x".repeat(37)}`.slice(0, 43);
      tokens.push(token);
      return token;
    },
  };
  return {
    deps,
    users,
    invites,
    audits,
    mails,
    tokens,
    setNow(value: Date) {
      now = value;
    },
  };
}

async function createRep(deps: UsersDeps, email = "rep.one@example.invalid", agentId = AGENT_A) {
  return createAdminUser(deps, OWNER, { email, password: REP_PASSWORD, role: "rep", agent_id: agentId });
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof UsersError && error.code === code);
}

test("C15: the Owner creates a rep with email and password, and the rep can log in", async () => {
  setTestEnv();
  const h = harness({ realHash: true });
  const view = await createRep(h.deps, "Rep.One@Example.Invalid");
  assert.equal(view.role, "rep");
  assert.equal(view.agent_id, AGENT_A);
  assert.equal(view.email, "rep.one@example.invalid");
  assert.equal("password_hash" in view, false);

  const stored = h.users.rows.find((row) => row.id === view.id)!;
  assert.match(stored.password_hash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword(REP_PASSWORD, stored.password_hash), true);
  assert.equal(await verifyPassword("wrong-password-123", stored.password_hash), false);

  // The session layer now accepts a rep token (tokens.ts previously refused role "rep").
  const token = signAccessToken({ sub: view.id, email: view.email, role: "rep", token_version: stored.token_version });
  const payload = verifyAccessToken(token);
  assert.equal(payload.role, "rep");
  assert.equal(payload.token_version, 0);
});

test("create guards: email unique (case-insensitive), rep needs an active Agent, one active rep per Agent", async () => {
  const h = harness();
  await createRep(h.deps);
  await rejectsWith(
    createAdminUser(h.deps, OWNER, { email: "REP.ONE@example.invalid", password: REP_PASSWORD, role: "admin" }),
    "email_taken",
  );
  await rejectsWith(
    createAdminUser(h.deps, OWNER, { email: "rep.two@example.invalid", password: REP_PASSWORD, role: "rep" }),
    "agent_required",
  );
  await rejectsWith(createRep(h.deps, "rep.two@example.invalid", AGENT_A), "agent_taken");
  await rejectsWith(createRep(h.deps, "rep.two@example.invalid", INACTIVE_AGENT), "agent_inactive");
  await rejectsWith(
    createAdminUser(h.deps, OWNER, { email: "admin2@example.invalid", password: REP_PASSWORD, role: "admin", agent_id: AGENT_B }),
    "agent_not_allowed",
  );
  await rejectsWith(
    createAdminUser(h.deps, OWNER, { email: "short@example.invalid", password: "short", role: "admin" }),
    "invalid_input",
  );
  // An inactive rep may share the Agent; reactivating it is then refused.
  const parked = await createAdminUser(h.deps, OWNER, {
    email: "rep.parked@example.invalid",
    password: REP_PASSWORD,
    role: "rep",
    agent_id: AGENT_A,
    active: false,
  });
  await rejectsWith(updateAdminUser(h.deps, OWNER, parked.id, { active: true }), "agent_taken");

  const unavailable = harness({ agentsUnavailable: true });
  await rejectsWith(createRep(unavailable.deps), "agent_check_unavailable");
  assert.equal(unavailable.users.rows.length, 1, "nothing is created when the Agent check can't run");
});

test("C15: set-password and deactivate end existing sessions (token_version)", async () => {
  const h = harness();
  const rep = await createRep(h.deps);
  const tokenVersion = () => h.users.rows.find((row) => row.id === rep.id)!.token_version;
  assert.equal(tokenVersion(), 0);

  await setAdminUserPassword(h.deps, OWNER, rep.id, { password: "a-new-password-42" });
  assert.equal(tokenVersion(), 1);
  assert.equal(h.users.rows.find((row) => row.id === rep.id)!.password_hash, "fake$a-new-password-42");

  await deactivateAdminUser(h.deps, OWNER, rep.id);
  assert.equal(tokenVersion(), 2);
  assert.equal(h.users.rows.find((row) => row.id === rep.id)!.active, false);

  // A role change also ends sessions; an email-only change does not.
  const admin = await createAdminUser(h.deps, OWNER, { email: "ops@example.invalid", password: REP_PASSWORD, role: "admin" });
  await updateAdminUser(h.deps, OWNER, admin.id, { email: "ops2@example.invalid" });
  assert.equal(h.users.rows.find((row) => row.id === admin.id)!.token_version, 0);
  await updateAdminUser(h.deps, OWNER, admin.id, { role: "rep", agent_id: AGENT_B });
  assert.equal(h.users.rows.find((row) => row.id === admin.id)!.token_version, 1);
  // Leaving the rep role clears the Agent link.
  const back = await updateAdminUser(h.deps, OWNER, admin.id, { role: "admin" });
  assert.equal(back.agent_id, null);
});

test("C15: the last active Owner can't be demoted or deactivated", async () => {
  const h = harness();
  await rejectsWith(updateAdminUser(h.deps, OWNER, OWNER_ID, { role: "admin" }), "last_owner");
  await rejectsWith(updateAdminUser(h.deps, OWNER, OWNER_ID, { role: "rep", agent_id: AGENT_A }), "last_owner");
  await rejectsWith(updateAdminUser(h.deps, OWNER, OWNER_ID, { active: false }), "last_owner");
  await rejectsWith(deactivateAdminUser(h.deps, OWNER, OWNER_ID), "last_owner");
  assert.equal(h.users.rows[0]!.role, "owner");
  assert.equal(h.users.rows[0]!.active, true);

  // With a second active Owner, one of them may step down.
  const second = await createAdminUser(h.deps, OWNER, { email: "owner2@example.invalid", password: REP_PASSWORD, role: "owner" });
  await updateAdminUser(h.deps, OWNER, OWNER_ID, { role: "admin" });
  await rejectsWith(deactivateAdminUser(h.deps, OWNER, second.id), "last_owner");
  const refused = h.audits.filter((entry) => entry.error_code === "last_owner");
  assert.ok(refused.length >= 5, "refusals are audited");
});

test("V-T3 M10: two Owners stepping each other down concurrently never leave zero active Owners", async () => {
  const OWNER_B_ID = "0000000000000000000000b2";
  const ownerB: UsersActor = { id: OWNER_B_ID, email: "owner.b@example.invalid", role: "owner" };
  const cases: Array<[string, (deps: UsersDeps) => [Promise<unknown>, Promise<unknown>]]> = [
    ["demote each other", (deps) => [
      updateAdminUser(deps, OWNER, OWNER_B_ID, { role: "admin" }),
      updateAdminUser(deps, ownerB, OWNER_ID, { role: "admin" }),
    ]],
    ["deactivate each other", (deps) => [
      deactivateAdminUser(deps, OWNER, OWNER_B_ID),
      deactivateAdminUser(deps, ownerB, OWNER_ID),
    ]],
    ["one demotes to rep, the other deactivates", (deps) => [
      updateAdminUser(deps, OWNER, OWNER_B_ID, { role: "rep", agent_id: AGENT_A }),
      deactivateAdminUser(deps, ownerB, OWNER_ID),
    ]],
    ["both step themselves down", (deps) => [
      updateAdminUser(deps, OWNER, OWNER_ID, { role: "admin", email: "was.owner@example.invalid" }),
      updateAdminUser(deps, ownerB, OWNER_B_ID, { active: false }),
    ]],
  ];
  for (const [name, run] of cases) {
    const h = harness({ seed: [ownerRecord(), ownerRecord({ id: OWNER_B_ID, email: "owner.b@example.invalid" })] });
    const outcomes = await Promise.allSettled(run(h.deps));
    const activeOwners = h.users.rows.filter((row) => row.role === "owner" && row.active);
    assert.ok(activeOwners.length >= 1, `${name}: at least one active Owner remains`);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        assert.ok(outcome.reason instanceof UsersError && outcome.reason.code === "last_owner", `${name}: refused as last_owner`);
      }
    }
    // At most one racer wins. When the two re-counts both see zero (the calls interleave at every
    // await), both revert and the state is exactly the starting state (roles, active, email).
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
    assert.ok(fulfilled <= 1, name);
    if (fulfilled === 0) {
      assert.deepEqual(
        h.users.rows.map((row) => [row.email, row.role, row.active, row.agent_id]),
        [["owner@example.invalid", "owner", true, null], ["owner.b@example.invalid", "owner", true, null]],
        name,
      );
    }
    assert.equal(h.audits.filter((entry) => entry.error_code === "last_owner").length, 2 - fulfilled, `${name}: refusals audited`);
    assert.equal(h.audits.filter((entry) => entry.ok).length, fulfilled, `${name}: only the winner is audited ok`);
  }

  // Sequentially, the first still succeeds and the second is refused, as before.
  const h = harness({ seed: [ownerRecord(), ownerRecord({ id: OWNER_B_ID, email: "owner.b@example.invalid" })] });
  await updateAdminUser(h.deps, OWNER, OWNER_B_ID, { role: "admin" });
  await rejectsWith(updateAdminUser(h.deps, ownerB, OWNER_ID, { role: "admin" }), "last_owner");
  assert.deepEqual(h.users.rows.map((row) => row.role), ["owner", "admin"]);
});

test("V-T3 M10: the compensating revert doesn't overwrite a newer change to the same user", async () => {
  const OWNER_B_ID = "0000000000000000000000b2";
  const h = harness({ seed: [ownerRecord(), ownerRecord({ id: OWNER_B_ID, email: "owner.b@example.invalid" })] });
  // Simulate a racer: when this caller re-counts after demoting B, A has been demoted by someone
  // else and B has meanwhile been changed again (deactivated) by a third writer.
  const realCount = h.users.countActiveOwners.bind(h.users);
  let calls = 0;
  h.users.countActiveOwners = async () => {
    calls += 1;
    if (calls === 2) {
      h.users.rows[0] = { ...h.users.rows[0]!, role: "admin" };
      h.users.rows[1] = { ...h.users.rows[1]!, active: false };
    }
    return realCount();
  };
  await rejectsWith(updateAdminUser(h.deps, OWNER, OWNER_B_ID, { role: "admin" }), "last_owner");
  assert.equal(h.users.rows[1]!.active, false, "the newer change is kept");
  assert.equal(h.users.rows[1]!.role, "admin");
});

test("V-T3 M10: an Owner step-down applies only to the state it read (user_changed otherwise)", async () => {
  const OWNER_B_ID = "0000000000000000000000b2";
  const h = harness({
    seed: [
      ownerRecord(),
      ownerRecord({ id: OWNER_B_ID, email: "owner.b@example.invalid" }),
      ownerRecord({ id: "0000000000000000000000c3", email: "owner.c@example.invalid" }),
    ],
  });
  const realCount = h.users.countActiveOwners.bind(h.users);
  let calls = 0;
  h.users.countActiveOwners = async () => {
    calls += 1;
    // Between the guard's read and the write, another caller already demoted B.
    if (calls === 1) h.users.rows[1] = { ...h.users.rows[1]!, role: "admin", token_version: 7 };
    return realCount();
  };
  await rejectsWith(deactivateAdminUser(h.deps, OWNER, OWNER_B_ID), "user_changed");
  assert.deepEqual([h.users.rows[1]!.role, h.users.rows[1]!.active, h.users.rows[1]!.token_version], ["admin", true, 7]);
});

test("C15: an invite token works once, expires after 72 hours, and only its hash is stored", async () => {
  const h = harness();
  const rep = await createRep(h.deps);
  const result = await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid/" });
  assert.equal(result.emailed, true);
  assert.equal(result.link, undefined, "an emailed invite does not return the link");
  assert.equal(result.expires_at, new Date(T0.getTime() + INVITE_TTL_MS).toISOString());
  const token = h.tokens[0]!;
  assert.equal(h.mails[0]!.link, `https://admin.example.invalid/accept-invite#token=${token}`);

  const stored = h.invites.rows[0]!;
  assert.equal(stored.token_sha256, createHash("sha256").update(token).digest("hex"));
  assert.equal(JSON.stringify(h.invites.rows).includes(token), false, "the raw token is never stored");

  h.setNow(new Date(T0.getTime() + INVITE_TTL_MS - 1000));
  await acceptAdminUserInvite(h.deps, { token, password: "chosen-password-1" });
  const after = h.users.rows.find((row) => row.id === rep.id)!;
  assert.equal(after.password_hash, "fake$chosen-password-1");
  assert.equal(after.token_version, 1, "accepting ends existing sessions");
  await rejectsWith(acceptAdminUserInvite(h.deps, { token, password: "second-attempt-12" }), "invite_invalid");

  // A fresh invite at exactly 72 h is expired.
  h.setNow(T0);
  await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
  h.setNow(new Date(T0.getTime() + INVITE_TTL_MS));
  await rejectsWith(acceptAdminUserInvite(h.deps, { token: h.tokens[1]!, password: "late-password-12" }), "invite_invalid");

  // A newer invite revokes the older unused one.
  h.setNow(T0);
  await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
  await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
  await rejectsWith(acceptAdminUserInvite(h.deps, { token: h.tokens[2]!, password: "old-link-pass-12" }), "invite_invalid");
  await acceptAdminUserInvite(h.deps, { token: h.tokens[3]!, password: "new-link-pass-12" });
});

test("accept-invite errors are generic and don't reveal whether a token exists", async () => {
  const h = harness();
  const rep = await createRep(h.deps);
  await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
  const good = h.tokens[0]!;
  const bodies: string[] = [];
  for (const token of ["A".repeat(43), "not-a-token", "", `${good}x`]) {
    const response = await handleAcceptInvite({ token, password: "any-password-123" }, h.deps);
    assert.equal(response.status, 400);
    bodies.push(await response.text());
  }
  await deactivateAdminUser(h.deps, OWNER, rep.id);
  const revoked = await handleAcceptInvite({ token: good, password: "any-password-123" }, h.deps);
  bodies.push(await revoked.text());
  assert.equal(new Set(bodies).size, 1, bodies.join("\n"));
  assert.match(bodies[0]!, /"code":"invite_invalid"/);
  const weak = await handleAcceptInvite({ token: good, password: "short" }, h.deps);
  assert.equal(weak.status, 400);
  assert.match(await weak.text(), /"code":"invalid_input"/);
});

test("copy-link fallback: not configured, failed or unreachable return the link with emailed:false", async () => {
  for (const delivery of ["not_configured", "failed", "throw"] as const) {
    const h = harness({ delivery });
    const rep = await createRep(h.deps);
    const result = await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
    assert.equal(result.emailed, false);
    assert.equal(result.delivery, delivery === "throw" ? "unreachable" : delivery);
    assert.equal(result.link, `https://admin.example.invalid/accept-invite#token=${h.tokens[0]}`);
  }
  const h = harness();
  const rep = await createRep(h.deps);
  await deactivateAdminUser(h.deps, OWNER, rep.id);
  await rejectsWith(sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://a.invalid" }), "user_inactive");
});

test("C15: no password, token or hash appears in audit rows", async () => {
  const h = harness({ delivery: "not_configured" });
  const rep = await createRep(h.deps);
  await updateAdminUser(h.deps, OWNER, rep.id, { email: "rep.renamed@example.invalid" });
  await setAdminUserPassword(h.deps, OWNER, rep.id, { password: "set-by-owner-pass-9" });
  await sendAdminUserInvite(h.deps, OWNER, rep.id, { baseUrl: "https://admin.example.invalid" });
  await acceptAdminUserInvite(h.deps, { token: h.tokens[0]!, password: "chosen-by-rep-pass-7" });
  await rejectsWith(createRep(h.deps, "rep.renamed@example.invalid"), "email_taken");
  await rejectsWith(updateAdminUser(h.deps, OWNER, OWNER_ID, { active: false }), "last_owner");
  await deactivateAdminUser(h.deps, OWNER, rep.id);

  const actions = h.audits.map((entry) => entry.action);
  for (const action of [
    "admin_user_create",
    "admin_user_update",
    "admin_user_set_password",
    "admin_user_invite",
    "admin_user_invite_accept",
    "admin_user_deactivate",
  ]) {
    assert.ok(actions.includes(action), `audited ${action}`);
  }
  const serialized = JSON.stringify(h.audits);
  const secrets = [
    REP_PASSWORD,
    "set-by-owner-pass-9",
    "chosen-by-rep-pass-7",
    "fake$",
    h.tokens[0]!,
    createHash("sha256").update(h.tokens[0]!).digest("hex"),
    "accept-invite#token",
  ];
  for (const secret of secrets) {
    assert.equal(serialized.includes(secret), false, `audit rows must not contain ${secret.slice(0, 6)}…`);
  }
  assert.equal(/password|token_sha|hash/i.test(Object.keys(Object.assign({}, ...h.audits.map((a) => a.payload))).join(",")), false);
});

test("C15: non-Owner callers get 403 (and no session 401) on every user route", async () => {
  const h = harness();
  const rep = await createRep(h.deps);
  const operations: AdminUsersOperation[] = [
    { kind: "list" },
    { kind: "create", body: { email: "x@example.invalid", password: REP_PASSWORD, role: "owner" } },
    { kind: "update", id: OWNER_ID, body: { role: "admin" } },
    { kind: "set_password", id: OWNER_ID, body: { password: "hijacked-password-1" } },
    { kind: "deactivate", id: OWNER_ID },
    { kind: "invite", id: rep.id, baseUrl: "https://admin.example.invalid" },
  ];
  const before = JSON.stringify(h.users.rows);
  for (const operation of operations) {
    for (const role of ["admin", "rep"] as const) {
      const response = await handleAdminUsersOperation({ id: rep.id, email: "x@example.invalid", role }, operation, h.deps);
      assert.equal(response.status, 403, `${role} ${operation.kind}`);
    }
    const anonymous = await handleAdminUsersOperation(null, operation, h.deps);
    assert.equal(anonymous.status, 401, `anonymous ${operation.kind}`);
  }
  assert.equal(JSON.stringify(h.users.rows), before, "nothing changed");
  assert.equal(h.invites.rows.length, 0);

  const ownerList = await handleAdminUsersOperation(OWNER, { kind: "list" }, h.deps);
  assert.equal(ownerList.status, 200);
  assert.equal(ownerList.headers.get("cache-control"), "no-store");
  const listed = (await ownerList.json()) as { data: { users: Array<Record<string, unknown>> } };
  assert.equal(listed.data.users.length, 2);
  assert.equal(JSON.stringify(listed).includes("fake$"), false, "list never returns a hash");
  assert.deepEqual((await listAdminUsers(h.deps, OWNER)).map((user) => user.role).sort(), ["owner", "rep"]);
});

test("http maps service errors to status codes", async () => {
  const h = harness();
  const missing = await handleAdminUsersOperation(OWNER, { kind: "update", id: "0000000000000000000000ff", body: { active: false } }, h.deps);
  assert.equal(missing.status, 404);
  const badId = await handleAdminUsersOperation(OWNER, { kind: "deactivate", id: "../etc" }, h.deps);
  assert.equal(badId.status, 400);
  const last = await handleAdminUsersOperation(OWNER, { kind: "deactivate", id: OWNER_ID }, h.deps);
  assert.equal(last.status, 409);
  const extra = await handleAdminUsersOperation(OWNER, { kind: "update", id: OWNER_ID, body: { password_hash: "x" } }, h.deps);
  assert.equal(extra.status, 400, "unknown fields are refused");
  const created = await handleAdminUsersOperation(
    OWNER,
    { kind: "create", body: { email: "rep@example.invalid", password: REP_PASSWORD, role: "rep", agent_id: INACTIVE_AGENT } },
    h.deps,
  );
  assert.equal(created.status, 422);
});

test("invite base URL comes only from ADMIN_PUBLIC_BASE_URL (an origin), never the request", () => {
  assert.equal(inviteBaseUrl("https://admin.vantage.test/"), "https://admin.vantage.test");
  assert.equal(inviteBaseUrl(" https://admin.vantage.test "), "https://admin.vantage.test");
  assert.equal(inviteBaseUrl("http://localhost:3000"), "http://localhost:3000");
  for (const bad of [undefined, "", "   ", "javascript:alert(1)", "not a url", "https://admin.vantage.test/sub",
    "https://admin.vantage.test/?x=1", "https://admin.vantage.test/#f", "https://user:pw@admin.vantage.test"]) {
    assert.equal(inviteBaseUrl(bad), null, String(bad));
  }
});

test("V-T3 m16: with no configured base URL the invite is refused as not_configured and nothing is written", async () => {
  const h = harness();
  const rep = await createAdminUser(h.deps, OWNER, { email: "rep@example.invalid", password: REP_PASSWORD, role: "rep", agent_id: AGENT_A });
  const response = await handleAdminUsersOperation(OWNER, { kind: "invite", id: rep.id, baseUrl: inviteBaseUrl(undefined) }, h.deps);
  assert.equal(response.status, 503);
  const body = (await response.json()) as { ok: boolean; code: string; error: string; issues?: Array<{ path: string; code: string }> };
  assert.equal(body.code, "not_configured");
  assert.match(body.error, /ADMIN_PUBLIC_BASE_URL/);
  assert.deepEqual(body.issues, [{ path: "ADMIN_PUBLIC_BASE_URL", code: "missing_env" }]);
  assert.equal(JSON.stringify(body).includes("accept-invite"), false, "no link");
  assert.equal(h.invites.rows.length, 0, "no invite token minted");
  assert.equal(h.mails.length, 0, "nothing mailed");
  const refusal = h.audits.find((entry) => entry.action === "admin_user_invite");
  assert.equal(refusal?.ok, false);
  assert.equal(refusal?.error_code, "not_configured");
  // Non-Owners are still refused first.
  const admin = await handleAdminUsersOperation({ id: rep.id, email: "a@example.invalid", role: "admin" }, { kind: "invite", id: rep.id, baseUrl: null }, h.deps);
  assert.equal(admin.status, 403);
});
