import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import type { AdminUser, UserIssue } from "./users-api";

/**
 * UI2-USERS: the pure rules of the Users tab and the accept page. The client checks mirror the server
 * (`server/users/validation.ts`): a valid email, a rep needs an Agent, a password of 10 characters to
 * 72 UTF-8 bytes, an invite token of 43 base64url characters. The server stays the judge; these only
 * spare a round trip and mark the field.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;
/** 32 random bytes as base64url (`validation.ts` `inviteTokenSchema`). */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AgentOption = { id: string; name: string; active: boolean };
export type UserRole = "owner" | "admin" | "rep";
export const USER_ROLES: UserRole[] = ["owner", "admin", "rep"];

const u = copy.ui2.users;

export function passwordBytes(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** True when the password meets the policy: at least 10 characters and at most 72 bytes. */
export function passwordOk(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && passwordBytes(password) <= PASSWORD_MAX_BYTES;
}

export function emailOk(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export const roleWord = (role: string): string => u.role[role] ?? role;

/** The Agent cell: `—` for no Agent, the name (marked when inactive), or `Agent not found`. `agents: null` → the list isn't loaded. */
export function agentLabel(agentId: string | null, agents: AgentOption[] | null): string {
  if (!agentId) return u.noAgent;
  if (!agents) return agentId;
  const agent = agents.find((candidate) => candidate.id === agentId);
  if (!agent) return u.unknownAgent;
  return agent.active ? agent.name : u.agentInactive(agent.name);
}

/**
 * The Agent picker: active Agents not held by another **active** rep. When editing a rep, their own Agent
 * stays in the list (even if it has since gone inactive) so an unrelated edit doesn't force a change.
 */
export function pickerAgents(agents: AgentOption[], users: AdminUser[], editingUserId: string | null): AgentOption[] {
  const editing = editingUserId ? users.find((user) => user.id === editingUserId) : undefined;
  const ownAgentId = editing?.role === "rep" ? editing.agent_id : null;
  const held = new Set(
    users
      .filter((user) => user.role === "rep" && user.active && user.agent_id && user.id !== editingUserId)
      .map((user) => user.agent_id as string),
  );
  return agents
    .filter((agent) => agent.id === ownAgentId || (agent.active && !held.has(agent.id)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The sentence for a server refusal code; an unknown code gets the generic sentence. */
export function errorSentence(code: string): string {
  return u.errors[code] ?? u.errors.generic!;
}

export type FormField = "email" | "role" | "agent" | "password";
export type FieldErrors = Partial<Record<FormField, string>>;

const ISSUE_FIELD: Record<string, FormField> = { email: "email", role: "role", agent_id: "agent", password: "password" };

/** Server `issues[]` → the fields to mark (field paths only; values are never echoed). */
export function issueFieldErrors(issues: UserIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const field = ISSUE_FIELD[issue.path.split(".")[0] ?? ""];
    if (field && !out[field]) out[field] = u.fieldErrors[field] ?? u.errors.invalid_input;
  }
  return out;
}

/** The field a refusal code belongs to (so the dialog marks it as well as printing the sentence). */
export function codeField(code: string): FormField | null {
  if (code === "email_taken") return "email";
  if (code === "agent_required" || code === "agent_taken" || code === "agent_inactive" || code === "agent_not_allowed") return "agent";
  return null;
}

export type UserDraft = {
  email: string;
  role: UserRole;
  agentId: string;
  active: boolean;
  access: "password" | "invite";
  password: string;
};

export function emptyDraft(): UserDraft {
  return { email: "", role: "rep", agentId: "", active: true, access: "invite", password: "" };
}

export function draftFromUser(user: AdminUser): UserDraft {
  const role = (USER_ROLES as string[]).includes(user.role) ? (user.role as UserRole) : "admin";
  return { email: user.email, role, agentId: user.agent_id ?? "", active: user.active, access: "password", password: "" };
}

/** Client checks before the request. `mode: "edit"` has no password. */
export function validateDraft(draft: UserDraft, mode: "add" | "edit"): FieldErrors {
  const out: FieldErrors = {};
  if (!emailOk(draft.email)) out.email = u.fieldErrors.email;
  if (draft.role === "rep" && !draft.agentId) out.agent = u.fieldErrors.agent;
  if (mode === "add" && draft.access === "password" && !passwordOk(draft.password)) out.password = u.fieldErrors.password;
  return out;
}

/** The PATCH body for Edit: only the fields that changed; leaving `rep` never sends an Agent. */
export function updateBody(user: AdminUser, draft: UserDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const email = draft.email.trim().toLowerCase();
  if (email !== user.email) body.email = email;
  if (draft.role !== user.role) body.role = draft.role;
  if (draft.role === "rep" && draft.agentId !== (user.agent_id ?? "")) body.agent_id = draft.agentId;
  if (draft.active !== user.active) body.active = draft.active;
  return body;
}

/**
 * Add-with-invite: the create route requires a password, so the user is created with a random one nobody
 * sees (32 random bytes, base64url: 43 characters, well under 72 bytes); the invite then lets them set theirs.
 */
export function unseenPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The token from `location.hash` (`#token=…`), or null when it is missing or not the token's shape. */
export function readInviteToken(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const token = new URLSearchParams(raw).get("token");
  return token && INVITE_TOKEN_PATTERN.test(token) ? token : null;
}

export type AcceptProblem = "weak" | "mismatch" | null;

/** Accept page client check: the policy first, then the two fields must match. */
export function acceptProblem(password: string, confirm: string): AcceptProblem {
  if (!passwordOk(password)) return "weak";
  if (password !== confirm) return "mismatch";
  return null;
}

/** Accept page: a refusal code → the page state it shows. */
export function acceptOutcome(code: string): "invalid" | "weak" | "generic" {
  if (code === "invite_invalid") return "invalid";
  if (code === "invalid_input") return "weak";
  return "generic";
}
