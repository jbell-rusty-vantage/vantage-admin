"use client";
import { useQuery } from "@tanstack/react-query";
import { useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import { fetchDailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import { queryKeys } from "@/lib/query/keys";
import { newBookingCount } from "@/lib/api/bookingsToFinish";
import { fetchGranotLifecycleHealth } from "@/lib/api/granotLifecycle";
import type { DashboardShellRole, SidebarBadgeCounts } from "./dashboard-nav";

const SNAPSHOT_RESYNC_MS = 5 * 60_000;

export function useToFinishCount(owner: boolean) {
  return useQuery({
    queryKey: queryKeys.granotLifecycle.health(),
    queryFn: fetchGranotLifecycleHealth,
    enabled: owner,
    select: (health) => newBookingCount(health.open_cases),
    staleTime: SNAPSHOT_RESYNC_MS,
    refetchInterval: SNAPSHOT_RESYNC_MS,
  }).data;
}

export function sidebarBadgeCounts(input: { stillOpen: number | null; toFinish: number | null; unassigned: number | null }): SidebarBadgeCounts {
  const stillOpen = input.stillOpen ?? 0;
  const unassigned = input.unassigned ?? 0;
  const today = stillOpen + unassigned;
  return {
    today: today > 0 ? today : null,
    bookings: input.toFinish && input.toFinish > 0 ? input.toFinish : null,
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
  const toFinish = useToFinishCount(owner);
  const team = useTeam(null, owner);
  if (!seesOperations) return {};
  return sidebarBadgeCounts({
    toFinish: owner ? toFinish ?? null : null,
    stillOpen: snapshot.data?.metrics.intakes.still_open ?? null,
    unassigned: owner ? (team.data?.unassigned.count ?? null) : null,
  });
}
