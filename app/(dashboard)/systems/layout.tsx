import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

/**
 * Systems (doc 11b): where every property lives and how much room is left. Owner only: the route guard, the shell
 * prefix and this layout all agree, so no other role renders anything under it.
 */
export default async function SystemsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/leads");

  return children;
}
