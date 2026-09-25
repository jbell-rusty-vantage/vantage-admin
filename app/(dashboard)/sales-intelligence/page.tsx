import { permanentRedirect, redirect } from "next/navigation";
import { Suspense } from "react";
import { DeskRouteSkeleton, deskRouteDecision } from "@/components/sales-intelligence/desk";
import { DeskClient } from "./desk-client";
import { LeadDeepLinkClient } from "./lead-deep-link-client";
import { routeViewer } from "./route-viewer";

/**
 * UI-1 §1: the Owner's Sales Intelligence desk. Old `outreach=&panel=` links redirect to the Outreach route; an old
 * Lead-only analysis link (`lead=&lead_model=&panel=`) resolves in the browser through `outreach/by-lead` (ADMIN-REBUILD trap 5).
 * UI2-SHELL (UI-2 §1–§2): a rep gets the same page under its forced scope, landing on My work. The Lead-only link needs the
 * Owner-only `outreach/by-lead` read, so a rep's desk ignores it.
 */
export default async function SalesIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await routeViewer();
  if (!session) redirect("/login");
  if (session === "admin") redirect("/");
  const role = session.viewer.role;
  const decision = deskRouteDecision(await searchParams);
  if (decision.kind === "redirect") permanentRedirect(decision.href);
  return (
    <Suspense fallback={<DeskRouteSkeleton role={role} />}>
      {decision.kind === "resolve-lead" && role === "owner" ? <LeadDeepLinkClient target={decision.target} /> : <DeskClient userId={session.id} viewer={session.viewer} />}
    </Suspense>
  );
}
