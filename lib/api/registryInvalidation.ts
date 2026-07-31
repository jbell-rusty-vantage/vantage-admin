"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";

/** Central invalidation after Operations Registry mutations. */
export async function invalidateRegistryQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.operationsRegistry.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sourceCompanies.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cplRates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.facets.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
  ]);
}
