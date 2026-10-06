"use client";
/**
 * Live sidebar badges (doc 01, behaviour 2). Nothing new is polled: the Daily Operations snapshot (already resynced
 * every five minutes by Today) supplies `intakes.still_open`, and the Outreach Desk team read supplies the unassigned
 * count. Today = intakes still open + unassigned leads; Bookings = intakes still open. Leads waits for the Granot
 * updates workflow (doc 17) and shows nothing yet.
 */
import { useQuery } from "@tanstack/react-query";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { fetchDailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import { queryKeys } from "@/lib/query/keys";
import type { DashboardShellRole, SidebarBadgeCounts } from "./dashboard-nav";

const SNAPSHOT_RESYNC_MS = 5 * 60_000;

export function sidebarBadgeCounts(input: { stillOpen: number | null; unassigned: number | null }): SidebarBadgeCounts {
  const stillOpen = input.stillOpen ?? 0;
  const unassigned = input.unassigned ?? 0;
  const today = stillOpen + unassigned;
  return {
    today: today > 0 ? today : null,
    bookings: stillOpen > 0 ? stillOpen : null,
    leads: null,
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
  if (!seesOperations) return {};
  return sidebarBadgeCounts({
    stillOpen: snapshot.data?.metrics.intakes.still_open ?? null,
    unassigned: owner ? (team.data?.unassigned.count ?? null) : null,
  });
}
