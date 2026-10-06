"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { fetchAdminFacets, type FilterCatalog, type FilterCatalogGranularity } from "./admin";
import type { SelectOption } from "./types";

function toOptions(values: string[] | undefined): SelectOption[] {
  return (values ?? []).map((value) => ({ value, label: value }));
}

function withInactiveMarker(label: string, active: boolean): string {
  return active ? label : `${label} (inactive)`;
}

export function sourceGranularitySelectOptions(
  granularities: readonly FilterCatalogGranularity[] | undefined,
  channel?: "form" | "call",
): SelectOption[] {
  return (granularities ?? [])
    .filter((row) => {
      if (!channel) return true;
      return row.channel === channel;
    })
    .map((row) => ({
      value: row.granularity_key,
      label: withInactiveMarker(row.owner_label, row.active),
    }));
}

export function sourceCompanyOptionsForLeadType(
  granularities: readonly FilterCatalogGranularity[] | undefined,
  leadType?: string,
): SelectOption[] {
  const channel = leadType === "form" || leadType === "call" ? leadType : undefined;
  return sourceGranularitySelectOptions(granularities, channel);
}

export function selectedSourceGranularityKey(
  selected: string | undefined,
  granularities: readonly FilterCatalogGranularity[] | undefined,
  leadType?: string,
): string | undefined {
  if (!selected) return undefined;
  if (!granularities) return selected;
  const key = selected.trim().toLowerCase();
  const options = sourceCompanyOptionsForLeadType(granularities, leadType);
  return options.some((option) => option.value.toLowerCase() === key) ? selected : undefined;
}

/**
 * Source granularities as the Bookings / Cancellations "Source" filter. A booking's `source` is the Granot CRM label
 * of the feed it came from ("Top10 Inbounds"), which the server's `bookingSourceFilterClause` matches exactly, so the
 * value is the granularity's `crm_label` (its owner label when no CRM label is recorded) and the label is the Owner's.
 */
export function bookingSourceSelectOptions(
  granularities: readonly FilterCatalogGranularity[] | undefined,
): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];
  for (const row of granularities ?? []) {
    const value = (row.crm_label ?? row.owner_label).trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    options.push({ value, label: withInactiveMarker(row.owner_label, row.active) });
  }
  return options;
}

export function agentSelectOptions(
  catalog: FilterCatalog | undefined,
): { agentOptions: SelectOption[]; agentIdOptions: SelectOption[] } {
  const agents = catalog?.agents ?? [];
  return {
    agentOptions: agents.map((agent) => ({
      value: agent.name,
      label: withInactiveMarker(agent.name, agent.active),
    })),
    agentIdOptions: agents
      .filter((agent) => agent.id)
      .map((agent) => ({
        value: agent.id,
        label: withInactiveMarker(agent.name, agent.active),
      })),
  };
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
  bookingSourceOptions: readonly SelectOption[];
  granularityLabelByKey: ReadonlyMap<string, string>;
  granularityKeyById: ReadonlyMap<string, string>;
  catalog: FilterCatalog | undefined;
  isLoading: boolean;
  isError: boolean;
};

export function useFacetOptions(): FacetOptions {
  const query = useQuery({
    queryKey: queryKeys.facets.all,
    queryFn: fetchAdminFacets,
    staleTime: 5 * 60 * 1000,
  });
  const catalog = query.data?.catalog;
  const agents = agentSelectOptions(catalog);
  const granularities = catalog?.source_granularities ?? [];

  return {
    agentOptions: catalog ? agents.agentOptions : toOptions(query.data?.agents),
    agentIdOptions: agents.agentIdOptions,
    merchantOptions: catalog
      ? (catalog.merchants ?? []).map((merchant) => ({
          value: merchant.name,
          label: withInactiveMarker(merchant.name, merchant.active),
        }))
      : toOptions(query.data?.merchants),
    sourceCompanyOptions: sourceGranularitySelectOptions(granularities),
    sourceOptions: toOptions(query.data?.sources),
    formSourceOptions: sourceGranularitySelectOptions(granularities, "form"),
    callSourceOptions: sourceGranularitySelectOptions(granularities, "call"),
    sourceGranularityOptions: sourceGranularitySelectOptions(granularities),
    bookingSourceOptions: bookingSourceSelectOptions(granularities),
    granularityLabelByKey: new Map(
      granularities.map((row) => [row.granularity_key.toLowerCase(), row.owner_label]),
    ),
    granularityKeyById: new Map(
      granularities.filter((row) => row.id).map((row) => [row.id, row.granularity_key]),
    ),
    catalog,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
