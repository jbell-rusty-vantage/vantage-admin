import { cookies } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";
import { DeskRouteSkeleton, deskRouteDecision } from "@/components/sales-intelligence/desk";
import { DeskClient } from "./desk-client";
import { LeadDeepLinkClient } from "./lead-deep-link-client";

/**
 * UI-1 §1: the Owner's Sales Intelligence desk. Old `outreach=&panel=` links redirect to the Outreach route; an old
 * Lead-only analysis link (`lead=&lead_model=&panel=`) resolves in the browser through `outreach/by-lead` (ADMIN-REBUILD trap 5).
 */
export default async function SalesIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = getAccessTokenCookie(await cookies());
  const admin = token ? await getAdminFromAccessToken(token) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");
  const decision = deskRouteDecision(await searchParams);
  if (decision.kind === "redirect") permanentRedirect(decision.href);
  return (
    <Suspense fallback={<DeskRouteSkeleton />}>
      {decision.kind === "resolve-lead" ? <LeadDeepLinkClient target={decision.target} /> : <DeskClient userId={admin.id} />}
    </Suspense>
  );
}
