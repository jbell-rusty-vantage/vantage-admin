"use client";

import { Maximize2 } from "lucide-react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY, formatDailyOperationsRelative } from "@/components/daily/daily-copy";
import { AnimatedEventList } from "@/components/daily/event-list";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { useNowMs } from "@/components/daily/use-now";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  countRecentDailyOperationsEvents,
  DAILY_OPERATIONS_ARRIVALS_LIMIT,
  eventsForDailyOperationsArrivals,
  newestDailyOperationsEventAt,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

const ARRIVALS_PULSE_WINDOW_MS = 15 * 60_000;

/**
 * Newest-first stream of today's Events across every lane. The header is the
 * broadcast chrome: a live dot, how many facts landed in the last 15 minutes,
 * how many are in view, and how long since the last fact. New facts grow in
 * at the top; the fact that falls off the 20-card window slides away at the
 * bottom. Cards read relative time once the browser clock is available; the
 * server render shows the Florida clock so hydration stays clean. The shell
 * owns the highlight record so the same fact animates everywhere at once.
 */
export function ArrivalsStream({
  events,
  company,
  quietPriorities,
  liveState = "live",
  todayCount,
  highlights = EMPTY_ARRIVAL_HIGHLIGHTS,
  onOpenFullStream,
  className,
}: {
  events: DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  /** Kept for callers that pass hydration state; highlighting now lives in the shell. */
  hydrated?: boolean;
  liveState?: LiveDotState;
  /** Total facts today across lanes (snapshot-derived). Optional; falls back to items in view. */
  todayCount?: number | null;
  highlights?: ArrivalHighlights;
  onOpenFullStream?: () => void;
  className?: string;
}) {
  const filtered = eventsForDailyOperationsArrivals({
    events,
    company,
    quietPriorities,
    limit: null,
  });
  const arrivals = filtered.slice(0, DAILY_OPERATIONS_ARRIVALS_LIMIT);
  const nowMs = useNowMs();

  const newestAt = newestDailyOperationsEventAt(filtered);
  const recent = nowMs === undefined ? 0 : countRecentDailyOperationsEvents(filtered, nowMs, ARRIVALS_PULSE_WINDOW_MS);
  const lastFact =
    newestAt && nowMs !== undefined
      ? formatDailyOperationsRelative(newestAt, nowMs)
      : newestAt
        ? null
        : DAILY_COPY.noFactYet;
  const beyondWindow = filtered.length - arrivals.length;

  return (
    <section data-band="arrivals" className={cn("flex min-h-0 flex-col", className)}>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden xl:max-h-[calc(100dvh-6rem)]">
        <CardHeader className="shrink-0 border-b border-steel-100 p-3 pb-2.5">
          <div className="flex items-center gap-2">
            <LiveDot state={liveState} />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-navy">
              {DAILY_COPY.arrivals}
            </h2>
            {recent > 0 ? (
              <span
                className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700"
                title="last 15 minutes"
              >
                +<AnimatedNumber value={recent} />
              </span>
            ) : null}
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {todayCount != null ? (
                <>
                  <AnimatedNumber value={todayCount} className="font-semibold text-navy" /> {DAILY_COPY.arrivalsToday} ·{" "}
                </>
              ) : null}
              <AnimatedNumber value={arrivals.length} /> {DAILY_COPY.arrivalsInMemory}
            </span>
            {onOpenFullStream && filtered.length > 0 ? (
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-steel-100 hover:text-navy"
                aria-label={DAILY_COPY.fullStream}
                title={beyondWindow > 0 ? `${DAILY_COPY.fullStream} (${filtered.length})` : DAILY_COPY.fullStream}
                onClick={onOpenFullStream}
              >
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 flex items-baseline justify-between gap-2 text-[11px] text-steel">
            <span>{DAILY_COPY.arrivalsSubtitle}</span>
            {lastFact ? (
              <span className="tabular-nums" data-last-fact>
                {DAILY_COPY.lastFact} {lastFact}
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-3 pt-2.5">
          {arrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{DAILY_COPY.arrivalsEmpty}</p>
          ) : (
            <div
              className="daily-stream-body relative min-h-0 flex-1 overflow-y-auto"
              data-arrivals-scroll
            >
              <AnimatedEventList
                events={arrivals}
                highlights={highlights}
                nowMs={nowMs}
                compact
                ariaLabel={DAILY_COPY.arrivals}
                className="pb-6"
              />
            </div>
          )}
          {beyondWindow > 0 && onOpenFullStream ? (
            <button
              type="button"
              className="mt-2 w-full shrink-0 rounded-md py-1 text-center text-xs font-semibold text-trust-blue hover:underline"
              onClick={onOpenFullStream}
            >
              {DAILY_COPY.openAll} ({filtered.length})
            </button>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
