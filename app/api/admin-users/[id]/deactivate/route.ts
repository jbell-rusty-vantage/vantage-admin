import { handleAdminUsersOperation } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

type Context = { params: Promise<{ id: string }> };

/** Owner-only: deactivate a user. Ends their sessions; the last active Owner is refused. */
export async function POST(_request: Request, { params }: Context) {
  const actor = await resolveSessionActor();
  const { id } = await params;
  return handleAdminUsersOperation(actor, { kind: "deactivate", id }, defaultUsersDeps());
}
