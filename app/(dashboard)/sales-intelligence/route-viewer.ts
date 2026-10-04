import { cookies } from "next/headers";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";

/**
 * Who opened a Sales Intelligence route: `null` → `/login`; `admin` → `/` (Sales Intelligence isn't an Admin page);
 * `rep` → the interim not-available page; `owner` → the page. The role comes from the session, never from the URL.
 */
export async function routeViewer(): Promise<null | "admin" | "rep" | "owner"> {
  const token = getAccessTokenCookie(await cookies());
  const user = token ? await getSessionUserFromAccessToken(token) : null;
  if (!user) return null;
  if (user.role === "owner" || user.role === "rep") return user.role;
  return "admin";
}
