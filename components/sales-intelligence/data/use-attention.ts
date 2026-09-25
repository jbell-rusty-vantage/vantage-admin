"use client";
/**
 * UI1-DATA: the desk list (Needs Attention, All Outreach, Closed) from `GET /attention` (S2). Keyset pages
 * (`cursor`, `Load more`); `total_items` is the server count; the order is the server's (never re-sorted here).
 * A filter/sort/view change is a new key, so paging restarts at the first page. Wrap the URL change in a
 * transition (use-url-state does) so the old page stays on screen while the new key loads (UI-0 §2.4).
 */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { attentionSchema, readSalesIntelligence, type AttentionRow } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";
import { attentionQuery, withCursor, type AttentionParams } from "./requests";

export type AttentionPage = ReturnType<typeof attentionSchema.parse>;

export function readAttentionPage(params: AttentionParams, cursor: string | null, signal?: AbortSignal) {
  return readSalesIntelligence(withCursor("attention", attentionQuery(params), cursor), attentionSchema, signal);
}

export function useAttentionList(params: AttentionParams) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.attention(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readAttentionPage(params, pageParam, signal),
    getNextPageParam: (last) => last.data.cursor ?? undefined,
    retry: false,
  });
  const first = query.data.pages[0]!.data;
  const items: AttentionRow[] = query.data.pages.flatMap((page) => page.data.items);
  return {
    ...query,
    items,
    /** The first page's `as_of`: every relative phrase on the list is measured against it. */
    asOf: query.data.pages[0]!.as_of,
    snapshotId: first.snapshot_id,
    totalItems: first.total_items,
    stale: first.stale ?? false,
    status: first.status ?? null,
    /** Absent (not null) on a snapshot without metrics → every tile prints `—`. */
    metrics: first.metrics ?? null,
    priorityCounts: first.priority_counts ?? null,
    reasonCounts: first.reason_counts ?? null,
    /** What the server applied; absent means the server has no sort contract. */
    served: { view: first.view ?? null, sort: first.sort ?? null, direction: first.direction ?? null, freshness: first.freshness ?? null },
  };
}
