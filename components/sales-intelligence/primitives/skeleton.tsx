"use client";

import { useEffect, useState, type ReactNode } from "react";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

/** UI-0 §2.4: shimmer lines shaped like the text they stand in for. Static under prefers-reduced-motion. */
export function SkeletonLines({ lines, widths, className }: { lines: number; widths?: (string | number)[]; className?: string }) {
  return (
    <span className={cx("si-skelgroup", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="si-skeleton si-skeleton--line" style={widths?.[i] != null ? { width: widths[i] } : undefined} />
      ))}
    </span>
  );
}

export function SkeletonBlock({ height, width, className }: { height: string | number; width?: string | number; className?: string }) {
  return <span className={cx("si-skeleton si-skelblock", className)} style={{ height, width }} aria-hidden />;
}

/**
 * Renders nothing until `delayMs` has passed, so a fast read never flickers (UI-0 §2.4). On the server and on
 * the first client render it is empty; the timer starts in an effect.
 */
export function DelayedSkeleton({ delayMs = 150, children }: { delayMs?: number; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
  if (!shown) return null;
  return (
    <div className="si-delayed" role="status" aria-busy="true">
      <span className="si-sr">{copy.ui1.prim.loading}</span>
      {children}
    </div>
  );
}
