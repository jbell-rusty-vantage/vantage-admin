"use client";

import { useCallback, useSyncExternalStore } from "react";
import { readPreferenceFlag, writePreferenceFlag } from "@/lib/api/dailyOperationsBoard";

const listeners = new Set<() => void>();

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * An Owner preference (`"1"` in localStorage) read as an external store. The
 * server render and first client paint see `false`; the stored value applies
 * as soon as the store is read on the client, so hydration never mismatches
 * and no effect has to copy storage into React state.
 */
export function useStoredPreferenceFlag(key: string): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPreferenceFlag(storageOrNull(), key),
    () => false,
  );
  const write = useCallback(
    (on: boolean) => {
      writePreferenceFlag(storageOrNull(), key, on);
      notify();
    },
    [key],
  );
  return [value, write];
}
