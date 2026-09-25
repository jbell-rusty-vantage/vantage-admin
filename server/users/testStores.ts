import { UsersError, type AdminUserInviteRecord, type AdminUserInvitesStore, type AdminUserRecord, type AdminUsersStore } from "./types";

/**
 * In-memory stores with the same contract as the Mongo stores (unique email,
 * unique active-rep agent_id, atomic single-use consume). Used by the users
 * service tests; not wired into any route.
 */
export function createMemoryUsersStore(seed: AdminUserRecord[] = []): AdminUsersStore & { rows: AdminUserRecord[] } {
  const rows = seed.map((row) => ({ ...row }));
  let counter = 0;
  const nextId = () => (0xa00000 + (counter += 1)).toString(16).padStart(24, "0");
  const conflict = (candidate: AdminUserRecord) => {
    for (const row of rows) {
      if (row.id === candidate.id) continue;
      if (row.email === candidate.email) throw new UsersError("email_taken");
      if (
        candidate.role === "rep" && candidate.active && candidate.agent_id &&
        row.role === "rep" && row.active && row.agent_id === candidate.agent_id
      ) {
        throw new UsersError("agent_taken");
      }
    }
  };
  return {
    rows,
    async list() {
      return rows.map((row) => ({ ...row }));
    },
    async findById(id) {
      const row = rows.find((candidate) => candidate.id === id);
      return row ? { ...row } : null;
    },
    async findByEmail(email) {
      const row = rows.find((candidate) => candidate.email === email.trim().toLowerCase());
      return row ? { ...row } : null;
    },
    async findActiveRepByAgent(agentId) {
      const row = rows.find((candidate) => candidate.role === "rep" && candidate.active && candidate.agent_id === agentId);
      return row ? { ...row } : null;
    },
    async countActiveOwners() {
      return rows.filter((row) => row.role === "owner" && row.active).length;
    },
    async insert(user) {
      const record: AdminUserRecord = { ...user, id: nextId(), last_login_at: null };
      conflict(record);
      rows.push(record);
      return { ...record };
    },
    async update(id, change) {
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) return null;
      const current = rows[index]!;
      const expect = change.expect ?? {};
      if (Object.entries(expect).some(([key, value]) => current[key as keyof AdminUserRecord] !== value)) return null;
      const next: AdminUserRecord = {
        ...current,
        ...change.set,
        updated_at: change.now,
        token_version: current.token_version + (change.incrementTokenVersion ? 1 : 0),
      };
      conflict(next);
      rows[index] = next;
      return { ...next };
    },
  };
}

export function createMemoryInvitesStore(): AdminUserInvitesStore & { rows: AdminUserInviteRecord[] } {
  const rows: AdminUserInviteRecord[] = [];
  const usable = (row: AdminUserInviteRecord, now: Date) =>
    row.used_at === null && row.revoked_at === null && row.expires_at.getTime() > now.getTime();
  return {
    rows,
    async insert(invite) {
      if (rows.some((row) => row.token_sha256 === invite.token_sha256)) throw new Error("duplicate token");
      rows.push({ ...invite, id: `invite-${rows.length + 1}`, used_at: null, revoked_at: null });
    },
    async findUsable(tokenSha256, now) {
      const row = rows.find((candidate) => candidate.token_sha256 === tokenSha256 && usable(candidate, now));
      return row ? { ...row } : null;
    },
    async consume(tokenSha256, now) {
      const row = rows.find((candidate) => candidate.token_sha256 === tokenSha256 && usable(candidate, now));
      if (!row) return null;
      row.used_at = now;
      return { ...row };
    },
    async revokeOutstanding(userId, now) {
      let count = 0;
      for (const row of rows) {
        if (row.user_id === userId && row.used_at === null && row.revoked_at === null) {
          row.revoked_at = now;
          count += 1;
        }
      }
      return count;
    },
  };
}
