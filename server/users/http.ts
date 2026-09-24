import {
  acceptAdminUserInvite,
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  sendAdminUserInvite,
  setAdminUserPassword,
  updateAdminUser,
} from "./service";
import { UsersError, type UsersActor, type UsersDeps } from "./types";

/**
 * Transport for the Owner-only `app/api/admin-users/**` routes and the public
 * `app/api/auth/accept-invite` route. Route files resolve the session and the
 * body; business rules stay in `service.ts`. Responses are `no-store`, and no
 * handler logs a request body (it can carry a password or an invite link).
 */
export type AdminUsersOperation =
  | { kind: "list" }
  | { kind: "create"; body: unknown }
  | { kind: "update"; id: string; body: unknown }
  | { kind: "set_password"; id: string; body: unknown }
  | { kind: "deactivate"; id: string }
  | { kind: "invite"; id: string; baseUrl: string };

const NO_STORE = { "cache-control": "no-store" };

function ok(data: unknown, status = 200): Response {
  return Response.json({ ok: true, data }, { status, headers: NO_STORE });
}

export function usersErrorResponse(error: unknown): Response {
  if (error instanceof UsersError) {
    return Response.json(
      { ok: false, code: error.code, error: error.message, ...(error.issues?.length ? { issues: error.issues } : {}) },
      { status: error.status, headers: NO_STORE },
    );
  }
  console.error("admin_users.unexpected_error", error instanceof Error ? error.name : "unknown");
  return Response.json({ ok: false, code: "internal_error", error: "Something went wrong." }, { status: 500, headers: NO_STORE });
}

export async function handleAdminUsersOperation(
  actor: UsersActor | null,
  operation: AdminUsersOperation,
  deps: UsersDeps,
): Promise<Response> {
  try {
    // Session and role are checked before anything is read or parsed.
    if (!actor) throw new UsersError("unauthorized", "Sign in again.");
    if (actor.role !== "owner") throw new UsersError("forbidden", "Only the Owner manages users.");
    switch (operation.kind) {
      case "list":
        return ok({ users: await listAdminUsers(deps, actor) });
      case "create":
        return ok({ user: await createAdminUser(deps, actor, operation.body) }, 201);
      case "update":
        return ok({ user: await updateAdminUser(deps, actor, operation.id, operation.body) });
      case "set_password":
        return ok({ user: await setAdminUserPassword(deps, actor, operation.id, operation.body) });
      case "deactivate":
        return ok({ user: await deactivateAdminUser(deps, actor, operation.id) });
      case "invite":
        return ok(await sendAdminUserInvite(deps, actor, operation.id, { baseUrl: operation.baseUrl }));
    }
  } catch (error) {
    return usersErrorResponse(error);
  }
}

/** Public accept: one generic error for every token problem. */
export async function handleAcceptInvite(body: unknown, deps: UsersDeps): Promise<Response> {
  try {
    await acceptAdminUserInvite(deps, body);
    return ok({ password_set: true });
  } catch (error) {
    if (error instanceof UsersError && error.code === "invalid_input") {
      // Password policy only; the token shape is folded into invite_invalid.
      return usersErrorResponse(error);
    }
    if (error instanceof UsersError) {
      return usersErrorResponse(new UsersError("invite_invalid", "This link is invalid or has expired."));
    }
    return usersErrorResponse(error);
  }
}

/**
 * Invite link base: `ADMIN_PUBLIC_BASE_URL` when set (http/https origin),
 * otherwise the Owner's own request origin.
 */
export function inviteBaseUrl(requestUrl: string, configured = process.env.ADMIN_PUBLIC_BASE_URL): string {
  const trimmed = configured?.trim();
  if (trimmed) {
    try {
      const url = new URL(trimmed);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
      }
    } catch {
      // fall back to the request origin
    }
  }
  return new URL(requestUrl).origin;
}

/** Reads a JSON body; a missing or malformed body becomes `undefined` (then `invalid_input`). */
export async function readJsonBodyOrUndefined(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
