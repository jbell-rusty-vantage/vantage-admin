/**
 * Pure view models for the Systems tab (doc 11b): one `CapacityCardView` shape for the database card and both Master
 * Sheet cards, so `capacity-card.tsx` is a single component and the colour / label rules are testable without React.
 */
import { CircleCheck, CircleHelp, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatCount, formatRelative, formatShortDate } from "@/components/ui/crm/format";
import type { PillVariant } from "@/components/ui/crm/primitives";
import type { CapacityColour, DatabaseCapacity, Runway, SheetCapacity, SyncLine } from "@/lib/api/systems";
import { SYSTEMS_COPY } from "./systems-copy";

const copy = SYSTEMS_COPY.capacity;

export type ColourView = { colour: CapacityColour; label: string; pill: PillVariant; icon: LucideIcon };

const COLOUR_VIEWS: Record<CapacityColour, Omit<ColourView, "colour" | "label">> = {
  green: { pill: "green", icon: CircleCheck },
  amber: { pill: "amber", icon: TriangleAlert },
  red: { pill: "red", icon: OctagonAlert },
  unknown: { pill: "gray", icon: CircleHelp },
};

/** Every colour pairs with a word and an icon (doc 15). */
export function colourView(colour: CapacityColour): ColourView {
  return { colour, label: copy.status[colour], ...COLOUR_VIEWS[colour] };
}

/** "9.0 GB", "0.55 GB", "4 MB". Decimal units, like the Atlas UI. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e8) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${Math.round(bytes)} B`;
}

export type RunwayLineView = { label: string; value: string; note: string | null; estimate: string | null };

export function runwayLine(label: string, runway: Runway | null, note: string | null = null): RunwayLineView {
  if (!runway) return { label, value: copy.notMeasured, note, estimate: null };
  return { label, value: runway.label, note, estimate: runway.basis === "estimate" ? copy.estimate(Math.min(runway.points, 7)) : null };
}

export type MeterView = { label: string; value: string; pct: number; growth: string | null; tone: CapacityColour };

export type SyncPart = { text: string; state: "ok" | "warn" | "bad" | "none" };

/** "2 min ago" inside the hour, then the dashboard's relative instant ("9:12 AM", "Yesterday 9:12 AM", "Sep 25"). */
export function sinceWords(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes >= 0 && minutes < 1) return "just now";
  if (minutes >= 1 && minutes < 60) return `${minutes} min ago`;
  return formatRelative(iso, now);
}

/** "last write 2 min ago ✓ · 1 pending · 0 failed", plus "⚠ 3 stuck since Jul 29" when any job is stuck. */
export function syncParts(sync: SyncLine | null, now: Date): SyncPart[] | null {
  if (!sync) return null;
  const s = copy.sync;
  const parts: SyncPart[] = [
    sync.last_write_at ? { text: s.lastWrite(sinceWords(sync.last_write_at, now)), state: "ok" } : { text: s.noWrite, state: "warn" },
    { text: s.pending(sync.pending), state: "none" },
    { text: s.failed(sync.failed), state: sync.failed > 0 ? "bad" : "none" },
  ];
  if (sync.stuck.count > 0) {
    parts.push({ text: s.stuck(sync.stuck.count, sync.stuck.oldest_at ? formatShortDate(sync.stuck.oldest_at, now) : "a while"), state: "bad" });
  }
  return parts;
}

export type CapacityCardView = {
  testId: string;
  title: string;
  status: ColourView;
  reason: string;
  error: string | null;
  meters: MeterView[];
  detail: string | null;
  runways: RunwayLineView[];
  sync: SyncPart[] | null;
  syncUnavailable: boolean;
  foot: string[];
  muted: string | null;
};

