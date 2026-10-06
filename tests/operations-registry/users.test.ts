import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// The Users tab became the Dashboard login line and sheet of the person card (doc 19): its dialogs, invite result and
// refusal mapping now live in components/setup/people with the same rules and sentences.
import { InviteLine, InviteResultView } from "../../components/setup/people/invite-result";
import { DeactivateLogin, LoginBlock, PasswordAndInvite } from "../../components/setup/people/login-block";
import { refusalState } from "../../components/setup/people/login-errors";
import { PEOPLE_COPY } from "../../components/setup/people/people-copy";
import { PersonCard } from "../../components/setup/people/person-card";
import { buildPeople } from "../../components/setup/people/people-model";
import {
  inviteResultSchema,
  parseUsersBody,
  usersListSchema,
  UsersApiError,
  type AdminUser,
} from "../../components/operations-registry/users/users-api";
import {
  agentLabel,
  emptyDraft,
  errorSentence,
  passwordBytes,
  passwordOk,
  pickerAgents,
  rowActions,
  updateBody,
  validateDraft,
  type AgentOption,
} from "../../components/operations-registry/users/users-logic";
import { canOpenSetupSection, setupSectionsFor } from "../../components/setup/setup-sections";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { fixtureTest, ifFixtures, requireContracts } from "../sales-intelligence/contracts-dir";

/*
 * UI2-USERS (UI-2 §8, UI2-A12…A14): the Users tab, its dialogs and the invite result, rendered to static
 * markup from the S8 admin-users fixtures (no DOM). The routes themselves are covered in server/users.
 */

type Fixture = { status: number; body: unknown };
const fixture = (name: string): Fixture =>
  JSON.parse(fs.readFileSync(path.join(requireContracts(), "S8", "admin-users", `${name}.json`), "utf8")) as Fixture;
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => decode(renderToStaticMarkup(element));
const u = copy.ui2.users;
const noop = () => {};

/** Throws the fixture's refusal as the client would; returns the error. */
function refusal(name: string): UsersApiError {
  const { status, body } = fixture(name);
  try {
    parseUsersBody(status, body, usersListSchema);
  } catch (error) {
    assert.ok(error instanceof UsersApiError, `${name} throws UsersApiError`);
    return error;
  }
  throw new Error(`${name} did not refuse`);
}

const DANA_AGENT = "6ab58feab68087c1548aadf5";
const AGENTS: AgentOption[] = [
  { id: DANA_AGENT, name: "Dana Reyes", active: true },
  { id: "6ab5ab0d72ee2eb383d940a8", name: "Marcus Bell", active: true },
  { id: "6ab5ab0d72ee2eb383d940a9", name: "Tina Cho", active: false },
];

const listed = ifFixtures(() => {
  const { status, body } = fixture("list__after");
  return parseUsersBody(status, body, usersListSchema).users;
});

// Reason: the users table is gone; the same facts (role word, Deactivated, no invite) are read from the person card's Dashboard line.
fixtureTest("list__after.json parses (no last_invite → null) and the Dashboard line prints the email, the role word and the state", () => {
  assert.equal(listed.length, 3);
  assert.ok(listed.every((user) => user.last_invite === null));
  const rep = listed.find((user) => user.role === "rep")!;
  const agent = { id: rep.agent_id!, name: "Dana Reyes", normalized_name: "dana reyes", active: true, created_from: "test" };
  const model = buildPeople({ agents: [agent], users: listed, extensionUsers: [], accounts: [] });
  const out = html(createElement(PersonCard, { person: model.people[0]!, loaded: model.loaded, readOnly: false, onEdit: noop }));
  assert.ok(out.includes(rep.email) && out.includes(PEOPLE_COPY.loginRoleWord.rep!));
  assert.ok(html(createElement(InviteLine, { invite: null })).includes(u.invite.none));
});

