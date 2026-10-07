"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Rows3 } from "lucide-react";
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
import { useNowMs } from "@/components/daily/use-now";
import { useStoredPreferenceFlag } from "@/components/daily/use-preference-flag";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/crm";
import {
  dailyOperationsDayKey,
  fetchDailyOperationsEvents,
  fetchDailyOperationsSnapshot,
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
  lanesNeedingBackfill,
  pairGranotEvents,
  parseDailyOperationsView,
  readPreferenceFlag,
  visibleDailyOperationsPanels,
  writeDailyOperationsView,
  type DailyOperationsView,
} from "@/lib/api/dailyOperationsBoard";
import {
  applyDailyOperationsSsePayload,
  DAILY_OPERATIONS_LIVE_PATH,
  EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  granotTileToday,
  mergeDailyOperationsEvents,
  receiveDailyOperationsSnapshot,
  type DailyOperationsLiveStatus,
  type DailyOperationsTileId,
} from "@/lib/api/dailyOperationsLive";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

/** Same as the server's `LIVE_DAILY_OPERATIONS_MAX_MS`: hidden longer than this and the stream may have missed a reconnect. */
const HIDDEN_RESYNC_MS = 240_000;
/** Snapshot resync cadence while the tab is visible — refreshes `held_now` / `still_open` and corrects drift. Not a live poll. */
const SNAPSHOT_RESYNC_MS = 5 * 60_000;
const TILE_FLASH_MS = 2_000;

