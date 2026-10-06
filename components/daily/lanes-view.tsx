"use client";

import { useState } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { FeedRow } from "@/components/daily/feed-row";
import { laneIcon } from "@/components/daily/kind-icons";
import { useKindTierOverrides } from "@/components/daily/kind-tiers-context";
import { formatLaneCount, laneSecondary, laneSessionDelta, laneTrend } from "@/components/daily/lane-math";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { Button } from "@/components/ui/button";
import { IconBadge, TrendChip } from "@/components/ui/crm";
import { sourceCompanyLabel, type DailyOperationsPanelLane, type DailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  eventsForDailyOperationsPanel,
  pairGranotEvents,
  panelsForDailyOperationsView,
  panelVisibleLimit,
  presentationTier,
  sliceDailyOperationsPanelEvents,
} from "@/lib/api/dailyOperationsBoard";
import { laneToneFor, toneClasses } from "@/lib/api/dailyOperationsColors";
import {
  granotTileToday,
  type DailyOperationsEventItem,
  type DailyOperationsSessionDeltas,
} from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

/**
 * Operations > Lanes: the seven lanes side by side (a grid from `xl`, stacked below). Each is a card with the lane
 * count and trend in its head and **rows**, newest first. A row opens in place into the full detail (every stored
 * fact on the payload, the chips, every link), which is where "every fact is visible" lives now that the Board shows
 * tier A as cards and tier B as lines. `?lane=` shows one lane alone (the DOP-11 solo view, `Load earlier` and all).
 */
export function LanesView({
  events,
  snapshot,
  sessionDeltas,
  lane,
  company,
  quietPriorities,
  sheetSyncOptIn,
  loading,
  loadingEarlier,
  canLoadEarlier,
  highlights = EMPTY_ARRIVAL_HIGHLIGHTS,
  onSelectLane,
  onShowAll,
  onLoadEarlier,
  onOpenAll,
}: {
  events: DailyOperationsEventItem[];
  snapshot?: DailyOperationsSnapshot | null;
  sessionDeltas: DailyOperationsSessionDeltas;
  lane: string | null;
  company: string | null;
  quietPriorities: boolean;
  sheetSyncOptIn: boolean;
  loading?: boolean;
  loadingEarlier?: boolean;
  canLoadEarlier?: boolean;
  highlights?: ArrivalHighlights;
  /** Toggle: the same lane again returns to every lane. */
  onSelectLane: (nextLane: DailyOperationsPanelLane) => void;
  onShowAll?: () => void;
  onLoadEarlier?: () => void;
  onOpenAll?: (lane: DailyOperationsPanelLane) => void;
}) {
  const view = panelsForDailyOperationsView({ lane, sheetSyncOptIn });
  const solo = view.solo;
  const showAll = onShowAll ?? (() => (solo ? onSelectLane(solo) : undefined));

  return (
    <section className="space-y-3" data-panels-focused={solo ?? "none"} data-panels-view={solo ? "solo" : "all"} data-ops-view="lanes">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="crm-text-muted crm-small m-0">{DAILY_COPY.lanes.subtitle}</p>
        {company ? (
          <span className="crm-pill crm-pill--neutral">
            {DAILY_COPY.filtered}: {sourceCompanyLabel(company)}
          </span>
        ) : null}
      </div>

      <div role="tablist" aria-label={DAILY_COPY.panelTabs} className="crm-chips">
        <LaneTab selected={solo === null} label={DAILY_COPY.allPanels} onClick={showAll} data-panel-tab="all" />
        {view.tabs.map((panel) => {
          const count = panel === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, panel);
          return (
            <LaneTab
              key={panel}
              selected={solo === panel}
              label={DAILY_COPY.panelsLabels[panel]}
              count={loading ? null : count}
              dot={toneClasses(laneToneFor(panel)).dot}
              onClick={() => (solo === panel ? showAll() : onSelectLane(panel))}
              data-panel-tab={panel}
            />
          );
        })}
      </div>

      <div className="dboard-lanes" data-solo={solo ? "true" : "false"}>
        {view.visible.map((panel) => (
          <LaneColumn
            key={panel}
            lane={panel}
            solo={solo === panel}
            events={events}
            snapshot={snapshot}
            sessionDeltas={sessionDeltas}
            company={company}
            quietPriorities={quietPriorities}
            loading={loading}
            loadingEarlier={loadingEarlier}
            canLoadEarlier={Boolean(solo === panel && canLoadEarlier)}
            highlights={highlights}
            onSelectLane={onSelectLane}
            onShowAll={showAll}
            onLoadEarlier={onLoadEarlier}
            onOpenAll={onOpenAll}
          />
        ))}
      </div>
    </section>
  );
}

function LaneTab({
  selected,
  label,
  count,
  dot,
  onClick,
  ...rest
}: {
  selected: boolean;
  label: string;
  count?: number | null;
  dot?: string;
  onClick: () => void;
  "data-panel-tab": string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn("crm-chip", selected && "crm-chip--active")}
      {...rest}
    >
      {dot ? <span className={cn("dboard-row__dot", dot)} aria-hidden="true" /> : null}
      {label}
      {count != null ? <AnimatedNumber value={count} className="text-[11px] font-semibold" /> : null}
    </button>
  );
}

