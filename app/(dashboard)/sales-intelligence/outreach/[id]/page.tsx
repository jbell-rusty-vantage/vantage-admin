import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OutreachRouteSkeleton } from "@/components/sales-intelligence/outreach";
import { routeViewer } from "../../route-viewer";
import { OutreachClient } from "./outreach-client";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** UI-1 §5: the Outreach route (`Analysis · Timeline · Work`). UI2-SHELL: open to a rep too; the server scopes it (404 outside). */
export default async function OutreachRoutePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await routeViewer();
  if (!session) redirect("/login");
  if (session === "admin") redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  return (
    <Suspense fallback={<OutreachRouteSkeleton />}>
      <OutreachClient id={id} tab={one(sp.tab)} run={one(sp.run)} siReturn={one(sp.si_return)} viewer={session.viewer} />
    </Suspense>
  );
}
