import { floridaCalendarToday } from "@/lib/floridaTime";
import type { DatabaseScope, SortDirection, TableQueryParams } from "./types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type SerializableFilterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly string[];

export type SerializableFilters = Record<string, SerializableFilterValue>;

export type DatePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "month_to_date"
  | "previous_month"
  | "year_to_date"
  | "all_time"
  | "custom";

export type DateRange = {
  from?: string;
  to?: string;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}


function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getDatePresetRange(preset: DatePreset, now = new Date()): DateRange {
  const today = floridaCalendarToday(now);

  switch (preset) {
    case "today":
      return { from: formatDate(today), to: formatDate(today) };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    }
    case "last_7_days":
      return { from: formatDate(addDays(today, -6)), to: formatDate(today) };
    case "last_30_days":
      return { from: formatDate(addDays(today, -29)), to: formatDate(today) };
    case "month_to_date":
      return {
        from: formatDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
        to: formatDate(today),
      };
    case "previous_month": {
      const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const firstOfPreviousMonth = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      return {
        from: formatDate(firstOfPreviousMonth),
        to: formatDate(addDays(firstOfThisMonth, -1)),
      };
    }
    case "year_to_date":
      return {
        from: formatDate(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))),
        to: formatDate(today),
      };
    case "all_time":
    case "custom":
      return {};
  }
}

export function serializeFilters(filters: SerializableFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item.trim()) {
          params.append(key, item);
        }
      }
      continue;
    }

    params.set(key, String(value));
  }

  return params;
}

export function filtersToQueryString(filters: SerializableFilters): string {
  const value = serializeFilters(filters).toString();
  return value ? `?${value}` : "";
}

export function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export function parseNumberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePageSize(value: string | null): number {
  const parsed = parseNumberParam(value);
  return parsed && PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

export function parseSortDirection(value: string | null): SortDirection | undefined {
  return value === "asc" || value === "desc" ? value : undefined;
}

export function parseDatabaseScope(value: string | null): DatabaseScope {
  return value === "historical" || value === "combined" ? value : "production";
}

export function parseTableQueryParams(searchParams: URLSearchParams): TableQueryParams {
  return {
    page: Math.max(parseNumberParam(searchParams.get("page")) ?? DEFAULT_PAGE, 1),
    limit: parsePageSize(searchParams.get("limit")),
    sort: searchParams.get("sort") ?? undefined,
    direction: parseSortDirection(searchParams.get("direction")),
    database_scope: parseDatabaseScope(searchParams.get("database_scope")),
    q: searchParams.get("q") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    date_field: searchParams.get("date_field") ?? undefined,
  };
}

export function pageToSkip(page: number, limit: number): number {
  return Math.max(page - 1, 0) * limit;
}

export function withLegacyPagination(filters: SerializableFilters): SerializableFilters {
  const page = typeof filters.page === "number" ? filters.page : DEFAULT_PAGE;
  const limit = typeof filters.limit === "number" ? filters.limit : DEFAULT_PAGE_SIZE;
  const rest = { ...filters };
  delete rest.page;

  return {
    ...rest,
    limit,
    skip: pageToSkip(page, limit),
  };
}
