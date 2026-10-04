"use client";
/**
 * UI1-LIVE (UI-0 §2.5, UX18): the stream status the header shows.
 *
 * `useLive()` OPENS the one `GET /live` EventSource (through `useSalesIntelligenceLive`), so call it once per page:
 * `HeaderLive` does.
 *
 * - `offline`: after `SALES_INTELLIGENCE_OFFLINE_MS` (30 s) without the stream (`connecting` or `reconnecting`).
 * - Fallback poll: while the stream isn't open, every active read is invalidated every 60 s
 *   (`useSalesIntelligenceLive` owns the timed resync, so no read hook needs a `refetchInterval`).
 * - On (re)connect everything is refetched (the existing `onopen` rule).
 * - `lastFrameAt` is the server `as_of` of the newest change frame (never the browser clock); null before one.
 */
import { useEffect, useState } from "react";
import {
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

/** Opens the stream (once per page) and returns `{ status, lastFrameAt }`. */
export function useLive(): LiveState {
  const raw = useSalesIntelligenceLive();
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
  return { status, lastFrameAt: pulse.at };
}
