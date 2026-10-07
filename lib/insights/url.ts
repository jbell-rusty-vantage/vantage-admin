/**
 * The Analytics page's URL (doc 09 "The controls"): `?period&compare&from&to&sources` (the server query, parsed by
 * `parseInsightsQuery`) plus the page's own `tab`, `basis` (Sources) and `cmp` (head-to-head selection). Everything
 * on screen can be bookmarked.
 */
import { insightsSearchParams, parseInsightsQuery, type InsightsQuery } from "@/lib/api/insights";

export const ANALYTICS_TABS = ["overview", "sources", "team", "bookings", "reviews"] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

export const ANALYTICS_TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  sources: "Sources",
  team: "Team",
  bookings: "Bookings & cancellations",
  reviews: "Reviews",
};

/** Sources basis: leads that arrived in the period (cohort, default) or bookings made in the period (activity). */
export type SourcesBasis = "cohort" | "activity";

/** Up to four entities side by side. */
export const COMPARE_MAX = 4;

export type AnalyticsUrlState = {
  query: InsightsQuery;
  tab: AnalyticsTab;
  basis: SourcesBasis;
  cmp: string[];
};

export function parseAnalyticsTab(value: string | null | undefined): AnalyticsTab {
  return ANALYTICS_TABS.find((tab) => tab === value) ?? "overview";
}

/** `cmp=key1,key2`: trimmed, de-duplicated, at most four. */
export function parseCompareKeys(value: string | null | undefined): string[] {
  const keys: string[] = [];
  for (const part of (value ?? "").split(",")) {
    const key = part.trim();
    if (key && !keys.includes(key)) keys.push(key);
    if (keys.length === COMPARE_MAX) break;
  }
  return keys;
}

export function parseAnalyticsUrl(params: Pick<URLSearchParams, "get">): AnalyticsUrlState {
  return {
    query: parseInsightsQuery(params),
    tab: parseAnalyticsTab(params.get("tab")),
    basis: params.get("basis") === "activity" ? "activity" : "cohort",
    cmp: parseCompareKeys(params.get("cmp")),
  };
}

/** The search string for a state ("?period=last_30&compare=previous&tab=sources"). Defaults are left out. */
export function analyticsSearch(state: AnalyticsUrlState): string {
  const params = insightsSearchParams(state.query);
  if (state.tab !== "overview") params.set("tab", state.tab);
  if (state.basis !== "cohort") params.set("basis", state.basis);
  if (state.cmp.length) params.set("cmp", state.cmp.slice(0, COMPARE_MAX).join(","));
  const text = params.toString().replace(/%2C/gi, ",");
  return text ? `?${text}` : "";
}

/** Applies a change. Changing tab clears the head-to-head selection (its keys belong to the other tab's table). */
export function patchAnalyticsState(state: AnalyticsUrlState, patch: Partial<AnalyticsUrlState>): AnalyticsUrlState {
  const next = { ...state, ...patch, query: patch.query ? { ...patch.query } : state.query };
  if (patch.tab && patch.tab !== state.tab && !patch.cmp) next.cmp = [];
  return next;
}
