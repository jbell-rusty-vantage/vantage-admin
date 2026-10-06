"use client";

import { useRef, useState } from "react";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import {
  buildFeed,
  feedEventIds,
  feedItemEventIds,
  FEED_ITEM_LIMIT,
  type FeedFilter,
  type FeedItem,
} from "@/components/daily/feed-model";
import { FeedRow, FoldRow } from "@/components/daily/feed-row";
import { useKindTierOverrides } from "@/components/daily/kind-tiers-context";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import { MilestoneCard, SpotlightCard } from "@/components/daily/spotlight-card";
import { EMPTY_ARRIVAL_HIGHLIGHTS, type ArrivalHighlights } from "@/components/daily/use-arrival-highlights";
import { useNowMs } from "@/components/daily/use-now";
import { useStoredPreferenceFlag } from "@/components/daily/use-preference-flag";
import { Chip } from "@/components/ui/crm";
import { DAILY_OPERATIONS_DEFAULT_PANELS } from "@/lib/api/dailyOperations";
import { laneToneFor, toneClasses } from "@/lib/api/dailyOperationsColors";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

export const DAILY_SHOW_SYSTEM_STORAGE_KEY = "vantage-admin-daily-show-system";

const SCROLLED_DOWN_PX = 24;

function arrivedAny(item: FeedItem, highlighted: ReadonlySet<string>): boolean {
  return feedItemEventIds(item).some((id) => highlighted.has(id));
}

/**
 * The one live feed (doc 16): the only place a fact animates in. Chips pick *Needs you* (tier A), *Everything*
 * (A and B, the default) or one lane. While the Owner is scrolled down in the feed, or hovering over it, new facts
 * wait behind an "N new" pill instead of pushing the content they are reading; the pill (or scrolling back to the top)
 * releases them.
 */
