import { cookies } from "next/headers";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";
import { isOutreachDeskRole } from "@/server/models/adminRoles";
import type { DeskViewer } from "@/components/outreach-desk/shell/desk-shell";

/** The signed-in desk viewer (Owner, Manager or Rep), or null for anyone else. Read from the session only. */
export async function deskViewer(): Promise<DeskViewer | null> {
  const token = getAccessTokenCookie(await cookies());
  const user = token ? await getSessionUserFromAccessToken(token) : null;
  if (!user || !isOutreachDeskRole(user.role)) return null;
  return { role: user.role, email: user.email, agentId: user.role === "rep" ? (user.agent_id ?? null) : null };
}
