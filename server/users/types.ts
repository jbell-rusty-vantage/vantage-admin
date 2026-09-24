import type { AdminRole } from "@/server/models/adminRoles";

/** Stored AdminUser as the users service sees it (store-agnostic). */
export type AdminUserRecord = {
  id: string;
  email: string;
  role: AdminRole;
  agent_id: string | null;
  active: boolean;
  token_version: number;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  password_changed_at: Date;
};

/** What the Owner sees: never the hash or the token version. */
export type AdminUserView = {
  id: string;
  email: string;
  role: AdminRole;
  agent_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  password_changed_at: string;
};

export type NewAdminUser = Omit<AdminUserRecord, "id" | "last_login_at">;

export type AdminUserChange = {
  set: Partial<Pick<AdminUserRecord, "email" | "role" | "agent_id" | "active" | "password_hash" | "password_changed_at">>;
  incrementTokenVersion: boolean;
  now: Date;
};

export interface AdminUsersStore {
  list(): Promise<AdminUserRecord[]>;
  findById(id: string): Promise<AdminUserRecord | null>;
  findByEmail(email: string): Promise<AdminUserRecord | null>;
  findActiveRepByAgent(agentId: string): Promise<AdminUserRecord | null>;
  countActiveOwners(): Promise<number>;
  /** Throws `UsersError("email_taken" | "agent_taken")` on a unique-index conflict. */
  insert(user: NewAdminUser): Promise<AdminUserRecord>;
  /** Returns null when the user no longer exists. Same conflict errors as insert. */
  update(id: string, change: AdminUserChange): Promise<AdminUserRecord | null>;
}

export type AdminUserInviteRecord = {
  id: string;
  user_id: string;
  token_sha256: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_by: string;
  created_at: Date;
};

export interface AdminUserInvitesStore {
  insert(invite: Omit<AdminUserInviteRecord, "id" | "used_at" | "revoked_at">): Promise<void>;
  /** Unused, unrevoked and unexpired at `now`, else null. */
  findUsable(tokenSha256: string, now: Date): Promise<AdminUserInviteRecord | null>;
  /** Atomically marks a usable invite used; null when it was not usable (single use). */
  consume(tokenSha256: string, now: Date): Promise<AdminUserInviteRecord | null>;
  /** Revokes every unused invite of the user; returns how many. */
  revokeOutstanding(userId: string, now: Date): Promise<number>;
}

export type InviteDeliveryStatus = "sent" | "not_configured" | "failed" | "unreachable";

export interface InviteMailer {
  sendInvite(input: { actor: UsersActor; to: string; link: string; expiresAt: Date }): Promise<InviteDeliveryStatus>;
}

export interface AgentDirectory {
  /** True when the main-server Agent exists and is active. Throws `UsersError("agent_check_unavailable")` when it can't tell. */
  isActiveAgent(agentId: string, actor: UsersActor): Promise<boolean>;
}

export type UsersActor = { id: string; email: string; role: AdminRole };

export type UsersAuditEntry = {
  actor: { id?: string; email?: string };
  action: string;
  entity_id?: string;
  /** Allowlisted fields only (never a password, token or hash). */
  payload: Record<string, unknown>;
  ok: boolean;
  status: number;
  error_code?: string;
};

export type UsersDeps = {
  users: AdminUsersStore;
  invites: AdminUserInvitesStore;
  agents: AgentDirectory;
  mailer: InviteMailer;
  audit: (entry: UsersAuditEntry) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  now: () => Date;
  randomToken: () => string;
};

export const USERS_ERROR_STATUS = {
  invalid_input: 400,
  agent_required: 400,
  agent_not_allowed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  email_taken: 409,
  agent_taken: 409,
  last_owner: 409,
  user_inactive: 409,
  agent_inactive: 422,
  invite_invalid: 400,
  agent_check_unavailable: 503,
} as const;

export type UsersErrorCode = keyof typeof USERS_ERROR_STATUS;

export class UsersError extends Error {
  readonly code: UsersErrorCode;
  readonly status: number;
  readonly issues?: Array<{ path: string; code: string }>;

  constructor(code: UsersErrorCode, message?: string, issues?: Array<{ path: string; code: string }>) {
    super(message ?? code);
    this.name = "UsersError";
    this.code = code;
    this.status = USERS_ERROR_STATUS[code];
    this.issues = issues;
  }
}
