import type { SerializableFilters } from "@/lib/api/filters";
import type { TableQueryParams } from "@/lib/api/types";

const URL_ONLY_KEYS = ["record", "connect", "panel"] as const;

export function apiFiltersFromUrlState(filters: TableQueryParams): SerializableFilters {
  const apiFilters: SerializableFilters = { ...filters };
  for (const key of URL_ONLY_KEYS) {
    delete apiFilters[key];
  }
  return apiFilters;
}

export function requestedPanelFromUrl(filters: TableQueryParams): string | undefined {
  const value = filters.panel;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function connectFromUrl(filters: TableQueryParams): boolean {
  return filters.connect === "1" || filters.connect === 1;
}
