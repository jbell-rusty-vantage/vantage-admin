import { handleAdminUsersOperation, inviteBaseUrl } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

type Context = { params: Promise<{ id: string }> };

/**
 * Owner-only: issue a single-use set-password invite (72 h) and email it via
 * the main server. When it can't be emailed the response carries the link for
 * the Owner to copy (`emailed: false`); the response is never logged. The link's
 * origin comes only from ADMIN_PUBLIC_BASE_URL; unset, the invite is refused
 * (503 `not_configured`).
 */
export async function POST(_request: Request, { params }: Context) {
  const actor = await resolveSessionActor();
  const { id } = await params;
  return handleAdminUsersOperation(
    actor,
    { kind: "invite", id, baseUrl: inviteBaseUrl() },
    defaultUsersDeps(),
  );
}
