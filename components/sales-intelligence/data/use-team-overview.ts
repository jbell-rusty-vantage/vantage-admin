"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { readActivityOverview, readOutcomesOverview, readTeamOverview } from "@/lib/api/salesIntelligenceOverview";

export const teamOverviewKey = (priority: readonly string[]) => [...salesIntelligenceKeys.all, "overview-team", [...priority].sort().join(",")] as const;
export const activityOverviewKey = (period: string, from?: string | null, through?: string | null) => [...salesIntelligenceKeys.all, "overview-activity", period, from ?? "", through ?? ""] as const;
export const outcomesOverviewKey = (cohort: string, from?: string | null, through?: string | null) => [...salesIntelligenceKeys.all, "overview-outcomes", cohort, from ?? "", through ?? ""] as const;

export function useTeamOverview(priority: readonly string[]) {
  return useSuspenseQuery({ queryKey: teamOverviewKey(priority), queryFn: ({ signal }) => readTeamOverview(priority, signal), refetchInterval: 60_000, retry: false });
}
export function useActivityOverview(period: string, from?: string | null, through?: string | null) {
  return useSuspenseQuery({ queryKey: activityOverviewKey(period, from, through), queryFn: ({ signal }) => readActivityOverview(period, from, through, signal), refetchInterval: 60_000, retry: false });
}
export function useOutcomesOverview(cohort: string, from?: string | null, through?: string | null) {
  return useSuspenseQuery({ queryKey: outcomesOverviewKey(cohort, from, through), queryFn: ({ signal }) => readOutcomesOverview(cohort, from, through, signal), refetchInterval: 60_000, retry: false });
}
