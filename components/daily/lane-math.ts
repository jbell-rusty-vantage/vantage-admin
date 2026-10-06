import { DAILY_COPY, dailyOperationsTextsHeader } from "@/components/daily/daily-copy";
import {
  dailyOperationsTrend,
  easternHourOf,
  granotDayBeforeByNow,
  granotYesterdayByNow,
  type DailyOperationsHourlyBucket,
  type DailyOperationsPanelLane,
  type DailyOperationsSnapshot,
  type DailyOperationsTrend,
} from "@/lib/api/dailyOperations";
import type { DailyOperationsEventItem, DailyOperationsSessionDeltas } from "@/lib/api/dailyOperationsLive";

export const LANE_SPARK_BUCKETS = 12;

export function formatLaneCount(value: number | null): string {
  if (value == null) {
    return DAILY_COPY.missingYesterday;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

/** Today against yesterday and the day before at this hour, for the lanes that have a paced headline metric. */
export function laneTrend(
  snapshot: DailyOperationsSnapshot | null | undefined,
  lane: DailyOperationsPanelLane,
  today: number,
): DailyOperationsTrend | null {
  if (!snapshot) {
    return null;
  }
  const m = snapshot.metrics;
  const pace =
    lane === "lead"
      ? m.leads
      : lane === "text"
        ? m.texts
        : lane === "booking"
          ? m.bookings
          : lane === "cancellation"
            ? m.cancellations
            : null;
  if (pace) {
    return dailyOperationsTrend({
      today,
      yesterdayByNow: pace.yesterday_by_now,
      dayBeforeByNow: pace.day_before_by_now,
      yesterday: pace.yesterday,
      dayBefore: pace.day_before,
    });
  }
  if (lane === "granot") {
    return dailyOperationsTrend({
      today,
      yesterdayByNow: granotYesterdayByNow(snapshot),
      dayBeforeByNow: granotDayBeforeByNow(snapshot),
    });
  }
  return null;
}

/** The lane's one-line breakdown (the old panel's second line). */
export function laneSecondary(
  snapshot: DailyOperationsSnapshot | null | undefined,
  lane: DailyOperationsPanelLane,
): string | null {
  if (!snapshot) {
    return null;
  }
  const leads = snapshot.metrics.leads;
  const texts = snapshot.metrics.texts;
  const intakes = snapshot.metrics.intakes;
  const webhooks = snapshot.metrics.webhooks;
  const exceptions = snapshot.metrics.exceptions;
  if (lane === "lead") {
    return `${formatLaneCount(leads.form)} ${DAILY_COPY.form} / ${formatLaneCount(leads.call)} ${DAILY_COPY.call} · ${formatLaneCount(leads.duplicate_form + leads.duplicate_call)} ${DAILY_COPY.tiles.duplicates}`;
  }
  if (lane === "text") {
    return dailyOperationsTextsHeader({ sent: texts.today, heldNow: texts.held_now, failed: texts.failed });
  }
  if (lane === "granot") {
    return `${webhooks.lead_created.today} ${DAILY_COPY.granotClasses.lead_created} · ${webhooks.priority_updated.today} ${DAILY_COPY.granotClasses.priority_updated} · ${webhooks.booked.today} / ${webhooks.release.today} ${DAILY_COPY.granotClasses.booked} / ${DAILY_COPY.granotClasses.release}`;
  }
  if (lane === "intake") {
    return `${intakes.opened_today} ${DAILY_COPY.opened} · ${intakes.still_open} ${DAILY_COPY.waitingForYou}`;
  }
  if (lane === "exception") {
    const total = exceptions.zip_missing + exceptions.crm_failed + exceptions.dead_letter + exceptions.adoption_conflict;
    if (total === 0) {
      return null;
    }
    return `${exceptions.zip_missing} ZIP · ${exceptions.crm_failed} CRM · ${exceptions.dead_letter} dead letter · ${exceptions.adoption_conflict} adoption`;
  }
  if (lane === "sheet_sync") {
    const sheetSync = snapshot.metrics.sheet_sync;
    if (sheetSync.completed + sheetSync.failed === 0) {
      return null;
    }
    return `${formatLaneCount(sheetSync.completed)} ${DAILY_COPY.completed} · ${formatLaneCount(sheetSync.failed)} ${DAILY_COPY.failed}`;
  }
  return null;
}

export function laneSessionDelta(deltas: DailyOperationsSessionDeltas, lane: DailyOperationsPanelLane): number {
  if (lane === "lead") return deltas.leads;
  if (lane === "text") return deltas.texts;
  if (lane === "granot") return deltas.granot;
  if (lane === "intake") return deltas.intakes;
  if (lane === "booking") return deltas.bookings;
  if (lane === "cancellation") return deltas.cancellations;
  return 0;
}

const HOURLY_FIELD: Partial<Record<DailyOperationsPanelLane, Exclude<keyof DailyOperationsHourlyBucket, "hour">>> = {
  lead: "leads",
  booking: "bookings",
  cancellation: "cancellations",
  granot: "webhooks",
  text: "messages",
};

/**
 * Twelve buckets, one per Florida hour, ending at `nowHour` (oldest first). Lanes the snapshot's `hourly` carries
 * (leads, bookings, cancellations, Granot receipts, texts) read it; Intakes, Exceptions and Sheet Sync have no hourly
 * series, so their buckets count the Events the board holds. Hours before midnight are 0.
 */
export function laneSparkBuckets(input: {
  snapshot: DailyOperationsSnapshot | null | undefined;
  events: readonly DailyOperationsEventItem[];
  lane: DailyOperationsPanelLane;
  nowHour: number;
}): number[] {
  const hours = Array.from({ length: LANE_SPARK_BUCKETS }, (_, index) => input.nowHour - (LANE_SPARK_BUCKETS - 1 - index));
  const field = HOURLY_FIELD[input.lane];
  if (field) {
    const rows = input.snapshot?.hourly.today ?? [];
    return hours.map((hour) => (hour < 0 ? 0 : Number(rows.find((row) => row.hour === hour)?.[field] ?? 0)));
  }
  const counts = new Map<number, number>();
  for (const event of input.events) {
    if (event.lane !== input.lane) {
      continue;
    }
    const hour = easternHourOf(event.occurred_at);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return hours.map((hour) => (hour < 0 ? 0 : (counts.get(hour) ?? 0)));
}
