"use client";
/**
 * The desk frame inside the "Lead outreach" shell. Team overview, My work, Activity and Settings go through the
 * capabilities-gated `DeskFrame`; All Numbers and RingCentral Accounts are the Owner's own desk views and load whether
 * or not the desk is switched on (they read the Number and Account routes, not the desk projection). Every view renders
 * client side: its reads go through the browser BFF. A Rep's name in the sidebar comes from its own rep-day read.
 */
import { DeskShell, type DeskViewer } from "@/components/outreach-desk/shell/desk-shell";
import { DeskFrame } from "@/components/outreach-desk/views/desk-frame";
import { AccountsView } from "@/components/outreach-desk/views/accounts-view";
import { NumbersView } from "@/components/outreach-desk/views/numbers-view";
import { useDeskLive } from "@/components/outreach-desk/data/use-desk-live";
import { useRepDays } from "@/components/outreach-desk/data/use-desk-reads";
import type { DeskView } from "@/components/outreach-desk/data/desk-url";

/** All Numbers / Accounts with the desk's live stream (its connect and clock frames refresh these reads too). */
function OwnerView({ viewer, view }: { viewer: DeskViewer; view: "numbers" | "accounts" }) {
  useDeskLive(true);
  return view === "numbers" ? <NumbersView viewer={viewer} /> : <AccountsView />;
}

export function DeskClient({ viewer, view }: { viewer: DeskViewer; view: DeskView }) {
  const own = useRepDays(null, null, viewer.role === "rep" && view !== "numbers" && view !== "accounts");
  const name = viewer.role === "rep" ? (own.data?.reps?.[0]?.agent_name ?? null) : null;
  return (
    <DeskShell viewer={viewer} view={view} name={name}>
      {view === "numbers" || view === "accounts" ? <OwnerView viewer={viewer} view={view} /> : <DeskFrame viewer={viewer} view={view} />}
    </DeskShell>
  );
}
