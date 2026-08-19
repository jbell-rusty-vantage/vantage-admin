import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GranotNavigation } from "@/components/granot-lifecycle/granot-navigation";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

export default async function GranotLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/ingestion");

  return (
    <div className="space-y-5">
      <GranotNavigation />
      {children}
    </div>
  );
}

