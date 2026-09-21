const FILTERS_OPEN_KEY = "vantage-admin-si-filters-open";

export const ATTENTION_LIST_KEYS = ["band", "state", "agent_id"] as const;
export const NUMBER_LIST_KEYS = ["classification"] as const;

export function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

export function writeList(params: URLSearchParams, key: string, values: readonly string[]) {
  params.delete(key);
  for (const value of values) {
    if (value) params.append(key, value);
  }
}

export function toggleValue(values: readonly string[], next: string): string[] {
  return values.includes(next) ? values.filter((value) => value !== next) : [...values, next];
}

export function readFiltersOpen(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(FILTERS_OPEN_KEY) !== "false";
}

export function writeFiltersOpen(open: boolean) {
  window.localStorage.setItem(FILTERS_OPEN_KEY, String(open));
}

export type AttentionFilterValue = {
  bands: string[];
  needs_review: boolean;
  states: string[];
  agent_ids: string[];
};

export function attentionFiltersFromParams(params: URLSearchParams): AttentionFilterValue {
  return {
    bands: readList(params, "band"),
    needs_review: params.get("needs_review") === "true",
    states: readList(params, "state"),
    agent_ids: readList(params, "agent_id"),
  };
}

export function applyAttentionFilters(params: URLSearchParams, value: AttentionFilterValue) {
  writeList(params, "band", value.bands);
  writeList(params, "state", value.states);
  writeList(params, "agent_id", value.agent_ids);
  if (value.needs_review) params.set("needs_review", "true");
  else params.delete("needs_review");
}

export function attentionQueryString(value: AttentionFilterValue, cursor: string | null): string {
  const query = new URLSearchParams({ limit: "50" });
  applyAttentionFilters(query, value);
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}
