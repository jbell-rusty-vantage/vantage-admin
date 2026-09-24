import { handleAcceptInvite, readJsonBodyOrUndefined } from "@/server/users/http";
import { defaultUsersDeps } from "@/server/users/wiring";

/**
 * Public: `{ token, password }` from an invite link sets the password once.
 * Every token problem is the same generic 400, so nothing reveals whether a
 * token or an email exists.
 */
export async function POST(request: Request) {
  return handleAcceptInvite(await readJsonBodyOrUndefined(request), defaultUsersDeps());
}
