import "@/components/setup/setup.css";
import "@/components/automations/automations.css";
import "@/components/automations/granot-updates/granot-start.css";
import "@/components/automations/granot-updates/granot-check.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

/**
 * Automations (the Owner's tab for operations that read Granot and prepare updates; doc 17 is the first one). Owner
 * only: the route guard, the shell prefix and this layout all agree, so no other role renders anything under it.
 * Section stylesheets are imported here (a CSS import in a component breaks the node test runner).
 */
export default async function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/leads");

  return children;
}
