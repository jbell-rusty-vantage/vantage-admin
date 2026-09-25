"use client";
/**
 * UI1-LIVE: the newest `as_of` on screen, for `Live · Updated {t}` (UI-0 §2.5). Page hooks report the `as_of` of
 * each response they render (`useReportAsOf(asOf)`); the header shows the newest. Server times only.
 */
import { useEffect, useSyncExternalStore } from "react";

let newest: string | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Keeps the later of the current value and `asOf`. Empty or unparseable values are ignored. */
export function reportAsOf(asOf: string | null | undefined) {
  if (!asOf) return;
  const next = Date.parse(asOf);
  if (Number.isNaN(next)) return;
  if (newest !== null && Date.parse(newest) >= next) return;
  newest = asOf;
  emit();
}
/** Tests only. */
export function resetNewestAsOf() {
  newest = null;
  emit();
}
export const readNewestAsOf = () => newest;

export function useNewestAsOf(): string | null {
  return useSyncExternalStore(subscribe, readNewestAsOf, () => null);
}

/** Reports after render (never during it). Region components call this with their response's `as_of`. */
export function useReportAsOf(asOf: string | null | undefined) {
  useEffect(() => {
    reportAsOf(asOf);
  }, [asOf]);
}
