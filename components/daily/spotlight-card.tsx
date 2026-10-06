"use client";

import Link from "next/link";
import { Check, Star, Users } from "lucide-react";
import { DAILY_COPY, formatDailyOperationsClock } from "@/components/daily/daily-copy";
import {
  eventJobNo,
  isBookedMoment,
  spotlightLinks,
  spotlightMeta,
  spotlightTitle,
  type FeedSpotlight,
} from "@/components/daily/feed-model";
import { kindIcon } from "@/components/daily/kind-icons";
import { useKindTone } from "@/components/daily/kind-colors-context";
import {
  milestoneHeadline,
  milestoneLinks,
  milestoneName,
  milestoneProgress,
  milestoneProgressText,
  milestoneRankLine,
  milestoneReachedClock,
  milestoneRepsLine,
  readMilestone,
} from "@/components/daily/milestone";
import { Avatar, CopyJobButton, IconBadge, Track } from "@/components/ui/crm";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { badgeToneForKindTone } from "@/lib/api/dailyOperationsColors";

/**
 * Tier A: a small card. An icon circle in the kind's colour (gold for a Booked moment), one title line, one meta
 * line, at most two link buttons. Everything else on the fact is one click away in the fact drawer.
 */
export function SpotlightCard({
  item,
  arrived = false,
  onOpen,
}: {
  item: FeedSpotlight;
  arrived?: boolean;
  onOpen: (eventIds: string[]) => void;
}) {
  const { event } = item;
  const { tone } = useKindTone(event.kind, event.lane);
  const gold = isBookedMoment(event);
  const Icon = kindIcon(event.kind, event.lane);
  const title = spotlightTitle(item);
  const meta = spotlightMeta(item);
  const links = spotlightLinks(item);
  const job = eventJobNo(event) ?? item.absorbed.map(eventJobNo).find(Boolean) ?? null;
  const ids = [event.event_id, ...item.absorbed.map((guest) => guest.event_id)];
  return (
    <article
      className="dboard-card"
      data-feed-card="spotlight"
      data-event-id={event.event_id}
      data-kind={event.kind}
      data-lane={event.lane}
      data-tone={gold ? "gold" : tone}
      data-arrived={arrived ? "true" : undefined}
    >
      <button
        type="button"
        className="dboard-card__open"
        aria-label={`${title}. ${DAILY_COPY.feed.openFact}`}
        onClick={() => onOpen(ids)}
      >
        <IconBadge icon={Icon} tone={gold ? "gold" : badgeToneForKindTone(tone)} size="sm" />
        <span className="dboard-card__text">
          <span className="dboard-card__title">{title}</span>
          {meta ? <span className="dboard-card__meta">{meta}</span> : null}
        </span>
        <time className="dboard-card__time" dateTime={event.occurred_at}>
          {formatDailyOperationsClock(event.occurred_at)}
        </time>
      </button>
      {links.length > 0 || job ? (
        <div className="dboard-card__actions">
          {job ? <CopyJobButton jobNo={job} /> : null}
          {links.map((link, index) => (
            <Link
              key={`${link.label}:${link.href}`}
              href={link.href}
              className={index === 0 ? "crm-button crm-button--sm crm-button--primary" : "crm-button crm-button--sm"}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * The gold milestone variant of the spotlight card: who reached what, a full green Track, the rank (or the team
 * count), and View queue / Team. Every field is optional on the wire, so every line is conditional.
 */
export function MilestoneCard({
  event,
  arrived = false,
  onOpen,
}: {
  event: DailyOperationsEventItem;
  arrived?: boolean;
  onOpen: (eventIds: string[]) => void;
}) {
  const fact = readMilestone(event);
  if (!fact) {
    return null;
  }
  const headline = milestoneHeadline(fact);
  const progressText = milestoneProgressText(fact);
  const secondary = milestoneRankLine(fact) ?? milestoneRepsLine(fact);
  const links = milestoneLinks(fact);
  return (
    <article
      className="dboard-card"
      data-feed-card="milestone"
      data-event-id={event.event_id}
      data-kind={event.kind}
      data-lane={event.lane}
      data-tone="gold"
      data-arrived={arrived ? "true" : undefined}
    >
      <button
        type="button"
        className="dboard-card__open"
        aria-label={`${headline}. ${DAILY_COPY.feed.openFact}`}
        onClick={() => onOpen([event.event_id])}
      >
        {fact.scope === "rep" ? (
          <span className="flex items-center gap-1">
            <IconBadge icon={Star} tone="gold" size="sm" />
            <Avatar name={milestoneName(fact)} size="sm" />
          </span>
        ) : (
          <IconBadge icon={Users} tone="gold" size="sm" />
        )}
        <span className="dboard-card__text">
          <span className="dboard-card__title">{headline}</span>
          {progressText ? (
            <span className="dboard-card__line flex items-center gap-1.5">
              <span>{progressText}</span>
              <Check aria-hidden="true" width={14} height={14} />
            </span>
          ) : null}
          {secondary ? <span className="dboard-card__meta">{secondary}</span> : null}
        </span>
        <time className="dboard-card__time" dateTime={fact.reachedAt} title={DAILY_COPY.milestone.reachedAt(milestoneReachedClock(fact))}>
          {milestoneReachedClock(fact)}
        </time>
      </button>
      <Track progress={milestoneProgress(fact)} done label={headline} />
      <div className="dboard-card__actions">
        {links.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className={index === 0 ? "crm-button crm-button--sm crm-button--primary" : "crm-button crm-button--sm"}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </article>
  );
}
