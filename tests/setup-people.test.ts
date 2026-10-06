import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminUser } from "../components/operations-registry/users/users-api";
import { UsersApiError } from "../components/operations-registry/users/users-api";
import { dependencyLabel } from "../components/setup/people/catalog-activation";
import { ExtensionBlock, extensionPatch } from "../components/setup/people/extension-block";
import { InviteResultView } from "../components/setup/people/invite-result";
import { DeactivateLogin, LoginBlock, PasswordAndInvite } from "../components/setup/people/login-block";
import { refusalState } from "../components/setup/people/login-errors";
import { NotMatchedSection } from "../components/setup/people/not-matched";
import { PEOPLE_COPY } from "../components/setup/people/people-copy";
import {
  accountReviewed,
  buildPeople,
  extensionUserFor,
  notMatchedCount,
  personMatches,
  type CatalogAgent,
  type ExtensionUser,
  type RingCentralAccount,
} from "../components/setup/people/people-model";
import { PeopleList } from "../components/setup/people/people-section";
import { PersonCard } from "../components/setup/people/person-card";
import { connectableAccounts, connectBody, connectError, RingCentralBlock } from "../components/setup/people/ringcentral-block";
import { RosterCreateBlock, RosterEditBlock, rosterUpdateBody } from "../components/setup/people/roster-block";
import { deskCopy } from "../components/outreach-desk/outreach-desk-copy";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";
import { SalesOutreachApiError } from "../lib/api/salesOutreach";

const html = (element: ReactElement) =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, element))
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const agent = (id: string, name: string, extra: Partial<CatalogAgent> = {}): CatalogAgent => ({
  id,
  name,
  normalized_name: name.toLowerCase(),
  active: true,
  created_from: "test",
  granot_crm_username: name.toUpperCase().slice(0, 6),
  ...extra,
});
const user = (id: string, email: string, role: string, agentId: string | null, extra: Partial<AdminUser> = {}): AdminUser => ({
  id,
  email,
  role,
  agent_id: agentId,
  active: true,
  created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z",
  last_login_at: null,
  password_changed_at: "2026-09-01T12:00:00.000Z",
  last_invite: null,
  ...extra,
});
const ext = (id: string, email: string, roles: ExtensionUser["roles"] = ["sales"]): ExtensionUser => ({ id, email, roles, active: true, created_at: "2026-09-01T12:00:00.000Z", last_login_at: null });
const account = (extensionId: string, number: string | null, extra: Partial<RingCentralAccount> = {}): RingCentralAccount => ({
  extension_id: extensionId,
  extension_number: number,
  name: `User ${number}`,
  direct_numbers: [],
  status: "Enabled",
  in_directory: true,
  agent: null,
  role: null,
  link_id: null,
  link_revision: null,
  suggestion: null,
  can_message: false,
  ...extra,
});

const AUSTIN = agent("a1", "Austin");
const DANA = agent("a2", "Dana");
const TINA = agent("a3", "Tina", { active: false });
const users = [
  user("u1", "austin@example.invalid", "rep", "a1", { last_login_at: "2026-10-01T15:00:00.000Z" }),
  user("u2", "dana@example.invalid", "rep", "a2"),
  user("u3", "owner@example.invalid", "owner", null),
];
const extUsers = [ext("e1", "Austin@Example.invalid", ["sales"]), ext("e2", "owner@example.invalid", ["owner"]), ext("e3", "stray@example.invalid", ["customer_service"])];
const accounts = [
  account("x1", "104", { agent: { id: "a1", name: "Austin" }, role: "sales_rep", link_id: "l1", link_revision: 3 }),
  account("x2", "200", { name: "Pat Lane", suggestion: { agent_id: "a2", agent_name: "Dana" } }),
  account("x3", "201", { role: "excluded" }),
  account("x4", "202", { in_directory: false }),
];
const full = () => buildPeople({ agents: [DANA, TINA, AUSTIN], users, extensionUsers: extUsers, accounts });

