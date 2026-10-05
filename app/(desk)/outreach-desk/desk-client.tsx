"use client";
/**
 * The desk frame inside the "Lead outreach" shell. Numbers and RingCentral Accounts are today's Sales Intelligence
 * components, mounted client-only as before (their `useSuspenseQuery` reads would otherwise run during the server
 * render against the browser-relative proxy URL). A Rep's name in the sidebar comes from its own rep-day read.
 */
import dynamic from "next/dynamic";
import { DeskShell, type DeskViewer } from "@/components/outreach-desk/shell/desk-shell";
import { DeskFrame } from "@/components/outreach-desk/views/desk-frame";
import { useRepDays } from "@/components/outreach-desk/data/use-desk-reads";
import type { DeskView } from "@/components/outreach-desk/data/desk-url";
import { NeutralRouteSkeleton } from "@/components/sales-intelligence/desk/route-skeleton";

const NumbersAndAccounts = dynamic(() => import("@/components/sales-intelligence/desk/desk").then((m) => m.Desk), {
  ssr: false,
  loading: () => <NeutralRouteSkeleton />,
});

export function DeskClient({ viewer, view }: { viewer: DeskViewer; view: DeskView }) {
  const own = useRepDays(null, null, viewer.role === "rep" && view !== "numbers" && view !== "accounts");
  const name = viewer.role === "rep" ? (own.data?.reps?.[0]?.agent_name ?? null) : null;
  return (
    <DeskShell viewer={viewer} view={view} name={name}>
      {view === "numbers" || view === "accounts" ? (
        <div className="od-embedded si-root si-route">
          <NumbersAndAccounts />
        </div>
      ) : (
        <DeskFrame viewer={viewer} view={view} />
      )}
    </DeskShell>
  );
}
