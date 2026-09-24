import { handleAdminUsersOperation, readJsonBodyOrUndefined } from "@/server/users/http";
import { defaultUsersDeps, resolveSessionActor } from "@/server/users/wiring";

/** Owner-only: list Admin users (S8-USERS). */
export async function GET() {
  return handleAdminUsersOperation(await resolveSessionActor(), { kind: "list" }, defaultUsersDeps());
}

/** Owner-only: create an Admin user with email, password, role, agent_id and active. */
export async function POST(request: Request) {
  const actor = await resolveSessionActor();
  const body = await readJsonBodyOrUndefined(request);
  return handleAdminUsersOperation(actor, { kind: "create", body }, defaultUsersDeps());
}
