"use client";
/**
 * UI1-DESK (UI-1 §3.4, §7c): what the desk does when the server refuses the list with a 400.
 *
 * - With `q` set (a server or snapshot without S11-SEARCH): stop sending `q`, keep the list, and say
 *   `Search isn’t available on this server yet.` (sticky for this page: every `q` would fail the same way).
 * - Otherwise with a non-default sort: fall back to the view's default and say
 *   `Sorting unavailable on this server. Showing the default order.` (only that sort is marked bad).
 * - Otherwise the region shows its error.
 *
 * `useQueryError` watches the query cache without adding an observer, so it never changes the list query's
 * options (an extra `useQuery` observer on an infinite key would replace its paging behaviour).
 */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { SalesIntelligenceError } from "@/lib/api/salesIntelligence";
import type { AttentionParams, ClosedHistoryParams } from "../data/requests";
import { effectiveSort } from "../data/url-state";

export type Degrade = { qOff: boolean; badSorts: readonly string[] };
export const NO_DEGRADE: Degrade = { qOff: false, badSorts: [] };

export const isBadRequest = (error: unknown) =>
  error instanceof SalesIntelligenceError ? error.status === 400 : !!error && typeof error === "object" && (error as { status?: unknown }).status === 400;

/** The params actually sent, after dropping `q` and any sort the server refused. */
export function applyDegrade(params: AttentionParams, degrade: Degrade): AttentionParams {
  let next = params;
  if (degrade.qOff && next.q) next = { ...next, q: null };
  if (next.sort && degrade.badSorts.includes(next.sort)) {
    const fallback = effectiveSort(next.view, null);
    next = { ...next, sort: fallback.sort, direction: fallback.direction, freshness: null };
  }
  return next;
}

export function applyHistoryDegrade(params: ClosedHistoryParams, degrade: Degrade): ClosedHistoryParams {
  return degrade.qOff && params.q ? { ...params, q: null } : params;
}

/** The next degrade state for a list error with the params that produced it; the same object when nothing changes. */
export function nextDegrade(error: unknown, sent: AttentionParams, degrade: Degrade): Degrade {
  if (!isBadRequest(error)) return degrade;
  if (sent.q?.trim() && !degrade.qOff) return { ...degrade, qOff: true };
  const fallback = effectiveSort(sent.view, null).sort;
  if (sent.sort && sent.sort !== fallback && !degrade.badSorts.includes(sent.sort)) return { ...degrade, badSorts: [...degrade.badSorts, sent.sort] };
  return degrade;
}

/** The notices the list shows for the current URL state. */
export function degradeNotices(requested: AttentionParams, degrade: Degrade): { search: boolean; sort: boolean } {
  return { search: degrade.qOff && !!requested.q?.trim(), sort: !!requested.sort && degrade.badSorts.includes(requested.sort) };
}

/** The error currently stored for `key` in the query cache (null when none). */
export function useQueryError(key: QueryKey): unknown {
  const client = useQueryClient();
  const subscribe = useCallback((notify: () => void) => client.getQueryCache().subscribe(notify), [client]);
  const read = () => client.getQueryState(key)?.error ?? null;
  return useSyncExternalStore(subscribe, read, () => null);
}
