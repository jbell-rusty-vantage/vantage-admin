"use client";
/**
 * Live motion for the desk: a count that rolls to its new value and a brief highlight on whatever just changed.
 * Both stay still on the first paint and only move on a later live change; `prefers-reduced-motion` is honored by
 * `AnimatedNumber` and by the desk's blanket reduced-motion rule in `outreach-desk.css`.
 */
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { countText } from "./lib/format";

const FLASH_MS = 1_200;

/** A desk count (null = pending, in the desk's words) that ticks to each new value. */
export function DeskCount({ value, className }: { value: number | null | undefined; className?: string }) {
  return <AnimatedNumber value={value} format={(n) => String(n)} fallback={countText(null)} className={className} />;
}

/**
 * True for a moment after `signature` changes (never on mount, never for a null signature), so a row or card can
 * carry `od-flash` while the update is fresh. The change is noticed during render; only the timer clears it.
 */
export function useChangeFlash(signature: string | number | null | undefined): boolean {
  const [previous, setPrevious] = useState(signature);
  const [flash, setFlash] = useState(0);
  if (signature !== previous) {
    setPrevious(signature);
    if (previous !== null && previous !== undefined && signature !== null && signature !== undefined) setFlash((n) => n + 1);
  }
  const [cleared, setCleared] = useState(0);
  useEffect(() => {
    if (flash === 0) return;
    const timer = setTimeout(() => setCleared(flash), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);
  return flash !== cleared;
}

const GOAL_TOAST_SEEN_KEY = "vantage-desk-goal-toast-seen";

/** `true` once per key in this browser (all tabs); when storage is unavailable it shows. */
export function firstGoalToast(key: string, storage: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(GOAL_TOAST_SEEN_KEY);
    const seen: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(seen) ? seen.filter((value): value is string => typeof value === "string") : [];
    if (list.includes(key)) return false;
    storage.setItem(GOAL_TOAST_SEEN_KEY, JSON.stringify([...list, key].slice(-30)));
    return true;
  } catch {
    return true;
  }
}

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The Rep's own goal toast on their desk (a Rep has no Daily Operations stream, so the dashboard milestone toast
 * never reaches them). It fires when a live update flips `goal_reached` from false to true for today, never on the
 * first paint of a day already met, and once per rep and day across reloads and tabs.
 */
export function useOwnGoalReached(input: { agentId: string | null; businessDay: string | null; isToday: boolean; reached: boolean | null | undefined }): boolean {
  const key = input.agentId && input.businessDay ? `${input.agentId}:${input.businessDay}` : null;
  const [previous, setPrevious] = useState<{ key: string | null; reached: boolean | null | undefined }>({ key, reached: input.reached });
  const [candidate, setCandidate] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  if (previous.key !== key || previous.reached !== input.reached) {
    setPrevious({ key, reached: input.reached });
    if (key && input.isToday && previous.key === key && previous.reached === false && input.reached === true) setCandidate(key);
  }
  // Storage is checked outside render (a once-per-day write must not run twice under a double render).
  useEffect(() => {
    if (!candidate) return;
    const timer = setTimeout(() => {
      setCandidate(null);
      if (firstGoalToast(candidate, localStorageOrNull())) setShow(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [candidate]);
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), 8_000);
    return () => clearTimeout(timer);
  }, [show]);
  return show;
}
