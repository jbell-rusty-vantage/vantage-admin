"use client";

import { AnimatedNumber } from "@/components/daily/animated-number";
import {
  DAILY_COPY,
  dailyOperationsTextsHeader,
} from "@/components/daily/daily-copy";
import { AnimatedEventList } from "@/components/daily/event-list";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dailyOperationsTrend,
  granotDayBeforeByNow,
  granotYesterdayByNow,
  sourceCompanyLabel,
  type DailyOperationsPanelLane,
  type DailyOperationsPercentChange,
  type DailyOperationsSnapshot,
  type DailyOperationsTrend,
} from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  eventsForDailyOperationsPanel,
  pairGranotEvents,
  panelsForDailyOperationsView,
  panelVisibleLimit,
  sliceDailyOperationsPanelEvents,
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
  if (lane === "sheet_sync") {
    const sheetSync = snapshot.metrics.sheet_sync;
    if (sheetSync.completed + sheetSync.failed === 0) {
      return null;
    }
    return `${formatCount(sheetSync.completed)} ${DAILY_COPY.completed} · ${formatCount(sheetSync.failed)} ${DAILY_COPY.failed}`;
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
 * The category strip. A tab row at the top picks the view: **All panels**
 * (the command-center grid, 8 cards each) or one lane alone (full width,
 * grid of up to 40 cards, `Load earlier`). `?lane=` carries the choice so
 * tiles, tabs, and panel headers all agree. Long stacks open the full-stream
 * overlay (`Open all (N)`) instead of stretching the page. Board-wide
 * controls (Quiet priorities, Sheet Sync, Colours) live in the shell chrome.
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
  /** Toggle: the same lane again returns to All panels. */
  onSelectLane: (nextLane: DailyOperationsPanelLane) => void;
  /** Explicit return to All panels (the first tab). */
  onShowAll?: () => void;
  /** Kept for callers that still wire the toggles here; the shell renders them. */
  onToggleQuietPriorities?: () => void;
  onToggleSheetSync?: () => void;
  onLoadEarlier?: () => void;
  onOpenAll?: (lane: DailyOperationsPanelLane) => void;
}) {
  const view = panelsForDailyOperationsView({ lane, sheetSyncOptIn });
  const solo = view.solo;
  const showAll = onShowAll ?? (() => (solo ? onSelectLane(solo) : undefined));

  return (
    <section className="space-y-3" data-panels-focused={solo ?? "none"} data-panels-view={solo ? "solo" : "all"}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">{DAILY_COPY.panels}</h2>
          <p className="text-[11px] text-steel">{DAILY_COPY.panelsSubtitle}</p>
        </div>
        {company ? (
          <span className="rounded-full bg-steel-100 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {DAILY_COPY.filtered}: {sourceCompanyLabel(company)}
          </span>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label={DAILY_COPY.panelTabs}
        className="flex flex-wrap gap-1 rounded-lg border border-steel-200 bg-card p-1"
      >
        <PanelTab
          selected={solo === null}
          label={DAILY_COPY.allPanels}
          onClick={showAll}
          data-panel-tab="all"
        />
        {view.tabs.map((panel) => {
          const count =
            panel === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, panel);
          return (
            <PanelTab
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

      <div className={cn("grid gap-4", !solo && "xl:grid-cols-2 2xl:grid-cols-3")}>
        {view.visible.map((panel) => (
          <CategoryPanel
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

function PanelTab({
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
        selected ? "bg-navy text-white shadow-sm" : "text-muted-foreground hover:bg-steel-100 hover:text-navy",
      )}
      {...rest}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", selected ? "bg-white/80" : dot)} aria-hidden="true" /> : null}
      {label}
      {count != null ? (
        <AnimatedNumber
          value={count}
          className={cn("text-[11px] font-semibold", selected ? "text-white/80" : "text-steel")}
        />
      ) : null}
    </button>
  );
}

function CategoryPanel({
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
  const panelEvents = eventsForDailyOperationsPanel({
    events,
    lane,
    company,
    quietPriorities,
  });
  const limit = panelVisibleLimit({ focused: solo, showAll: false, total: panelEvents.length });
  const visible = sliceDailyOperationsPanelEvents(panelEvents, solo, limit);
  const hidden = panelEvents.length - visible.length;
  const today =
    lane === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, lane);
  const sessionDelta = sessionDeltaForLane(sessionDeltas, lane);
  const empty = dailyOperationsPanelEmptyCopy({ lane, company, todayCount: today });
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
        "flex min-h-0 flex-col overflow-hidden border-t-4 transition-shadow",
        tone.edge,
        solo && "ring-2 ring-trust-blue/30 shadow-md xl:max-h-[calc(100dvh-8rem)]",
        exceptionsLive && "bg-amber-50/60",
      )}
      data-panel={lane}
      data-focused={solo ? "true" : "false"}
    >
      <CardHeader className="shrink-0 p-3.5 pb-2">
        <button
          type="button"
          className="w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-blue/40"
          aria-pressed={solo}
          aria-label={`${solo ? DAILY_COPY.allPanels : DAILY_COPY.onlyThis}: ${DAILY_COPY.panelsLabels[lane]}`}
          onClick={() => (solo ? onShowAll() : onSelectLane(lane))}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden="true" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-navy">
              {DAILY_COPY.panelsLabels[lane]}
            </CardTitle>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              {sessionDelta > 0 ? (
                <span className="rounded-full bg-emerald-50 px-1.5 text-xs font-semibold tabular-nums text-emerald-700">
                  +<AnimatedNumber value={sessionDelta} />
                </span>
              ) : null}
              <span className="text-xl font-semibold leading-none tabular-nums text-navy">
                {loading ? DAILY_COPY.missingYesterday : <AnimatedNumber value={today} />}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {solo ? DAILY_COPY.allPanels : DAILY_COPY.onlyThis} ↗
              </span>
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3.5 pt-2">
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-md bg-steel-100" />
            <div className="h-12 animate-pulse rounded-md bg-steel-100" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div
            className={cn(
              "daily-stream-body relative min-h-0 overflow-y-auto",
              solo ? "max-h-[min(56rem,calc(100dvh-14rem))] flex-1" : "max-h-112",
            )}
            data-panel-scroll
          >
            <AnimatedEventList
              events={visible}
              highlights={highlights}
              groupedIds={pairedIds}
              ariaLabel={DAILY_COPY.panelsLabels[lane]}
              className={cn("pb-6", solo && "grid items-start sm:grid-cols-2 xl:grid-cols-3")}
            />
          </div>
        )}
        {hidden > 0 && onOpenAll ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full shrink-0 px-3 text-xs text-trust-blue"
            onClick={() => onOpenAll(lane)}
          >
            {DAILY_COPY.openAll} ({panelEvents.length})
          </Button>
        ) : null}
        {solo && canLoadEarlier ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full shrink-0 px-3 text-xs"
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
