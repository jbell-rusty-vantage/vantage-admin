import { handleAdminUsersOperation, readJsonBodyOrUndefined } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

type Context = { params: Promise<{ id: string }> };

/** Owner-only: update email, role, agent_id and active. */
export async function PATCH(request: Request, { params }: Context) {
  const actor = await resolveSessionActor();
  const { id } = await params;
  const body = await readJsonBodyOrUndefined(request);
  return handleAdminUsersOperation(actor, { kind: "update", id, body }, defaultUsersDeps());
}
