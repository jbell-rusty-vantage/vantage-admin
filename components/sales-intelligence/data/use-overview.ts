"use client";
/**
 * UI1-DATA: `GET /overview` (UI-1 §4, addendum §6). Re-polls every 60 s and on the `attention`/`outreach`
 * live topics. Envelope `{ ok, data: { as_of, … } }`: the Overview's own `as_of` is inside `data`.
 */
import { useSuspenseQuery } from "@tanstack/react-query";
import { overviewSchema, readSalesIntelligence } from "@/lib/api/salesIntelligence";
import { siKeys } from "./query-keys";
import { overviewQuery, type OverviewParams } from "./requests";

export const OVERVIEW_REFRESH_MS = 60_000;

export function readOverview(params: OverviewParams, signal?: AbortSignal) {
  const query = overviewQuery(params).toString();
  return readSalesIntelligence(query ? `overview?${query}` : "overview", overviewSchema, signal);
}

export function useOverview(params: OverviewParams) {
  const query = useSuspenseQuery({
    queryKey: siKeys.overview(params),
    queryFn: ({ signal }) => readOverview(params, signal),
    refetchInterval: OVERVIEW_REFRESH_MS,
    retry: false,
  });
  return { ...query, overview: query.data.data, asOf: query.data.data.as_of };
}
