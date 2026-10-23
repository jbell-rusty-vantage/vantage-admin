"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, Rows3 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CompaniesTable } from "@/components/daily/companies-table";
import {
  DAILY_COPY,
  DAILY_QUIET_PRIORITIES_STORAGE_KEY,
  DAILY_SHEET_SYNC_STORAGE_KEY,
  dailyOperationsFloridaHour,
  formatDailyOperationsClock,
  formatDailyOperationsDay,
} from "@/components/daily/daily-copy";
import {
  DailyOperationsEventsOverlay,
  type DailyOperationsOverlayScope,
} from "@/components/daily/events-overlay";
import { HeadlineTiles } from "@/components/daily/headline-tiles";
import { DailyBoardStyle } from "@/components/daily/daily-board-style";
import { FactDrawer } from "@/components/daily/fact-drawer";
import { HourlyRhythm } from "@/components/daily/hourly-rhythm";
import { KindColorsProvider, useStoredKindTones } from "@/components/daily/kind-colors-context";
import { KindColorsPanel } from "@/components/daily/kind-colors-panel";
import { KindTiersProvider, useStoredKindTiers } from "@/components/daily/kind-tiers-context";
import { LaneTiles } from "@/components/daily/lane-tiles";
import { LanesView } from "@/components/daily/lanes-view";
import { LiveDot } from "@/components/daily/live-dot";
import { LeadSpendPanel } from "@/components/daily/lead-spend-panel";
import { LiveFeed } from "@/components/daily/live-feed";
import { OriginsPanel } from "@/components/daily/origins-panel";
import { useArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { TeamCallGoals } from "@/components/daily/team-call-goals";
import { useNowMs } from "@/components/daily/use-now";
import { useStoredPreferenceFlag } from "@/components/daily/use-preference-flag";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/crm";
import {
  fetchDailyOperationsEvents,
  toggleSearchParam,
  withLiveDailyOperationsClock,
  writeSearchParam,
  type DailyOperationsLane,
  type DailyOperationsPanelLane,
} from "@/lib/api/dailyOperations";
import {
  dailyOperationsPanelCount,
  earlierDailyOperationsCursor,
  eventsForDailyOperationsArrivals,
  eventsForDailyOperationsPanel,
  focusLaneFromSearch,
  pairGranotEvents,
  parseDailyOperationsView,
  readPreferenceFlag,
  visibleDailyOperationsPanels,
  writeDailyOperationsView,
  type DailyOperationsView,
} from "@/lib/api/dailyOperationsBoard";
import {
  EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  granotTileToday,
  mergeDailyOperationsEvents,
  type DailyOperationsLiveStatus,
  type DailyOperationsTileId,
} from "@/lib/api/dailyOperationsLive";
import { useDailyOperationsRead } from "./daily-read-provider";
import { dailyOperationsReadDayNotice, receiveDailyOperationsReadView, type DailyOperationsReadView } from "@/lib/api/dailyOperationsRead";
import { cn } from "@/lib/utils";

function LiveChrome({ status, lastGoodAt, day, onRetry }: {
  status: DailyOperationsLiveStatus;
  lastGoodAt: string | null;
  day: string | undefined;
  onRetry: () => void;
}) {
  const label = status === "paused" ? "Paused" : status === "reconnecting" ? "Update delayed" : status === "off" ? "Unavailable" : "Updates every minute";
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-steel-200 bg-card px-3 py-1 text-sm" aria-live="polite" data-live-status={status}>
      <LiveDot state={status} />
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {lastGoodAt ? <span className="text-xs text-muted-foreground">Updated {day} {formatDailyOperationsClock(lastGoodAt)}</span> : null}
      {status === "off" ? <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={onRetry}>{DAILY_COPY.retry}</Button> : null}
    </div>
  );
}

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The board and shell toasts consume one shared, visible-tab, minute read view. */
export function DailyOperationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOwner = useDashboardRole() === "owner";
  const lane = searchParams.get("lane");
  const company = searchParams.get("company");
  const quietFromUrl = searchParams.get("quiet_priorities") === "1";
  // `?view=board|lanes`; a link that names a lane and no view means Lanes (old /daily?lane= links, Pulse tiles).
  const view = parseDailyOperationsView(searchParams.get("view"), lane);
  const laneInView = view === "lanes" ? lane : null;
  const [board, setBoard] = useState(EMPTY_DAILY_OPERATIONS_LIVE_BOARD);
  const read = useDailyOperationsRead();
  const flashedTiles: DailyOperationsTileId[] = [];
  const [storedQuiet, writeStoredQuiet] = useStoredPreferenceFlag(DAILY_QUIET_PRIORITIES_STORAGE_KEY);
  const [storedSheet, writeStoredSheet] = useStoredPreferenceFlag(DAILY_SHEET_SYNC_STORAGE_KEY);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [exhaustedScopes, setExhaustedScopes] = useState<ReadonlySet<string>>(new Set());
  const [overlay, setOverlay] = useState<DailyOperationsOverlayScope | null>(null);
  const { overrides: kindTones, pick: pickKindTone, reset: resetKindTones } = useStoredKindTones();
  const { overrides: kindTiers, pick: pickKindTier, reset: resetKindTiers } = useStoredKindTiers();
  const [drawerIds, setDrawerIds] = useState<readonly string[] | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const preferencesSeeded = useRef(false);
  const focusedLane = focusLaneFromSearch(laneInView);
  const nowMs = useNowMs();
  const eventsHydrated = read.data !== null;
  const highlights = useArrivalHighlights(board.events, eventsHydrated);
  const [syncedView, setSyncedView] = useState<DailyOperationsReadView | null>(null);
  if (read.data !== syncedView) {
    setSyncedView(read.data);
    if (read.data) {
      const next = read.data;
      if (board.snapshot?.today !== next.day) setExhaustedScopes(new Set(next.events.length < 80 ? ["all"] : []));
      setBoard(current => receiveDailyOperationsReadView(current, next));
    } else if (read.error) {
      // Authentication refusal clears the provider; never keep revoked cards visible.
      setBoard(EMPTY_DAILY_OPERATIONS_LIVE_BOARD);
    }
  }

  // Preferences live in localStorage (external store). A shared link with
  // `?quiet_priorities=1` persists the preference on arrival; a stored
  // preference is written back into the link once so the URL stays shareable.
  const quietPriorities = storedQuiet || quietFromUrl;
  const sheetSyncOn = storedSheet || lane === "sheet_sync";
  useEffect(() => {
    if (preferencesSeeded.current) {
      return;
    }
    preferencesSeeded.current = true;
    if (quietFromUrl) {
      writeStoredQuiet(true);
      return;
    }
    if (readPreferenceFlag(storageOrNull(), DAILY_QUIET_PRIORITIES_STORAGE_KEY)) {
      const next = writeSearchParam(searchParams, "quiet_priorities", "1");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [pathname, quietFromUrl, router, searchParams, writeStoredQuiet]);

  const ageMs = read.data ? Math.max(0, (nowMs ?? Date.parse(read.data.generated_at)) - Date.parse(read.data.generated_at)) : 0;
  const dayNotice = dailyOperationsReadDayNotice(read.data, nowMs);
  const status: DailyOperationsLiveStatus = read.paused ? "paused" : read.error || read.data?.freshness === "stale" || dayNotice || ageMs > 180_000 ? "reconnecting" : read.data ? "live" : "off";
  const snapshot = board.snapshot ? withLiveDailyOperationsClock(board.snapshot, nowMs) : null;
  const nowHour = nowMs === undefined ? undefined : dailyOperationsFloridaHour(new Date(nowMs));
  const loading = !snapshot && !read.error;

  function replaceQuery(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function writeParam(key: "lane" | "company", value: string) {
    replaceQuery(toggleSearchParam(searchParams, key, value));
  }

  /** A headline tile or a lane tab: that lane alone on the Lanes view (the same lane again returns to every lane). */
  function selectLane(nextLane: DailyOperationsLane) {
    const next = toggleSearchParam(searchParams, "lane", nextLane);
    next.set("view", "lanes");
    replaceQuery(next);
  }

  function writeView(nextView: DailyOperationsView) {
    replaceQuery(writeDailyOperationsView(searchParams, nextView));
  }

  function showAllPanels() {
    const next = writeSearchParam(searchParams, "lane", null);
    next.set("view", "lanes");
    replaceQuery(next);
  }

  function writeQuietPriorities(nextValue: boolean) {
    writeStoredQuiet(nextValue);
    replaceQuery(writeSearchParam(searchParams, "quiet_priorities", nextValue ? "1" : null));
  }

  function writeSheetSync(nextValue: boolean) {
    writeStoredSheet(nextValue);
    if (nextValue) {
      const next = writeSearchParam(searchParams, "lane", "sheet_sync");
      next.set("view", "lanes");
      replaceQuery(next);
      return;
    }
    if (lane === "sheet_sync") {
      showAllPanels();
    }
  }

  function scopeKey(scope: DailyOperationsPanelLane | null): string {
    return scope ?? "all";
  }

  function canLoadEarlierFor(scope: DailyOperationsPanelLane | null): boolean {
    return !exhaustedScopes.has(scopeKey(scope));
  }

  async function loadEarlier(scope: DailyOperationsPanelLane | null) {
    const cursor = earlierDailyOperationsCursor(board.events, scope);
    if (loadingEarlier || exhaustedScopes.has(scopeKey(scope))) {
      return;
    }
    setLoadingEarlier(true);
    try {
      const page = await fetchDailyOperationsEvents({ lane: scope, cursor: cursor ?? undefined, limit: 40 });
      setBoard((current) => ({
        ...current,
        events: mergeDailyOperationsEvents(current.events, page.items),
      }));
      if (page.items.length === 0 || page.next_cursor === null) {
        setExhaustedScopes((current) => new Set([...current, scopeKey(scope)]));
      }
    } finally {
      setLoadingEarlier(false);
    }
  }

  const overlayLane: DailyOperationsPanelLane | null = overlay && overlay !== "all" ? overlay : null;
  const overlayEvents =
    overlay === null
      ? []
      : overlayLane
        ? eventsForDailyOperationsPanel({ events: board.events, lane: overlayLane, company, quietPriorities })
        : eventsForDailyOperationsArrivals({ events: board.events, company, quietPriorities, limit: null });
  const drawerEvents = drawerIds
    ? drawerIds.flatMap((id) => board.events.filter((event) => event.event_id === id))
    : [];
  const overlayGrouped = new Set(
    overlayLane === "granot"
      ? pairGranotEvents(overlayEvents)
          .filter((event) => event.parent_receipt_id)
          .map((event) => event.event_id)
      : [],
  );
  const overlayToday =
    overlayLane === null
      ? null
      : overlayLane === "granot"
        ? granotTileToday(snapshot)
        : dailyOperationsPanelCount(snapshot, overlayLane);

  const boardPanels = visibleDailyOperationsPanels({ lane: null, sheetSyncOptIn: sheetSyncOn });

  return (
    <KindColorsProvider overrides={kindTones}>
      <KindTiersProvider overrides={kindTiers}>
      <DailyBoardStyle />
      <div className="space-y-5">
        <header className={cn("flex flex-wrap items-end gap-3", embedded ? "justify-end" : "justify-between")}>
          {embedded ? null : (
            <div>
              <p className="eyebrow">{DAILY_COPY.title}</p>
              <h1 className="text-3xl font-extrabold tracking-tight">{DAILY_COPY.title}</h1>
              <p className="mt-1.5 text-sm text-steel">
                {snapshot
                  ? formatDailyOperationsDay(snapshot.generated_at)
                  : DAILY_COPY.timezone}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2" aria-label={DAILY_COPY.boardToolbar}>
            <Segmented<DailyOperationsView>
              label={DAILY_COPY.boardViews.label}
              value={view}
              onChange={writeView}
              options={[
                { value: "board", label: DAILY_COPY.boardViews.board, icon: LayoutGrid },
                { value: "lanes", label: DAILY_COPY.boardViews.lanes, icon: Rows3 },
              ]}
            />
            <LiveChrome
              status={status}
              lastGoodAt={board.lastGoodAt}
              day={read.data?.day}
              onRetry={read.refresh}
            />
            <details className="dboard-display relative">
              <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md border border-steel-200 bg-card px-3 text-xs font-medium text-navy">
                {DAILY_COPY.display}
                <ChevronDown aria-hidden="true" width={14} height={14} />
              </summary>
              <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col gap-1.5 rounded-xl border border-steel-200 bg-card p-2 shadow-lg [&>button]:w-full [&>button]:justify-start">
                <Button
                  type="button"
                  variant={quietPriorities ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  aria-pressed={quietPriorities}
                  onClick={() => writeQuietPriorities(!quietPriorities)}
                >
                  {DAILY_COPY.quietPriorities}
                </Button>
                <Button
                  type="button"
                  variant={sheetSyncOn ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  aria-pressed={sheetSyncOn}
                  onClick={() => writeSheetSync(!sheetSyncOn)}
                >
                  {sheetSyncOn ? DAILY_COPY.sheetSyncHide : DAILY_COPY.sheetSyncShow}
                </Button>
                <Button
                  type="button"
                  variant={colorsOpen ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  aria-pressed={colorsOpen}
                  aria-expanded={colorsOpen}
                  onClick={() => setColorsOpen((current) => !current)}
                >
                  {DAILY_COPY.colors}
                  {Object.keys(kindTones).length + Object.keys(kindTiers).length > 0 ? (
                    <span className="ml-1 rounded-full bg-card/30 px-1 text-[10px] tabular-nums">
                      {Object.keys(kindTones).length + Object.keys(kindTiers).length}
                    </span>
                  ) : null}
                </Button>
              </div>
            </details>
          </div>
        </header>

        {colorsOpen ? (
          <KindColorsPanel
            overrides={kindTones}
            tiers={kindTiers}
            onPick={pickKindTone}
            onPickTier={pickKindTier}
            onReset={() => {
              resetKindTones();
              resetKindTiers();
            }}
            onClose={() => setColorsOpen(false)}
          />
        ) : null}

        {dayNotice ? <FeedbackMessage tone="error">{dayNotice}</FeedbackMessage> : null}

        {read.error ? (
          <FeedbackMessage tone="error">{read.error}</FeedbackMessage>
        ) : null}

        {isOwner ? <LeadSpendPanel /> : null}

        <section className="space-y-2" aria-label={DAILY_COPY.headline}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">{DAILY_COPY.headline}</h2>
          <HeadlineTiles
            snapshot={snapshot}
            sessionDeltas={board.sessionDeltas}
            flashedTiles={flashedTiles}
            lane={laneInView}
            loading={loading}
            nowHour={nowHour}
            onSelectLane={selectLane}
          />
        </section>

        <TeamCallGoals />

        {view === "board" ? (
          <div className="dboard-grid" data-ops-view="board">
            <div className="min-w-0 space-y-4">
              <HourlyRhythm snapshot={snapshot} nowHour={nowHour} />
              <section className="space-y-2" aria-label={DAILY_COPY.panels}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">{DAILY_COPY.panels}</h2>
                <LaneTiles
                  lanes={boardPanels}
                  events={board.events}
                  snapshot={snapshot}
                  company={company}
                  quietPriorities={quietPriorities}
                  loading={loading}
                  nowHour={nowHour}
                  highlights={highlights}
                  onOpenLane={(panel) => setOverlay(panel)}
                />
              </section>
              <div className="grid gap-4 md:grid-cols-2">
                <CompaniesTable
                  companies={snapshot?.companies}
                  selectedCompany={company}
                  loading={loading}
                  onSelectCompany={(slug) => writeParam("company", slug)}
                />
                <OriginsPanel origins={snapshot?.origins} loading={loading} />
              </div>
            </div>
            <LiveFeed
              events={board.events}
              company={company}
              quietPriorities={quietPriorities}
              lanes={boardPanels}
              liveState={status}
              highlights={highlights}
              onOpenFact={setDrawerIds}
              onOpenFullList={() => setOverlay("all")}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <HourlyRhythm snapshot={snapshot} nowHour={nowHour} />
              <OriginsPanel origins={snapshot?.origins} loading={loading} />
              <CompaniesTable
                companies={snapshot?.companies}
                selectedCompany={company}
                loading={loading}
                onSelectCompany={(slug) => writeParam("company", slug)}
              />
            </div>
            <LanesView
              events={board.events}
              snapshot={snapshot}
              sessionDeltas={board.sessionDeltas}
              lane={laneInView}
              company={company}
              quietPriorities={quietPriorities}
              sheetSyncOptIn={sheetSyncOn}
              loading={loading}
              loadingEarlier={loadingEarlier}
              canLoadEarlier={Boolean(focusedLane && canLoadEarlierFor(focusedLane as DailyOperationsPanelLane))}
              highlights={highlights}
              onSelectLane={(nextLane: DailyOperationsPanelLane) => selectLane(nextLane)}
              onShowAll={showAllPanels}
              onLoadEarlier={() => {
                if (focusedLane) {
                  void loadEarlier(focusedLane as DailyOperationsPanelLane);
                }
              }}
              onOpenAll={(panel) => setOverlay(panel)}
            />
          </>
        )}

        {overlay ? (
          <DailyOperationsEventsOverlay
            scope={overlay}
            events={overlayEvents}
            todayCount={overlayToday}
            highlights={highlights}
            groupedIds={overlayGrouped}
            liveState={status}
            company={company}
            quietPriorities={quietPriorities}
            loadingEarlier={loadingEarlier}
            canLoadEarlier={canLoadEarlierFor(overlayLane)}
            exhausted={exhaustedScopes.has(scopeKey(overlayLane))}
            onLoadEarlier={() => {
              void loadEarlier(overlayLane);
            }}
            onOpenFact={setDrawerIds}
            onClose={() => setOverlay(null)}
          />
        ) : null}

        {drawerIds ? <FactDrawer events={drawerEvents} onClose={() => setDrawerIds(null)} /> : null}
      </div>
      </KindTiersProvider>
    </KindColorsProvider>
  );
}


