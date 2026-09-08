"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_COPY, formatDailyOperationsRelative } from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import { bumpNow, useNowMs } from "@/components/daily/use-now";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  clearAllArrivalHighlightTimers,
  countRecentDailyOperationsEvents,
  eventsForDailyOperationsArrivals,
  newestDailyOperationsEventAt,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

const ARRIVALS_PULSE_WINDOW_MS = 15 * 60_000;

/**
 * Newest-first stream of today's Events across every lane. The header is the
 * broadcast chrome: a live dot, how many facts landed in the last 15 minutes,
 * how many are in view, and how long since the last fact. Cards read relative
 * time once the browser clock is available; the server render shows the
 * Florida clock so hydration stays clean.
 */
export function ArrivalsStream({
  events,
  company,
  quietPriorities,
  hydrated = true,
  liveState = "live",
  todayCount,
  className,
}: {
  events: DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  hydrated?: boolean;
  liveState?: LiveDotState;
  /** Total facts today across lanes (snapshot-derived). Optional; falls back to items in view. */
  todayCount?: number | null;
  className?: string;
}) {
  const arrivals = eventsForDailyOperationsArrivals({
    events,
    company,
    quietPriorities,
  });
  const boardKey = events.map((row) => row.event_id).join("\0");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const highlightTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(new Set());
  const [justNowIds, setJustNowIds] = useState<ReadonlySet<string>>(new Set());
  const nowMs = useNowMs();

  useEffect(() => {
    const nextRawIds = boardKey === "" ? [] : boardKey.split("\0");
    const { arrived, seen, seeded } = seedOrArriveDailyOperationsEventIds(
      seenIdsRef.current,
      nextRawIds,
      { hydrated, seeded: seededRef.current },
    );
    seenIdsRef.current = seen;
    seededRef.current = seeded;
    if (arrived.length === 0) {
      return;
    }
    bumpNow();
    setHighlightedIds((current) => new Set([...current, ...arrived]));
    setJustNowIds((current) => new Set([...current, ...arrived]));
    schedulePerIdArrivalHighlightClear(highlightTimersRef.current, arrived, (expired) => {
      const drop = (current: ReadonlySet<string>) => {
        const next = new Set(current);
        for (const id of expired) {
          next.delete(id);
        }
        return next;
      };
      setHighlightedIds(drop);
      // Once the highlight settles the stamp goes relative (`Just now` → `12s ago`).
      setJustNowIds(drop);
    });
  }, [boardKey, hydrated]);

  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      clearAllArrivalHighlightTimers(timers);
    };
  }, []);

  const newestAt = newestDailyOperationsEventAt(arrivals);
  const recent = nowMs === undefined ? 0 : countRecentDailyOperationsEvents(arrivals, nowMs, ARRIVALS_PULSE_WINDOW_MS);
  const lastFact =
    newestAt && nowMs !== undefined
      ? formatDailyOperationsRelative(newestAt, nowMs)
      : newestAt
        ? null
        : DAILY_COPY.noFactYet;

  return (
    <section data-band="arrivals" className={cn("flex flex-col", className)}>
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="border-b border-steel-100 p-3 pb-2.5">
          <div className="flex items-center gap-2">
            <LiveDot state={liveState} />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">
              {DAILY_COPY.arrivals}
            </h2>
            {recent > 0 ? (
              <span
                className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700"
                title="last 15 minutes"
              >
                +{recent}
              </span>
            ) : null}
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {todayCount != null ? (
                <>
                  <span className="font-semibold text-navy">{todayCount}</span> {DAILY_COPY.arrivalsToday} ·{" "}
                </>
              ) : null}
              {arrivals.length} {DAILY_COPY.arrivalsInMemory}
            </span>
          </div>
          <p className="mt-1 flex items-baseline justify-between gap-2 text-[11px] text-steel">
            <span>{DAILY_COPY.arrivalsSubtitle}</span>
            {lastFact ? (
              <span className="tabular-nums" data-last-fact>
                {DAILY_COPY.lastFact} {lastFact}
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="daily-stream-body relative flex-1 p-3 pt-2.5">
          {arrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{DAILY_COPY.arrivalsEmpty}</p>
          ) : (
            <ol className="space-y-2">
              {arrivals.map((event, index) => (
                <li
                  key={event.event_id}
                  className={cn(highlightedIds.has(event.event_id) && "daily-arrival-enter")}
                  data-arrival-index={index}
                >
                  <DailyOperationsEventCard
                    event={event}
                    highlight={highlightedIds.has(event.event_id)}
                    justNow={justNowIds.has(event.event_id)}
                    nowMs={nowMs}
                    compact
                  />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