fixtureTest("an unknown agent_id is Agent not found; no Agent prints —; an inactive Agent is marked", () => {
  // Reason: the table cell is gone; the pure label it printed is still the rule.
  assert.equal(agentLabel("6ab5ab0d72ee2eb383d94000", AGENTS), u.unknownAgent);
  assert.equal(agentLabel(null, AGENTS), u.noAgent);
  assert.equal(agentLabel("6ab5ab0d72ee2eb383d940a9", AGENTS), u.agentInactive("Tina Cho"));
  assert.equal(agentLabel(DANA_AGENT, null), DANA_AGENT, "Agent list not loaded: the id, not a wrong sentence");
});

test("the invite line prints each last_invite state; pending carries the exact ET expiry on a <time>", () => {
  const t = "2026-09-27T15:03:00.000Z";
  const pending = html(createElement(InviteLine, { invite: { state: "pending", created_at: t, expires_at: t } }));
  const exact = formatExactFull(t);
  assert.ok(pending.includes("Invite expires "));
  assert.ok(pending.includes(`title="${exact}"`) && pending.includes(`aria-label="${exact}"`));
  assert.ok(pending.includes(`>${exact}</time>`));
  assert.ok(html(createElement(InviteLine, { invite: { state: "accepted", created_at: t, expires_at: t } })).includes(u.invite.accepted));
  assert.ok(html(createElement(InviteLine, { invite: { state: "expired", created_at: t, expires_at: t } })).includes(u.invite.expired));
  assert.ok(html(createElement(InviteLine, { invite: { state: "revoked", created_at: t, expires_at: t } })).includes(u.invite.revoked));
  assert.ok(html(createElement(InviteLine, { invite: null })).includes(u.invite.none));
});

fixtureTest("A12: the Agent picker lists active Agents not held by another active rep; the edited rep keeps their own", () => {
  const activeRep: AdminUser = { ...listed[1]!, id: "000000000000000000a00009", email: "marcus@example.invalid", agent_id: AGENTS[1]!.id, active: true };
  const users = [...listed, activeRep];
  // Add: Dana's rep is deactivated (her Agent is free), Marcus is held by an active rep, Tina is inactive.
  assert.deepEqual(pickerAgents(AGENTS, users, null).map((agent) => agent.name), ["Dana Reyes"]);
  // Edit Marcus's rep: his own Agent stays.
  assert.deepEqual(pickerAgents(AGENTS, users, activeRep.id).map((agent) => agent.name), ["Dana Reyes", "Marcus Bell"]);
  // Editing a rep whose own Agent went inactive keeps it (marked) so an unrelated edit doesn't force a change.
  const tinaRep: AdminUser = { ...activeRep, id: "000000000000000000a0000a", agent_id: AGENTS[2]!.id };
  assert.deepEqual(pickerAgents(AGENTS, [...users, tinaRep], tinaRep.id).map((agent) => agent.name), ["Dana Reyes", "Tina Cho"]);

  const out = html(createElement(LoginBlock, { agent: null, user: null, users, agents: AGENTS, initialDraft: { ...emptyDraft(), role: "rep" } }));
  assert.ok(out.includes(">Dana Reyes<") && !out.includes(">Marcus Bell<") && !out.includes(">Tina Cho<"));
  assert.ok(out.includes(PEOPLE_COPY.loginSheet.agentHint));
  const none = html(createElement(LoginBlock, { agent: null, user: null, users, agents: AGENTS.slice(1), initialDraft: { ...emptyDraft(), role: "rep" } }));
  assert.ok(none.includes(PEOPLE_COPY.loginSheet.noAgentsFree));
});

