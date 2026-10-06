"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parseTableQueryParams,
  withoutRetiredDatabaseScope,
} from "./filters";
import type { SortDirection, TableQueryParams } from "./types";
import { applyUrlStateUpdate, type UrlStateUpdate } from "./url-state-update";

export type { UrlStateUpdate };
export type UrlStateUpdateOptions = { resetPage?: boolean; replace?: boolean };
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
    const current = new URLSearchParams(searchParams.toString());
    const params = withoutRetiredDatabaseScope(current) ?? current;
    return {
      ...defaults,
      ...Object.fromEntries(params.entries()),
      ...parseTableQueryParams(params),
      page: Number(params.get("page") ?? defaults.page ?? DEFAULT_PAGE),
      limit: Number(params.get("limit") ?? defaults.limit ?? DEFAULT_PAGE_SIZE),
    } as TableQueryParams;
  }, [defaults, searchParams]);

  const update = useCallback(
    (next: UrlStateUpdate, options: UrlStateUpdateOptions = { resetPage: true }) => {
      const params = applyUrlStateUpdate(latestQueryRef.current, next, { resetPage: options.resetPage ?? true });
      const query = params.toString();
      latestQueryRef.current = query;
      pendingPushRef.current = true;
      const href = query ? `${pathname}?${query}` : pathname;
      // Typing in a search box replaces the entry so Back does not walk through every keystroke burst.
      if (options.replace) router.replace(href);
      else router.push(href);
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

  const reset = useCallback(() => {
    latestQueryRef.current = "";
    pendingPushRef.current = true;
    router.push(pathname);
  }, [pathname, router]);

  return {
    filters,
    searchParams,
    update,
    setSort,
    setPage,
    setLimit,
    reset,
  };
}
