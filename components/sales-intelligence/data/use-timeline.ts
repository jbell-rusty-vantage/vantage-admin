"use client";
/**
 * UI1-DATA: timeline v2 on both scopes (final §10, UI-1 §5.3). 50 per page; `Load older activity` pages by
 * `cursor`. `kinds` narrows the server read (repeated param). The component takes `scope` so UI-3 reuses it
 * for a Number. `data.coverage.truncated_sources[]` non-empty → `Some older activity isn't shown here.`
 */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { readSalesIntelligence, timelineV2Schema, type TimelineEvent } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";
import { timelinePath, timelineQuery, type TimelineScope } from "./requests";

export function readTimelinePage(scope: TimelineScope, id: string, kinds: readonly string[], cursor: string | null, signal?: AbortSignal) {
  return readSalesIntelligence(`${timelinePath(scope, id)}?${timelineQuery(kinds, cursor)}`, timelineV2Schema, signal);
}

export function useTimeline({ scope, id, kinds = [] }: { scope: TimelineScope; id: string; kinds?: readonly string[] }) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.timeline(scope, id, kinds),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readTimelinePage(scope, id, kinds, pageParam, signal),
    getNextPageParam: (last) => last.data.cursor ?? undefined,
    retry: false,
  });
  const items: TimelineEvent[] = query.data.pages.flatMap((page) => page.data.items);
  const truncated = [...new Set(query.data.pages.flatMap((page) => page.data.coverage.truncated_sources))];
  return { ...query, items, asOf: query.data.pages[0]!.as_of, truncatedSources: truncated };
}