fixtureTest("each refusal fixture maps to its sentence (and *__as-admin to forbidden)", () => {
  const cases: Array<[string, string]> = [
    ["create__rep-agent-taken", "agent_taken"],
    ["create__rep-agent-inactive", "agent_inactive"],
    ["create__rep-without-agent", "agent_required"],
    ["create__email-taken", "email_taken"],
    ["create__weak-password", "invalid_input"],
    ["deactivate__last-owner", "last_owner"],
    ["update__last-owner-demote", "last_owner"],
    ["update__unknown-user", "not_found"],
    ["invite__inactive-user", "user_inactive"],
    ["list__as-admin", "forbidden"],
    ["create__as-admin", "forbidden"],
    ["update__as-admin", "forbidden"],
    ["set-password__as-admin", "forbidden"],
    ["deactivate__as-admin", "forbidden"],
    ["invite__as-admin", "forbidden"],
  ];
  for (const [name, code] of cases) {
    const error = refusal(name);
    assert.equal(error.code, code, name);
    assert.equal(errorSentence(error.code), u.errors[code], name);
    assert.ok(u.errors[code], `a sentence exists for ${code}`);
  }
  assert.equal(errorSentence("something_new"), u.errors.generic);
  // The weak-password refusal marks the password field through issues[].
  assert.equal(refusalState(refusal("create__weak-password")).fields.password, u.fieldErrors.password);
  // agent_taken marks the Agent field as well as printing the sentence.
  assert.equal(refusalState(refusal("create__rep-agent-taken")).fields.agent, u.errors.agent_taken);
});

fixtureTest("A12: agent_taken shows its sentence in the Add dialog; A14: last_owner shows its sentence in Deactivate", () => {
  const add = html(createElement(LoginBlock, {
    agent: null, user: null, users: listed, agents: AGENTS,
    initialDraft: { ...emptyDraft(), email: "second.dana@example.invalid", role: "rep", agentId: DANA_AGENT },
    initialError: refusal("create__rep-agent-taken"),
  }));
  assert.ok(add.includes(`role="alert">${u.errors.agent_taken}<`));
  assert.ok(add.includes('aria-invalid="true"'));
  const owner = listed[0]!;
  const deactivate = html(createElement(DeactivateLogin, { user: owner, onFlash: noop, initialError: refusal("deactivate__last-owner") }));
  assert.ok(deactivate.includes(u.deactivate.title(owner.email)));
  // Reason: the body now says "reactivate them here" (the login sheet's own Active box), not "in Edit".
  assert.ok(deactivate.includes(PEOPLE_COPY.loginSheet.deactivateBody));
  assert.ok(deactivate.includes(u.errors.last_owner!));
  const setPw = html(createElement(PasswordAndInvite, { user: owner, onFlash: noop, onInvite: noop }));
  assert.ok(setPw.includes(u.setPassword.body) && setPw.includes(u.form.passwordPolicy));
});

fixtureTest("A13: invite__rep-not-emailed.json → the link, Copy link and Not emailed: no mail sender is set up.", () => {
  const { status, body } = fixture("invite__rep-not-emailed");
  const result = parseUsersBody(status, body, inviteResultSchema);
  const out = html(createElement(InviteResultView, { email: "dana@example.invalid", result }));
  assert.ok(out.includes(`value="${result.link}"`) && out.includes('readOnly=""'), "the link in a read-only field");
  assert.ok(out.includes(`${u.inviteResult.copy}</button>`), "Copy link");
  assert.ok(out.includes("Not emailed: no mail sender is set up. Copy the link and send it yourself."));
  const exact = formatExactFull(result.expires_at);
  assert.ok(out.includes(`aria-label="${exact}"`), "expiry is a <time> with the exact ET label");
});

test("a sent invite prints Invite emailed to {email}. It expires {ET time}. and no link", () => {
  const expires = "2026-09-27T15:03:00.000Z";
  const out = html(createElement(InviteResultView, { email: "rep@example.invalid", result: { emailed: true, delivery: "sent", expires_at: expires } }));
  const exact = formatExactFull(expires);
  assert.ok(out.includes(`Invite emailed to rep@example.invalid. It expires <time`));
  assert.ok(out.includes(`>${exact}</time>.`));
  assert.ok(!out.includes("accept-invite") && !out.includes(u.inviteResult.copy));
});

