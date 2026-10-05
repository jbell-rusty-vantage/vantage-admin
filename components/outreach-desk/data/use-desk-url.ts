"use client";
/**
 * Reads and writes the desk URL (`desk-url.ts` owns the rules). Writes push a canonical URL inside a transition so
 * Back/Forward restore filters and the current rows stay on screen while the next request loads. Selection lives
 * in the URL as `lead=<subject_id>`, never as a row position.
 */
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { OutreachDeskRole } from "@/server/models/adminRoles";
import { DESK_PATH, canonicalDeskQuery } from "./desk-url";

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
      startTransition(() => (options?.replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
    },
    [role, router],
  );
  const hrefWith = useCallback((patch: DeskUrlPatch) => deskHrefWith(query, patch, role), [query, role]);
  return { get, update, hrefWith, isPending, query };
}
