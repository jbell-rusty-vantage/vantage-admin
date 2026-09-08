import {
  dailyOperationsDayKey,
  easternHourOf,
  granotReceiptsToday,
  normalizeDailyOperationsSnapshot,
  type DailyOperationsCard,
  type DailyOperationsHourlyBucket,
  type DailyOperationsLinks,
  type DailyOperationsSnapshot,
  type DailyOperationsTileId,
} from "./dailyOperations";

export type { DailyOperationsTileId };

export const DAILY_OPERATIONS_LIVE_PATH = "/api/daily-operations-live";
export const DAILY_OPERATIONS_EVENT_LIST_LIMIT = 40;
export const DAILY_OPERATIONS_EVENT_MEMORY_LIMIT = 200;

export type DailyOperationsLiveStatus = "live" | "paused" | "reconnecting" | "off";

export type DailyOperationsEventItem = {
  event_id: string;
  day: string;
  occurred_at: string;
  lane: string;
  kind: string;
  title: string;
  source_company: string | null;
  ingestion_origin: string | null;
  lead_kind: "form" | "call" | null;
  job_no: string | null;
  entity_type: string | null;
  entity_id: string | null;
  parent_receipt_id: string | null;
  links: DailyOperationsLinks;
  card: DailyOperationsCard;
  metric_touches: string[];
};

export type DailyOperationsSessionDeltas = Record<DailyOperationsTileId, number>;

export const EMPTY_DAILY_OPERATIONS_SESSION_DELTAS: DailyOperationsSessionDeltas = {
  leads: 0,
  form_call: 0,
  duplicates: 0,
  bookings: 0,
  cancellations: 0,
  texts: 0,
  granot: 0,
  intakes: 0,
};

export type DailyOperationsLiveBoard = {
  snapshot: DailyOperationsSnapshot | null;
  events: DailyOperationsEventItem[];
  sessionDeltas: DailyOperationsSessionDeltas;
  lastGoodAt: string | null;
  error: string | null;
};

export const EMPTY_DAILY_OPERATIONS_LIVE_BOARD: DailyOperationsLiveBoard = {
  snapshot: null,
  events: [],
  sessionDeltas: { ...EMPTY_DAILY_OPERATIONS_SESSION_DELTAS },
  lastGoodAt: null,
  error: null,
};

/**
 * Touches that move the number printed on each tile. `texts` counts sent
 * only: a held text flashes the tile (see `TILE_FLASH_TOUCHES`) but must not
 * add to the `+N` badge beside a count that did not move.
 */
const TILE_TOUCHES: Record<DailyOperationsTileId, readonly string[]> = {
  leads: ["leads.total"],
  form_call: ["leads.form", "leads.call"],
  duplicates: ["leads.duplicate_form", "leads.duplicate_call"],
  bookings: ["bookings.total"],
  cancellations: ["cancellations.total"],
  texts: ["messages.successful"],
  granot: [
    "webhooks.lead_created",
    "webhooks.priority_updated",
    "webhooks.booking_status_changed",
  ],
  intakes: ["intakes.opened"],
};

/** Touches that flash a tile without necessarily moving its count. */
const TILE_FLASH_TOUCHES: Record<DailyOperationsTileId, readonly string[]> = {
  ...TILE_TOUCHES,
  texts: ["messages.successful", "messages.deferred"],
};

type HourlyField = Exclude<keyof DailyOperationsHourlyBucket, "hour">;

const HOURLY_FIELDS: readonly HourlyField[] = ["leads", "bookings", "cancellations", "webhooks", "messages"];

function isHourlyField(value: string): value is HourlyField {
  return (HOURLY_FIELDS as readonly string[]).includes(value);
}

export function mergeDailyOperationsEvents(
  current: DailyOperationsEventItem[],
  incoming: DailyOperationsEventItem | DailyOperationsEventItem[],
): DailyOperationsEventItem[] {
  const next = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map<string, DailyOperationsEventItem>();
  for (const item of [...current, ...next]) {
    if (!item?.event_id) {
      continue;
    }
    byId.set(item.event_id, item);
  }
  const sorted = [...byId.values()].sort(compareDailyOperationsEventsNewestFirst);
  const kept: DailyOperationsEventItem[] = [];
  const seenPerLane = new Map<string, number>();
  for (const item of sorted) {
    const lane = item.lane || "unknown";
    const count = seenPerLane.get(lane) ?? 0;
    if (count >= DAILY_OPERATIONS_EVENT_MEMORY_LIMIT) {
      continue;
    }
    seenPerLane.set(lane, count + 1);
    kept.push(item);
  }
  return kept;
}

