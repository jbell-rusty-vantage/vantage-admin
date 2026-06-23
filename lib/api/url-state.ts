"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, parseDatabaseScope, parseTableQueryParams } from "./filters";
import type { DatabaseScope, SortDirection, TableQueryParams } from "./types";

export type UrlStateUpdate = Record<string, string | number | boolean | null | undefined>;

export function useUrlTableState(defaults: Partial<TableQueryParams> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return {
      ...defaults,
      ...Object.fromEntries(params.entries()),
      ...parseTableQueryParams(params),
      page: Number(params.get("page") ?? defaults.page ?? DEFAULT_PAGE),
      limit: Number(params.get("limit") ?? defaults.limit ?? DEFAULT_PAGE_SIZE),
      database_scope: parseDatabaseScope(params.get("database_scope") ?? String(defaults.database_scope ?? "")),
    } as TableQueryParams;
  }, [defaults, searchParams]);

  const update = useCallback(
    (next: UrlStateUpdate, options: { resetPage?: boolean } = { resetPage: true }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (options.resetPage) {
        params.set("page", "1");
      }

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setSort = useCallback(
    (field: string, direction: SortDirection) => {
      update({ sort: field, direction }, { resetPage: true });
    },
    [update],
  );

  const setPage = useCallback(
    (page: number) => {
      update({ page }, { resetPage: false });
    },
    [update],
  );

  const setLimit = useCallback(
    (limit: number) => {
      update({ limit, page: 1 }, { resetPage: false });
    },
    [update],
  );

  const setScope = useCallback(
    (scope: DatabaseScope) => {
      update({ database_scope: scope, page: 1 }, { resetPage: false });
    },
    [update],
  );

  const reset = useCallback(() => {
    const params = new URLSearchParams();
    const scope = searchParams.get("database_scope") ?? defaults.database_scope;
    if (scope) {
      params.set("database_scope", String(scope));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [defaults.database_scope, pathname, router, searchParams]);

  return {
    filters,
    searchParams,
    update,
    setSort,
    setPage,
    setLimit,
    setScope,
    reset,
  };
}
