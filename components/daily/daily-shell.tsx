"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrivalsStream } from "@/components/daily/arrivals-stream";
import { CategoryPanels } from "@/components/daily/category-panels";
import { CompaniesTable } from "@/components/daily/companies-table";
import {
  DAILY_COPY,
  DAILY_QUIET_PRIORITIES_STORAGE_KEY,
  DAILY_SHEET_SYNC_STORAGE_KEY,
  formatDailyOperationsClock,
  formatDailyOperationsDay,
} from "@/components/daily/daily-copy";
import { HeadlineTiles } from "@/components/daily/headline-tiles";
import { HourlyRhythm } from "@/components/daily/hourly-rhythm";
import { KindColorsProvider, useStoredKindTones } from "@/components/daily/kind-colors-context";
import { KindColorsPanel } from "@/components/daily/kind-colors-panel";
import { LiveDot } from "@/components/daily/live-dot";
import { OriginsPanel } from "@/components/daily/origins-panel";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchDailyOperationsEvents,
  fetchDailyOperationsSnapshot,
  normalizeDailyOperationsSnapshot,
  toggleSearchParam,
  writeSearchParam,
  type DailyOperationsLane,
  type DailyOperationsPanelLane,
} from "@/lib/api/dailyOperations";
import {
  focusLaneFromSearch,
  readPreferenceFlag,
  writePreferenceFlag,
} from "@/lib/api/dailyOperationsBoard";
import {
  applyDailyOperationsSsePayload,
  DAILY_OPERATIONS_LIVE_PATH,
  EMPTY_DAILY_OPERATIONS_LIVE_BOARD,
  mergeDailyOperationsEvents,
  type DailyOperationsLiveStatus,
  type DailyOperationsTileId,
} from "@/lib/api/dailyOperationsLive";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

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

