import { cookies } from "next/headers";
import { getAccessTokenCookie, getSessionUserFromAccessToken, verifyAccessToken } from "@/server/auth";
import { viewerFromSession, type Viewer } from "@/components/sales-intelligence/rep/viewer-session";

/**
 * UI2-SHELL (UI-2 §1): the Sales Intelligence routes open to the Owner and to a rep (the edge guard already limited a rep
 * to these two pages). `null` → `/login`; `admin` → `/` (unchanged: Sales Intelligence isn't an Admin page); otherwise the
 * session user and the viewer the client roots get. The role comes from the session, never from the URL.
 */
export async function routeViewer(): Promise<null | "admin" | { id: string; viewer: Viewer }> {
  const token = getAccessTokenCookie(await cookies());
  const user = token ? await getSessionUserFromAccessToken(token) : null;
  if (!user) return null;
  if (user.role !== "owner" && user.role !== "rep") return "admin";
  return { id: user.id, viewer: viewerFromSession(user) };
}

/** The route skeleton's role, from the access token alone (no database read). Owner when unknown. */
export async function skeletonRole(): Promise<"owner" | "rep"> {
  const token = getAccessTokenCookie(await cookies());
  if (!token) return "owner";
  try {
    return verifyAccessToken(token).role === "rep" ? "rep" : "owner";
  } catch {
    return "owner";
  }
}
