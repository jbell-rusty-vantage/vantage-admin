"use client";
/**
 * UI1-LIVE (UI-0 §2.5, UX18): the stream status the header shows.
 *
 * `useLive()` OPENS the one `GET /live` EventSource (through `useSalesIntelligenceLive`), so call it once per page:
 * `HeaderLive` does. Everything else reads the same state with `useLiveSnapshot()`, which never opens a stream.
 *
 * - `offline`: after `SALES_INTELLIGENCE_OFFLINE_MS` (30 s) without the stream (`connecting` or `reconnecting`).
 * - Fallback poll: while the stream isn't open, every active read is invalidated every 60 s
 *   (`fallbackMs: 60000, fallbackWhileLive: false`). This is the least invasive place for it: the existing hook
 *   already owns the timed resync, so no read hook needs a `refetchInterval` and no QueryClient default changes.
 * - On (re)connect everything is refetched (the existing `onopen` rule).
 * - `lastFrameAt` is the server `as_of` of the newest change frame (never the browser clock); null before one.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  SALES_INTELLIGENCE_FALLBACK_POLL_MS,
  SALES_INTELLIGENCE_OFFLINE_MS,
  useSalesIntelligenceLive,
  useSalesIntelligencePulse,
  type SalesIntelligenceLiveStatus,
} from "@/lib/query/salesIntelligence";
import type { LiveStatus } from "../../primitives";

export type LiveState = { status: LiveStatus; lastFrameAt: string | null };

/** Pure: the header status from the raw stream status and whether the 30 s down timer has run out. */
export function liveStatusOf(raw: SalesIntelligenceLiveStatus, downTooLong: boolean): LiveStatus {
  return raw !== "live" && downTooLong ? "offline" : raw;
}

let snapshot: LiveState = { status: "connecting", lastFrameAt: null };
const listeners = new Set<() => void>();
function publish(next: LiveState) {
  if (next.status === snapshot.status && next.lastFrameAt === snapshot.lastFrameAt) return;
  snapshot = next;
  for (const listener of [...listeners]) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const read = () => snapshot;
const serverSnapshot: LiveState = { status: "connecting", lastFrameAt: null };

/** Reads the header's live state anywhere without opening a second stream. */
export function useLiveSnapshot(): LiveState {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot);
}

/** Opens the stream (once per page) and returns `{ status, lastFrameAt }`. */
export function useLive(): LiveState {
  const raw = useSalesIntelligenceLive({ fallbackMs: SALES_INTELLIGENCE_FALLBACK_POLL_MS, fallbackWhileLive: false });
  const pulse = useSalesIntelligencePulse();
  // Adjust-on-change during render (React's documented pattern): a new raw status starts a fresh down timer.
  const [seen, setSeen] = useState(raw);
  const [downTooLong, setDownTooLong] = useState(false);
  if (seen !== raw) {
    setSeen(raw);
    setDownTooLong(false);
  }
  useEffect(() => {
    if (raw === "live") return;
    const timer = window.setTimeout(() => setDownTooLong(true), SALES_INTELLIGENCE_OFFLINE_MS);
    return () => window.clearTimeout(timer);
  }, [raw]);
  const status = liveStatusOf(raw, seen === raw && downTooLong);
  const lastFrameAt = pulse.at;
  useEffect(() => {
    publish({ status, lastFrameAt });
  }, [status, lastFrameAt]);
  return { status, lastFrameAt };
}
