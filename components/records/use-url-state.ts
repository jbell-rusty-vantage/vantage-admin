"use client";
/**
 * URL-held workspace state (doc 03: everything stays in the URL). `toUpdate` turns a state patch into the query keys
 * it changes; the hook applies it on top of the latest query it pushed, so several updates in one tick (a filter plus
 * its dependent feed) build on each other instead of racing the router.
 */
import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyUrlStateUpdate, type UrlStateUpdate } from "@/lib/api/url-state-update";

export type UrlStateUpdater<Patch> = (patch: Patch, options?: { replace?: boolean }) => void;

export function useUrlState<Patch>(toUpdate: (patch: Patch) => UrlStateUpdate): UrlStateUpdater<Patch> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const latestQuery = useRef(searchParams.toString());
  const pendingPush = useRef(false);
  useEffect(() => {
    const current = searchParams.toString();
    if (current === latestQuery.current) {
      pendingPush.current = false;
      return;
    }
    if (!pendingPush.current) latestQuery.current = current;
  }, [searchParams]);
  return useCallback(
    (patch: Patch, options: { replace?: boolean } = {}) => {
      const params = applyUrlStateUpdate(latestQuery.current, toUpdate(patch));
      const query = params.toString();
      latestQuery.current = query;
      pendingPush.current = true;
      const href = query ? `${pathname}?${query}` : pathname;
      if (options.replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router, toUpdate],
  );
}
