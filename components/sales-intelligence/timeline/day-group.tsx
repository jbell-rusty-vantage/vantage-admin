/**
 * UI1-TL: one ET day of the timeline (final spec §10.1). The day header (`Today`, `Yesterday`, `Sun Sep 20`, 13 px
 * uppercase) is computed against the response's `as_of`. The server's routine rows collapse at the end of the day
 * under `Processing details ({n})`, closed by default.
 */
import type { TimelineEvent } from "@/lib/api/salesIntelligence";
import { Disclosure } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { etDateKey, formatDayHeader } from "../lib/time";
import { EventRow } from "./event-row";

const t = copy.ui1.timeline;

export type TimelineDay = { key: string; header: string; events: TimelineEvent[]; routine: TimelineEvent[] };

/** Groups newest-first items by their ET day, keeping the server's order inside each day. */
export function groupByDay(items: readonly TimelineEvent[], asOf: string): TimelineDay[] {
  const days: TimelineDay[] = [];
  const byKey = new Map<string, TimelineDay>();
  for (const item of items) {
    const key = etDateKey(item.happened_at) || "unknown";
    let day = byKey.get(key);
    if (!day) {
      day = { key, header: formatDayHeader(item.happened_at, asOf), events: [], routine: [] };
      byKey.set(key, day);
      days.push(day);
    }
    (item.routine ? day.routine : day.events).push(item);
  }
  return days;
}

export function DayGroup({ day, asOf, idPrefix }: { day: TimelineDay; asOf: string; idPrefix: string }) {
  const headingId = `${idPrefix}-day-${day.key}`;
  return (
    <li className="si-timeline__day" data-day={day.key}>
      <h3 id={headingId} className="si-timeline__dayhead">{day.header}</h3>
      {day.events.length > 0 && (
        <ol className="si-timeline__rows" aria-labelledby={headingId}>
          {day.events.map((item) => (
            <EventRow key={item.id} item={item} asOf={asOf} />
          ))}
        </ol>
      )}
      {day.routine.length > 0 && (
        <Disclosure id={`${idPrefix}-processing-${day.key}`} title={t.processing(day.routine.length)} className="si-timeline__processing">
          <ol className="si-timeline__rows">
            {day.routine.map((item) => (
              <EventRow key={item.id} item={item} asOf={asOf} />
            ))}
          </ol>
        </Disclosure>
      )}
    </li>
  );
}
