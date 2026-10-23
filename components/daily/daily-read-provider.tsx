"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { bindDailyReadVisibility, createDailyReadCoordinator, type DailyReadState } from "@/lib/dailyOperationsReadCoordinator";
import { fetchDailyOperationsReadView, type DailyOperationsReadView } from "@/lib/api/dailyOperationsRead";
const empty: DailyReadState<DailyOperationsReadView> = { data: null, error: null, loading: false, paused: true };
const DailyReadContext = createContext({ ...empty, refresh: () => {} });
/** Exactly one coordinator per authorized shell; every child consumes this same state. */
export function DailyOperationsReadProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [coordinator] = useState(() => createDailyReadCoordinator({ load: fetchDailyOperationsReadView, interval: data => data.poll_after_ms }));
  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, () => empty);
  useEffect(() => bindDailyReadVisibility(coordinator, {
    enabled, page: document, network: window, online: () => navigator.onLine !== false,
  }), [coordinator, enabled]);
  return <DailyReadContext.Provider value={{ ...(enabled ? state : empty), refresh: coordinator.refresh }}>{children}</DailyReadContext.Provider>;
}
export const useDailyOperationsRead = () => useContext(DailyReadContext);
