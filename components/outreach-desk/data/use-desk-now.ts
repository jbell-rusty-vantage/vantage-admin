"use client";

import { useEffect, useState } from "react";

/** Relative move/interaction labels only. Filters and cadence presentation retain their server snapshot. */
export function useDeskNow(asOf: string): string {
  const [tick, setTick] = useState<{ asOf: string; now: string } | null>(null);
  useEffect(() => {
    const started = performance.now();
    const update = () => setTick({ asOf, now: new Date(Date.parse(asOf) + Math.max(0, performance.now() - started)).toISOString() });
    const timer = setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [asOf]);
  return tick?.asOf === asOf ? tick.now : asOf;
}
