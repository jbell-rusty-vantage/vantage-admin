"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

/**
 * Domains invalidated after a successful Operations Registry mutation
 * (including persisted validation failures that changed route state).
 */
export const REGISTRY_INVALIDATION_ROOTS = [
  "operationsRegistry",
  "catalog",
  "sourceCompanies",
  "cplRates",
  "facets",
  "lists",
  "details",
  "search",
  "analytics",
  "auditLog",
  "publicEmployeeBooking",
  "workflows",
  "granotAutomation",
] as const;

export type RegistryInvalidationRoot = (typeof REGISTRY_INVALIDATION_ROOTS)[number];

/** Query-key prefixes covered by {@link invalidateRegistryQueries}. */
export function registryInvalidationQueryKeys() {
  return [
    queryKeys.operationsRegistry.all,
    queryKeys.catalog.all,
    queryKeys.sourceCompanies.all,
    queryKeys.cplRates.all,
    queryKeys.facets.all,
    queryKeys.lists.all,
    queryKeys.details.all,
    queryKeys.search.all,
    queryKeys.analytics.all,
    queryKeys.auditLog.all,
    queryKeys.publicEmployeeBooking.all,
    queryKeys.workflows.all,
    queryKeys.granotAutomation.all,
  ] as const;
}

/** Central invalidation after Operations Registry mutations. */
export async function invalidateRegistryQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    registryInvalidationQueryKeys().map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
