"use client";
/**
 * Reads and writes the desk URL (`desk-url.ts` owns the rules). Same-view writes use Next's native History
 * integration so filters/selection start their client reads without a server page round trip. View changes
 * still navigate through the server. Back/Forward restore filters; selection is `lead=<subject_id>`.
 */
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { OutreachDeskRole } from "@/server/models/adminRoles";
import { DESK_PATH, canonicalDeskQuery, parseDeskView } from "./desk-url";

export type DeskUrlPatch = Record<string, string | null | undefined>;

export function deskHrefWith(current: string, patch: DeskUrlPatch, role: OutreachDeskRole): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }
  return `${DESK_PATH}?${canonicalDeskQuery(params, role).toString()}`;
}

export function useDeskUrl(role: OutreachDeskRole) {
  const params = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const query = params.toString();
  const values = useMemo(() => new URLSearchParams(query), [query]);
  const get = useCallback((key: string) => values.get(key), [values]);
  // The URL a write last asked for. A navigation runs in a transition, so `query` is still the old URL until it
  // commits: a second write in that window (switch to All, then search at once) must build on the first one,
  // not on the stale URL, or it silently undoes it. A committed URL (including Back/Forward) resets it.
  const requested = useRef(query);
  useEffect(() => {
    requested.current = query;
  }, [query]);
  const update = useCallback(
    (patch: DeskUrlPatch, options?: { replace?: boolean }) => {
      const href = deskHrefWith(requested.current, patch, role);
      if (href === `${DESK_PATH}?${requested.current}`) return;
      requested.current = href.slice(href.indexOf("?") + 1);
      startTransition(() => {
        // Filters and selection are client reads. Native history integrates with useSearchParams
        // without waiting for a new server page/session read before starting the queue request.
        const next = new URLSearchParams(requested.current);
        if (parseDeskView(values, role) === parseDeskView(next, role)) {
          if (options?.replace) window.history.replaceState(null, "", href);
          else window.history.pushState(null, "", href);
        } else if (options?.replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [role, router, values],
  );
  const hrefWith = useCallback((patch: DeskUrlPatch) => deskHrefWith(query, patch, role), [query, role]);
  return { get, update, hrefWith, isPending, query };
}
