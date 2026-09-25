"use client";
/**
 * UI1-DATA: rep identity links and the RingCentral directory (`GET /reps`): the RingCentral Accounts view and
 * the composer's `Send to someone else` picker (UX28). `query` is the request string (e.g. `limit=100`).
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { readSalesIntelligence, repsSchema } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

export function readReps(query: string, signal?: AbortSignal) {
  return readSalesIntelligence(query ? `reps?${query}` : "reps", repsSchema, signal);
}

export function useReps(query = "limit=100") {
  const result = useSuspenseQuery({ queryKey: siKeys.reps(query), queryFn: ({ signal }) => readReps(query, signal), retry: false });
  return { ...result, links: result.data.data.items, directory: result.data.data.directory, cursor: result.data.data.next_cursor };
}