export function DailyOperationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const lane = searchParams.get("lane");
  const company = searchParams.get("company");
  const quietFromUrl = searchParams.get("quiet_priorities") === "1";
  const [board, setBoard] = useState(EMPTY_DAILY_OPERATIONS_LIVE_BOARD);
  const [streamStatus, setStreamStatus] = useState<DailyOperationsLiveStatus>("reconnecting");
  const [tabHidden, setTabHidden] = useState(false);
  const [streamGeneration, setStreamGeneration] = useState(0);
  const [flashedTiles, setFlashedTiles] = useState<DailyOperationsTileId[]>([]);
  const [quietPriorities, setQuietPriorities] = useState(quietFromUrl);
  const [sheetSyncOptIn, setSheetSyncOptIn] = useState(false);
  const [eventsCursor, setEventsCursor] = useState<string | null>(null);
  const [eventsHydrated, setEventsHydrated] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const { overrides: kindTones, pick: pickKindTone, reset: resetKindTones } = useStoredKindTones();
  const [colorsOpen, setColorsOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferencesHydrated = useRef(false);
  const focusedLane = focusLaneFromSearch(lane);
  const snapshotQuery = useQuery({
    queryKey: queryKeys.dailyOperations.snapshot(),
    queryFn: fetchDailyOperationsSnapshot,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const querySnapshotRef = useRef(snapshotQuery.data);
  const eventsQuery = useQuery({
    queryKey: queryKeys.dailyOperations.events("all"),
    queryFn: () => fetchDailyOperationsEvents({ limit: 80 }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useEffect(() => {
    querySnapshotRef.current = snapshotQuery.data;
  }, [snapshotQuery.data]);

  useEffect(() => {
    if (eventsQuery.data) {
      const items = eventsQuery.data.items;
      setBoard((current) => ({
        ...current,
        events: mergeDailyOperationsEvents(current.events, items),
      }));
      setEventsCursor(eventsQuery.data.next_cursor ?? null);
      setEventsHydrated(true);
      return;
    }
    if (eventsQuery.isFetched) {
      setEventsHydrated(true);
    }
  }, [eventsQuery.data, eventsQuery.isFetched]);

  useEffect(() => {
    if (preferencesHydrated.current) {
      return;
    }
    preferencesHydrated.current = true;
    const storage = storageOrNull();
    const storedQuiet = readPreferenceFlag(storage, DAILY_QUIET_PRIORITIES_STORAGE_KEY);
    const storedSheet = readPreferenceFlag(storage, DAILY_SHEET_SYNC_STORAGE_KEY);
    setSheetSyncOptIn(storedSheet || lane === "sheet_sync");
    if (quietFromUrl) {
      setQuietPriorities(true);
      writePreferenceFlag(storage, DAILY_QUIET_PRIORITIES_STORAGE_KEY, true);
      return;
    }
    if (storedQuiet) {
      setQuietPriorities(true);
      const next = writeSearchParam(searchParams, "quiet_priorities", "1");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [lane, pathname, quietFromUrl, router, searchParams]);

  useEffect(() => {
    function onVisibility() {
      setTabHidden(document.hidden);
    }
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const source = new EventSource(DAILY_OPERATIONS_LIVE_PATH);
    const applyEvent = (eventName: string, rawData: string) => {
      setBoard((current) => {
        const seeded =
          current.snapshot || !querySnapshotRef.current
            ? current
            : {
                ...current,
                snapshot: normalizeDailyOperationsSnapshot(querySnapshotRef.current),
                lastGoodAt: current.lastGoodAt ?? querySnapshotRef.current.generated_at,
              };
        const next = applyDailyOperationsSsePayload(eventName, rawData, seeded);
        if (next.board.snapshot) {
          queryClient.setQueryData(queryKeys.dailyOperations.snapshot(), next.board.snapshot);
        }
        if (next.flashedTiles.length > 0) {
          setFlashedTiles(next.flashedTiles);
          if (flashTimer.current) {
            clearTimeout(flashTimer.current);
          }
          flashTimer.current = setTimeout(() => setFlashedTiles([]), 2000);
        }
        if (eventName === "error") {
          setStreamStatus("off");
        } else if (eventName !== "error") {
          setStreamStatus(document.hidden ? "paused" : "live");
        }
        return next.board;
      });
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
  }, [queryClient, streamGeneration]);

  const status: DailyOperationsLiveStatus =
    streamStatus === "live" && tabHidden ? "paused" : streamStatus;
  const snapshot = board.snapshot ?? (snapshotQuery.data
    ? normalizeDailyOperationsSnapshot(snapshotQuery.data)
    : null);
  const loading = snapshotQuery.isLoading && !snapshot;

  function writeParam(key: "lane" | "company", value: string) {
    const next = toggleSearchParam(searchParams, key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function writeQuietPriorities(nextValue: boolean) {
    setQuietPriorities(nextValue);
    writePreferenceFlag(storageOrNull(), DAILY_QUIET_PRIORITIES_STORAGE_KEY, nextValue);
    const next = writeSearchParam(searchParams, "quiet_priorities", nextValue ? "1" : null);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function writeSheetSync(nextValue: boolean) {
    setSheetSyncOptIn(nextValue);
    writePreferenceFlag(storageOrNull(), DAILY_SHEET_SYNC_STORAGE_KEY, nextValue);
    if (nextValue) {
      const next = writeSearchParam(searchParams, "lane", "sheet_sync");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      return;
    }
    if (lane === "sheet_sync") {
      const next = writeSearchParam(searchParams, "lane", null);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }

  async function loadEarlier() {
    if (!eventsCursor || loadingEarlier) {
      return;
    }
    setLoadingEarlier(true);
    try {
      const page = await fetchDailyOperationsEvents({
        lane: focusedLane,
        cursor: eventsCursor,
        limit: 40,
      });
      setBoard((current) => ({
        ...current,
        events: mergeDailyOperationsEvents(current.events, page.items),
      }));
      setEventsCursor(page.next_cursor);
    } finally {
      setLoadingEarlier(false);
    }
  }

  const sheetSyncOn = sheetSyncOptIn || lane === "sheet_sync";

  return (
    <KindColorsProvider overrides={kindTones}>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{DAILY_COPY.title}</p>
            <h1 className="text-3xl font-extrabold tracking-tight">{DAILY_COPY.title}</h1>
            <p className="mt-1.5 text-sm text-steel">
              {snapshot
                ? formatDailyOperationsDay(snapshot.generated_at)
                : DAILY_COPY.timezone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label={DAILY_COPY.boardToolbar}>
            <LiveChrome
              status={status}
              lastGoodAt={board.lastGoodAt}
              onRetry={() => {
                setStreamStatus("reconnecting");
                setStreamGeneration((value) => value + 1);
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
              {Object.keys(kindTones).length > 0 ? (
                <span className="ml-1 rounded-full bg-card/30 px-1 text-[10px] tabular-nums">
                  {Object.keys(kindTones).length}
                </span>
              ) : null}
            </Button>
          </div>
        </header>

        {colorsOpen ? (
          <KindColorsPanel
            overrides={kindTones}
            onPick={pickKindTone}
            onReset={resetKindTones}
            onClose={() => setColorsOpen(false)}
          />
        ) : null}

        {snapshotQuery.error && !snapshot ? (
          <FeedbackMessage tone="error">{DAILY_COPY.loadFailed}</FeedbackMessage>
        ) : null}

        <section className="space-y-2" aria-label={DAILY_COPY.headline}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">{DAILY_COPY.headline}</h2>
          <HeadlineTiles
            snapshot={snapshot}
            sessionDeltas={board.sessionDeltas}
            flashedTiles={flashedTiles}
            lane={lane}
            loading={loading}
            onSelectLane={(nextLane: DailyOperationsLane) => writeParam("lane", nextLane)}
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <HourlyRhythm snapshot={snapshot} />
          <OriginsPanel origins={snapshot?.origins} loading={loading} />
          <CompaniesTable
            companies={snapshot?.companies}
            selectedCompany={company}
            loading={loading}
            onSelectCompany={(slug) => writeParam("company", slug)}
          />
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <ArrivalsStream
            events={board.events}
            company={company}
            quietPriorities={quietPriorities}
            hydrated={eventsHydrated}
            liveState={status}
            className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
          />

          <CategoryPanels
            events={board.events}
            snapshot={snapshot}
            sessionDeltas={board.sessionDeltas}
            lane={lane}
            company={company}
            quietPriorities={quietPriorities}
            sheetSyncOptIn={sheetSyncOn}
            loading={loading}
            loadingEarlier={loadingEarlier}
            canLoadEarlier={Boolean(focusedLane && eventsCursor)}
            onSelectLane={(nextLane: DailyOperationsPanelLane) => writeParam("lane", nextLane)}
            onLoadEarlier={() => {
              void loadEarlier();
            }}
          />
        </div>
      </div>
    </KindColorsProvider>
  );
}
