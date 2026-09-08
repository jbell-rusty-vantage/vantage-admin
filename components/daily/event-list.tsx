"use client";

import { DailyOperationsEventCard } from "@/components/daily/event-card";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { useExitingList } from "@/components/daily/use-exiting-list";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

const NO_IDS: ReadonlySet<string> = new Set();

function eventKey(event: DailyOperationsEventItem): string {
  return event.event_id;
}

/**
 * The one list every stream on `/daily` renders. A fact that just landed
 * grows in from the top (`daily-row-enter`); a fact that fell off the visible
 * window slides away in place (`daily-row-exit`) instead of vanishing. Layout
 * is the caller's: a single column by default, a grid when `className` says so
 * (solo panel, overlay). Existing rows never reorder.
 */
export function AnimatedEventList({
  events,
  highlights = EMPTY_ARRIVAL_HIGHLIGHTS,
  groupedIds = NO_IDS,
  nowMs,
  compact = false,
  className,
  ariaLabel,
}: {
  events: DailyOperationsEventItem[];
  highlights?: ArrivalHighlights;
  groupedIds?: ReadonlySet<string>;
  nowMs?: number;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const rows = useExitingList(events, eventKey);
  return (
    <ol className={cn("flex flex-col gap-2", className)} aria-label={ariaLabel} data-event-list>
      {rows.map((row, index) => {
        const entering = !row.exiting && highlights.highlightedIds.has(row.key);
        return (
          <li
            key={row.key}
            className={cn(
              "daily-row",
              entering && "daily-row-enter",
              row.exiting && "daily-row-exit",
            )}
            data-row-index={index}
            data-exiting={row.exiting ? "true" : undefined}
            aria-hidden={row.exiting ? "true" : undefined}
          >
            <div className="min-h-0">
              <DailyOperationsEventCard
                event={row.item}
                grouped={groupedIds.has(row.key)}
                highlight={entering}
                justNow={highlights.justNowIds.has(row.key)}
                nowMs={nowMs}
                compact={compact}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
