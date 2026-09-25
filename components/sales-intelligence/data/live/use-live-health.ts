"use client";
/**
 * UI1-LIVE: capture health for the header indicator (UI-0 §2.5, UX29).
 * - status: the Overview's `now.capture_health.status` when an Overview read is already in the cache (the page
 *   shows it), else the coverage read's `capture_health.status`.
 * - knownCompleteThrough: only the coverage read carries it, so the coverage read (60 s `staleTime`, the same key
 *   as `useCoverage`) is always made unless `enabled: false` (a rep gets 403 there).
 * Non-suspending: the header never blocks a page. An unknown status word maps to null (`Capture status not known yet.`).
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import type { CaptureHealth } from "../../primitives";
import { useCaptureHealth } from "../use-coverage";

export type LiveHealth = { status: CaptureHealth["status"] | null; knownCompleteThrough: string | null };

const HEALTH_STATUSES: readonly string[] = ["ok", "attention", "broken"];
export const narrowHealth = (status: string | null | undefined): CaptureHealth["status"] | null =>
  status && HEALTH_STATUSES.includes(status) ? (status as CaptureHealth["status"]) : null;

type OverviewCache = { data?: { as_of?: string; now?: { capture_health?: { status?: string } | null } } };

/** The newest cached Overview's capture status (by its `as_of`), or null. */
export function cachedOverviewCaptureStatus(client: QueryClient): string | null {
  let best: { at: number; status: string } | null = null;
  for (const query of client.getQueryCache().findAll({ queryKey: [...salesIntelligenceKeys.all, "overview"] })) {
    const data = query.state.data as OverviewCache | undefined;
    const status = data?.data?.now?.capture_health?.status;
    if (!status) continue;
    const parsed = Date.parse(data?.data?.as_of ?? "");
    const at = Number.isNaN(parsed) ? 0 : parsed;
    if (!best || at > best.at) best = { at, status };
  }
  return best?.status ?? null;
}

/** Pure: combine the two sources. */
export function liveHealthOf(overviewStatus: string | null, coverage: { status: string; known_complete_through: string | null } | null): LiveHealth {
  return { status: narrowHealth(overviewStatus ?? coverage?.status), knownCompleteThrough: coverage?.known_complete_through ?? null };
}

export function useLiveHealth({ enabled = true }: { enabled?: boolean } = {}): LiveHealth {
  const client = useQueryClient();
  const subscribe = useCallback((listener: () => void) => client.getQueryCache().subscribe(listener), [client]);
  const overviewStatus = useSyncExternalStore(subscribe, () => cachedOverviewCaptureStatus(client), () => null);
  const coverage = useCaptureHealth({ enabled });
  return liveHealthOf(overviewStatus, coverage);
}

/** The primitive's `health` prop: null when the status is unknown. */
export const captureHealthProp = (health: LiveHealth): CaptureHealth | null =>
  health.status ? { status: health.status, knownCompleteThrough: health.knownCompleteThrough } : null;
