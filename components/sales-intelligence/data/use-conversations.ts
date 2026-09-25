"use client";
/**
 * UI1-DATA: conversations of the record's Number (`GET /numbers/:id/conversations`, final §11.7) and one
 * conversation's transcript (`GET /conversations/:id/transcript`). Conversation cards page by `next_cursor`;
 * transcript segments page by `next_offset` (`Load more`). The audio player's `src` is `conversationMediaSrc`,
 * the Owner media route through the admin proxy (it streams 206 chunks; a 404 means removed under retention).
 */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { conversationsSchema, readSalesIntelligence, transcriptSchema, type ConversationCard, type OtherCall } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

const enc = encodeURIComponent;
export const TRANSCRIPT_PAGE_SIZE = 100;

export function readConversationsPage(numberId: string, cursor: string | null, signal?: AbortSignal) {
  return readSalesIntelligence(`numbers/${enc(numberId)}/conversations${cursor ? `?cursor=${enc(cursor)}` : ""}`, conversationsSchema, signal);
}
export function readTranscriptPage(conversationId: string, offset: number, signal?: AbortSignal) {
  return readSalesIntelligence(`conversations/${enc(conversationId)}/transcript?offset=${offset}&limit=${TRANSCRIPT_PAGE_SIZE}`, transcriptSchema, signal);
}
export const conversationMediaSrc = (conversationId: string) =>
  `/api/proxy/api/v1/admin/sales-intelligence/conversations/${enc(conversationId)}/media?scope=production`;

export function useConversations(numberId: string) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.conversations(numberId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => readConversationsPage(numberId, pageParam, signal),
    getNextPageParam: (last) => last.data.next_cursor ?? undefined,
    retry: false,
  });
  const items: ConversationCard[] = query.data.pages.flatMap((page) => page.data.items);
  const otherCalls: OtherCall[] = query.data.pages.flatMap((page) => page.data.other_calls);
  return { ...query, items, otherCalls, asOf: query.data.pages[0]!.as_of };
}

/** Starts at `offset` (the `Open in transcript` target may start mid-way); later pages follow `next_offset`. */
export function useTranscript(conversationId: string, offset = 0) {
  const query = useSuspenseInfiniteQuery({
    queryKey: siKeys.transcript(conversationId, offset),
    initialPageParam: offset,
    queryFn: ({ pageParam, signal }) => readTranscriptPage(conversationId, pageParam, signal),
    getNextPageParam: (last) => last.data.next_offset ?? undefined,
    retry: false,
  });
  const first = query.data.pages[0]!.data;
  const last = query.data.pages[query.data.pages.length - 1]!.data;
  return {
    ...query,
    segments: query.data.pages.flatMap((page) => page.data.segments),
    available: first.available,
    total: first.total,
    transcriptVersion: first.transcript_version,
    /** The newest page's completeness (`segments_before:n` / `segments_after:n`). */
    completeness: last.completeness,
    asOf: query.data.pages[0]!.as_of,
  };
}
