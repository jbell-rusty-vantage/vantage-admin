"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  DAILY_KIND_COLORS_STORAGE_KEY,
  kindToneFor,
  readKindToneOverrides,
  toneClasses,
  withKindTone,
  writeKindToneOverrides,
  type DailyOperationsKind,
  type DailyOperationsKindToneOverrides,
  type DailyOperationsTone,
  type DailyOperationsToneClasses,
} from "@/lib/api/dailyOperationsColors";

const EMPTY_OVERRIDES: DailyOperationsKindToneOverrides = {};
const KindColorsContext = createContext<DailyOperationsKindToneOverrides>(EMPTY_OVERRIDES);

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: DailyOperationsKindToneOverrides = EMPTY_OVERRIDES;

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readSnapshot(): DailyOperationsKindToneOverrides {
  const storage = storageOrNull();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(DAILY_KIND_COLORS_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = raw ? readKindToneOverrides(storage) : EMPTY_OVERRIDES;
  }
  return cachedValue;
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
 * Owner colour overrides backed by localStorage. The server render (and the
 * first client paint) uses the catalog defaults; the stored overrides apply
 * as soon as the store is read on the client, so hydration never mismatches.
 */
export function useStoredKindTones(): {
  overrides: DailyOperationsKindToneOverrides;
  pick: (kind: DailyOperationsKind, tone: DailyOperationsTone) => void;
  reset: () => void;
} {
  const overrides = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_OVERRIDES);
  const pick = useCallback((kind: DailyOperationsKind, tone: DailyOperationsTone) => {
    writeKindToneOverrides(storageOrNull(), withKindTone(readSnapshot(), kind, tone));
    notify();
  }, []);
  const reset = useCallback(() => {
    writeKindToneOverrides(storageOrNull(), {});
    notify();
  }, []);
  return { overrides, pick, reset };
}

/**
 * Owner colour overrides for Daily Operations Event kinds. Cards, Arrivals
 * dots, and panel headers read the resolved tone through `useKindTone`.
 * Without a provider (unit tests, Live Events) the catalog defaults apply.
 */
export function KindColorsProvider({
  overrides,
  children,
}: {
  overrides: DailyOperationsKindToneOverrides;
  children: ReactNode;
}) {
  return <KindColorsContext.Provider value={overrides}>{children}</KindColorsContext.Provider>;
}

export function useKindToneOverrides(): DailyOperationsKindToneOverrides {
  return useContext(KindColorsContext);
}

export function useKindTone(kind: string, lane?: string | null): {
  tone: DailyOperationsTone;
  classes: DailyOperationsToneClasses;
} {
  const overrides = useContext(KindColorsContext);
  const tone = kindToneFor(kind, overrides, lane);
  return { tone, classes: toneClasses(tone) };
}