export function compareDailyOperationsEventsNewestFirst(
  left: DailyOperationsEventItem,
  right: DailyOperationsEventItem,
): number {
  if (left.occurred_at === right.occurred_at) {
    return right.event_id.localeCompare(left.event_id);
  }
  return right.occurred_at.localeCompare(left.occurred_at);
}

export function sessionDeltaIncrements(touches: string[]): Partial<DailyOperationsSessionDeltas> {
  const increments: Partial<DailyOperationsSessionDeltas> = {};
  for (const [tile, keys] of Object.entries(TILE_TOUCHES) as [
    DailyOperationsTileId,
    readonly string[],
  ][]) {
    const count = touches.filter((touch) => keys.includes(touch)).length;
    if (count > 0) {
      increments[tile] = count;
    }
  }
  return increments;
}

/** Tiles that should flash for these touches (a superset of the delta tiles). */
export function tilesFlashedByTouches(touches: string[]): DailyOperationsTileId[] {
  const tiles: DailyOperationsTileId[] = [];
  for (const [tile, keys] of Object.entries(TILE_FLASH_TOUCHES) as [
    DailyOperationsTileId,
    readonly string[],
  ][]) {
    if (touches.some((touch) => keys.includes(touch))) {
      tiles.push(tile);
    }
  }
  return tiles;
}

/**
 * Adds one fact's touches to the snapshot. `occurredAt` places the
 * `hourly.<field>` touches in that fact's Florida hour so the rhythm chart and
 * sparklines move with the tiles instead of freezing at page load.
 */
export function applyDailyOperationsMetricTouches(
  snapshot: DailyOperationsSnapshot,
  touches: string[],
  occurredAt?: string | null,
): DailyOperationsSnapshot {
  const next = structuredClone(normalizeDailyOperationsSnapshot(snapshot));
  const hour = occurredAt ? easternHourOf(occurredAt) : null;
  for (const touch of touches) {
    if (touch.startsWith("hourly.")) {
      const field = touch.slice("hourly.".length);
      if (hour != null && isHourlyField(field)) {
        bumpHourlyBucket(next.hourly.today, hour, field);
      }
      continue;
    }
    if (touch === "leads.total") next.metrics.leads.today += 1;
    else if (touch === "leads.form") next.metrics.leads.form += 1;
    else if (touch === "leads.call") next.metrics.leads.call += 1;
    else if (touch === "leads.duplicate_form") next.metrics.leads.duplicate_form += 1;
    else if (touch === "leads.duplicate_call") next.metrics.leads.duplicate_call += 1;
    else if (touch === "bookings.total") next.metrics.bookings.today += 1;
    else if (touch === "cancellations.total") next.metrics.cancellations.today += 1;
    else if (touch === "messages.successful") next.metrics.texts.today += 1;
    else if (touch === "messages.deferred") next.metrics.texts.deferred += 1;
    else if (touch === "messages.skipped") next.metrics.texts.skipped += 1;
    else if (touch === "messages.failed") next.metrics.texts.failed += 1;
    else if (touch === "webhooks.lead_created") next.metrics.webhooks.lead_created.today += 1;
    else if (touch === "webhooks.priority_updated") {
      next.metrics.webhooks.priority_updated.today += 1;
    } else if (touch === "webhooks.booking_status_changed") {
      next.metrics.webhooks.booking_status_changed.today += 1;
    } else if (touch === "webhooks.booked") next.metrics.webhooks.booked.today += 1;
    else if (touch === "webhooks.release") next.metrics.webhooks.release.today += 1;
    else if (touch === "intakes.opened") next.metrics.intakes.opened_today += 1;
    else if (touch === "sheet_sync.completed") next.metrics.sheet_sync.completed += 1;
    else if (touch === "sheet_sync.failed") next.metrics.sheet_sync.failed += 1;
    else if (touch.startsWith("origins.")) {
      const key = touch.slice("origins.".length) as keyof DailyOperationsSnapshot["origins"];
      if (key in next.origins) {
        next.origins[key] += 1;
      }
    } else if (touch.startsWith("companies.")) {
      const rest = touch.slice("companies.".length);
      const separator = rest.lastIndexOf(".");
      if (separator <= 0) continue;
      const slug = rest.slice(0, separator);
      const field = rest.slice(separator + 1);
      const row = next.companies.find((company) => company.source_company === slug);
      if (row && (field === "form" || field === "call" || field === "total")) {
        row[field] += 1;
      }
    }
  }
  return next;
}

