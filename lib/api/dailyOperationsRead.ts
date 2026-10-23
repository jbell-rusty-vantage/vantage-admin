import { dailyOperationsDayKey, normalizeDailyOperationsSnapshot, type DailyOperationsSnapshot } from "./dailyOperations";
import type { DailyOperationsEventItem, DailyOperationsLiveBoard } from "./dailyOperationsLive";
import { EMPTY_DAILY_OPERATIONS_SESSION_DELTAS, mergeDailyOperationsEvents } from "./dailyOperationsLive";
export type DailyOperationsReadView = {
  schema_version: 2; day: string; timezone: string; revision: number; generated_at: string;
  freshness: "fresh" | "stale"; poll_after_ms: number; snapshot: DailyOperationsSnapshot;
  events: DailyOperationsEventItem[]; milestones: DailyOperationsEventItem[];
  truncation?: { events: boolean; milestones: boolean };
};
export class DailyOperationsReadError extends Error {
  constructor(public status: number) { super("Daily Operations is unavailable."); }
}
export function parseDailyOperationsReadView(payload: unknown): DailyOperationsReadView {
  const candidate = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  if (!candidate || typeof candidate !== "object") throw new DailyOperationsReadError(502);
  const value = candidate as Partial<DailyOperationsReadView>;
  if (value.schema_version !== 2 || typeof value.revision !== "number" || !Number.isFinite(value.revision) || typeof value.day !== "string" || typeof value.timezone !== "string" || typeof value.generated_at !== "string" || !Number.isFinite(Date.parse(value.generated_at)) || !value.snapshot?.metrics || value.snapshot.today !== value.day || !Array.isArray(value.events) || !Array.isArray(value.milestones) || (value.freshness !== "fresh" && value.freshness !== "stale")) throw new DailyOperationsReadError(502);
  const validEvents = (items: DailyOperationsEventItem[]) => items.every(item => item && typeof item.event_id === "string" && typeof item.kind === "string" && typeof item.occurred_at === "string");
  if (value.events.length > 80 || value.milestones.length > 50 || !validEvents(value.events) || !validEvents(value.milestones)) throw new DailyOperationsReadError(502);
  return { ...value, snapshot: normalizeDailyOperationsSnapshot(value.snapshot), poll_after_ms: Math.min(300_000, Math.max(60_000, Number.isFinite(value.poll_after_ms) ? Number(value.poll_after_ms) : 60_000)) } as DailyOperationsReadView;
}
export async function fetchDailyOperationsReadView(signal: AbortSignal): Promise<DailyOperationsReadView> {
  const response = await fetch("/api/daily-operations-board", { credentials: "include", cache: "no-store", signal });
  if (!response.ok) throw new DailyOperationsReadError(response.status);
  return parseDailyOperationsReadView(await response.json());
}
/** Counters come only from the authoritative snapshot; history pages are display-only. */
export function receiveDailyOperationsReadView(current: DailyOperationsLiveBoard, view: DailyOperationsReadView): DailyOperationsLiveBoard {
  return {
    snapshot: view.snapshot,
    events: mergeDailyOperationsEvents(current.snapshot?.today === view.day ? current.events : [], view.events),
    sessionDeltas: { ...EMPTY_DAILY_OPERATIONS_SESSION_DELTAS }, lastGoodAt: view.generated_at, error: null,
  };
}

/** A retained prior-day snapshot must never masquerade as today's board. */
export function dailyOperationsReadDayNotice(view: Pick<DailyOperationsReadView, "day"> | null, now: number | undefined): string | null {
  return view && now !== undefined && view.day !== dailyOperationsDayKey(now)
    ? `Showing the saved board for ${view.day}. Today's update is unavailable.`
    : null;
}
