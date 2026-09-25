import type { AdminUser, InviteResult } from "@/components/operations-registry/users/users-api";
import { UsersApiError } from "@/components/operations-registry/users/users-api";
import type { AgentOption } from "@/components/operations-registry/users/users-logic";

/*
 * UI2-USERS gallery fixtures. The users are `contracts/S8/admin-users/list__after.json` (owner, deactivated
 * rep, admin) with `last_invite` added the way the new list read returns it, plus one active rep with a
 * pending invite. Agent names are the seed manifest's; the ids are the fixture's. The invite result is
 * `invite__rep-not-emailed.json` with its redacted link; nothing here is a real token.
 */

export const DANA_AGENT = "6ab58feab68087c1548aadf5";
export const MARCUS_AGENT = "6ab5ab0d72ee2eb383d940a8";
export const TINA_AGENT = "6ab5ab0d72ee2eb383d940a9";

export const GALLERY_AGENTS: AgentOption[] = [
  { id: DANA_AGENT, name: "Dana Reyes", active: true },
  { id: MARCUS_AGENT, name: "Marcus Bell", active: true },
  { id: TINA_AGENT, name: "Tina Cho", active: true },
  { id: "6ab5ab0d72ee2eb383d940b0", name: "Former Agent", active: false },
];

const T = "2026-09-24T15:00:00.000Z";

export const GALLERY_USERS: AdminUser[] = [
  { id: "0000000000000000000000a1", email: "owner@example.invalid", role: "owner", agent_id: null, active: true, created_at: T, updated_at: T, last_login_at: null, password_changed_at: T, last_invite: null },
  {
    id: "000000000000000000a00001", email: "dana@example.invalid", role: "rep", agent_id: DANA_AGENT, active: false,
    created_at: T, updated_at: "2026-09-27T15:04:00.000Z", last_login_at: null, password_changed_at: "2026-09-24T15:04:00.000Z",
    last_invite: { state: "revoked", created_at: "2026-09-24T15:03:00.000Z", expires_at: "2026-09-27T15:03:00.000Z" },
  },
  { id: "000000000000000000a00002", email: "office@example.invalid", role: "admin", agent_id: null, active: true, created_at: T, updated_at: T, last_login_at: null, password_changed_at: T, last_invite: null },
  {
    id: "000000000000000000a00003", email: "marcus@example.invalid", role: "rep", agent_id: MARCUS_AGENT, active: true,
    created_at: T, updated_at: T, last_login_at: null, password_changed_at: T,
    last_invite: { state: "pending", created_at: "2026-09-24T15:03:00.000Z", expires_at: "2026-09-27T15:03:00.000Z" },
  },
  {
    id: "000000000000000000a00004", email: "tina@example.invalid", role: "rep", agent_id: "6ab5ab0d72ee2eb383d940ff", active: true,
    created_at: T, updated_at: T, last_login_at: null, password_changed_at: T,
    last_invite: { state: "accepted", created_at: "2026-09-24T15:03:00.000Z", expires_at: "2026-09-27T15:03:00.000Z" },
  },
];

export const INVITE_NOT_EMAILED: InviteResult = {
  emailed: false,
  delivery: "not_configured",
  expires_at: "2026-09-27T15:03:00.000Z",
  link: "https://admin.example.invalid/accept-invite#token=<redacted>",
};

export const INVITE_SENT: InviteResult = { emailed: true, delivery: "sent", expires_at: "2026-09-27T15:03:00.000Z" };

export const AGENT_TAKEN = new UsersApiError("agent_taken", 409);
export const LAST_OWNER = new UsersApiError("last_owner", 409);
