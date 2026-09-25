"use client";
/**
 * UI1-DATA: `GET /outreach/closed-history` (E27, UI-1 §3.5). Paged only after the 90-day Closed partition
 * runs out (`cursor: null` on the Closed list) and the Owner presses `Load closed history`, so this hook is
 * mounted on demand. `retention.days` feeds `Closed Outreach is kept for {n} days`.
 */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { closedHistorySchema, readSalesIntelligence, type AttentionRow } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";
import { closedHistoryQuery, withCursor, type ClosedHistoryParams } from "./requests";

export function readClosedHistoryPage(params: ClosedHistoryParams, cursor: string | null, signal?: AbortSignal) {
  return readSalesIntelligence(withCursor("outreach/closed-history", closedHistoryQuery(params), cursor), closedHistorySchema, signal);
}

export function useClosedHistory(params: ClosedHistoryParams) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.closedHistory(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readClosedHistoryPage(params, pageParam, signal),
    getNextPageParam: (last) => last.data.cursor ?? undefined,
    retry: false,
  });
  const items: AttentionRow[] = query.data.pages.flatMap((page) => page.data.items);
  return { ...query, items, asOf: query.data.pages[0]!.as_of, retention: query.data.pages[0]!.data.retention };
}
