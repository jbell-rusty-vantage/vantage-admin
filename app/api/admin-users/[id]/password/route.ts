import { handleAdminUsersOperation, readJsonBodyOrUndefined } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

type Context = { params: Promise<{ id: string }> };

/** Owner-only: set a new password (bcrypt). Ends the user's existing sessions. */
export async function POST(request: Request, { params }: Context) {
  const actor = await resolveSessionActor();
  const { id } = await params;
  const body = await readJsonBodyOrUndefined(request);
  return handleAdminUsersOperation(actor, { kind: "set_password", id, body }, defaultUsersDeps());
}
