import Link from "next/link";
import { DAILY_COPY, formatDailyOperationsClock } from "@/components/daily/daily-copy";
import {
  dailyOperationsCardFacts,
  dailyOperationsEventLinks,
  dailyOperationsEventTitle,
  dailyOperationsUsefulChips,
} from "@/lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";
import { cn } from "@/lib/utils";

export function DailyOperationsEventCard({
  event,
  grouped = false,
  highlight = false,
  justNow = false,
}: {
  event: DailyOperationsEventItem;
  grouped?: boolean;
  highlight?: boolean;
  justNow?: boolean;
}) {
  const title = dailyOperationsEventTitle(event);
  const facts = dailyOperationsCardFacts(event);
  const chips = dailyOperationsUsefulChips(event);
  const links = dailyOperationsEventLinks(event);

  return (
    <article
      data-event-id={event.event_id}
      data-lane={event.lane}
      data-kind={event.kind}
      data-just-arrived={highlight ? "true" : undefined}
      className={cn(
        "rounded-md border border-steel-200 bg-card px-3 py-2 text-sm shadow-sm",
        grouped && "border-l-2 border-l-trust-blue/40",
        highlight && "daily-arrival-highlight bg-amber-50 ring-1 ring-trust-blue/30",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <time
          dateTime={event.occurred_at}
          className="tabular-nums text-xs font-medium text-muted-foreground"
        >
          {justNow ? DAILY_COPY.justNow : formatDailyOperationsClock(event.occurred_at)}
        </time>
        <h3 className="font-semibold text-navy">{title}</h3>
      </div>
      {facts.length > 0 ? (
        <p className="mt-1 text-xs text-steel">{facts.join(" · ")}</p>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex rounded-full bg-steel-100 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {chip}
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
