"use client";

import {
  DAILY_COPY,
  dailyOperationsTextsHeader,
} from "@/components/daily/daily-copy";
import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  granotYesterdayByNow,
  paceVersusYesterdayByNow,
  type DailyOperationsPanelLane,
  type DailyOperationsSnapshot,
} from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  eventsForDailyOperationsPanel,
  focusLaneFromSearch,
  pairGranotEvents,
  sliceDailyOperationsPanelEvents,
  visibleDailyOperationsPanels,
} from "@/lib/api/dailyOperationsBoard";
import {
  granotTileToday,
  type DailyOperationsEventItem,
  type DailyOperationsSessionDeltas,
} from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function PanelPace({
  today,
  yesterdayByNow,
}: {
  today: number;
  yesterdayByNow: number | null;
}) {
  const pace = paceVersusYesterdayByNow(today, yesterdayByNow);
  const label =
    pace.tone === "missing"
      ? DAILY_COPY.missingYesterday
      : pace.delta === 0
        ? DAILY_COPY.even
        : pace.delta! > 0
          ? `+${pace.delta}`
          : `${pace.delta}`;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        pace.tone === "ahead" && "bg-emerald-50 text-emerald-700",
        pace.tone === "behind" && "bg-red-50 text-red-700/80",
        (pace.tone === "even" || pace.tone === "missing") && "bg-steel-100 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function panelYesterdayByNow(
  snapshot: DailyOperationsSnapshot | null | undefined,
  lane: DailyOperationsPanelLane,
): number | null {
  if (!snapshot) {
    return null;
  }
  if (lane === "lead") return snapshot.metrics.leads.yesterday_by_now;
  if (lane === "text") return snapshot.metrics.texts.yesterday_by_now;
  if (lane === "booking") return snapshot.metrics.bookings.yesterday_by_now;
  if (lane === "cancellation") return snapshot.metrics.cancellations.yesterday_by_now;
  if (lane === "granot") return granotYesterdayByNow(snapshot);
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
  onToggleQuietPriorities,
  onToggleSheetSync,
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
  onToggleQuietPriorities: () => void;
  onToggleSheetSync: () => void;
  onLoadEarlier?: () => void;
}) {
  const focused = focusLaneFromSearch(lane);
  const panels = visibleDailyOperationsPanels({ lane, sheetSyncOptIn });
  const rail = focused ? panels.filter((panel) => panel !== focused) : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {DAILY_COPY.panels}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={quietPriorities ? "default" : "outline"}
            className="h-8 px-3 text-xs"
            aria-pressed={quietPriorities}
            onClick={onToggleQuietPriorities}
          >
            {DAILY_COPY.quietPriorities}
          </Button>
          <Button
            type="button"
            variant={sheetSyncOptIn || focused === "sheet_sync" ? "default" : "outline"}
            className="h-8 px-3 text-xs"
            aria-pressed={sheetSyncOptIn || focused === "sheet_sync"}
            onClick={onToggleSheetSync}
          >
            {sheetSyncOptIn || focused === "sheet_sync" ? DAILY_COPY.sheetSyncHide : DAILY_COPY.sheetSyncShow}
          </Button>
        </div>
      </div>

      {focused && rail.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="daily-count-rail">
          {rail.map((panel) => {
            const count =
              panel === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, panel);
            return (
              <button
                key={panel}
                type="button"
                onClick={() => onSelectLane(panel)}
                className="inline-flex items-center gap-1.5 rounded-full border border-steel-200 bg-card px-2.5 py-1 text-xs font-medium text-navy hover:border-trust-blue/40"
              >
                <span>{DAILY_COPY.panelsLabels[panel]}</span>
                <span className="tabular-nums text-muted-foreground">{formatCount(count)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          focused
            ? "grid-cols-1"
            : "xl:grid-cols-2 2xl:grid-cols-3",
        )}
      >
        {(focused ? [focused] : panels).map((panel) => (
          <CategoryPanel
            key={panel}
            lane={panel}
            focused={focused === panel}
            events={events}
            snapshot={snapshot}
            sessionDeltas={sessionDeltas}
            company={company}
            quietPriorities={quietPriorities}
            loading={loading}
            loadingEarlier={loadingEarlier}
            canLoadEarlier={Boolean(focused === panel && canLoadEarlier)}
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
  const panelEvents = eventsForDailyOperationsPanel({
    events,
    lane,
    company,
    quietPriorities,
  });
  const visible = sliceDailyOperationsPanelEvents(panelEvents, focused);
  const today =
    lane === "granot" ? granotTileToday(snapshot ?? null) : dailyOperationsPanelCount(snapshot, lane);
  const sessionDelta = sessionDeltaForLane(sessionDeltas, lane);
  const empty = dailyOperationsPanelEmptyCopy({ lane, company });
  const secondary = panelSecondary(snapshot, lane);
  const pairedIds = new Set(
    lane === "granot"
      ? pairGranotEvents(panelEvents)
          .filter((event) => event.parent_receipt_id)
          .map((event) => event.event_id)
      : [],
  );

  return (
    <Card
      className={cn(focused && lane === "exception" && "xl:col-span-2 2xl:col-span-3")}
      data-panel={lane}
      data-focused={focused ? "true" : "false"}
    >
      <CardHeader className="p-4 pb-2">
        <button type="button" className="w-full text-left" onClick={() => onSelectLane(lane)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {DAILY_COPY.panelsLabels[lane]}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold tabular-nums text-navy">
                {loading ? DAILY_COPY.missingYesterday : formatCount(today)}
              </span>
              <PanelPace today={today} yesterdayByNow={panelYesterdayByNow(snapshot, lane)} />
              {sessionDelta > 0 ? (
                <span className="text-xs font-semibold tabular-nums text-emerald-700">+{sessionDelta}</span>
              ) : null}
            </div>
          </div>
          {secondary ? <p className="mt-1 text-xs text-muted-foreground">{secondary}</p> : null}
        </button>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
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
