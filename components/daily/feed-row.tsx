"use client";

import { useState } from "react";
import { formatDailyOperationsClock } from "@/components/daily/daily-copy";
import {
  feedItemEventIds,
  foldLabel,
  foldSpan,
  isBookedMoment,
  rowSegments,
  type FeedFold,
} from "@/components/daily/feed-model";
import { kindIcon } from "@/components/daily/kind-icons";
import { useKindTone } from "@/components/daily/kind-colors-context";
import { isMilestoneEvent, milestoneHeadline, readMilestone } from "@/components/daily/milestone";
import { IconBadge } from "@/components/ui/crm";
import { badgeToneForKindTone } from "@/lib/api/dailyOperationsColors";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import type { DailyOperationsTier } from "@/lib/api/dailyOperationsBoard";

/**
 * Tier B: one line. dot, time, who, what, source, route. A tier C fact (shown only under "Show system detail", or in
 * a Lane) is the same line, quieter. A settled milestone is the same line with a star for its dot.
 *
 * `onClick` opens the fact drawer on the board and expands the row in place on Lanes; `expanded` is set only by the
 * second.
 */
export function FeedRow({
  event,
  tier = "B",
  suffix = null,
  arrived = false,
  expanded,
  icon = false,
  onClick,
}: {
  event: DailyOperationsEventItem;
  tier?: DailyOperationsTier;
  suffix?: string | null;
  arrived?: boolean;
  expanded?: boolean;
  /** Lanes: a tier A row carries the icon circle in place of the dot. */
  icon?: boolean;
  onClick: () => void;
}) {
  const { tone, classes } = useKindTone(event.kind, event.lane);
  const milestone = isMilestoneEvent(event) ? readMilestone(event) : null;
  const segments = milestone ? [milestoneHeadline(milestone)] : rowSegments(event);
  const [first, ...rest] = segments;
  return (
    <button
      type="button"
      className="dboard-row"
      data-feed-row="row"
      data-event-id={event.event_id}
      data-kind={event.kind}
      data-lane={event.lane}
      data-tier={tier}
      data-arrived={arrived ? "true" : undefined}
      aria-expanded={expanded}
      onClick={onClick}
    >
      {icon && tier === "A" && !milestone ? (
        <IconBadge
          icon={kindIcon(event.kind, event.lane)}
          tone={isBookedMoment(event) ? "gold" : badgeToneForKindTone(tone)}
          size="sm"
        />
      ) : milestone ? (
        <span className="dboard-row__star" aria-hidden="true">
          ★
        </span>
      ) : (
        <span className={`dboard-row__dot ${classes.dot}`} aria-hidden="true" />
      )}
      <time className="dboard-row__time" dateTime={event.occurred_at}>
        {formatDailyOperationsClock(event.occurred_at)}
      </time>
      <span className="dboard-row__text">
        <strong>{first}</strong>
        {rest.length > 0 ? ` · ${rest.join(" · ")}` : null}
        {suffix ? <span className="dboard-row__suffix"> {suffix}</span> : null}
      </span>
      <span className="dboard-row__chev" aria-hidden="true">
        {expanded === undefined ? "›" : expanded ? "▾" : "▸"}
      </span>
    </button>
  );
}

/** Three or more tier-B rows of one kind inside three minutes: one line that expands in place. */
export function FoldRow({
  fold,
  highlightedIds,
  onOpen,
}: {
  fold: FeedFold;
  highlightedIds: ReadonlySet<string>;
  onOpen: (eventIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const { classes } = useKindTone(fold.kind, fold.rows[0]?.event.lane);
  const label = foldLabel(fold.kind, fold.rows.length);
  return (
    <div className="dboard-fold" data-feed-row="fold" data-fold-kind={fold.kind} data-fold-count={fold.rows.length}>
      <button type="button" className="dboard-fold__toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={`dboard-row__dot ${classes.dot}`} aria-hidden="true" />
        <time className="dboard-row__time" dateTime={fold.rows[0]?.event.occurred_at}>
          {formatDailyOperationsClock(fold.rows[0]!.event.occurred_at)}
        </time>
        <span className="dboard-row__text">
          <strong>{label}</strong> · {foldSpan(fold)}
        </span>
        <span className="dboard-row__chev" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <ul className="dboard-fold__children" aria-label={label}>
          {fold.rows.map((row) => (
            <li key={row.key}>
              <FeedRow
                event={row.event}
                tier={row.tier}
                suffix={row.suffix}
                arrived={highlightedIds.has(row.event.event_id)}
                onClick={() => onOpen(feedItemEventIds(row))}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
