"use client";
/**
 * UI1-DATA: `GET /coverage` (UI-1 §6) with `capture_health` (S5c-HEALTH). Cached for 60 s: the header's live
 * indicator takes the capture status from here on pages that don't read the Overview (UI-0 §2.5).
 * `useCaptureHealth` is the non-suspending read for the header, which must never block a page.
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
  return { ...query, coverage: query.data.data.coverage, captureHealth: query.data.data.coverage.capture_health ?? null, asOf: query.data.data.as_of };
}

/** Same key and cache as `useCoverage`; `null` while loading, on error, or before S5c. A rep gets 403 here: pass `enabled: false`. */
export function useCaptureHealth({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery({ queryKey: siKeys.coverage(), queryFn: ({ signal }) => readCoverage(signal), staleTime: COVERAGE_STALE_MS, retry: false, enabled });
  return query.data?.data.coverage.capture_health ?? null;
}
