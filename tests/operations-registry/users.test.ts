import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InviteResultView } from "../../components/operations-registry/users/invite-result";
import { DeactivateDialog, SetPasswordDialog } from "../../components/operations-registry/users/user-dialogs";
import { refusalState, UserFormDialog } from "../../components/operations-registry/users/user-form-dialog";
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
  updateBody,
  validateDraft,
  type AgentOption,
} from "../../components/operations-registry/users/users-logic";
import { InviteCell, rowActions, UsersTableView } from "../../components/operations-registry/users/users-table";
import { UsersLoadError } from "../../components/operations-registry/users/users-tab";
import { parseRegistryTab, registryTabsFor, REGISTRY_TABS } from "../../components/operations-registry/registry-tabs";
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

fixtureTest("list__after.json parses (no last_invite → null) and the table prints role words, Deactivated, Agent names and No invite", () => {
  assert.equal(listed.length, 3);
  assert.ok(listed.every((user) => user.last_invite === null));
  const out = html(createElement(UsersTableView, { users: listed, agents: AGENTS, onAction: noop }));
  for (const word of ["owner@example.invalid", "dana@example.invalid", "office@example.invalid", "Owner", "Rep", "Admin"]) {
    assert.ok(out.includes(`>${word}<`), word);
  }
  assert.ok(out.includes(`>${u.inactive}<`), "Deactivated");
  assert.equal(out.split(`>${u.active}<`).length - 1, 2, "two Active users");
  assert.ok(out.includes(">Dana Reyes<"), "Agent name resolved from the Agent list");
  assert.equal(out.split(`>${u.invite.none}<`).length - 1, 3, "invite column: No invite");
  for (const column of Object.values(u.columns)) assert.ok(out.includes(`>${column}<`), `column ${column}`);
  // A deactivated user offers Edit and Set password only.
  const danaRow = out.slice(out.indexOf('data-user="000000000000000000a00001"'), out.indexOf('data-user="000000000000000000a00002"'));
  assert.ok(!danaRow.includes(`>${u.actions.deactivate}<`) && !danaRow.includes(`>${u.actions.invite}<`));
  assert.ok(danaRow.includes(`>${u.actions.setPassword}<`) && danaRow.includes(`>${u.actions.more}`));
});

fixtureTest("an unknown agent_id prints Agent not found; no Agent prints —; an inactive Agent is marked", () => {
  const rep = { ...listed[1]!, agent_id: "6ab5ab0d72ee2eb383d94000" };
  const out = html(createElement(UsersTableView, { users: [rep], agents: AGENTS, onAction: noop }));
  assert.ok(out.includes(`>${u.unknownAgent}<`));
  assert.equal(agentLabel(null, AGENTS), u.noAgent);
  assert.equal(agentLabel("6ab5ab0d72ee2eb383d940a9", AGENTS), u.agentInactive("Tina Cho"));
  assert.equal(agentLabel(DANA_AGENT, null), DANA_AGENT, "Agent list not loaded: the id, not a wrong sentence");
});

test("the invite column prints each last_invite state; pending carries the exact ET expiry on a <time>", () => {
  const t = "2026-09-27T15:03:00.000Z";
  const pending = html(createElement(InviteCell, { invite: { state: "pending", created_at: t, expires_at: t } }));
  const exact = formatExactFull(t);
  assert.ok(pending.includes("Invite expires "));
  assert.ok(pending.includes(`title="${exact}"`) && pending.includes(`aria-label="${exact}"`));
  assert.ok(pending.includes(`>${exact}</time>`));
  assert.ok(html(createElement(InviteCell, { invite: { state: "accepted", created_at: t, expires_at: t } })).includes(u.invite.accepted));
  assert.ok(html(createElement(InviteCell, { invite: { state: "expired", created_at: t, expires_at: t } })).includes(u.invite.expired));
  assert.ok(html(createElement(InviteCell, { invite: { state: "revoked", created_at: t, expires_at: t } })).includes(u.invite.revoked));
  assert.ok(html(createElement(InviteCell, { invite: null })).includes(u.invite.none));
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

  const out = html(createElement(UserFormDialog, { mode: "add", inline: true, users, agents: AGENTS, onSubmit: async () => {}, onClose: noop, initialDraft: { ...emptyDraft(), role: "rep" } }));
  assert.ok(out.includes(">Dana Reyes<") && !out.includes(">Marcus Bell<") && !out.includes(">Tina Cho<"));
  assert.ok(out.includes(u.form.agentHint));
  const none = html(createElement(UserFormDialog, { mode: "add", inline: true, users, agents: AGENTS.slice(1), onSubmit: async () => {}, onClose: noop }));
  assert.ok(none.includes(u.form.noAgentsFree));
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
  const add = html(createElement(UserFormDialog, {
    mode: "add", inline: true, users: listed, agents: AGENTS, onSubmit: async () => {}, onClose: noop,
    initialDraft: { ...emptyDraft(), email: "second.dana@example.invalid", role: "rep", agentId: DANA_AGENT },
    initialError: refusal("create__rep-agent-taken"),
  }));
  assert.ok(add.includes(`role="alert">${u.errors.agent_taken}<`));
  assert.ok(add.includes('aria-invalid="true"'));
  const owner = listed[0]!;
  const deactivate = html(createElement(DeactivateDialog, { user: owner, inline: true, onConfirm: async () => {}, onClose: noop, initialError: refusal("deactivate__last-owner") }));
  assert.ok(deactivate.includes(u.deactivate.title(owner.email)));
  assert.ok(deactivate.includes(u.deactivate.body));
  assert.ok(deactivate.includes(u.errors.last_owner!));
  const setPw = html(createElement(SetPasswordDialog, { user: owner, inline: true, onSubmit: async () => {}, onClose: noop }));
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

test("load error prints Couldn't load users., the code and Try again", () => {
  const out = html(createElement(UsersLoadError, { code: "forbidden", onRetry: noop }));
  assert.ok(out.includes(u.loadError) && out.includes(">forbidden<") && out.includes(u.tryAgain));
  const empty = html(createElement(UsersTableView, { users: [], agents: [], onAction: noop }));
  assert.ok(empty.includes(u.empty));
});

test("the Users tab is listed, and ?tab=users honoured, for the Owner only", () => {
  assert.ok(registryTabsFor("owner").some((tab) => tab.id === "users"));
  assert.equal(registryTabsFor("owner").find((tab) => tab.id === "users")?.label, u.tab);
  assert.ok(!registryTabsFor("admin").some((tab) => tab.id === "users"));
  assert.ok(!registryTabsFor(null).some((tab) => tab.id === "users"));
  assert.ok(!REGISTRY_TABS.some((tab) => (tab.id as string) === "users"));
  assert.equal(parseRegistryTab("users", "owner"), "users");
  assert.equal(parseRegistryTab("users", "admin"), "overview");
  assert.equal(parseRegistryTab("users", null), "overview");
  assert.equal(parseRegistryTab("users"), "overview");
});

test("an older list response without last_invite parses as null; a list response never needs a token", () => {
  const parsed = usersListSchema.parse({ users: [{ id: "a", email: "a@b.co", role: "admin", agent_id: null, active: true, created_at: "", updated_at: "", last_login_at: null, password_changed_at: "" }] });
  assert.equal(parsed.users[0]!.last_invite, null);
});
