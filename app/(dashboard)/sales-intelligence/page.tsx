import { cookies } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";
import { DeskRouteSkeleton, legacyDeepLinkRedirect } from "@/components/sales-intelligence/desk";
import { DeskClient } from "./desk-client";

/** UI-1 §1: the Owner's Sales Intelligence desk. Old `outreach=&panel=` links redirect to the Outreach route (ADMIN-REBUILD trap 5). */
export default async function SalesIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = getAccessTokenCookie(await cookies());
  const admin = token ? await getAdminFromAccessToken(token) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");
  const target = legacyDeepLinkRedirect(await searchParams);
  if (target) permanentRedirect(target);
  return (
    <Suspense fallback={<DeskRouteSkeleton />}>
      <DeskClient userId={admin.id} />
    </Suspense>
  );
}
