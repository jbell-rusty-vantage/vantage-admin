import "@/components/setup/setup.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

export default async function AutomationsLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/leads");

  return children;
}
