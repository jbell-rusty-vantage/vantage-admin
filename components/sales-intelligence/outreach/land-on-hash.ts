"use client";
/**
 * UI1-ANALYSIS-WIRE: land on `location.hash` once the target is rendered. The Outreach route renders client-side and
 * its regions fill after the browser's own hash scroll has already missed, so a deep link (`#scores`,
 * `#full-output`, `#review-item-{id}`) is scrolled to here. Layout keeps moving while the regions above fill in, so the
 * target is re-landed on every size change of `root` for a few seconds, and never again once the person scrolls,
 * types or taps.
 */
import { useEffect, type RefObject } from "react";

/** How long the hash target is held in place while the page above it settles (ms). */
export const LAND_SETTLE_MS = 4000;
const STOP_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

export function hashTarget(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.slice(1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** `ready`: the part that holds the target has rendered its data (for example the review items list). */
export function useLandOnHash(root: RefObject<HTMLElement | null>, ready = true) {
  useEffect(() => {
    const el = root.current;
    const id = hashTarget();
    if (!ready || !el || !id) return;
    const find = () => {
      const found = document.getElementById(id);
      return found && el.contains(found) ? found : null;
    };
    if (!find()) return;
    let active = true;
    const land = () => {
      if (active) find()?.scrollIntoView({ block: "start" });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(land);
    const stop = () => {
      active = false;
      observer?.disconnect();
      for (const name of STOP_EVENTS) window.removeEventListener(name, stop);
    };
    land();
    observer?.observe(el);
    for (const name of STOP_EVENTS) window.addEventListener(name, stop, { passive: true });
    const timer = window.setTimeout(stop, LAND_SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [root, ready]);
}
