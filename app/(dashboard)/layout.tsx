import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/lib/query/client";
import { DatabaseScopeProvider } from "@/lib/state/database-scope";
import { RepFrame } from "@/components/sales-intelligence/rep/rep-frame";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";

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

  // UI2-SHELL (UI-2 §1): a rep is a real session. The edge guard (`applyRoleRouteGuard`) already sent a rep outside its
  // two Sales Intelligence pages to `/sales-intelligence`; here the rep gets its own frame, with no dashboard nav.
  const admin = await getSessionUserFromAccessToken(accessToken);
  if (!admin) {
    redirect("/login");
  }

  if (admin.role === "rep") {
    return (
      <QueryProvider>
        <RepFrame email={admin.email}>{children}</RepFrame>
      </QueryProvider>
    );
  }
  if (admin.role !== "owner" && admin.role !== "admin") {
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
