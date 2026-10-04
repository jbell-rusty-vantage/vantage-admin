import { cookies } from "next/headers";
import { getAccessTokenCookie, getSessionUserFromAccessToken, verifyAccessToken } from "@/server/auth";

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

/**
 * The route loading skeleton's shape, from the access token alone (no database read), because `loading.tsx` streams
 * before `routeViewer()` finishes. Only a verified Owner token gets the Owner desk frame (title, Numbers and
 * RingCentral Accounts tabs); a Rep, an Admin, or a missing or bad token gets the neutral skeleton, so nobody but the
 * Owner ever sees the Owner tab bar flash before their own page (or redirect).
 */
export function skeletonRoleFromToken(token: string | null | undefined): "owner" | "neutral" {
  if (!token) return "neutral";
  try {
    return verifyAccessToken(token).role === "owner" ? "owner" : "neutral";
  } catch {
    return "neutral";
  }
}

export async function skeletonRole(): Promise<"owner" | "neutral"> {
  return skeletonRoleFromToken(getAccessTokenCookie(await cookies()));
}