test("failed and unreachable deliveries show their own reason", () => {
  for (const delivery of ["failed", "unreachable"]) {
    const out = html(createElement(InviteResultView, { email: "a@example.invalid", result: { emailed: false, delivery, expires_at: "2026-09-27T15:03:00.000Z", link: "https://x.invalid/accept-invite#token=<redacted>" } }));
    assert.ok(out.includes(u.inviteResult.notEmailed(u.inviteResult.reason[delivery]!)), delivery);
  }
});

test("password policy: 10 characters to 72 bytes; 60 two-byte characters are refused", () => {
  assert.equal(passwordOk("123456789"), false);
  assert.equal(passwordOk("1234567890"), true);
  const twoByte = "é".repeat(60);
  assert.equal(twoByte.length, 60);
  assert.equal(passwordBytes(twoByte), 120);
  assert.equal(passwordOk(twoByte), false);
  assert.equal(passwordOk("é".repeat(36)), true, "exactly 72 bytes");
  assert.equal(passwordOk("a".repeat(73)), false);
});

test("client checks: a valid email, a rep needs an Agent, Add with a password needs the policy", () => {
  assert.deepEqual(validateDraft({ ...emptyDraft(), email: "bad", role: "rep" }, "add"), { email: u.fieldErrors.email, agent: u.fieldErrors.agent });
  assert.deepEqual(validateDraft({ ...emptyDraft(), email: "a@b.co", role: "admin", access: "password", password: "short" }, "add"), { password: u.fieldErrors.password });
  assert.deepEqual(validateDraft({ ...emptyDraft(), email: "a@b.co", role: "admin", access: "invite" }, "add"), {});
  assert.deepEqual(validateDraft({ ...emptyDraft(), email: "a@b.co", role: "admin", password: "" }, "edit"), {});
});

fixtureTest("Edit sends only changed fields; leaving rep never sends an Agent", () => {
  const dana = listed[1]!;
  assert.deepEqual(updateBody(dana, { email: "dana@example.invalid", role: "rep", agentId: DANA_AGENT, active: true, access: "password", password: "" }), { active: true });
  assert.deepEqual(updateBody(dana, { email: "Dana2@Example.invalid", role: "admin", agentId: DANA_AGENT, active: false, access: "password", password: "" }), { email: "dana2@example.invalid", role: "admin" });
});

test("row actions: an active user has all four; a deactivated one Edit and Set password", () => {
  const base = { id: "x", email: "x@example.invalid", role: "rep", agent_id: null, created_at: "", updated_at: "", last_login_at: null, password_changed_at: "", last_invite: null };
  assert.deepEqual(rowActions({ ...base, active: true }), ["edit", "setPassword", "deactivate", "invite"]);
  assert.deepEqual(rowActions({ ...base, active: false }), ["edit", "setPassword"]);
});

// Reason: the users table, its load error and its empty state are gone with the Users tab; the person card's reads say "not loaded" instead (tests/setup-people.test.ts).

test("People & access is one Setup section: every dashboard role sees it, the login lines are Owner-only (doc 19)", () => {
  // The Owner-only Users tab became the Dashboard login line of the person card; Admin opens the section and reads the roster.
  assert.ok(setupSectionsFor("owner").some((section) => section.key === "people"));
  assert.ok(setupSectionsFor("admin").some((section) => section.key === "people"));
  assert.equal(canOpenSetupSection("admin", "people"), true);
  assert.equal(canOpenSetupSection(null, "people"), true);
});

test("an older list response without last_invite parses as null; a list response never needs a token", () => {
  const parsed = usersListSchema.parse({ users: [{ id: "a", email: "a@b.co", role: "admin", agent_id: null, active: true, created_at: "", updated_at: "", last_login_at: null, password_changed_at: "" }] });
  assert.equal(parsed.users[0]!.last_invite, null);
});
