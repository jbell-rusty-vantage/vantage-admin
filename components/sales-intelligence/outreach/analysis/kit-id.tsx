"use client";
/**
 * UI1-ANALYSIS-WIRE: element ids of the analysis kit. The Outreach route renders the kit once, so its ids are the bare
 * anchors the deep links name (`#scores`, `#full-output`, `#findings`, `#conversations`, `si-finding-{id}`, …). A page
 * that renders the kit twice (the gallery's 390 px frame) wraps the second copy in `KitIdProvider value="…-"`, and every
 * id, `aria-labelledby` and in-page link inside it takes that prefix, so no id repeats.
 */
import { createContext, useContext } from "react";

const KitIdContext = createContext("");
export const KitIdProvider = KitIdContext.Provider;

/** The prefix itself (a stable string, for effect dependencies). */
export const useKitPrefix = () => useContext(KitIdContext);

/** `kid("scores")` → `"scores"` on the route, `"{prefix}scores"` inside a prefixed copy. */
export function useKitId(): (base: string) => string {
  const prefix = useContext(KitIdContext);
  return (base: string) => prefix + base;
}
