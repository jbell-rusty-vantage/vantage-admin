"use client";

import Link from "next/link";
import {
  DAILY_COPY,
  dailyOperationsKindLabel,
  formatDailyOperationsClock,
  formatDailyOperationsRelative,
} from "@/components/daily/daily-copy";
import { useKindTone } from "@/components/daily/kind-colors-context";
import {
  dailyOperationsAttentionChips,
  dailyOperationsCardDetails,
  dailyOperationsCardFacts,
  dailyOperationsEventLinks,
  dailyOperationsEventTitle,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

/**
 * One Daily Operations Event. Every stored fact on the small card payload is
 * visible: identity line, labelled detail grid, attention chips, links. The
 * left rail and kind badge carry the Owner's colour for the Event kind.
 *
 * `nowMs` switches the stamp to a relative reading (Arrivals); panels keep the
 * absolute Florida clock. Both stay on the same `<time dateTime>`.
 */
export function DailyOperationsEventCard({
  event,
  grouped = false,
  highlight = false,
  justNow = false,
  nowMs,
  compact = false,
}: {
  event: DailyOperationsEventItem;
  grouped?: boolean;
  highlight?: boolean;
  justNow?: boolean;
  nowMs?: number;
  compact?: boolean;
}) {
  const title = dailyOperationsEventTitle(event);
  const facts = dailyOperationsCardFacts(event);
  const details = dailyOperationsCardDetails(event);
  const chips = dailyOperationsAttentionChips(event);
  const links = dailyOperationsEventLinks(event);
  const { tone, classes } = useKindTone(event.kind, event.lane);
  const clock = formatDailyOperationsClock(event.occurred_at);
  const stamp = justNow
    ? DAILY_COPY.justNow
    : nowMs !== undefined
      ? formatDailyOperationsRelative(event.occurred_at, nowMs)
      : clock;

  return (
    <article
      data-event-id={event.event_id}
      data-lane={event.lane}
      data-kind={event.kind}
      data-tone={tone}
      data-just-arrived={highlight ? "true" : undefined}
      className={cn(
        "relative rounded-md border border-steel-200 bg-card py-2 pl-4 pr-3 text-sm shadow-sm transition-colors",
        grouped && "ml-3",
        highlight && "daily-arrival-highlight bg-amber-50 ring-1 ring-trust-blue/30",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-1.5 left-1.5 w-1 rounded-full", classes.dot)}
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <time
          dateTime={event.occurred_at}
          title={clock}
          className="tabular-nums text-xs font-medium text-muted-foreground"
        >
          {stamp}
        </time>
        {nowMs !== undefined && !justNow ? (
          <span className="tabular-nums text-[11px] text-steel">{clock}</span>
        ) : null}
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            classes.badge,
          )}
        >
          <span className={cn("size-1.5 rounded-full", classes.dot)} aria-hidden="true" />
          {dailyOperationsKindLabel(event.kind)}
        </span>
      </div>
      <h3 className="mt-0.5 font-semibold leading-snug text-navy">{title}</h3>
      {facts.length > 0 ? (
        <p className="mt-0.5 text-xs text-steel">{facts.join(" · ")}</p>
      ) : null}
      {details.length > 0 ? (
        <dl
          className={cn(
            "mt-1.5 grid gap-x-3 gap-y-0.5 text-xs",
            compact ? "grid-cols-1" : "grid-cols-[auto_1fr]",
          )}
        >
          {details.map((detail) => (
            <div key={`${detail.label}:${detail.value}`} className="contents">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {detail.label}
              </dt>
              <dd
                className={cn(
                  "break-words text-navy",
                  detail.tone === "alert" && "font-medium text-amber-800",
                  detail.tone === "muted" && "text-steel",
                )}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={`${chip.label}:${chip.value}`}
              className={cn(
                "inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                chip.tone === "alert"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-steel-100 text-muted-foreground",
              )}
            >
              {chip.value}
            </span>
          ))}
        </div>
      ) : null}
      {links.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {links.map((link) => (
            <Link
              key={`${link.label}:${link.href}`}
              href={link.href}
              className="text-xs font-semibold text-trust-blue hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
