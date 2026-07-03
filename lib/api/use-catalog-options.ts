"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchCatalogItems,
  toAgentIdSelectOptions,
  toCatalogOptions,
  type CatalogItem,
} from "./catalog";
import type { SelectOption } from "./types";
import { queryKeys } from "@/lib/query/keys";

export type CatalogOptions = {
  agents: CatalogItem[];
  merchants: CatalogItem[];
  agentOptions: SelectOption[];
  agentIdOptions: SelectOption[];
  merchantOptions: SelectOption[];
  isLoading: boolean;
};

export function useCatalogOptions(): CatalogOptions {
  const agentsQuery = useQuery({
    queryKey: queryKeys.catalog.kind("agents"),
    queryFn: () => fetchCatalogItems("agents"),
    staleTime: 5 * 60 * 1000,
  });
  const merchantsQuery = useQuery({
    queryKey: queryKeys.catalog.kind("merchants"),
    queryFn: () => fetchCatalogItems("merchants"),
    staleTime: 5 * 60 * 1000,
  });
  const allAgentsQuery = useQuery({
    queryKey: [...queryKeys.catalog.kind("agents"), "include-inactive"],
    queryFn: () => fetchCatalogItems("agents", { includeInactive: true }),
    staleTime: 5 * 60 * 1000,
  });

  return {
    agents: agentsQuery.data ?? [],
    merchants: merchantsQuery.data ?? [],
    agentOptions: toCatalogOptions(agentsQuery.data),
    agentIdOptions: toAgentIdSelectOptions(allAgentsQuery.data),
    merchantOptions: toCatalogOptions(merchantsQuery.data),
    isLoading: agentsQuery.isLoading || merchantsQuery.isLoading || allAgentsQuery.isLoading,
  };
}
