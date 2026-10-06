"use client";
/**
 * The full "Things that need you" list as a hook: the aggregate list read plus the Granot names and inbound routes
 * reads (the list alone cannot say that a Granot name lands nowhere or that a checked number is not filing). The keys
 * are the section's own, so TanStack dedupes them with the Lead sources page. The sub-navigation badge can read
 * `count` from here to match the strip exactly; `needsYou(list)` alone gives the list-only subset.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchLeadSources } from "@/lib/api/leadSources";
import { fetchGranotCrmSources } from "@/lib/api/registryGranotCrmSources";
import { fetchRingCentralRoutes } from "@/lib/api/registryRingCentral";
import { queryKeys } from "@/lib/query/keys";
import { needsYou, type NeedsYouItem } from "./needs-you";

export function useNeedsYou(enabled = true): { items: NeedsYouItem[]; count: number | null } {
  const list = useQuery({ queryKey: queryKeys.operationsRegistry.leadSources(), queryFn: fetchLeadSources, enabled, retry: false });
  const granots = useQuery({ queryKey: queryKeys.operationsRegistry.granotCrmSources(), queryFn: fetchGranotCrmSources, enabled, retry: false });
  const routes = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRoutes({ includeInactive: true, includeHistory: false }),
    queryFn: () => fetchRingCentralRoutes({ includeInactive: true }),
    enabled,
    retry: false,
  });
  if (!list.data) return { items: [], count: null };
  const items = needsYou(list.data.items, { granotNames: granots.data, routes: routes.data });
  return { items, count: items.length };
}
