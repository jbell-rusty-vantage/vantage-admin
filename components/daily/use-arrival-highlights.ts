"use client";

import { useEffect, useRef, useState } from "react";
import { bumpNow } from "@/components/daily/use-now";
import {
  clearAllArrivalHighlightTimers,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

const EMPTY: ReadonlySet<string> = new Set();

export type ArrivalHighlights = {
  /** Ids inside their 1.5s insert highlight. */
  highlightedIds: ReadonlySet<string>;
  /** Ids whose stamp still reads `Just now`. */
  justNowIds: ReadonlySet<string>;
};

export const EMPTY_ARRIVAL_HIGHLIGHTS: ArrivalHighlights = { highlightedIds: EMPTY, justNowIds: EMPTY };

/**
 * One board-wide record of which facts just landed this session. The shell
 * owns it and hands the same sets to Arrivals, every panel, and the overlay,
 * so a fact animates in wherever it is visible and never twice. Seeding rules
 * live in `seedOrArriveDailyOperationsEventIds`: the hydration fetch does not
 * flash; only facts never seen before do.
 */
export function useArrivalHighlights(
  events: readonly DailyOperationsEventItem[],
  hydrated: boolean,
): ArrivalHighlights {
  const boardKey = events.map((row) => row.event_id).join("\0");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(EMPTY);
  const [justNowIds, setJustNowIds] = useState<ReadonlySet<string>>(EMPTY);

  useEffect(() => {
    const nextRawIds = boardKey === "" ? [] : boardKey.split("\0");
    const { arrived, seen, seeded } = seedOrArriveDailyOperationsEventIds(seenIdsRef.current, nextRawIds, {
      hydrated,
      seeded: seededRef.current,
    });
    seenIdsRef.current = seen;
    seededRef.current = seeded;
    if (arrived.length === 0) {
      return;
    }
    bumpNow();
    setHighlightedIds((current) => new Set([...current, ...arrived]));
    setJustNowIds((current) => new Set([...current, ...arrived]));
    schedulePerIdArrivalHighlightClear(timersRef.current, arrived, (expired) => {
      const drop = (current: ReadonlySet<string>) => {
        const next = new Set(current);
        for (const id of expired) {
          next.delete(id);
        }
        return next;
      };
      setHighlightedIds(drop);
      setJustNowIds(drop);
    });
  }, [boardKey, hydrated]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      clearAllArrivalHighlightTimers(timers);
    };
  }, []);

  return { highlightedIds, justNowIds };
}
