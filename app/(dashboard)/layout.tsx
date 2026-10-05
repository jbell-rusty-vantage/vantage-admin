import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { QueryProvider } from "@/lib/query/client";
import { RetiredDatabaseScopeCleanup } from "@/lib/state/database-scope";
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

  // A rep is a real session whose only page is the Outreach Desk, which has its own "Lead outreach" shell outside
  // this layout (ADM-1). The edge guard (`applyRoleRouteGuard`) already sends a rep or a manager elsewhere; this is
  // the same answer for a request that slipped past it. A manager renders the dashboard shell for Daily Operations.
  const admin = await getSessionUserFromAccessToken(accessToken);
  if (!admin) {
    redirect("/login");
  }

  if (admin.role === "rep") {
    redirect("/outreach-desk");
  }
  if (admin.role !== "owner" && admin.role !== "admin" && admin.role !== "manager") {
    redirect("/login");
  }

  return (
    <QueryProvider>
      <Suspense fallback={null}>
        <RetiredDatabaseScopeCleanup />
        <DashboardShell adminEmail={admin.email} adminRole={admin.role}>
          {children}
        </DashboardShell>
      </Suspense>
    </QueryProvider>
  );
}