export function databaseCardView(db: DatabaseCapacity): CapacityCardView {
  const d = copy.database;
  const meters: MeterView[] =
    db.used_bytes !== null && db.total_bytes !== null
      ? [
          {
            label: d.disk,
            value: d.used(formatBytes(db.used_bytes).replace(" GB", ""), formatBytes(db.total_bytes)),
            pct: db.used_pct ?? 0,
            growth: null,
            tone: db.status.colour,
          },
        ]
      : [];
  const growth = db.growth_per_day_bytes !== null ? d.growing(formatBytes(db.growth_per_day_bytes)) : null;
  const growthNote = growth && db.growth_source === "data" ? `${growth}, ${d.fromData}` : growth;
  return {
    testId: "systems-capacity-database",
    title: d.title,
    status: colourView(db.status.colour),
    reason: db.status.reason,
    error: db.error,
    meters,
    detail: db.breakdown
      ? d.breakdown(
          formatBytes(db.breakdown.business_bytes),
          formatBytes(db.breakdown.oplog_bytes),
          formatBytes(db.breakdown.oplog_reclaimable_bytes),
          formatBytes(db.breakdown.system_bytes),
        )
      : null,
    runways: db.until_90 || db.until_full ? [runwayLine(d.until90, db.until_90, growthNote), runwayLine(d.untilFull, db.until_full)] : [],
    sync: null,
    syncUnavailable: false,
    foot: [],
    muted: db.caveat || null,
  };
}

export function sheetCardView(sheet: SheetCapacity, now: Date): CapacityCardView {
  const s = copy.sheet;
  const meters: MeterView[] = [];
  if (sheet.biggest_tab) {
    const tab = sheet.biggest_tab;
    meters.push({
      label: s.biggestTab,
      value: s.tabRows(tab.name, formatCount(tab.filled_rows), formatCount(tab.limit)),
      pct: tab.pct,
      growth: s.rowsPerMonth(formatCount(tab.growth_per_month)),
      tone: tab.filled_rows >= tab.limit ? "red" : tab.filled_rows >= tab.warning ? "amber" : "green",
    });
  }
  if (sheet.cells) {
    meters.push({
      label: s.workbook,
      value: s.cells(formatCount(sheet.cells.used), formatCount(sheet.cells.cap)),
      pct: sheet.cells.pct,
      growth: s.cellsPerMonth(formatCount(sheet.cells.growth_per_month)),
      tone: sheet.cells.used >= 5_000_000 ? "red" : sheet.cells.used >= 3_000_000 ? "amber" : "green",
    });
  }
  const untilNew = sheet.until_new_workbook;
  const trigger = untilNew && untilNew.days_left !== null ? (untilNew.trigger === "cells" ? s.byCells : s.byRows(sheet.biggest_tab?.name ?? "")) : null;
  const foot: string[] = [];
  if (sheet.workbook === "master_booked") {
    foot.push(sheet.last_cancellation_at ? s.lastCancellation(formatShortDate(sheet.last_cancellation_at, now)) : s.noCancellation);
  }
  return {
    testId: `systems-capacity-${sheet.workbook.replace("_", "-")}`,
    title: sheet.label,
    status: colourView(sheet.status.colour),
    reason: sheet.status.reason,
    error: sheet.error,
    meters,
    detail: null,
    runways: sheet.biggest_tab ? [runwayLine(s.untilNewWorkbook, untilNew, trigger), runwayLine(s.untilCellCap, sheet.until_cell_cap)] : [],
    sync: syncParts(sheet.sync, now),
    syncUnavailable: sheet.sync === null,
    foot,
    muted: null,
  };
}

/** The "checked 9:14 AM" stamp's time from the capacity read. */
export function checkedTime(generatedAt: string | null | undefined): string | null {
  if (!generatedAt) return null;
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

/** The link as the row shows it: no scheme, no trailing slash. */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** A partner path chip's link: the main link without a trailing slash, plus the path. */
export function pathLink(url: string, path: string): string {
  return `${url.replace(/\/+$/, "")}${path}`;
}
