import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";
import { OutreachRouteSkeleton } from "@/components/sales-intelligence/outreach";
import { OutreachClient } from "./outreach-client";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** UI-1 §5: the Outreach route (`Analysis · Timeline · Work`). Owner only until UI-2 opens it to reps. */
export default async function OutreachRoutePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = getAccessTokenCookie(await cookies());
  const admin = token ? await getAdminFromAccessToken(token) : null;
  if (!admin) redirect("/login");
  if (admin.role !== "owner") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  return (
    <Suspense fallback={<OutreachRouteSkeleton />}>
      <OutreachClient id={id} tab={one(sp.tab)} run={one(sp.run)} siReturn={one(sp.si_return)} />
    </Suspense>
  );
}
