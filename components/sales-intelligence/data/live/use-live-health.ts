"use client";
/**
 * UI1-LIVE: capture health for the header indicator (UI-0 §2.5, UX29), from the coverage read's `capture_health`
 * (the same key and 60 s cache as the Numbers capture-health block). Non-suspending: the header never blocks a page.
 * An unknown status word maps to null (`Capture status not known yet.`).
 */
import type { CaptureHealth } from "../../primitives";
import { useCaptureHealth } from "../use-coverage";

export type LiveHealth = { status: CaptureHealth["status"] | null; knownCompleteThrough: string | null };

const HEALTH_STATUSES: readonly string[] = ["ok", "attention", "broken"];
export const narrowHealth = (status: string | null | undefined): CaptureHealth["status"] | null =>
  status && HEALTH_STATUSES.includes(status) ? (status as CaptureHealth["status"]) : null;

/** Pure: the indicator's health from the coverage read's capture health. */
export function liveHealthOf(coverage: { status: string; known_complete_through: string | null } | null): LiveHealth {
  return { status: narrowHealth(coverage?.status), knownCompleteThrough: coverage?.known_complete_through ?? null };
}

export function useLiveHealth(): LiveHealth {
  return liveHealthOf(useCaptureHealth());
}

/** The primitive's `health` prop: null when the status is unknown. */
export const captureHealthProp = (health: LiveHealth): CaptureHealth | null =>
  health.status ? { status: health.status, knownCompleteThrough: health.knownCompleteThrough } : null;
