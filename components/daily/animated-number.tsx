"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_MS = 650;

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatDailyOperationsNumber(value: number): string {
  return Number.isInteger(value) ? integerFormatter.format(value) : decimalFormatter.format(value);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function reducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * A count that rolls from the value it showed to the value it should show,
 * with one short pop on the change. The server render and the first paint
 * print the final value directly (no hydration mismatch); only later changes
 * tween. `null` prints the missing-baseline dash and does not animate.
 */
export function AnimatedNumber({
  value,
  format = formatDailyOperationsNumber,
  durationMs = DEFAULT_DURATION_MS,
  className,
  fallback = DAILY_COPY.missingYesterday,
}: {
  value: number | null | undefined;
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
  fallback?: string;
}) {
  const target = value == null || !Number.isFinite(value) ? null : value;
  const [displayed, setDisplayed] = useState<number | null>(target);
  const [bump, setBump] = useState<{ seq: number; direction: "up" | "down" } | null>(null);
  const shownRef = useRef<number | null>(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = shownRef.current;
    if (target === from) {
      return;
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (target === null || from === null || reducedMotion() || durationMs <= 0) {
      shownRef.current = target;
      setDisplayed(target);
      return;
    }
    const direction = target > from ? "up" : "down";
    setBump((current) => ({ seq: (current?.seq ?? 0) + 1, direction }));
    const integers = Number.isInteger(from) && Number.isInteger(target);
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      const eased = easeOutCubic(progress);
      const raw = from + (target - from) * eased;
      const next = progress >= 1 ? target : integers ? Math.round(raw) : Math.round(raw * 10) / 10;
      shownRef.current = next;
      setDisplayed(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, durationMs]);

  return (
    <span
      key={bump?.seq ?? 0}
      className={cn("inline-block tabular-nums", bump && "daily-number-bump", className)}
      data-direction={bump?.direction}
      data-animated-number={target ?? "missing"}
    >
      {displayed == null ? fallback : format(displayed)}
    </span>
  );
}
