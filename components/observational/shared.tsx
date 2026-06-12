"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchObservabilityFacets, type ObservabilityFacetsResponse } from "@/lib/api/admin";
import type { SelectOption } from "@/lib/api/types";
import { queryKeys } from "@/lib/query/keys";
import { humanizeKey } from "./entity-link";

/**
 * Filter dropdown values for the Observational tab. One backend call feeds
 * every tab; values are cached for five minutes since distinct event keys and
 * workflows change slowly.
 */
export function useObservabilityFacets() {
  return useQuery<ObservabilityFacetsResponse>({
    queryKey: queryKeys.observability.facets(),
    queryFn: () => fetchObservabilityFacets(),
    staleTime: 5 * 60 * 1000,
  });
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
