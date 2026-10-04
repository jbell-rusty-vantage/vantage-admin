"use client";
/**
 * `GET /coverage`: capture completeness, capture health and mapping hygiene. Cached for 60 s; the header's live
 * indicator reads the same key without suspending (`useCaptureHealth`), so it never blocks a page.
 */
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ownerCoverageSchema, readSalesIntelligence } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";

export const COVERAGE_STALE_MS = 60_000;

export function readCoverage(signal?: AbortSignal) {
  return readSalesIntelligence("coverage", ownerCoverageSchema, signal);
}

export function useCoverage() {
  const query = useSuspenseQuery({ queryKey: siKeys.coverage(), queryFn: ({ signal }) => readCoverage(signal), staleTime: COVERAGE_STALE_MS, retry: false });
  return { ...query, coverage: query.data.data.coverage, captureHealth: query.data.data.coverage.capture_health, asOf: query.data.data.as_of };
}

/** Same key and cache as `useCoverage`; `null` while loading or on error. */
export function useCaptureHealth() {
  const query = useQuery({ queryKey: siKeys.coverage(), queryFn: ({ signal }) => readCoverage(signal), staleTime: COVERAGE_STALE_MS, retry: false });
  return query.data?.data.coverage.capture_health ?? null;
}