function LaneColumn({
  lane,
  solo,
  events,
  snapshot,
  sessionDeltas,
  company,
  quietPriorities,
  loading,
  loadingEarlier,
  canLoadEarlier,
  highlights,
  onSelectLane,
  onShowAll,
  onLoadEarlier,
  onOpenAll,
}: {
  lane: DailyOperationsPanelLane;
  solo: boolean;
  events: DailyOperationsEventItem[];
  snapshot?: DailyOperationsSnapshot | null;
  sessionDeltas: DailyOperationsSessionDeltas;
  company: string | null;
  quietPriorities: boolean;
  loading?: boolean;
  loadingEarlier?: boolean;
  canLoadEarlier: boolean;
  highlights: ArrivalHighlights;
  onSelectLane: (nextLane: DailyOperationsPanelLane) => void;
  onShowAll: () => void;
  onLoadEarlier?: () => void;
  onOpenAll?: (lane: DailyOperationsPanelLane) => void;
}) {
  const overrides = useKindTierOverrides();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const panelEvents = eventsForDailyOperationsPanel({ events, lane, company, quietPriorities });
  const limit = panelVisibleLimit({ focused: solo, showAll: false, total: panelEvents.length });
  const visible = sliceDailyOperationsPanelEvents(panelEvents, solo, limit);
  const hidden = panelEvents.length - visible.length;
  const today = lane === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, lane);
  const sessionDelta = laneSessionDelta(sessionDeltas, lane);
  const empty = dailyOperationsPanelEmptyCopy({ lane, company, todayCount: today });
  const secondary = laneSecondary(snapshot, lane);
  const trend = laneTrend(snapshot, lane, today);
  const tone = toneClasses(laneToneFor(lane));
  const pairedIds = new Set(
    lane === "granot"
      ? pairGranotEvents(panelEvents)
          .filter((event) => event.parent_receipt_id)
          .map((event) => event.event_id)
      : [],
  );
  const label = DAILY_COPY.panelsLabels[lane];
  const change = trend && trend.versusYesterday.tone !== "missing" ? trend.versusYesterday : null;

  function toggle(eventId: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(eventId)) {
        next.add(eventId);
      }
      return next;
    });
  }

  return (
    <section
      className={cn("crm-card dboard-lane", solo && "crm-card--selected")}
      data-panel={lane}
      data-focused={solo ? "true" : "false"}
      aria-label={label}
    >
      <button
        type="button"
        className="dboard-lane__head"
        aria-pressed={solo}
        aria-label={`${solo ? DAILY_COPY.allPanels : DAILY_COPY.onlyThis}: ${label}`}
        onClick={() => (solo ? onShowAll() : onSelectLane(lane))}
      >
        <span className="dboard-lane__top">
          <IconBadge icon={laneIcon(lane)} tone="gray" size="sm" />
          <span className={cn("dboard-row__dot", tone.dot)} aria-hidden="true" />
          <span className="dboard-tile__title">{label}</span>
          <span className="ml-auto flex items-center gap-2">
            {sessionDelta > 0 ? (
              <span className="crm-pill crm-pill--green">
                +<AnimatedNumber value={sessionDelta} />
              </span>
            ) : null}
            <span className="dboard-tile__count">{loading ? DAILY_COPY.missingYesterday : <AnimatedNumber value={today} />}</span>
          </span>
        </span>
        {trend ? (
          <span className="dboard-tile__meta">
            {trend.yesterdayByNow == null && trend.dayBeforeByNow == null ? (
              <span>
                {DAILY_COPY.missingYesterday} {DAILY_COPY.noBaseline}
              </span>
            ) : (
              <>
                {change ? (
                  <TrendChip tone={change.tone === "ahead" ? "up" : change.tone === "behind" ? "down" : "even"}>
                    {change.label} {DAILY_COPY.vsYesterdayByNow}
                  </TrendChip>
                ) : null}
                <span>
                  {DAILY_COPY.yesterdayFull} {formatLaneCount(trend.yesterdayByNow)}
                  {trend.dayBeforeByNow != null ? ` · ${DAILY_COPY.dayBefore} ${formatLaneCount(trend.dayBeforeByNow)}` : ""}{" "}
                  {DAILY_COPY.byNow}
                </span>
              </>
            )}
          </span>
        ) : null}
        {secondary ? <span className="dboard-tile__meta">{secondary}</span> : null}
      </button>
      {loading ? (
        <div className="crm-stack" style={{ padding: "0 14px 14px" }}>
          <span className="crm-skeleton" style={{ height: 36 }} />
          <span className="crm-skeleton" style={{ height: 36 }} />
        </div>
      ) : visible.length === 0 ? (
        <p className="crm-empty">{empty}</p>
      ) : (
        <div className="dboard-lane__scroll" data-panel-scroll>
          <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label={label} data-event-list>
            {visible.map((event) => {
              const expanded = open.has(event.event_id);
              const arrived = highlights.highlightedIds.has(event.event_id);
              const tier = presentationTier(event.kind, { overrides, quietPriorities });
              return (
                <li
                  key={event.event_id}
                  className={arrived ? "daily-row daily-row-enter" : "daily-row"}
                  style={pairedIds.has(event.event_id) ? { marginLeft: 14 } : undefined}
                >
                  <div className="min-h-0">
                    <FeedRow
                      event={event}
                      tier={tier}
                      arrived={arrived}
                      expanded={expanded}
                      icon
                      onClick={() => toggle(event.event_id)}
                    />
                    {expanded ? (
                      <div className="dboard-detail" data-lane-detail>
                        <DailyOperationsEventCard event={event} compact />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <div className="dboard-lane__more">
        {hidden > 0 && onOpenAll ? (
          <Button type="button" variant="ghost" className="h-8 w-full px-3 text-xs text-trust-blue" onClick={() => onOpenAll(lane)}>
            {DAILY_COPY.openAll} ({panelEvents.length})
          </Button>
        ) : null}
        {solo && canLoadEarlier ? (
          <Button type="button" variant="outline" className="h-8 w-full px-3 text-xs" disabled={loadingEarlier} onClick={onLoadEarlier}>
            {DAILY_COPY.loadEarlier}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
