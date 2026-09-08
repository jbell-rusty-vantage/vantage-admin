"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/daily/animated-number";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { AnimatedEventList } from "@/components/daily/event-list";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import type { ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { Button } from "@/components/ui/button";
import { sourceCompanyLabel, type DailyOperationsPanelLane } from "@/lib/api/dailyOperations";
import { laneToneFor, toneClasses } from "@/lib/api/dailyOperationsColors";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

export type DailyOperationsOverlayScope = DailyOperationsPanelLane | "all";
export type DailyOperationsOverlayLayout = "grid" | "column";

export const DAILY_OVERLAY_LAYOUT_STORAGE_KEY = "vantage-admin-daily-overlay-layout";

function readLayout(): DailyOperationsOverlayLayout {
  try {
    return window.localStorage.getItem(DAILY_OVERLAY_LAYOUT_STORAGE_KEY) === "column" ? "column" : "grid";
  } catch {
    return "grid";
  }
}

function writeLayout(layout: DailyOperationsOverlayLayout): void {
  try {
    window.localStorage.setItem(DAILY_OVERLAY_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Private mode / quota: the choice just does not persist.
  }
}

/**
 * The full-height view of one stream when the panel is too short to hold it:
 * every in-memory fact for the chosen lane (or every lane), newest first, as
 * a responsive grid or one long column, with `Load earlier` at the foot. Same
 * cards, same highlights, same EventSource — nothing here fetches on its own
 * except the earlier page the Owner asks for. Escape and the backdrop close it.
 */
export function DailyOperationsEventsOverlay({
  scope,
  events,
  todayCount,
  highlights,
  groupedIds,
  nowMs,
  liveState,
  company,
  loadingEarlier = false,
  canLoadEarlier = false,
  exhausted = false,
  onLoadEarlier,
  onClose,
}: {
  scope: DailyOperationsOverlayScope;
  events: DailyOperationsEventItem[];
  todayCount: number | null;
  highlights: ArrivalHighlights;
  groupedIds?: ReadonlySet<string>;
  nowMs?: number;
  liveState: LiveDotState;
  company?: string | null;
  loadingEarlier?: boolean;
  canLoadEarlier?: boolean;
  exhausted?: boolean;
  onLoadEarlier?: () => void;
  onClose: () => void;
}) {
  // Mounted only after an Owner click, never server-rendered, so the stored
  // layout can seed state directly.
  const [layout, setLayout] = useState<DailyOperationsOverlayLayout>(readLayout);
  const dialogRef = useRef<HTMLElement | null>(null);
  const label = scope === "all" ? DAILY_COPY.allLanes : DAILY_COPY.panelsLabels[scope];
  const tone = scope === "all" ? null : toneClasses(laneToneFor(scope));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-overlay-close]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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

  function pickLayout(next: DailyOperationsOverlayLayout) {
    setLayout(next);
    writeLayout(next);
  }

  return (
    <div className="fixed inset-0 z-50" data-daily-overlay={scope} data-layout={layout}>
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
            <div className="flex items-center rounded-full bg-steel-100 p-0.5" role="radiogroup" aria-label={DAILY_COPY.layout}>
              {(["grid", "column"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={layout === option}
                  onClick={() => pickLayout(option)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    layout === option ? "bg-navy text-white" : "text-muted-foreground hover:bg-steel-200",
                  )}
                >
                  {option === "grid" ? DAILY_COPY.layoutGrid : DAILY_COPY.layoutColumn}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="h-8 w-8 px-0"
              onClick={onClose}
              aria-label={DAILY_COPY.close}
              data-overlay-close
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{DAILY_COPY.panelsEmpty}</p>
          ) : (
            <AnimatedEventList
              events={events}
              highlights={highlights}
              groupedIds={groupedIds}
              nowMs={nowMs}
              ariaLabel={label}
              className={cn(
                layout === "grid"
                  ? "grid items-start sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                  : "mx-auto w-full max-w-3xl",
              )}
            />
          )}
          <div className="mt-4 flex justify-center">
            {canLoadEarlier && onLoadEarlier ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-4 text-xs"
                disabled={loadingEarlier}
                onClick={onLoadEarlier}
              >
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