test("an Agent with all four parts joins by agent_id, email (case-insensitive) and agent.id", () => {
  const austin = full().people.find((person) => person.agent.id === "a1")!;
  assert.equal(austin.user?.id, "u1");
  assert.equal(austin.extensionUser?.id, "e1");
  assert.deepEqual(austin.accounts.map((item) => item.extension_id), ["x1"]);
});

test("a rep login without an extension has no extension user; active Agents come first", () => {
  const model = full();
  const dana = model.people.find((person) => person.agent.id === "a2")!;
  assert.equal(dana.user?.id, "u2");
  assert.equal(dana.extensionUser, null);
  assert.deepEqual(model.people.map((person) => person.agent.name), ["Austin", "Dana", "Tina"]);
});

test("an extension user with no email match, a login without an Agent and an unconnected account land under Not matched", () => {
  const { notMatched } = full();
  assert.deepEqual(notMatched.extensionUsers.map((item) => item.id), ["e3"]);
  assert.deepEqual(notMatched.users.map((item) => item.id), ["u3"]);
  // Excluded and not-in-directory accounts are not asked about; the owner's extension login matches the owner's email.
  assert.deepEqual(notMatched.accounts.map((item) => item.extension_id), ["x2"]);
  assert.equal(extensionUserFor(users[2]!, extUsers)?.id, "e2");
});

test("several accounts per Agent are allowed", () => {
  const two = [...accounts, account("x5", "105", { agent: { id: "a1", name: "Austin" }, role: "service" })];
  const austin = buildPeople({ agents: [AUSTIN], users, extensionUsers: extUsers, accounts: two }).people[0]!;
  assert.equal(austin.accounts.length, 2);
});

test("null inputs mean unknown: nothing lands under Not matched from them and the model says what is loaded", () => {
  const none = buildPeople({ agents: [AUSTIN, DANA], users: null, extensionUsers: null, accounts: null });
  assert.deepEqual(none.notMatched, { users: [], extensionUsers: [], accounts: [] });
  assert.deepEqual(none.loaded, { users: false, extensionUsers: false, accounts: false });
  assert.ok(none.people.every((person) => person.user === null && person.extensionUser === null && person.accounts.length === 0));
  assert.equal(notMatchedCount(none), 0);
  // Without the dashboard read an extension login cannot be judged, so it is not called unmatched.
  const half = buildPeople({ agents: [AUSTIN], users: null, extensionUsers: extUsers, accounts: null });
  assert.deepEqual(half.notMatched.extensionUsers, []);
});

test("the badge counts rep logins without a usable Agent, extension logins and accounts; an Owner login is listed but not counted", () => {
  assert.equal(notMatchedCount(full()), 2);
  const orphanRep = buildPeople({ agents: [AUSTIN], users: [user("u9", "ghost@example.invalid", "rep", "gone")], extensionUsers: [], accounts: [] });
  assert.equal(orphanRep.notMatched.users.length, 1);
  assert.equal(notMatchedCount(orphanRep), 1);
});

test("search matches name, email, Granot username and extension number", () => {
  const austin = full().people.find((person) => person.agent.id === "a1")!;
  for (const term of ["aust", "AUSTIN@EXAMPLE", austin.agent.granot_crm_username!.toLowerCase(), "104", ""]) assert.equal(personMatches(austin, term), true, term);
  assert.equal(personMatches(austin, "zzz"), false);
});

test("a RingCentral link is reviewed once it carries a role", () => {
  assert.equal(accountReviewed(accounts[0]!), true);
  assert.equal(accountReviewed(accounts[1]!), false);
});

test("the person card prints the four lines, the pills and the quiet Pay line, with no Owner-language leak", () => {
  const model = full();
  const out = html(createElement(PeopleList, { model, visible: model.people, readOnly: false, onEdit: () => {} }));
  assert.deepEqual(findOwnerMarkupLeaks(out), []);
  for (const text of ["Austin", "Sales rep", "Granot username AUSTIN", "austin@example.invalid", "ext 104", "reviewed", PEOPLE_COPY.pay, PEOPLE_COPY.dashboard.noLogin, PEOPLE_COPY.extension.none, PEOPLE_COPY.ringcentral.none, "Inactive"]) {
    assert.ok(out.includes(text), text);
  }
  assert.ok(out.includes("last sign-in"));
  assert.ok(out.includes("never signed in"));
  assert.equal(out.split('data-testid="person-card"').length - 1, 3);
});

