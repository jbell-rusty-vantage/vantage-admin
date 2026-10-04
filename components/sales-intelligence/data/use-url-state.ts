"use client";
/**
 * `useSiUrlState()` reads and writes the Sales Intelligence URL (see url-state.ts for the rules). Writes use
 * `router.push(…, { scroll: false })` inside a transition, so browser Back/Forward restores filter choices and a
 * suspended region keeps showing its old data while the new request loads; `isPending` drives the progress bar.
 */
import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseSiUrl, siUrlUpdate, type SiUrlPatch, type SiUrlState } from "./url-state";

export function useSiUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const query = params.toString();
  const state: SiUrlState = useMemo(() => parseSiUrl(new URLSearchParams(query)), [query]);
  const update = useCallback((patch: SiUrlPatch) => {
    const next = siUrlUpdate(query, patch).toString();
    if (next === query) return;
    startTransition(() => router.push(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  }, [pathname, query, router]);
  return { state, update, isPending, query };
}
