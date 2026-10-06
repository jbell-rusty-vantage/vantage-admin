"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  DAILY_KIND_TIERS_STORAGE_KEY,
  readTierOverrides,
  withKindTier,
  writeTierOverrides,
  type DailyOperationsTier,
  type DailyOperationsTierOverrides,
} from "@/lib/api/dailyOperationsBoard";

const EMPTY_OVERRIDES: DailyOperationsTierOverrides = {};
const KindTiersContext = createContext<DailyOperationsTierOverrides>(EMPTY_OVERRIDES);

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: DailyOperationsTierOverrides = EMPTY_OVERRIDES;

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readSnapshot(): DailyOperationsTierOverrides {
  const storage = storageOrNull();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(DAILY_KIND_TIERS_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = raw ? readTierOverrides(storage) : EMPTY_OVERRIDES;
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
 * Per-viewer tier overrides ("Colours & visibility"), backed by localStorage beside the colours. Not runtime
 * configuration: nobody else sees them. The server render and first paint use the doc 16 table.
 */
export function useStoredKindTiers(): {
  overrides: DailyOperationsTierOverrides;
  pick: (kind: string, tier: DailyOperationsTier) => void;
  reset: () => void;
} {
  const overrides = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_OVERRIDES);
  const pick = useCallback((kind: string, tier: DailyOperationsTier) => {
    writeTierOverrides(storageOrNull(), withKindTier(readSnapshot(), kind, tier));
    notify();
  }, []);
  const reset = useCallback(() => {
    writeTierOverrides(storageOrNull(), {});
    notify();
  }, []);
  return { overrides, pick, reset };
}

export function KindTiersProvider({ overrides, children }: { overrides: DailyOperationsTierOverrides; children?: ReactNode }) {
  return <KindTiersContext.Provider value={overrides}>{children}</KindTiersContext.Provider>;
}

export function useKindTierOverrides(): DailyOperationsTierOverrides {
  return useContext(KindTiersContext);
}
