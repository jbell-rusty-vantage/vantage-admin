"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, parseDatabaseScope, parseTableQueryParams } from "./filters";
import type { DatabaseScope, SortDirection, TableQueryParams } from "./types";
import { applyUrlStateUpdate, type UrlStateUpdate } from "./url-state-update";

export type { UrlStateUpdate };
export { applyUrlStateUpdate };

export function useUrlTableState(defaults: Partial<TableQueryParams> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const latestQueryRef = useRef(searchParams.toString());
  const pendingPushRef = useRef(false);

  useEffect(() => {
    const current = searchParams.toString();
    if (current === latestQueryRef.current) {
      pendingPushRef.current = false;
      return;
    }
    if (!pendingPushRef.current) {
      latestQueryRef.current = current;
    }
  }, [searchParams]);

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
      const params = applyUrlStateUpdate(latestQueryRef.current, next, options);
      const query = params.toString();
      latestQueryRef.current = query;
      pendingPushRef.current = true;
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
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
    latestQueryRef.current = query;
    pendingPushRef.current = true;
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