function LiveChrome({
  status,
  lastGoodAt,
  onRetry,
}: {
  status: DailyOperationsLiveStatus;
  lastGoodAt: string | null;
  onRetry: () => void;
}) {
  const label =
    status === "live"
      ? DAILY_COPY.live
      : status === "paused"
        ? DAILY_COPY.paused
        : status === "reconnecting"
          ? DAILY_COPY.reconnecting
          : DAILY_COPY.liveOff;
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-full border px-3 py-1 text-sm",
        status === "live" && "border-emerald-200 bg-emerald-50/60",
        status === "reconnecting" && "border-amber-200 bg-amber-50/60",
        (status === "paused" || status === "off") && "border-steel-200 bg-card",
      )}
      aria-live="polite"
      data-live-status={status}
    >
      <LiveDot state={status} />
      <span
        className={cn(
          "font-semibold uppercase tracking-wide text-xs",
          status === "live" && "text-emerald-700",
          status === "paused" && "text-muted-foreground",
          status === "reconnecting" && "text-amber-700",
          status === "off" && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {status === "reconnecting" && lastGoodAt ? (
        <span className="text-xs text-muted-foreground">
          {DAILY_COPY.showingDataFrom} {formatDailyOperationsClock(lastGoodAt)}
        </span>
      ) : null}
      {status === "off" ? (
        <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={onRetry}>
          {DAILY_COPY.retry}
        </Button>
      ) : null}
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

/**
 * `embedded` is the Today > Operations tab: the Today header owns the title and date, so the board keeps only its
 * toolbar (live chip, Quiet priorities, Sheet Sync, Colours) in one right-aligned row.
 *
 * The Owner's day. One EventSource feeds one in-memory board; every band
 * reads from it. Counts move per fact (`applyDailyOperationsSsePayload`); the
 * like-hour baselines and the `now` marker follow the browser clock
 * (`withLiveDailyOperationsClock`) so a board left open all day stays honest.
 * The snapshot resyncs from Mongo every five minutes, when the tab returns
 * after a long hide, and when the Florida day rolls over.
 */
export function DailyOperationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isOwner = useDashboardRole() === "owner";
  const lane = searchParams.get("lane");
  const company = searchParams.get("company");
  const quietFromUrl = searchParams.get("quiet_priorities") === "1";
  // `?view=board|lanes`; a link that names a lane and no view means Lanes (old /daily?lane= links, Pulse tiles).
  const view = parseDailyOperationsView(searchParams.get("view"), lane);
  const laneInView = view === "lanes" ? lane : null;
  const [board, setBoard] = useState(EMPTY_DAILY_OPERATIONS_LIVE_BOARD);
  const [streamStatus, setStreamStatus] = useState<DailyOperationsLiveStatus>("reconnecting");
  const [tabHidden, setTabHidden] = useState(false);
  const [streamGeneration, setStreamGeneration] = useState(0);
  const [flashedTiles, setFlashedTiles] = useState<DailyOperationsTileId[]>([]);
  const [storedQuiet, writeStoredQuiet] = useStoredPreferenceFlag(DAILY_QUIET_PRIORITIES_STORAGE_KEY);
  const [storedSheet, writeStoredSheet] = useStoredPreferenceFlag(DAILY_SHEET_SYNC_STORAGE_KEY);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [exhaustedScopes, setExhaustedScopes] = useState<ReadonlySet<string>>(new Set());
  const [overlay, setOverlay] = useState<DailyOperationsOverlayScope | null>(null);
  const { overrides: kindTones, pick: pickKindTone, reset: resetKindTones } = useStoredKindTones();
  const { overrides: kindTiers, pick: pickKindTier, reset: resetKindTiers } = useStoredKindTiers();
  const [drawerIds, setDrawerIds] = useState<readonly string[] | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFlashes = useRef<DailyOperationsTileId[]>([]);
  const preferencesSeeded = useRef(false);
  const hiddenSince = useRef<number | null>(null);
  const focusedLane = focusLaneFromSearch(laneInView);
  const nowMs = useNowMs();
  const snapshotQuery = useQuery({
    queryKey: queryKeys.dailyOperations.snapshot(),
    queryFn: fetchDailyOperationsSnapshot,
    staleTime: SNAPSHOT_RESYNC_MS,
    refetchOnWindowFocus: false,
    refetchInterval: SNAPSHOT_RESYNC_MS,
    refetchIntervalInBackground: false,
  });
  const eventsQuery = useQuery({
    queryKey: queryKeys.dailyOperations.events("all"),
    queryFn: () => fetchDailyOperationsEvents({ limit: 80 }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const eventsHydrated = eventsQuery.isFetched;
  const highlights = useArrivalHighlights(board.events, eventsHydrated);

  // Fetched data folds into the board during render (React's "adjust state
  // from the previous render" pattern) so the first paint after a fetch is
  // already correct and no effect copies query state into React state.
  //
  // Every fetched snapshot (first load, 5-minute resync, focus resync, day
  // rollover) is authoritative: Mongo is the book. Live increments that landed
  // during the fetch are re-added by the next fact, not lost.
  // The markers start empty on purpose: a remount (route change and back,
  // Fast Refresh) finds both queries already cached and must still fold them.
  const [syncedSnapshot, setSyncedSnapshot] = useState<typeof snapshotQuery.data>(undefined);
  if (snapshotQuery.data !== syncedSnapshot) {
    setSyncedSnapshot(snapshotQuery.data);
    const data = snapshotQuery.data;
    if (data) {
      setBoard((current) => receiveDailyOperationsSnapshot(current, data));
    }
  }

  const [syncedEvents, setSyncedEvents] = useState<typeof eventsQuery.data>(undefined);
  if (eventsQuery.data !== syncedEvents) {
    setSyncedEvents(eventsQuery.data);
    const page = eventsQuery.data;
    if (page) {
      setBoard((current) => ({
        ...current,
        events: mergeDailyOperationsEvents(current.events, page.items),
      }));
      if (page.next_cursor === null) {
        // Fewer than a page today: every lane is fully loaded.
        setExhaustedScopes(new Set(["all", ...page.items.map((item) => item.lane)]));
      }
    }
  }

  // A Granot flood can push every Lead or Booking of the day out of the first
  // newest-80 page. A panel whose count says otherwise fetches its own newest
  // page once, so no panel reads "Nothing yet today" against a non-zero count.
  const [backfilledLanes, setBackfilledLanes] = useState<ReadonlySet<string>>(new Set());
  const backfillKey = (
    eventsHydrated
      ? lanesNeedingBackfill({
          snapshot: board.snapshot,
          events: board.events,
          panels: visibleDailyOperationsPanels({ lane: laneInView, sheetSyncOptIn: storedSheet }),
          attempted: backfilledLanes,
        })
      : []
  ).join(",");
  useEffect(() => {
    if (!backfillKey) {
      return;
    }
    const lanes = backfillKey.split(",") as DailyOperationsPanelLane[];
    for (const scope of lanes) {
      void fetchDailyOperationsEvents({ lane: scope, limit: 40 })
        .then((page) => {
          setBoard((current) => ({
            ...current,
            events: mergeDailyOperationsEvents(current.events, page.items),
          }));
          if (page.next_cursor === null) {
            setExhaustedScopes((current) => new Set([...current, scope]));
          }
        })
        .catch(() => {
          // The panel keeps its count; Load earlier in the solo view still works.
        })
        .finally(() => {
          setBackfilledLanes((current) => new Set([...current, scope]));
        });
    }
  }, [backfillKey]);

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

  const resync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dailyOperations.snapshot() });
  }, [queryClient]);

  useEffect(() => {
    function onVisibility() {
      const hidden = document.hidden;
      setTabHidden(hidden);
      if (hidden) {
        hiddenSince.current = Date.now();
        return;
      }
      const since = hiddenSince.current;
      hiddenSince.current = null;
      if (since !== null && Date.now() - since >= HIDDEN_RESYNC_MS) {
        resync();
      }
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [resync]);

  // Florida day rollover while the tab is open: yesterday's board is not
  // today's. Refetch both queries; `receiveDailyOperationsSnapshot` drops the
  // old day's facts and session badges when the new-day snapshot lands.
  const liveDayKey = nowMs === undefined ? null : dailyOperationsDayKey(nowMs);
  const snapshotDay = board.snapshot?.today ?? null;
  useEffect(() => {
    if (!liveDayKey || !snapshotDay || liveDayKey === snapshotDay) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.dailyOperations.snapshot() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dailyOperations.events("all") });
  }, [liveDayKey, snapshotDay, queryClient]);

  // The live socket is bound to the day it opened on; reconnect once the
  // board has moved to a new day so the new day's facts start flowing.
  const [streamDay, setStreamDay] = useState(snapshotDay);
  if (snapshotDay !== streamDay) {
    setStreamDay(snapshotDay);
    if (streamDay !== null && snapshotDay !== null) {
      setStreamGeneration((value) => value + 1);
    }
  }

  // Tile flashes queued by the SSE reducer drain here, outside the state updater.
  useEffect(() => {
    if (pendingFlashes.current.length === 0) {
      return;
    }
    const tiles = [...new Set(pendingFlashes.current)];
    pendingFlashes.current = [];
    if (tiles.includes("leads")) {
      // A lead arrived: refresh the live lead spend within a second or two.
      void queryClient.invalidateQueries({ queryKey: queryKeys.insights.dailyLeadSpend() });
    }
    setFlashedTiles(tiles);
    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
    }
    flashTimer.current = setTimeout(() => setFlashedTiles([]), TILE_FLASH_MS);
  }, [board, queryClient]);

  useEffect(() => {
    const source = new EventSource(DAILY_OPERATIONS_LIVE_PATH);
    const applyEvent = (eventName: string, rawData: string) => {
      setBoard((current) => {
        const next = applyDailyOperationsSsePayload(eventName, rawData, current);
        if (next.flashedTiles.length > 0) {
          pendingFlashes.current.push(...next.flashedTiles);
        }
        return next.board;
      });
      setStreamStatus(eventName === "error" ? "off" : document.hidden ? "paused" : "live");
    };
    source.addEventListener("snapshot", (event) => {
      applyEvent("snapshot", (event as MessageEvent).data);
    });
    source.addEventListener("event", (event) => {
      applyEvent("event", (event as MessageEvent).data);
    });
    source.addEventListener("metrics", (event) => {
      applyEvent("metrics", (event as MessageEvent).data);
    });
    source.addEventListener("heartbeat", (event) => {
      applyEvent("heartbeat", (event as MessageEvent).data);
    });
    source.addEventListener("error", (event) => {
      if ((event as MessageEvent).data) {
        applyEvent("error", (event as MessageEvent).data);
        return;
      }
      setStreamStatus(source.readyState === EventSource.CLOSED ? "off" : "reconnecting");
    });
    source.onopen = () => {
      setStreamStatus(document.hidden ? "paused" : "live");
    };
    return () => {
      source.close();
      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }
    };
  }, [streamGeneration]);

  const status: DailyOperationsLiveStatus =
    streamStatus === "live" && tabHidden ? "paused" : streamStatus;
  const snapshot = board.snapshot ? withLiveDailyOperationsClock(board.snapshot, nowMs) : null;
  const nowHour = nowMs === undefined ? undefined : dailyOperationsFloridaHour(new Date(nowMs));
  const loading = snapshotQuery.isLoading && !snapshot;

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
    return !exhaustedScopes.has(scopeKey(scope)) && earlierDailyOperationsCursor(board.events, scope) !== null;
  }

  async function loadEarlier(scope: DailyOperationsPanelLane | null) {
    const cursor = earlierDailyOperationsCursor(board.events, scope);
    if (!cursor || loadingEarlier || exhaustedScopes.has(scopeKey(scope))) {
      return;
    }
    setLoadingEarlier(true);
    try {
      const page = await fetchDailyOperationsEvents({ lane: scope, cursor, limit: 40 });
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
              onRetry={() => {
                setStreamStatus("reconnecting");
                setStreamGeneration((value) => value + 1);
                resync();
              }}
            />
            <span className="hidden h-5 w-px bg-steel-200 sm:inline-block" aria-hidden="true" />
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

        {snapshotQuery.error && !snapshot ? (
          <FeedbackMessage tone="error">{DAILY_COPY.loadFailed}</FeedbackMessage>
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


