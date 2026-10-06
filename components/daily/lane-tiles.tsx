"use client";

import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY, formatDailyOperationsClock } from "@/components/daily/daily-copy";
import { rowSegments } from "@/components/daily/feed-model";
import { laneIcon } from "@/components/daily/kind-icons";
import { useKindTierOverrides } from "@/components/daily/kind-tiers-context";
import { laneSparkBuckets, laneTrend } from "@/components/daily/lane-math";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { IconBadge, Pill, TrendChip, type CrmTone } from "@/components/ui/crm";
import type { DailyOperationsPanelLane, DailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  filterDailyOperationsEventsByCompany,
  presentationTier,
  type DailyOperationsTierOverrides,
} from "@/lib/api/dailyOperationsBoard";
import { granotTileToday, compareDailyOperationsEventsNewestFirst, type DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

const LANE_BADGE_TONE: Record<string, CrmTone> = {
  lead: "blue",
  text: "purple",
  granot: "green",
  intake: "amber",
  booking: "green",
  cancellation: "red",
  exception: "red",
  sheet_sync: "gray",
};

/** The newest fact of a lane that is not system bookkeeping (tier C), else the newest of any kind. */
export function newestLaneFact(
  events: readonly DailyOperationsEventItem[],
  lane: DailyOperationsPanelLane,
  options: {
    company?: string | null;
    quietPriorities?: boolean;
    overrides?: DailyOperationsTierOverrides | null;
  } = {},
): DailyOperationsEventItem | null {
  const inLane = filterDailyOperationsEventsByCompany(
    events.filter((event) => event.lane === lane),
    options.company,
  ).sort(compareDailyOperationsEventsNewestFirst);
  return (
    inLane.find(
      (event) =>
        presentationTier(event.kind, { overrides: options.overrides, quietPriorities: options.quietPriorities }) !== "C",
    ) ??
    inLane[0] ??
    null
  );
}

function Spark({ buckets, label }: { buckets: readonly number[]; label: string }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="dboard-spark" role="img" aria-label={label} data-lane-spark>
      {buckets.map((value, index) => (
        <span
          key={index}
          className="dboard-spark__bar"
          data-now={index === buckets.length - 1 ? "true" : undefined}
          style={{ height: `${Math.max(8, Math.round((value / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

/**
 * The seven lane tiles that replace the old card panels (doc 16): count, trend against yesterday at this hour, a
 * 12-bucket sparkline, the newest fact as one line, and **Open ›** (the overlay of rows). A new Spotlight fact flashes
 * its tile, so a card that arrives while the feed is held back is still seen.
 */
export function LaneTiles({
  lanes,
  events,
  snapshot,
  company,
  quietPriorities,
  loading,
  nowHour,
  highlights = EMPTY_ARRIVAL_HIGHLIGHTS,
  onOpenLane,
}: {
  lanes: readonly DailyOperationsPanelLane[];
  events: readonly DailyOperationsEventItem[];
  snapshot?: DailyOperationsSnapshot | null;
  company?: string | null;
  quietPriorities?: boolean;
  loading?: boolean;
  nowHour?: number;
  highlights?: ArrivalHighlights;
  onOpenLane: (lane: DailyOperationsPanelLane) => void;
}) {
  const overrides = useKindTierOverrides();
  const hour = nowHour ?? 23;
  const flashedLanes = new Set(
    events
      .filter(
        (event) =>
          highlights.highlightedIds.has(event.event_id) &&
          presentationTier(event.kind, { overrides, quietPriorities }) === "A",
      )
      .map((event) => event.lane),
  );
  return (
    <div className="dboard-tiles" data-lane-tiles>
      {lanes.map((lane) => {
        const today = lane === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, lane);
        const trend = laneTrend(snapshot, lane, today);
        const change = trend && trend.versusYesterday.tone !== "missing" ? trend.versusYesterday : null;
        const newest = newestLaneFact(events, lane, { company, quietPriorities, overrides });
        const metrics = snapshot?.metrics;
        const label = DAILY_COPY.panelsLabels[lane];
        return (
          <article key={lane} className="dboard-tile" data-lane-tile={lane} data-flash={flashedLanes.has(lane) ? "true" : undefined}>
            <div className="dboard-tile__head">
              <IconBadge icon={laneIcon(lane)} tone={LANE_BADGE_TONE[lane] ?? "gray"} size="sm" />
              <h3 className="dboard-tile__title">{label}</h3>
              <span className="dboard-tile__count" data-lane-count>
                {loading ? DAILY_COPY.missingYesterday : <AnimatedNumber value={today} />}
              </span>
            </div>
            <div className="dboard-tile__meta">
              {change ? (
                <TrendChip tone={change.tone === "ahead" ? "up" : change.tone === "behind" ? "down" : "even"} title={DAILY_COPY.vsYesterdayByNow}>
                  {change.label}
                </TrendChip>
              ) : null}
              {lane === "text" && metrics && metrics.texts.failed > 0 ? (
                <Pill variant="red">{DAILY_COPY.lanes.failedCount(metrics.texts.failed)}</Pill>
              ) : null}
              {lane === "exception" && today > 0 ? <Pill variant="amber">{DAILY_COPY.lanes.exceptionsCount(today)}</Pill> : null}
              {lane === "intake" && metrics && metrics.intakes.still_open > 0 ? (
                <Pill variant="amber">{DAILY_COPY.lanes.waitingCount(metrics.intakes.still_open)}</Pill>
              ) : null}
            </div>
            <Spark buckets={laneSparkBuckets({ snapshot, events, lane, nowHour: hour })} label={`${label} · ${DAILY_COPY.lanes.sparkLabel}`} />
            <p className="dboard-tile__fact" data-lane-newest>
              {newest ? (
                <>
                  {rowSegments(newest).slice(0, 2).join(" · ")}
                  {" · "}
                  {formatDailyOperationsClock(newest.occurred_at)}
                </>
              ) : (
                DAILY_COPY.lanes.nothingYet
              )}
            </p>
            <div className="dboard-tile__foot">
              <button
                type="button"
                className="crm-button crm-button--quiet crm-button--sm"
                aria-label={`${DAILY_COPY.lanes.open} ${label}`}
                onClick={() => onOpenLane(lane)}
              >
                {DAILY_COPY.lanes.open} ›
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
