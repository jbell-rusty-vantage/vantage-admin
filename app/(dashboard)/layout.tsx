import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/lib/query/client";
import { DatabaseScopeProvider } from "@/lib/state/database-scope";
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
      <Suspense fallback={null}>
        <DatabaseScopeProvider>
          <DashboardShell adminEmail={admin.email} adminRole={admin.role}>
            {children}
          </DashboardShell>
        </DatabaseScopeProvider>
      </Suspense>
    </QueryProvider>
  );
}
