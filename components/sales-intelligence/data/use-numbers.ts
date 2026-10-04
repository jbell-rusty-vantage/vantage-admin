"use client";
/** The Numbers reads: one list page, one Number's detail, and its timeline (newest first, keyset pages). */
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { numberDetailSchema, numberSearchSchema, readSalesIntelligence, timelineSchema } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";
import { useReportAsOf } from "./live";

export const NUMBERS_PAGE_SIZE = 50;
export const TIMELINE_PAGE_SIZE = 50;

export function useNumbersPage(query: URLSearchParams) {
  const text = query.toString();
  const result = useSuspenseQuery({ queryKey: siKeys.numbers(text), queryFn: ({ signal }) => readSalesIntelligence(`numbers?${text}`, numberSearchSchema, signal), retry: false });
  useReportAsOf(result.data.as_of);
  return result;
}

export function useNumberDetail(id: string) {
  const result = useSuspenseQuery({ queryKey: siKeys.number(id), queryFn: ({ signal }) => readSalesIntelligence(`numbers/${encodeURIComponent(id)}`, numberDetailSchema, signal), retry: false });
  useReportAsOf(result.data.as_of);
  return result;
}

export function useNumberTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: siKeys.timeline(id),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readSalesIntelligence(`numbers/${encodeURIComponent(id)}/timeline?limit=${TIMELINE_PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, timelineSchema, signal),
    getNextPageParam: (page) => page.data.cursor ?? undefined,
    retry: false,
  });
}
