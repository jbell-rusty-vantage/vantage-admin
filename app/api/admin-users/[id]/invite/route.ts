import { handleAdminUsersOperation, inviteBaseUrl } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

type Context = { params: Promise<{ id: string }> };

/**
 * Owner-only: issue a single-use set-password invite (72 h) and email it via
 * the main server. When it can't be emailed the response carries the link for
 * the Owner to copy (`emailed: false`); the response is never logged.
 */
export async function POST(request: Request, { params }: Context) {
  const actor = await resolveSessionActor();
  const { id } = await params;
  return handleAdminUsersOperation(
    actor,
    { kind: "invite", id, baseUrl: inviteBaseUrl(request.url) },
    defaultUsersDeps(),
  );
}