test("a part whose read was not loaded says not loaded, never none", () => {
  const model = buildPeople({ agents: [AUSTIN], users: null, extensionUsers: null, accounts: null });
  const out = html(createElement(PersonCard, { person: model.people[0]!, loaded: model.loaded, readOnly: false, onEdit: () => {} }));
  assert.equal(out.split(PEOPLE_COPY.notLoaded).length - 1, 3);
  assert.ok(!out.includes(PEOPLE_COPY.dashboard.noLogin) && !out.includes(PEOPLE_COPY.ringcentral.none));
});

test("Admin and Manager see the head and the Roster line only, with no Edit", () => {
  const model = full();
  const out = html(createElement(PersonCard, { person: model.people[0]!, loaded: model.loaded, readOnly: true, onEdit: () => {} }));
  assert.ok(out.includes("Granot username"));
  assert.ok(!out.includes("austin@example.invalid") && !out.includes(PEOPLE_COPY.pay) && !out.includes(">Edit<"));
  assert.deepEqual(findOwnerMarkupLeaks(out), []);
});

test("Not matched to a person lists each kind, with a Connect to… picker where a command exists", () => {
  const model = full();
  const agents = model.people.map((person) => ({ id: person.agent.id, name: person.agent.name, active: person.agent.active }));
  const out = html(createElement(NotMatchedSection, { model, agents, users }));
  assert.deepEqual(findOwnerMarkupLeaks(out), []);
  assert.ok(out.includes("owner@example.invalid") && out.includes("stray@example.invalid") && out.includes("Pat Lane"));
  assert.ok(out.includes(PEOPLE_COPY.notMatched.noAgentRole("Owner")), "an Owner login has no Agent to connect");
  assert.ok(out.includes(PEOPLE_COPY.notMatched.extensionNote), "an extension login says it has no Agent field");
  assert.equal(out.split(`>${PEOPLE_COPY.notMatched.connectTo}<`).length - 1, 1, "one picker: the account (the Owner login and the extension login offer none)");
});

test("the sheets render without Owner-language leaks and keep their rules", () => {
  const model = full();
  const agents = model.people.map((person) => ({ id: person.agent.id, name: person.agent.name, active: person.agent.active }));
  const pieces: ReactElement[] = [
    createElement(RosterEditBlock, { agent: AUSTIN, onSaved: () => {} }),
    createElement(RosterCreateBlock, { onCreated: () => {} }),
    createElement(LoginBlock, { agent: agents[0]!, user: null, users, agents }),
    createElement(LoginBlock, { agent: agents[0]!, user: users[0]!, users, agents }),
    createElement(ExtensionBlock, { extensionUser: extUsers[0]!, defaultEmail: "" }),
    createElement(ExtensionBlock, { extensionUser: null, defaultEmail: "new@example.invalid" }),
    createElement(RingCentralBlock, { agent: agents[0]!, linked: [accounts[0]!], directory: accounts }),
  ];
  for (const piece of pieces) assert.deepEqual(findOwnerMarkupLeaks(html(piece)), []);
  const ext = html(pieces[4]!);
  assert.ok(ext.includes("hard delete"), "Remove says it is a hard delete before the confirm");
  assert.ok(ext.includes(PEOPLE_COPY.extensionSheet.passwordKeep));
  const create = html(pieces[5]!);
  for (const word of ["Owner", "Sales", "Customer Service"]) assert.ok(create.includes(word), word);
  assert.ok(create.includes("new@example.invalid"));
  const login = html(pieces[2]!);
  assert.ok(login.includes(PEOPLE_COPY.loginSheet.agentFixed), "from a card the Agent is fixed");
  for (const word of ["Owner", "Admin", "Manager", "Rep"]) assert.ok(login.includes(`>${word}<`), word);
});

