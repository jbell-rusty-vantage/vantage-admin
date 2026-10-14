"use client";
/**
 * The desk's one live stream (ADM-7, CONTRACTS "SSE"): an EventSource on `/api/outreach-desk-live`, hints only (ids
 * and revisions, never customer records). Rules from the server handoff:
 * - `connect`/`reconnect`/`clock` (every 30 s) and an overfull change (`refetch: "all"`) → full scoped refetch;
 *   a change frame refetches only what its topics name (`outreachInvalidationKeys`);
 * - the stream ends itself after about 240 s: the browser reconnects and the connect frame resnapshots;
 * - a refusal (403 / 503 desk unavailable) closes it: back off, recheck capabilities, try again later;
 * - hidden page → close the stream; visible again → reopen with a full refetch;
 * - New York midnight → full refetch so "today" rolls over.
 * Desk reads also resnapshot every 30 s on a visible page, recovering a missed hint even on a live stream.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { salesOutreachLiveFrameSchema } from "@/lib/api/salesOutreach";
import { outreachInvalidationKeys, outreachKeys, type OutreachInvalidationFrame } from "@/lib/query/salesOutreach";

export const OUTREACH_DESK_LIVE_URL = "/api/outreach-desk-live";
export const DESK_FALLBACK_POLL_MS = 30_000;
const REFUSED_RETRY_MS = 60_000;
const COALESCE_MS = 250;

export type DeskLiveStatus = "connecting" | "live" | "offline";

let status: DeskLiveStatus = "connecting";
const listeners = new Set<() => void>();
function setStatus(next: DeskLiveStatus) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => status;
const readServer = (): DeskLiveStatus => "connecting";

export function useDeskLiveStatus(): DeskLiveStatus {
  return useSyncExternalStore(subscribe, read, readServer);
}

/** Short foreground resnapshots also recover a missed hint while SSE remains connected. */
export function useDeskPollInterval(): number | false {
  return DESK_FALLBACK_POLL_MS;
}

/** Parses a frame leniently: anything unreadable is treated as "refetch everything". */
export function parseDeskFrame(data: string): OutreachInvalidationFrame {
  try {
    const parsed = salesOutreachLiveFrameSchema.safeParse(JSON.parse(data));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  return { reason: "reconnect", refetch: "all", topics: [], changes: [] };
}

/** Milliseconds until the next New York midnight from `now` (DST-safe: searches the next local day's start). */
export function msUntilNewYorkMidnight(now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const start = now.getTime();
  const today = formatter.format(now);
  let low = start;
  let high = start + 26 * 3_600_000;
  // Search the first instant of tomorrow rather than assuming that this NY day lasts 24 hours.
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (formatter.format(new Date(middle)) === today) low = middle;
    else high = middle;
  }
  return Math.max(1000, high - start + 1000);
}

export function useDeskLive(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let midnight: ReturnType<typeof setTimeout> | undefined;
    const pending = new Map<string, QueryKey>();

    const flush = () => {
      flushTimer = undefined;
      const keys = [...pending.values()];
      pending.clear();
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };
    const queue = (frame: OutreachInvalidationFrame) => {
      for (const key of outreachInvalidationKeys(frame)) pending.set(JSON.stringify(key), key as QueryKey);
      if (!flushTimer) flushTimer = setTimeout(flush, COALESCE_MS);
    };
    const refetchAll = () => queue({ reason: "reconnect", refetch: "all", topics: [], changes: [] });

    const close = () => {
      source?.close();
      source = null;
    };
    const open = () => {
      if (source || document.visibilityState !== "visible") return;
      setStatus("connecting");
      const es = new EventSource(OUTREACH_DESK_LIVE_URL);
      source = es;
      es.onopen = () => setStatus("live");
      es.addEventListener("invalidation", (event) => {
        setStatus("live");
        queue(parseDeskFrame((event as MessageEvent<string>).data));
      });
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          // Refused (403, desk muted, link lost) or unreachable: recheck capabilities and retry later.
          setStatus("offline");
          close();
          void queryClient.invalidateQueries({ queryKey: outreachKeys.capabilities() as QueryKey });
          clearTimeout(retry);
          retry = setTimeout(open, REFUSED_RETRY_MS);
        } else {
          // The stream ended (≈240 s) or blipped: the browser reconnects and the connect frame resnapshots.
          setStatus("connecting");
        }
      };
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refetchAll();
        open();
      } else {
        clearTimeout(retry);
        close();
      }
    };
    const onOnline = () => {
      refetchAll();
      open();
    };
    const armMidnight = () => {
      midnight = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey });
        armMidnight();
      }, msUntilNewYorkMidnight(new Date()));
    };

    open();
    armMidnight();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      close();
      clearTimeout(retry);
      clearTimeout(flushTimer);
      clearTimeout(midnight);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      setStatus("connecting");
    };
  }, [enabled, queryClient]);
}
