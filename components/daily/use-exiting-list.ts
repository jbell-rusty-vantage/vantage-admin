"use client";

import { useEffect, useRef, useState } from "react";

export const DAILY_ROW_EXIT_MS = 380;
/** More than this many rows leaving at once (a filter flip) just drop; a flood of exits is noise. */
export const DAILY_ROW_EXIT_ANIMATED_MAX = 8;

export type ExitingRow<T> = {
  key: string;
  item: T;
  exiting: boolean;
};

type Exiting<T> = {
  item: T;
  /** Index the row held in the previous render, so it slides out of its own slot. */
  index: number;
};

/**
 * Keeps rows that just left `items` on screen for `exitMs`, flagged
 * `exiting`, so the stream can slide them away instead of snapping. The
 * server render and the first paint return `items` untouched. Rows keep their
 * old slot while leaving; rows that come back before the timer fires are
 * simply live again.
 */
export function useExitingList<T>(
  items: readonly T[],
  getKey: (item: T) => string,
  exitMs = DAILY_ROW_EXIT_MS,
): ExitingRow<T>[] {
  const previousRef = useRef<readonly T[]>(items);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [exiting, setExiting] = useState<Map<string, Exiting<T>>>(() => new Map());

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = items;
    const nextKeys = new Set(items.map(getKey));
    const left: Array<{ key: string; item: T; index: number }> = [];
    previous.forEach((item, index) => {
      const key = getKey(item);
      if (!nextKeys.has(key)) {
        left.push({ key, item, index });
      }
    });
    const timers = timersRef.current;
    const revived = [...timers.keys()].filter((key) => nextKeys.has(key));
    if (left.length === 0 && revived.length === 0) {
      return;
    }
    const animated = left.length <= DAILY_ROW_EXIT_ANIMATED_MAX ? left : [];
    setExiting((current) => {
      const next = new Map(current);
      for (const key of revived) {
        clearTimeout(timers.get(key));
        timers.delete(key);
        next.delete(key);
      }
      for (const row of animated) {
        next.set(row.key, { item: row.item, index: row.index });
        clearTimeout(timers.get(row.key));
        timers.set(
          row.key,
          setTimeout(() => {
            timers.delete(row.key);
            setExiting((after) => {
              if (!after.has(row.key)) {
                return after;
              }
              const cleared = new Map(after);
              cleared.delete(row.key);
              return cleared;
            });
          }, exitMs),
        );
      }
      return next;
    });
  }, [items, getKey, exitMs]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const rows: ExitingRow<T>[] = items.map((item) => ({ key: getKey(item), item, exiting: false }));
  if (exiting.size === 0) {
    return rows;
  }
  const liveKeys = new Set(rows.map((row) => row.key));
  const leaving = [...exiting.entries()]
    .filter(([key]) => !liveKeys.has(key))
    .sort((left, right) => left[1].index - right[1].index);
  for (const [key, row] of leaving) {
    const at = Math.min(row.index, rows.length);
    rows.splice(at, 0, { key, item: row.item, exiting: true });
  }
  return rows;
}
