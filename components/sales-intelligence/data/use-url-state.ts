"use client";
/**
 * UI1-DATA: `useDeskUrlState()` reads and writes the desk's URL (see url-state.ts for the rules). Writes use
 * `router.replace(…, { scroll: false })` inside a transition, so a suspended region keeps showing its old
 * data while the new request loads; `isPending` drives the 2 px progress bar (UI-0 §2.4).
 * With a `userId`, a Priority / Lead-toggle change is remembered per user, and on mount a URL without either
 * gets the remembered choice (UI-1 §3.2).
 */
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { readStoredPreset, writeStoredPreset } from "./preset-storage";
import { deskUrlUpdate, parseDeskUrl, type DeskUrlPatch, type DeskUrlState } from "./url-state";

export function useDeskUrlState({ userId }: { userId?: string | null } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const query = params.toString();
  const state: DeskUrlState = useMemo(() => parseDeskUrl(new URLSearchParams(query)), [query]);

  const update = useCallback((patch: DeskUrlPatch) => {
    const next = deskUrlUpdate(query, patch).toString();
    if (userId && ("priority" in patch || "attachment" in patch)) {
      const after = parseDeskUrl(new URLSearchParams(next));
      writeStoredPreset(userId, { priority: after.priority, attachment: after.attachment });
    }
    if (next === query) return;
    startTransition(() => router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false }));
  }, [pathname, query, router, userId]);

  // Read once on mount: the remembered preset fills a URL that names neither Priority nor the Lead toggle.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !userId) return;
    restored.current = true;
    if (state.priority.length || state.attachment) return;
    const stored = readStoredPreset(userId);
    if (stored && (stored.priority.length || stored.attachment)) update({ priority: stored.priority, attachment: stored.attachment });
  }, [state.attachment, state.priority.length, update, userId]);

  return { state, update, isPending, query };
}
