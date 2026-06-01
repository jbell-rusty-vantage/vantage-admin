import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/lib/query/client";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);

  if (!accessToken) {
    redirect("/login");
  }

  const admin = await getAdminFromAccessToken(accessToken);
  if (!admin) {
    redirect("/login");
  }

  return (
    <QueryProvider>
      <DashboardShell adminEmail={admin.email}>{children}</DashboardShell>
    </QueryProvider>
  );
}
