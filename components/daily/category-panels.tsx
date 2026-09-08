"use client";

import { useState } from "react";
import {
  DAILY_COPY,
  dailyOperationsTextsHeader,
} from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dailyOperationsTrend,
  granotDayBeforeByNow,
  granotYesterdayByNow,
  type DailyOperationsPanelLane,
  type DailyOperationsPercentChange,
  type DailyOperationsSnapshot,
  type DailyOperationsTrend,
} from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  eventsForDailyOperationsPanel,
  focusLaneFromSearch,
  orderPanelsForFocus,
  pairGranotEvents,
  panelVisibleLimit,
  sliceDailyOperationsPanelEvents,
  visibleDailyOperationsPanels,
} from "@/lib/api/dailyOperationsBoard";
import { laneToneFor, toneClasses } from "@/lib/api/dailyOperationsColors";
import {
  granotTileToday,
  type DailyOperationsEventItem,
  type DailyOperationsSessionDeltas,
} from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

function formatCount(value: number | null): string {
  if (value == null) {
    return DAILY_COPY.missingYesterday;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function chipTone(tone: DailyOperationsPercentChange["tone"]): string {
  if (tone === "ahead") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (tone === "behind") {
    return "bg-red-50 text-red-700/80";
  }
  return "bg-steel-100 text-muted-foreground";
}

function panelTrend(
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

function panelSecondary(snapshot: DailyOperationsSnapshot | null | undefined, lane: DailyOperationsPanelLane): string | null {
  if (!snapshot) {
    return null;
  }
  const leads = snapshot.metrics.leads;
  const texts = snapshot.metrics.texts;
  const intakes = snapshot.metrics.intakes;
  const webhooks = snapshot.metrics.webhooks;
  const exceptions = snapshot.metrics.exceptions;
  if (lane === "lead") {
    return `${formatCount(leads.form)} ${DAILY_COPY.form} / ${formatCount(leads.call)} ${DAILY_COPY.call} · ${formatCount(leads.duplicate_form + leads.duplicate_call)} ${DAILY_COPY.tiles.duplicates}`;
  }
  if (lane === "text") {
    return dailyOperationsTextsHeader({
      sent: texts.today,
      heldNow: texts.held_now,
      failed: texts.failed,
    });
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
  return null;
}

function sessionDeltaForLane(
  deltas: DailyOperationsSessionDeltas,
  lane: DailyOperationsPanelLane,
): number {
  if (lane === "lead") return deltas.leads;
  if (lane === "text") return deltas.texts;
  if (lane === "granot") return deltas.granot;
  if (lane === "intake") return deltas.intakes;
  if (lane === "booking") return deltas.bookings;
  if (lane === "cancellation") return deltas.cancellations;
  return 0;
}

/**
 * The category grid. Every panel stays on the board at all times: focusing a
 * lane moves it to the top, lets it span the full width and show up to 40
 * cards with `Load earlier`; the rest of the panels keep their places
 * underneath. Board-wide controls (Quiet priorities, Sheet Sync, Colours)
 * live in the shell chrome, not here.
 */
export function CategoryPanels({
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
  onSelectLane,
  onLoadEarlier,
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
  onSelectLane: (nextLane: DailyOperationsPanelLane) => void;
  /** Kept for callers that still wire the toggles here; the shell renders them. */
  onToggleQuietPriorities?: () => void;
  onToggleSheetSync?: () => void;
  onLoadEarlier?: () => void;
}) {
  const focusedPanel = focusLaneFromSearch(lane) as DailyOperationsPanelLane | null;
  const panels = orderPanelsForFocus(visibleDailyOperationsPanels({ lane, sheetSyncOptIn }), focusedPanel);

  return (
    <section className="space-y-3" data-panels-focused={focusedPanel ?? "none"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">{DAILY_COPY.panels}</h2>
          <p className="text-[11px] text-steel">{DAILY_COPY.panelsSubtitle}</p>
        </div>
        {focusedPanel ? (
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={() => onSelectLane(focusedPanel)}
          >
            {DAILY_COPY.collapse} {DAILY_COPY.panelsLabels[focusedPanel]}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {panels.map((panel) => (
          <CategoryPanel
            key={panel}
            lane={panel}
            focused={focusedPanel === panel}
            events={events}
            snapshot={snapshot}
            sessionDeltas={sessionDeltas}
            company={company}
            quietPriorities={quietPriorities}
            loading={loading}
            loadingEarlier={loadingEarlier}
            canLoadEarlier={Boolean(focusedPanel === panel && canLoadEarlier)}
            onSelectLane={onSelectLane}
            onLoadEarlier={onLoadEarlier}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryPanel({
  lane,
  focused,
  events,
  snapshot,
  sessionDeltas,
  company,
  quietPriorities,
  loading,
  loadingEarlier,
  canLoadEarlier,
  onSelectLane,
  onLoadEarlier,
}: {
  lane: DailyOperationsPanelLane;
  focused: boolean;
  events: DailyOperationsEventItem[];
  snapshot?: DailyOperationsSnapshot | null;
  sessionDeltas: DailyOperationsSessionDeltas;
  company: string | null;
  quietPriorities: boolean;
  loading?: boolean;
  loadingEarlier?: boolean;
  canLoadEarlier: boolean;
  onSelectLane: (nextLane: DailyOperationsPanelLane) => void;
  onLoadEarlier?: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const panelEvents = eventsForDailyOperationsPanel({
    events,
    lane,
    company,
    quietPriorities,
  });
  const limit = panelVisibleLimit({ focused, showAll, total: panelEvents.length });
  const visible = sliceDailyOperationsPanelEvents(panelEvents, focused, limit);
  const hidden = panelEvents.length - visible.length;
  const today =
    lane === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, lane);
  const sessionDelta = sessionDeltaForLane(sessionDeltas, lane);
  const empty = dailyOperationsPanelEmptyCopy({ lane, company });
  const secondary = panelSecondary(snapshot, lane);
  const trend = panelTrend(snapshot, lane, today);
  const tone = toneClasses(laneToneFor(lane));
  const pairedIds = new Set(
    lane === "granot"
      ? pairGranotEvents(panelEvents)
          .filter((event) => event.parent_receipt_id)
          .map((event) => event.event_id)
      : [],
  );
  const exceptionsLive = lane === "exception" && panelEvents.length > 0;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-t-4 transition-shadow",
        tone.edge,
        focused && "col-span-full ring-2 ring-trust-blue/30 shadow-md",
        exceptionsLive && "bg-amber-50/60",
      )}
      data-panel={lane}
      data-focused={focused ? "true" : "false"}
    >
      <CardHeader className="p-3.5 pb-2">
        <button
          type="button"
          className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-blue/40"
          aria-pressed={focused}
          aria-label={`${focused ? DAILY_COPY.collapse : DAILY_COPY.lookCloser}: ${DAILY_COPY.panelsLabels[lane]}`}
          onClick={() => onSelectLane(lane)}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden="true" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-navy">
              {DAILY_COPY.panelsLabels[lane]}
            </CardTitle>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {sessionDelta > 0 ? (
                <span className="rounded-full bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700">
                  +{sessionDelta}
                </span>
              ) : null}
              <span className="text-xl font-semibold leading-none tabular-nums text-navy">
                {loading ? DAILY_COPY.missingYesterday : formatCount(today)}
              </span>
              <span className="text-[11px] text-muted-foreground">{focused ? DAILY_COPY.collapse : DAILY_COPY.lookCloser} ↗</span>
            </span>
          </div>
          {trend ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
              {trend.yesterdayByNow == null && trend.dayBeforeByNow == null ? (
                <span className="text-muted-foreground">
                  {DAILY_COPY.missingYesterday} {DAILY_COPY.noBaseline}
                </span>
              ) : (
                <>
                  <span
                    className={cn("inline-flex rounded-full px-1.5 py-0.5 font-semibold", chipTone(trend.versusYesterday.tone))}
                    title={DAILY_COPY.vsYesterdayByNow}
                  >
                    {trend.versusYesterday.label} {DAILY_COPY.vsYesterdayByNow}
                  </span>
                  <span className="text-muted-foreground">
                    {DAILY_COPY.yesterdayFull} {formatCount(trend.yesterdayByNow)}
                    {trend.dayBeforeByNow != null ? ` · ${DAILY_COPY.dayBefore} ${formatCount(trend.dayBeforeByNow)}` : ""}{" "}
                    {DAILY_COPY.byNow}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
        </button>
      </CardHeader>
      <CardContent className={cn("flex-1 space-y-2 p-3.5 pt-2", focused && "xl:columns-2 2xl:columns-3 xl:gap-3 xl:space-y-0 [&>*]:mb-2 [&>*]:break-inside-avoid")}>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-md bg-steel-100" />
            <div className="h-12 animate-pulse rounded-md bg-steel-100" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          visible.map((event) => (
            <DailyOperationsEventCard
              key={event.event_id}
              event={event}
              grouped={pairedIds.has(event.event_id)}
            />
          ))
        )}
        {hidden > 0 || showAll ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full px-3 text-xs text-trust-blue"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? DAILY_COPY.showFewer : `${DAILY_COPY.showAll} (${hidden} more)`}
          </Button>
        ) : null}
        {focused && canLoadEarlier ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full px-3 text-xs"
            disabled={loadingEarlier}
            onClick={onLoadEarlier}
          >
            {DAILY_COPY.loadEarlier}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
