"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchAdminFacets } from "./admin";
import {
  fetchLeadSourceCompanies,
  toLeadSourceCompanyOptions,
  type LeadSourceChannel,
  type LeadSourceCompany,
} from "./sourceCompanies";
import { useCatalogOptions } from "./use-catalog-options";
import type { DatabaseScope, SelectOption } from "./types";

function toOptions(values: string[] | undefined): SelectOption[] {
  return (values ?? []).map((value) => ({ value, label: value }));
}

export type FacetOptions = {
  agentOptions: readonly SelectOption[];
  agentIdOptions: readonly SelectOption[];
  merchantOptions: readonly SelectOption[];
  sourceCompanyOptions: readonly SelectOption[];
  sourceOptions: readonly SelectOption[];
  formSourceOptions: readonly SelectOption[];
  callSourceOptions: readonly SelectOption[];
  sourceGranularityOptions: readonly SelectOption[];
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
    staleTime: 5 * 60 * 1000,
  });
  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
    enabled: isProduction,
  });

  if (isProduction) {
    const facets = query.data;
    const sourceCompanies = sourceCompaniesQuery.data;
    return {
      agentOptions: catalog.agentOptions,
      agentIdOptions: catalog.agentIdOptions,
      merchantOptions: catalog.merchantOptions,
      sourceCompanyOptions: toLeadSourceCompanyOptions(sourceCompanies),
      sourceOptions: toOptions(facets?.sources),
      formSourceOptions: toGranularityOptions(sourceCompanies, "form"),
      callSourceOptions: toGranularityOptions(sourceCompanies, "call"),
      sourceGranularityOptions: toGranularityKeyOptions(sourceCompanies),
      isLoading: query.isLoading || sourceCompaniesQuery.isLoading || catalog.isLoading,
    };
  }

  const facets = query.data;
  return {
    agentOptions: toOptions(facets?.agents),
    agentIdOptions: catalog.agentIdOptions,
    merchantOptions: toOptions(facets?.merchants),
    sourceCompanyOptions: toOptions(facets?.source_companies),
    sourceOptions: toOptions(facets?.sources),
    formSourceOptions: toOptions(facets?.sources),
    callSourceOptions: toOptions(facets?.sources),
    sourceGranularityOptions: toOptions(facets?.source_granularities),
    isLoading: query.isLoading || catalog.isLoading,
  };
}

function toGranularityOptions(
  companies: LeadSourceCompany[] | undefined,
  channel: LeadSourceChannel,
): SelectOption[] {
  return (companies ?? []).flatMap((company) =>
    company.granularities
      .filter((granularity) => granularity.channel === channel)
      .map((granularity) => ({
        value: granularity.crm_label,
        label: granularity.active
          ? granularity.crm_label
          : `${granularity.crm_label} (inactive)`,
      })),
  );
}

function toGranularityKeyOptions(companies: LeadSourceCompany[] | undefined): SelectOption[] {
  return (companies ?? []).flatMap((company) =>
    company.granularities.map((granularity) => ({
      value: granularity.granularity_key,
      label: `${granularity.owner_label} (${granularity.channel})`,
    })),
  );
}