export function LiveFeed({
  events,
  company,
  quietPriorities,
  lanes = DAILY_OPERATIONS_DEFAULT_PANELS,
  liveState = "live",
  highlights = EMPTY_ARRIVAL_HIGHLIGHTS,
  onOpenFact,
  onOpenFullList,
  className,
}: {
  events: DailyOperationsEventItem[];
  company?: string | null;
  quietPriorities?: boolean;
  /** The lane chips, in order. */
  lanes?: readonly string[];
  liveState?: LiveDotState;
  highlights?: ArrivalHighlights;
  onOpenFact: (eventIds: string[]) => void;
  onOpenFullList?: () => void;
  className?: string;
}) {
  const nowMs = useNowMs();
  const overrides = useKindTierOverrides();
  const [showSystem, setShowSystem] = useStoredPreferenceFlag(DAILY_SHOW_SYSTEM_STORAGE_KEY);
  const [filter, setFilter] = useState<FeedFilter>("everything");
  const [hovering, setHovering] = useState(false);
  const [scrolledDown, setScrolledDown] = useState(false);
  // The ids on screen when the Owner started reading. `null` = live.
  const [frozen, setFrozen] = useState<ReadonlySet<string> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const build = (source: readonly DailyOperationsEventItem[]) =>
    buildFeed({ events: source, company, quietPriorities, overrides, showSystem, filter, nowMs });
  const liveItems = build(events);
  const shownItems = frozen ? build(events.filter((event) => frozen.has(event.event_id))) : liveItems;
  const shownIds = feedEventIds(shownItems);
  const newCount = frozen ? [...feedEventIds(liveItems)].filter((id) => !shownIds.has(id)).length : 0;
  const visibleItems = shownItems.slice(0, FEED_ITEM_LIMIT);

  function settle(next: { hovering?: boolean; scrolledDown?: boolean }) {
    const nextHovering = next.hovering ?? hovering;
    const nextScrolled = next.scrolledDown ?? scrolledDown;
    setHovering(nextHovering);
    setScrolledDown(nextScrolled);
    if (nextHovering || nextScrolled) {
      if (frozen === null) {
        setFrozen(new Set(events.map((event) => event.event_id)));
      }
    } else {
      setFrozen(null);
    }
  }

  function release() {
    setHovering(false);
    setScrolledDown(false);
    setFrozen(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const empty =
    filter === "needs" ? DAILY_COPY.feed.emptyNeeds : filter === "everything" ? DAILY_COPY.feed.empty : DAILY_COPY.feed.emptyLane;

  return (
    <section
      className={["dboard-feed", className].filter(Boolean).join(" ")}
      data-band="feed"
      data-daily-feed
      aria-label={DAILY_COPY.feed.title}
    >
      <div className="dboard-feed__head">
        <h2 className="dboard-feed__title">
          <LiveDot state={liveState} />
          {DAILY_COPY.feed.title}
        </h2>
        <div className="dboard-feed__chips" role="group" aria-label={DAILY_COPY.feed.label}>
          <Chip small active={filter === "needs"} onClick={() => setFilter("needs")}>
            {DAILY_COPY.feed.needsYou}
          </Chip>
          <Chip small active={filter === "everything"} onClick={() => setFilter("everything")}>
            {DAILY_COPY.feed.everything}
          </Chip>
          {lanes.map((lane) => (
            <Chip key={lane} small active={filter === lane} onClick={() => setFilter(lane)}>
              <span className={`dboard-row__dot ${toneClasses(laneToneFor(lane)).dot}`} aria-hidden="true" />
              {DAILY_COPY.panelsLabels[lane as keyof typeof DAILY_COPY.panelsLabels] ?? lane}
            </Chip>
          ))}
        </div>
        <div className="dboard-feed__tools">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showSystem} onChange={(event) => setShowSystem(event.target.checked)} />
            {DAILY_COPY.feed.showSystem}
          </label>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="dboard-feed__scroll"
        data-feed-scroll
        onMouseEnter={() => settle({ hovering: true })}
        onMouseLeave={() => settle({ hovering: false })}
        onScroll={(event) => settle({ scrolledDown: event.currentTarget.scrollTop > SCROLLED_DOWN_PX })}
      >
        {newCount > 0 ? (
          <div className="dboard-new">
            <button type="button" className="dboard-new__pill" data-feed-new onClick={release}>
              {DAILY_COPY.feed.newAbove(newCount)}
            </button>
          </div>
        ) : null}
        {visibleItems.length === 0 ? (
          <p className="dboard-feed__empty">{empty}</p>
        ) : (
          <ol className="dboard-feed__list" aria-label={DAILY_COPY.feed.title} data-event-list>
            {visibleItems.map((item) => {
              const arrived = arrivedAny(item, highlights.highlightedIds);
              return (
                <li key={item.key} className={arrived ? "daily-row daily-row-enter" : "daily-row"} data-feed-item={item.type}>
                  <div className="min-h-0">
                    <FeedEntry item={item} arrived={arrived} highlightedIds={highlights.highlightedIds} onOpen={onOpenFact} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {shownItems.length > visibleItems.length && onOpenFullList ? (
          <button type="button" className="dboard-feed__more" onClick={onOpenFullList}>
            {DAILY_COPY.feed.openFull}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FeedEntry({
  item,
  arrived,
  highlightedIds,
  onOpen,
}: {
  item: FeedItem;
  arrived: boolean;
  highlightedIds: ReadonlySet<string>;
  onOpen: (eventIds: string[]) => void;
}) {
  if (item.type === "spotlight") {
    return <SpotlightCard item={item} arrived={arrived} onOpen={onOpen} />;
  }
  if (item.type === "milestone") {
    return item.pinned ? (
      <MilestoneCard event={item.event} arrived={arrived} onOpen={onOpen} />
    ) : (
      <FeedRow event={item.event} tier="A" arrived={arrived} onClick={() => onOpen([item.event.event_id])} />
    );
  }
  if (item.type === "fold") {
    return <FoldRow fold={item} highlightedIds={highlightedIds} onOpen={onOpen} />;
  }
  return (
    <FeedRow
      event={item.event}
      tier={item.tier}
      suffix={item.suffix}
      arrived={arrived}
      onClick={() => onOpen(feedItemEventIds(item))}
    />
  );
}
