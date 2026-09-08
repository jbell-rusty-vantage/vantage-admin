"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared wall clock that ticks every 15s. Server render and the first
 * client paint return `undefined` so relative stamps only appear once the
 * browser clock is available (no hydration mismatch). Call `bumpNow()` after
 * a live insert so stamps refresh immediately instead of on the next tick.
 */
const NOW_TICK_MS = 15_000;
const listeners = new Set<() => void>();
let nowMs: number | undefined;
let timer: ReturnType<typeof setInterval> | null = null;

function start(): void {
  if (timer) {
    return;
  }
  nowMs = Date.now();
  timer = setInterval(() => {
    nowMs = Date.now();
    for (const listener of listeners) {
      listener();
    }
  }, NOW_TICK_MS);
}

function stop(): void {
  if (timer && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  start();
  return () => {
    listeners.delete(onChange);
    stop();
  };
}

function getSnapshot(): number | undefined {
  if (nowMs === undefined) {
    nowMs = Date.now();
  }
  return nowMs;
}

function getServerSnapshot(): number | undefined {
  return undefined;
}

export function bumpNow(): void {
  nowMs = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

/** Ticks every 15s; `undefined` until the browser clock is available. */
export function useNowMs(): number | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
