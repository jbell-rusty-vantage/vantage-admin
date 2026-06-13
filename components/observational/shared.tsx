"use client";

import { useQuery } from "@tanstack/react-query";
import { FeedbackMessage } from "@/components/ui/feedback";
import { fetchObservabilityFacets, type ObservabilityFacetsResponse } from "@/lib/api/admin";
import type { SelectOption } from "@/lib/api/types";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  NOTIFICATION_PURPOSES,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_STATUSES,
  OBSERVABILITY_LEVELS,
  OPERATIONAL_EVENT_CATEGORIES,
  OPERATIONAL_REPORT_KEYS,
  REPORT_RUN_STATUSES,
} from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey } from "./entity-link";

/**
 * Built-in dropdown values used until the facets endpoint responds (or when
 * it fails). Enum-backed filters always work; data-derived lists (workflows,
 * event keys, source companies, entity types, routes) require the endpoint.
 */
const STATIC_FACET_VALUES: ObservabilityFacetsResponse = {
  period: { from: "", to: "" },
  workflows: [],
  event_keys: [],
  source_companies: [],
  entity_types: [],
  routes: [],
  levels: [...OBSERVABILITY_LEVELS],
  categories: [...OPERATIONAL_EVENT_CATEGORIES],
  incident_statuses: [...INCIDENT_STATUSES],
  incident_severities: [...INCIDENT_SEVERITIES],
  notification_statuses: [...NOTIFICATION_STATUSES],
  notification_purposes: [...NOTIFICATION_PURPOSES],
  notification_recipient_types: [...NOTIFICATION_RECIPIENT_TYPES],
  report_keys: [...OPERATIONAL_REPORT_KEYS],
  report_run_statuses: [...REPORT_RUN_STATUSES],
};

/**
 * Filter dropdown values for the Observational tab. One backend call feeds
 * every tab; values are cached for five minutes since distinct event keys and
 * workflows change slowly. `values` always resolves: static enums fill in
 * while loading or when the endpoint is unavailable.
 */
export function useObservabilityFacets() {
  const query = useQuery<ObservabilityFacetsResponse>({
    queryKey: queryKeys.observability.facets(),
    queryFn: () => fetchObservabilityFacets(),
    staleTime: 5 * 60 * 1000,
  });

  return { ...query, values: query.data ?? STATIC_FACET_VALUES };
}

/** Inline warning for tabs when dynamic facet values could not be loaded. */
export function FacetsErrorNotice({ error }: { error: unknown }) {
  return (
    <FeedbackMessage tone="warning">
      Some filter options could not be loaded from the server
      {error instanceof Error && error.message ? ` (${error.message})` : ""}. Built-in options
      are shown; workflow, event key, source company, entity type, and route lists may be empty
      until the server is reachable.
    </FeedbackMessage>
  );
}

/** Raw values keep their identifier form; labels are humanized for owners. */
export function toSelectOptions(
  values: readonly string[] | undefined,
  options: { humanize?: boolean } = {},
): SelectOption[] {
  if (!values) {
    return [];
  }
  return values.map((value) => ({
    value,
    label: options.humanize ? humanizeKey(value) : value,
  }));
}

export function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted-foreground">No data.</p>;
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
