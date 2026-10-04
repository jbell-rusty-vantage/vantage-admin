import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DeskRouteSkeleton, siRouteDecision } from "@/components/sales-intelligence/desk";
import { RepUnavailable } from "@/components/sales-intelligence/rep-unavailable";
import { DeskClient } from "./desk-client";
import { routeViewer } from "./route-viewer";
import "@/components/sales-intelligence/styles/sales-intelligence.css";

/**
 * The interim Sales Intelligence page: Numbers (default) and RingCentral Accounts, Owner only. A Rep account gets the
 * truthful not-available page and no read. Any query that isn't the canonical Numbers/Accounts query (an old Outreach,
 * Attention, Closed, Overview, Coverage or Guide link, an `outreach=`/`lead=` deep link) redirects to Numbers.
 */
export default async function SalesIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await routeViewer();
  if (!viewer) redirect("/login");
  if (viewer === "admin") redirect("/");
  if (viewer === "rep") return <RepUnavailable />;
  const decision = siRouteDecision(await searchParams);
  if (decision.kind === "redirect") redirect(decision.href);
  return (
    <Suspense fallback={<DeskRouteSkeleton />}>
      <DeskClient />
    </Suspense>
  );
}
