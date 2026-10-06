"use client";
/**
 * Live sidebar badges (doc 01, behaviour 2). Nothing new is polled: the Daily Operations snapshot (already resynced
 * every five minutes by Today) supplies `intakes.still_open`, the Outreach Desk team read supplies the unassigned
 * count, and the Granot updates runs page (shared by key with Today and the Automations pages, doc 17) supplies the
 * checks waiting for approval. Today = intakes still open + unassigned leads; Bookings = intakes still open;
 * Automations = Granot checks waiting for the Owner. Leads carries no badge.
 */
import { useQuery } from "@tanstack/react-query";
import { useGranotRuns } from "@/components/automations/granot-updates/use-granot-updates";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { fetchDailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import { waitingChecks } from "@/lib/automations/granot-updates-model";
import { queryKeys } from "@/lib/query/keys";
import type { DashboardShellRole, SidebarBadgeCounts } from "./dashboard-nav";

const SNAPSHOT_RESYNC_MS = 5 * 60_000;

export function sidebarBadgeCounts(input: { stillOpen: number | null; unassigned: number | null; granotWaiting?: number | null }): SidebarBadgeCounts {
  const stillOpen = input.stillOpen ?? 0;
  const unassigned = input.unassigned ?? 0;
  const granotWaiting = input.granotWaiting ?? 0;
  const today = stillOpen + unassigned;
  return {
    today: today > 0 ? today : null,
    bookings: stillOpen > 0 ? stillOpen : null,
    leads: null,
    automations: granotWaiting > 0 ? granotWaiting : null,
  };
}

export function useSidebarBadges(adminRole: DashboardShellRole): SidebarBadgeCounts {
  const owner = adminRole === "owner";
  const seesOperations = owner || adminRole === "manager";
  const snapshot = useQuery({
    queryKey: queryKeys.dailyOperations.snapshot(),
    queryFn: fetchDailyOperationsSnapshot,
    enabled: seesOperations,
    staleTime: SNAPSHOT_RESYNC_MS,
    refetchInterval: SNAPSHOT_RESYNC_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const team = useTeam(null, owner);
  const granotRuns = useGranotRuns(owner);
  if (!seesOperations) return {};
  return sidebarBadgeCounts({
    stillOpen: snapshot.data?.metrics.intakes.still_open ?? null,
    unassigned: owner ? (team.data?.unassigned.count ?? null) : null,
    granotWaiting: owner && granotRuns.data ? waitingChecks(granotRuns.data).length : null,
  });
}
