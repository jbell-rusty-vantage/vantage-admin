"use client";
/**
 * `useSiUrlState()` reads and writes the Sales Intelligence URL (see url-state.ts for the rules). Writes use
 * `router.push(…, { scroll: false })` inside a transition, so browser Back/Forward restores filter choices and a
 * suspended region keeps showing its old data while the new request loads; `isPending` drives the progress bar.
 * An automatic rewrite the Owner didn't ask for (the stale-cursor recovery) passes `{ replace: true }`: it replaces
 * the entry, so the rejected URL never stays in history for Back to land on again.
 */
import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseSiUrl, siUrlUpdate, type SiUrlPatch, type SiUrlState } from "./url-state";

export type SiUrlUpdateOptions = { replace?: boolean };
export type SiUrlUpdate = (patch: SiUrlPatch, options?: SiUrlUpdateOptions) => void;

/** The navigation one `update` makes: `push` (or `replace` when asked), or `null` when the URL wouldn't change. */
export function siNavigation(pathname: string, query: string, patch: SiUrlPatch, options?: SiUrlUpdateOptions): { method: "push" | "replace"; href: string } | null {
  const next = siUrlUpdate(query, patch).toString();
  if (next === query) return null;
  return { method: options?.replace ? "replace" : "push", href: next ? `${pathname}?${next}` : pathname };
}

export function useSiUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const query = params.toString();
  const state: SiUrlState = useMemo(() => parseSiUrl(new URLSearchParams(query)), [query]);
  const update: SiUrlUpdate = useCallback((patch, options) => {
    const nav = siNavigation(pathname, query, patch, options);
    if (!nav) return;
    startTransition(() => (nav.method === "replace" ? router.replace(nav.href, { scroll: false }) : router.push(nav.href, { scroll: false })));
  }, [pathname, query, router]);
  return { state, update, isPending, query };
}
