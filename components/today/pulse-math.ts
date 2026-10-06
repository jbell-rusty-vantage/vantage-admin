import {
  trendFromPace,
  type DailyOperationsHeadlinePace,
  type DailyOperationsSnapshot,
} from "@/lib/api/dailyOperations";
import { eventsForDailyOperationsArrivals } from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { OVERVIEW_INTAKE_PREVIEW_LIMIT, todayCopy } from "./today-copy";

export const PULSE_HIGHLIGHT_LIMIT = 8;

type ExceptionKey = keyof DailyOperationsSnapshot["metrics"]["exceptions"];
const EXCEPTION_ORDER: readonly ExceptionKey[] = ["zip_missing", "crm_failed", "dead_letter", "adoption_conflict"];

export function exceptionsTotal(snapshot: DailyOperationsSnapshot): number {
  const exceptions = snapshot.metrics.exceptions;
  return EXCEPTION_ORDER.reduce((sum, key) => sum + Number(exceptions?.[key] ?? 0), 0);
}

/** "zip missing, CRM failed": the non-zero kinds in words, in a fixed order. */
export function exceptionKindsInWords(snapshot: DailyOperationsSnapshot): string {
  const exceptions = snapshot.metrics.exceptions;
  return EXCEPTION_ORDER.filter((key) => Number(exceptions?.[key] ?? 0) > 0)
    .map((key) => todayCopy.waiting.exceptions.kinds[key])
    .join(", ");
}

export type TileTrend = { tone: "up" | "down" | "even"; label: string; title: string };

/** The trend chip for a headline tile versus yesterday at this hour; null when there is no baseline. */
export function tileTrend(pace: DailyOperationsHeadlinePace | null | undefined): TileTrend | null {
  const trend = trendFromPace(pace);
  const change = trend.versusYesterday;
  if (change.tone === "missing") return null;
  const tone = change.tone === "ahead" ? "up" : change.tone === "behind" ? "down" : "even";
  const delta = trend.pace.delta;
  const signed = delta === null ? "" : ` (${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta)})`;
  return { tone, label: change.label, title: `${todayCopy.tiles.vsYesterday}${signed}` };
}

/** The newest facts for Highlights, strictly newest first. Quiet priorities stay hidden (they are noise here). */
export function highlightEvents(
  events: readonly DailyOperationsEventItem[],
  limit = PULSE_HIGHLIGHT_LIMIT,
): DailyOperationsEventItem[] {
  return eventsForDailyOperationsArrivals({ events: [...events], company: null, quietPriorities: true, limit });
}

/** A written Booking is the one celebration (gold) in Highlights. */
export function isCelebration(event: Pick<DailyOperationsEventItem, "kind">): boolean {
  return event.kind === "booking.created";
}

/** "just now", "3 min ago", "2 h ago" for a query's `dataUpdatedAt`; null until the browser clock is known. */
export function resyncAge(updatedAt: number | undefined, nowMs: number | undefined): string | null {
  if (!updatedAt || nowMs === undefined) return null;
  const seconds = Math.max(0, Math.round((nowMs - updatedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

/** The list filters for the open booking Intakes preview (the same contract as the Intakes workbench list). */
export function openIntakePreviewFilters(kind: "booking" | "release" = "booking") {
  return {
    kind,
    state: "open" as const,
    sort: "last_evidence_at" as const,
    order: "desc" as const,
    limit: OVERVIEW_INTAKE_PREVIEW_LIMIT,
  };
}
