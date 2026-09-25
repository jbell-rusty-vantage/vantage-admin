import { z } from "zod";

/**
 * UI2-USERS: the browser client for the Owner-only `app/api/admin-users/**` routes and the public
 * `app/api/auth/accept-invite` route (S8-USERS). Schemas are lenient on enums, strict on shape; a list
 * response from before `last_invite` existed parses with `last_invite: null`.
 *
 * Nothing here logs a request or response body: a body can carry a password or an invite link.
 */

export const lastInviteSchema = z.object({
  state: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  agent_id: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable(),
  password_changed_at: z.string(),
  last_invite: lastInviteSchema.nullable().optional().transform((value) => value ?? null),
});

export const usersListSchema = z.object({ users: z.array(adminUserSchema) });
export const userEnvelopeSchema = z.object({ user: adminUserSchema });

export const inviteResultSchema = z.object({
  emailed: z.boolean(),
  delivery: z.string(),
  expires_at: z.string(),
  link: z.string().optional(),
});

export const acceptInviteResultSchema = z.object({ password_set: z.literal(true) });

export type AdminUser = z.infer<typeof adminUserSchema>;
export type LastInvite = z.infer<typeof lastInviteSchema>;
export type InviteResult = z.infer<typeof inviteResultSchema>;
export type UserIssue = { path: string; code: string };

/** A refusal from the users routes: `code` picks the sentence, `issues` mark the fields. */
export class UsersApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues: UserIssue[];
  constructor(code: string, status: number, issues: UserIssue[] = []) {
    super(code);
    this.name = "UsersApiError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

const envelope = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  code: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
});

/** Parses a `{ ok, data | code }` body with `schema`, or throws `UsersApiError` (never with the body in it). */
export function parseUsersBody<T>(status: number, body: unknown, schema: z.ZodType<T>): T {
  const parsed = envelope.safeParse(body);
  if (!parsed.success) throw new UsersApiError(status >= 500 ? "internal_error" : "bad_response", status);
  if (!parsed.data.ok) throw new UsersApiError(parsed.data.code ?? "internal_error", status, parsed.data.issues ?? []);
  const data = schema.safeParse(parsed.data.data);
  if (!data.success) throw new UsersApiError("bad_response", status);
  return data.data;
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: { method: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new UsersApiError("network_error", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return parseUsersBody(response.status, body, schema);
}

const userPath = (id: string, tail = "") => `/api/admin-users/${encodeURIComponent(id)}${tail}`;

export type CreateUserBody = { email: string; password: string; role: string; agent_id?: string | null; active?: boolean };
export type UpdateUserBody = { email?: string; role?: string; agent_id?: string | null; active?: boolean };

export const fetchAdminUsers = () => request("/api/admin-users", usersListSchema).then((data) => data.users);
export const createAdminUser = (body: CreateUserBody) =>
  request("/api/admin-users", userEnvelopeSchema, { method: "POST", body }).then((data) => data.user);
export const updateAdminUser = (id: string, body: UpdateUserBody) =>
  request(userPath(id), userEnvelopeSchema, { method: "PATCH", body }).then((data) => data.user);
export const setAdminUserPassword = (id: string, password: string) =>
  request(userPath(id, "/password"), userEnvelopeSchema, { method: "POST", body: { password } }).then((data) => data.user);
export const deactivateAdminUser = (id: string) =>
  request(userPath(id, "/deactivate"), userEnvelopeSchema, { method: "POST" }).then((data) => data.user);
export const sendAdminUserInvite = (id: string) => request(userPath(id, "/invite"), inviteResultSchema, { method: "POST" });
export const acceptAdminInvite = (token: string, password: string) =>
  request("/api/auth/accept-invite", acceptInviteResultSchema, { method: "POST", body: { token, password } });

/** Query key: under `operations-registry`, so `invalidateRegistryQueries` refreshes it with the rest of the Registry. */
export const usersQueryKey = ["operations-registry", "admin-users"] as const;
