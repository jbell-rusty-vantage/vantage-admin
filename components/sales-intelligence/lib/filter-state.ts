const FILTERS_OPEN_KEY = "vantage-admin-si-filters-open";

export function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

export function toggleValue(values: readonly string[], next: string): string[] {
  return values.includes(next) ? values.filter((value) => value !== next) : [...values, next];
}

/** Per-viewer convenience: whether the Numbers filter rail is open. Storage can be unavailable; open is the default. */
export function readFiltersOpen(): boolean {
  try {
    return typeof window === "undefined" || window.localStorage.getItem(FILTERS_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writeFiltersOpen(open: boolean) {
  try {
    window.localStorage.setItem(FILTERS_OPEN_KEY, String(open));
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}
