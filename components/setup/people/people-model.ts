/**
 * People & access (doc 19 "One person, one card"): the pure client-side join of the four things the server keeps apart.
 * Roster (Agent) is the card's identity. A dashboard login joins by `agent_id` (reps); an extension login joins by an
 * email equal to that dashboard login's; a RingCentral account joins by `agent.id` (several per Agent are allowed).
 * A `null` input means the read was not allowed or failed: it is "unknown", never "none", so nothing from it is placed
 * under Not matched and the card says "not loaded" for that part. No React here, so node:test covers every rule.
 */
import type { AdminUser } from "@/components/operations-registry/users/users-api";
import type { Account } from "@/lib/api/allNumbers";
import type { AdminExtensionUser } from "@/lib/api/extensionUsers";
import type { RegistryCatalogItem } from "@/lib/api/registryAgents";

export type CatalogAgent = RegistryCatalogItem;
export type ExtensionUser = AdminExtensionUser;
export type RingCentralAccount = Account;

export type Person = {
  agent: CatalogAgent;
  user: AdminUser | null;
  extensionUser: ExtensionUser | null;
  accounts: RingCentralAccount[];
};

export type PeopleModel = {
  people: Person[];
  notMatched: { users: AdminUser[]; extensionUsers: ExtensionUser[]; accounts: RingCentralAccount[] };
  /** Which reads arrived. A part that is not loaded is unknown, not empty. */
  loaded: { users: boolean; extensionUsers: boolean; accounts: boolean };
};

export type PeopleInput = {
  agents: CatalogAgent[];
  users: AdminUser[] | null;
  extensionUsers: ExtensionUser[] | null;
  accounts: RingCentralAccount[] | null;
};

const emailKey = (email: string): string => email.trim().toLowerCase();

/** Active Agents first, then inactive, each by name. */
function orderedAgents(agents: CatalogAgent[]): CatalogAgent[] {
  return [...agents].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/** The login that stands for an Agent: the active one, else the newest. */
function loginOf(agent: CatalogAgent, users: AdminUser[]): AdminUser | null {
  const own = users.filter((user) => user.agent_id === agent.id);
  return own.find((user) => user.active) ?? [...own].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
}

export function buildPeople(input: PeopleInput): PeopleModel {
  const agentIds = new Set(input.agents.map((agent) => agent.id));
  const { users, extensionUsers, accounts } = input;

  const people = orderedAgents(input.agents).map((agent): Person => {
    const user = users ? loginOf(agent, users) : null;
    const extensionUser = user && extensionUsers ? (extensionUsers.find((item) => emailKey(item.email) === emailKey(user.email)) ?? null) : null;
    return { agent, user, extensionUser, accounts: (accounts ?? []).filter((account) => account.agent?.id === agent.id) };
  });

  const notMatchedUsers = users ? users.filter((user) => !user.agent_id || !agentIds.has(user.agent_id)) : [];
  const userEmails = new Set((users ?? []).map((user) => emailKey(user.email)));
  // Without the dashboard read an extension login cannot be judged either way, so it is not listed as unmatched.
  const notMatchedExtension = users && extensionUsers ? extensionUsers.filter((item) => !userEmails.has(emailKey(item.email))) : [];
  const notMatchedAccounts = accounts
    ? accounts.filter((account) => account.in_directory && account.role !== "excluded" && (!account.agent || !agentIds.has(account.agent.id)))
    : [];

  return {
    people,
    notMatched: { users: notMatchedUsers, extensionUsers: notMatchedExtension, accounts: notMatchedAccounts },
    loaded: { users: users !== null, extensionUsers: extensionUsers !== null, accounts: accounts !== null },
  };
}

/**
 * The sub-navigation badge: what needs the Owner's look. An Owner, Admin or Manager login never holds an Agent, so it
 * is listed under Not matched but is not counted; a rep login without a usable Agent, an unmatched extension login and
 * an unconnected RingCentral account are.
 */
export function notMatchedCount(model: PeopleModel): number {
  const { users, extensionUsers, accounts } = model.notMatched;
  return users.filter((user) => user.role === "rep").length + extensionUsers.length + accounts.length;
}

/** The extension login that shares a dashboard login's email, or null. */
export function extensionUserFor(user: AdminUser, extensionUsers: ExtensionUser[] | null): ExtensionUser | null {
  return extensionUsers?.find((item) => emailKey(item.email) === emailKey(user.email)) ?? null;
}

/** The search the section runs: name, email (dashboard and extension), Granot username and RingCentral extension number. */
export function personMatches(person: Person, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    person.agent.name,
    person.agent.granot_crm_username,
    person.user?.email,
    person.extensionUser?.email,
    ...person.accounts.flatMap((account) => [account.extension_number, account.name]),
  ];
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

/** A RingCentral link counts as reviewed once it carries a role: the Owner (or the server's suggestion they accepted) chose one. */
export function accountReviewed(account: RingCentralAccount): boolean {
  return Boolean(account.link_id && account.role);
}