function bumpHourlyBucket(buckets: DailyOperationsHourlyBucket[], hour: number, field: HourlyField): void {
  const existing = buckets.find((bucket) => bucket.hour === hour);
  if (existing) {
    existing[field] += 1;
    return;
  }
  buckets.push({
    hour,
    leads: 0,
    bookings: 0,
    cancellations: 0,
    webhooks: 0,
    messages: 0,
    [field]: 1,
  });
  buckets.sort((left, right) => left.hour - right.hour);
}

/**
 * Counts move per **fact**, not per wake batch. Every `event` carries its own
 * `metric_touches`, so the board adds them the moment the fact lands — once,
 * keyed by `event_id`, so a replay after reconnect never double counts. The
 * server's `metrics` frame is a batch summary of the same touches; treating it
 * as a second increment would count a burst of three leads as one (its touch
 * list is deduped) and then count them again here. It is acknowledged and
 * otherwise ignored.
 */
/**
 * A fetched or streamed snapshot is authoritative: Mongo is the book. When it
 * belongs to a new Florida day (the board was left open past midnight) the
 * session's `+N` badges and yesterday's facts leave with the old day; facts
 * that already belong to the new day stay.
 */
export function receiveDailyOperationsSnapshot(
  current: DailyOperationsLiveBoard,
  payload: DailyOperationsSnapshot,
): DailyOperationsLiveBoard {
  const snapshot = normalizeDailyOperationsSnapshot(payload);
  const lastGoodAt = snapshot.generated_at ?? current.lastGoodAt;
  if (current.snapshot && current.snapshot.today !== snapshot.today) {
    return {
      ...current,
      snapshot,
      lastGoodAt,
      events: current.events.filter((event) => dailyOperationsDayKey(Date.parse(event.occurred_at)) === snapshot.today),
      sessionDeltas: { ...EMPTY_DAILY_OPERATIONS_SESSION_DELTAS },
    };
  }
  return { ...current, snapshot, lastGoodAt };
}

export function applyDailyOperationsSsePayload(
  eventName: string,
  rawData: string,
  current: DailyOperationsLiveBoard,
): { board: DailyOperationsLiveBoard; flashedTiles: DailyOperationsTileId[] } {
  try {
    if (eventName === "snapshot") {
      const payload = JSON.parse(rawData) as DailyOperationsSnapshot;
      return {
        board: { ...receiveDailyOperationsSnapshot(current, payload), error: null },
        flashedTiles: [],
      };
    }
    if (eventName === "event") {
      const incoming = JSON.parse(rawData) as DailyOperationsEventItem;
      const alreadyCounted = current.events.some((row) => row.event_id === incoming.event_id);
      const touches = alreadyCounted || !Array.isArray(incoming.metric_touches) ? [] : incoming.metric_touches;
      const increments = sessionDeltaIncrements(touches);
      const flashedTiles = tilesFlashedByTouches(touches);
      const sessionDeltas = { ...current.sessionDeltas };
      for (const tile of Object.keys(increments) as DailyOperationsTileId[]) {
        sessionDeltas[tile] += increments[tile] ?? 0;
      }
      return {
        board: {
          ...current,
          events: mergeDailyOperationsEvents(current.events, incoming),
          snapshot:
            current.snapshot && touches.length > 0
              ? applyDailyOperationsMetricTouches(current.snapshot, touches, incoming.occurred_at)
              : current.snapshot,
          sessionDeltas,
          lastGoodAt: incoming.occurred_at ?? current.lastGoodAt,
          error: null,
        },
        flashedTiles,
      };
    }
    if (eventName === "metrics") {
      // Batch summary of touches already applied per event above.
      return { board: { ...current, error: null }, flashedTiles: [] };
    }
    if (eventName === "heartbeat") {
      const payload = JSON.parse(rawData) as { ts?: string };
      return {
        board: {
          ...current,
          lastGoodAt: payload.ts ?? current.lastGoodAt,
          error: null,
        },
        flashedTiles: [],
      };
    }
    if (eventName === "error") {
      const payload = JSON.parse(rawData) as { error?: string };
      return {
        board: {
          ...current,
          error: payload.error?.trim() || "Live stream failed",
        },
        flashedTiles: [],
      };
    }
    return { board: current, flashedTiles: [] };
  } catch {
    return {
      board: {
        ...current,
        error:
          eventName === "snapshot"
            ? "Could not read the Daily Operations snapshot."
            : "Could not read a Daily Operations live event.",
      },
      flashedTiles: [],
    };
  }
}

export function granotTileToday(snapshot: DailyOperationsSnapshot | null): number {
  if (!snapshot) {
    return 0;
  }
  return granotReceiptsToday(snapshot);
}