test("login rules: refusals print their sentence, an unset invite sender is said in Owner words, last_owner shows on Deactivate", () => {
  const agents = [{ id: "a1", name: "Austin", active: true }];
  const taken = html(createElement(LoginBlock, { agent: null, user: null, users, agents, initialDraft: { email: "x@example.invalid", role: "rep", agentId: "a1", active: true, access: "invite", password: "" }, initialError: new UsersApiError("agent_taken", 409, [{ path: "agent_id", code: "taken" }]) }));
  assert.ok(taken.includes("That Agent is already linked to another active rep.") && taken.includes('aria-invalid="true"'));
  assert.equal(refusalState(new UsersApiError("not_configured", 503)).sentence, PEOPLE_COPY.loginSheet.inviteNotSetUp);
  assert.deepEqual(findOwnerMarkupLeaks(refusalState(new UsersApiError("not_configured", 503)).sentence), []);
  const deactivate = html(createElement(DeactivateLogin, { user: users[2]!, onFlash: () => {}, initialError: new UsersApiError("last_owner", 409) }));
  assert.ok(deactivate.includes("last active Owner"));
  const password = html(createElement(PasswordAndInvite, { user: users[0]!, onFlash: () => {}, onInvite: () => {} }));
  assert.ok(password.includes(PEOPLE_COPY.loginSheet.setPasswordBody) && password.includes(PEOPLE_COPY.loginSheet.passwordPolicy));
  const invite = html(createElement(InviteResultView, { email: "a@example.invalid", result: { emailed: false, delivery: "not_configured", expires_at: "2026-10-09T15:00:00.000Z", link: "https://x.invalid/accept-invite#token=redacted" } }));
  assert.ok(invite.includes("Copy link") && invite.includes("Not emailed"));
});

test("RingCentral: the write carries the revision the Owner read; a stale revision says the Desk's conflict words; the suggestion comes first", () => {
  assert.deepEqual(connectBody(accounts[0]!, "a1", "manager"), { agent_id: "a1", role: "manager", link_revision: 3 });
  assert.deepEqual(connectBody(accounts[1]!, "a2"), { agent_id: "a2" });
  assert.deepEqual(connectBody(accounts[0]!, null), { agent_id: null, link_revision: 3 });
  const stale = new SalesOutreachApiError(409, "REVISION_CONFLICT", "stale");
  assert.equal(connectError(stale), PEOPLE_COPY.ringcentralSheet.conflict);
  // Reason: the Desk's own sentence uses an em-dash, which Setup copy may not; the words are otherwise the same.
  assert.equal(PEOPLE_COPY.ringcentralSheet.conflict.replace(". Check", " — check"), deskCopy.accounts.conflict);
  assert.match(connectError(new SalesOutreachApiError(500, "X", "Boom")), /Boom/);
  const free = connectableAccounts([account("m1", "301", { name: "Zed" }), account("m2", "302", { name: "Amy", suggestion: { agent_id: "a2", agent_name: "Dana" } }), account("m3", "303", { agent: { id: "a1", name: "Austin" } })], "a2");
  assert.deepEqual(free.map((item) => item.extension_id), ["m2", "m1"]);
});

test("roster and extension writes send only what changed", () => {
  assert.equal(rosterUpdateBody(AUSTIN, { name: "Austin", granot: AUSTIN.granot_crm_username!, reason: "" }), null);
  assert.deepEqual(rosterUpdateBody(AUSTIN, { name: " Austin R ", granot: "austr", reason: " fix " }), { name: "Austin R", granot_crm_username: "AUSTR", reason: "fix" });
  assert.equal(extensionPatch(extUsers[0]!, { email: "austin@example.invalid", password: "", roles: ["sales"] }), null);
  assert.deepEqual(extensionPatch(extUsers[0]!, { email: "austin@example.invalid", password: "longenough", roles: ["sales", "owner"] }), { password: "longenough", roles: ["sales", "owner"] });
});

test("dependency keys are said in Owner words", () => {
  assert.equal(dependencyLabel("source_granularities"), "feeds");
  assert.equal(dependencyLabel("lead_cost_rows"), "lead cost rows");
  assert.deepEqual(findOwnerMarkupLeaks(dependencyLabel("source_granularity")), []);
});
