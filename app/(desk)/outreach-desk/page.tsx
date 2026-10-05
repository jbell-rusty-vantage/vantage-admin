import { redirect } from "next/navigation";
import { deskRouteDecision } from "@/components/outreach-desk/data/desk-url";
import { DeskClient } from "./desk-client";
import { deskViewer } from "./session";

/**
 * The Outreach Desk page: one canonical URL per frame (`?view=team|my|activity|settings|numbers|accounts`), redirecting
 * any other query (a foreign frame for the role, an unknown key, an old link) to it. The frame itself renders client
 * side: its reads go through the browser BFF (`/api/proxy`) and the live stream (`/api/outreach-desk-live`).
 */
export default async function OutreachDeskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await deskViewer();
  if (!viewer) redirect("/");
  const decision = deskRouteDecision(await searchParams, viewer.role);
  if (decision.kind === "redirect") redirect(decision.href);
  return <DeskClient viewer={viewer} view={decision.view} />;
}
