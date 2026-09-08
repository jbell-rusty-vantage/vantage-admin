"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearAllArrivalHighlightTimers,
  eventsForDailyOperationsArrivals,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

export function ArrivalsStream({
  events,
  company,
  quietPriorities,
  hydrated = true,
}: {
  events: DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  hydrated?: boolean;
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
    setHighlightedIds((current) => new Set([...current, ...arrived]));
    setJustNowIds((current) => new Set([...current, ...arrived]));
    schedulePerIdArrivalHighlightClear(highlightTimersRef.current, arrived, (expired) => {
      setHighlightedIds((current) => {
        const next = new Set(current);
        for (const id of expired) {
          next.delete(id);
        }
        return next;
      });
    });
  }, [boardKey, hydrated]);

  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => {
      clearAllArrivalHighlightTimers(timers);
    };
  }, []);

  return (
    <section data-band="arrivals">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {DAILY_COPY.arrivals}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {arrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{DAILY_COPY.arrivalsEmpty}</p>
          ) : (
            <div className="space-y-2">
              {arrivals.map((event) => (
                <DailyOperationsEventCard
                  key={event.event_id}
                  event={event}
                  highlight={highlightedIds.has(event.event_id)}
                  justNow={justNowIds.has(event.event_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
