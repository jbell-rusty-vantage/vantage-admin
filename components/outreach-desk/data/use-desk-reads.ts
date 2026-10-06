"use client";
/**
 * Desk reads (TanStack Query) over the browser BFF. The server's DTO is the authority: these hooks only fetch,
 * validate and cache. Error rules from the server handoff:
 * - a 403/404 on a Lead clears it from every cached read (`clearSubject`) and the caller drops the selection;
 * - 409 `CURSOR_EXPIRED` drops the cursor and reloads page one;
 * - a 503 is "unavailable", never "empty"; no 4xx or 503 is retried.
 */
import { useInfiniteQuery, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  isSalesOutreachApiError,
  salesOutreachCapabilitiesSchema,
  salesOutreachDetailSchema,
  salesOutreachPaths,
  salesOutreachQueueSchema,
  salesOutreachRead,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  type SalesOutreachQueueRequest,
} from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { useDeskPollInterval } from "./use-desk-live";

/**
 * Retry only transient failures (network, 5xx other than 503), at most twice. A body the mirror can't read is a
 * `READ_SHAPE_MISMATCH` with the response's 2xx status, so it is not retried: the view says so at once.
 */
export function retryDeskRead(failureCount: number, error: unknown): boolean {
  if (isSalesOutreachApiError(error) && (error.status < 500 || error.status === 503)) return false;
  return failureCount < 2;
}

export function useCapabilities() {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: outreachKeys.capabilities(),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.capabilities(), salesOutreachCapabilitiesSchema, signal),
    retry: retryDeskRead,
    refetchInterval: poll,
    staleTime: 15_000,
  });
}

export function useTeam(businessDay: string | null, enabled: boolean) {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: outreachKeys.team(businessDay),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.team(businessDay ? { business_day: businessDay } : {}), salesOutreachTeamSchema, signal),
    enabled,
    retry: retryDeskRead,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
}

export function useRepDays(businessDay: string | null, agentId: string | null, enabled: boolean) {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: outreachKeys.repDays(businessDay, agentId),
    queryFn: ({ signal }) =>
      salesOutreachRead(
        salesOutreachPaths.repDays({ ...(businessDay ? { business_day: businessDay } : {}), ...(agentId ? { agent_id: agentId } : {}) }),
        salesOutreachRepDaysSchema,
        signal,
      ),
    enabled,
    retry: retryDeskRead,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
}

/**
 * The scoped queue, one server page at a time (`next_cursor`). Filters and sort are applied by the server before
 * paging; the browser never re-sorts. A filter change is a new key, so paging restarts.
 */
export function useQueue(request: Omit<SalesOutreachQueueRequest, "cursor">, enabled: boolean) {
  const poll = useDeskPollInterval();
  const queryClient = useQueryClient();
  const key = outreachKeys.queue(request);
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      try {
        return await salesOutreachRead(salesOutreachPaths.queue({ ...request, cursor: pageParam }), salesOutreachQueueSchema, signal);
      } catch (error) {
        if (pageParam && isSalesOutreachApiError(error) && error.code === "CURSOR_EXPIRED") {
          // The list changed under the cursor: drop it and reload page one.
          queueMicrotask(() => void queryClient.resetQueries({ queryKey: key as QueryKey, exact: true }));
        }
        throw error;
      }
    },
    getNextPageParam: (last) => (last.has_more && last.next_cursor ? last.next_cursor : undefined),
    enabled,
    retry: retryDeskRead,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
  const pages = query.data?.pages ?? [];
  return {
    query,
    first: pages[0] ?? null,
    rows: pages.flatMap((page) => page.rows),
  };
}

export function useDetail(subjectId: string | null) {
  const poll = useDeskPollInterval();
  return useQuery({
    queryKey: subjectId ? outreachKeys.detail(subjectId) : [...outreachKeys.detailAll(), "none"],
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.detail(subjectId as string), salesOutreachDetailSchema, signal),
    enabled: Boolean(subjectId),
    retry: retryDeskRead,
    refetchInterval: poll,
  });
}
