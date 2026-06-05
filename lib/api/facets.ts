"use client";

import { useQuery } from "@tanstack/react-query";
import {
  SOURCE_COMPANY_OPTIONS,
  SOURCE_LABEL_OPTIONS,
} from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { fetchAdminFacets } from "./admin";
import { useCatalogOptions } from "./use-catalog-options";
import type { DatabaseScope, SelectOption } from "./types";

function toOptions(values: string[] | undefined): SelectOption[] {
  return (values ?? []).map((value) => ({ value, label: value }));
}

export type FacetOptions = {
  agentOptions: readonly SelectOption[];
  merchantOptions: readonly SelectOption[];
  sourceCompanyOptions: readonly SelectOption[];
  sourceOptions: readonly SelectOption[];
  isLoading: boolean;
};

// Production uses the fixed enums (with friendly labels); historical and
// combined scopes resolve their filter options from the live facets endpoint.
export function useFacetOptions(scope: DatabaseScope): FacetOptions {
  const isProduction = scope === "production";
  const catalog = useCatalogOptions();
  const query = useQuery({
    queryKey: queryKeys.facets.scope(scope),
    queryFn: () => fetchAdminFacets(scope),
    enabled: !isProduction,
    staleTime: 5 * 60 * 1000,
  });

  if (isProduction) {
    return {
      agentOptions: catalog.agentOptions,
      merchantOptions: catalog.merchantOptions,
      sourceCompanyOptions: SOURCE_COMPANY_OPTIONS,
      sourceOptions: SOURCE_LABEL_OPTIONS,
      isLoading: catalog.isLoading,
    };
  }

  const facets = query.data;
  return {
    agentOptions: toOptions(facets?.agents),
    merchantOptions: toOptions(facets?.merchants),
    sourceCompanyOptions: toOptions(facets?.source_companies),
    sourceOptions: toOptions(facets?.sources),
    isLoading: query.isLoading,
  };
}
