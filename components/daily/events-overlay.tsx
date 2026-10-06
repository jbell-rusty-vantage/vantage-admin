"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { FeedRow } from "@/components/daily/feed-row";
import { useKindTierOverrides } from "@/components/daily/kind-tiers-context";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import type { ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { Button } from "@/components/ui/button";
import { sourceCompanyLabel, type DailyOperationsPanelLane } from "@/lib/api/dailyOperations";
import { presentationTier } from "@/lib/api/dailyOperationsBoard";
import { laneToneFor, toneClasses } from "@/lib/api/dailyOperationsColors";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

export type DailyOperationsOverlayScope = DailyOperationsPanelLane | "all";

/**
 * The full-height list behind a lane tile's **Open ›**: every in-memory fact for the chosen lane (or every lane),
 * newest first, as one column of rows (no grid or column switch any more), with `Load earlier` at the foot. A row
 * opens the fact drawer. Same highlights, same EventSource: nothing here fetches on its own except the earlier page
 * the Owner asks for. Escape and the backdrop close it (Escape closes the drawer first when one is open).
 */
export function DailyOperationsEventsOverlay({
  scope,
  events,
  todayCount,
  highlights,
  groupedIds,
  liveState,
  company,
  quietPriorities = false,
  loadingEarlier = false,
  canLoadEarlier = false,
  exhausted = false,
  onLoadEarlier,
  onOpenFact,
  onClose,
}: {
  scope: DailyOperationsOverlayScope;
  events: DailyOperationsEventItem[];
  todayCount: number | null;
  highlights: ArrivalHighlights;
  groupedIds?: ReadonlySet<string>;
  liveState: LiveDotState;
  company?: string | null;
  quietPriorities?: boolean;
  loadingEarlier?: boolean;
  canLoadEarlier?: boolean;
  exhausted?: boolean;
  onLoadEarlier?: () => void;
  onOpenFact: (eventIds: string[]) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const overrides = useKindTierOverrides();
  const label = scope === "all" ? DAILY_COPY.allLanes : DAILY_COPY.panelsLabels[scope];
  const tone = scope === "all" ? null : toneClasses(laneToneFor(scope));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-overlay-close]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[data-fact-drawer]")) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" data-daily-overlay={scope}>
      <button
        type="button"
        aria-label={DAILY_COPY.close}
        className="daily-overlay-backdrop absolute inset-0 bg-navy/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} · ${DAILY_COPY.panels}`}
        className="daily-overlay-panel absolute inset-3 flex flex-col overflow-hidden rounded-xl border border-steel-200 bg-background shadow-2xl sm:inset-6"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-card px-4 py-3">
          <LiveDot state={liveState} />
          {tone ? <span className={cn("size-2.5 rounded-full", tone.dot)} aria-hidden="true" /> : null}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-navy">{label}</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            <AnimatedNumber value={events.length} className="font-semibold text-navy" /> {DAILY_COPY.cards}
            {todayCount != null ? (
              <>
                {" · "}
                <AnimatedNumber value={todayCount} className="font-semibold text-navy" /> {DAILY_COPY.arrivalsToday}
              </>
            ) : null}
          </span>
          {company ? (
            <span className="rounded-full bg-steel-100 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {DAILY_COPY.filtered}: {sourceCompanyLabel(company)}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" className="h-8 w-8 px-0" onClick={onClose} aria-label={DAILY_COPY.close} data-overlay-close>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{DAILY_COPY.panelsEmpty}</p>
          ) : (
            <ol className="mx-auto m-0 flex w-full max-w-3xl list-none flex-col gap-1 p-0" aria-label={label} data-event-list>
              {events.map((event) => {
                const arrived = highlights.highlightedIds.has(event.event_id);
                return (
                  <li
                    key={event.event_id}
                    className={arrived ? "daily-row daily-row-enter" : "daily-row"}
                    style={groupedIds?.has(event.event_id) ? { marginLeft: 14 } : undefined}
                  >
                    <div className="min-h-0">
                      <FeedRow
                        event={event}
                        tier={presentationTier(event.kind, { overrides, quietPriorities })}
                        arrived={arrived}
                        icon
                        onClick={() => onOpenFact([event.event_id])}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-4 flex justify-center">
            {canLoadEarlier && onLoadEarlier ? (
              <Button type="button" variant="outline" className="h-8 px-4 text-xs" disabled={loadingEarlier} onClick={onLoadEarlier}>
                {DAILY_COPY.loadEarlier}
              </Button>
            ) : exhausted && events.length > 0 ? (
              <p className="text-xs text-muted-foreground">{DAILY_COPY.wholeDayLoaded}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
