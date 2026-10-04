"use client";
/**
 * One Number's calls and Lead messages (`GET /numbers/:id/timeline`), newest first, grouped by Eastern day. Provider
 * call metadata only: direction, result, duration, the legs and the rep the call is attributed to at its start
 * (only a reviewed Rep Identity Link names an Agent). A Lead message shows its status, never a body.
 */
import { useMemo } from "react";
import { MessageSquare, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { interactionDetailSchema, leadMessageDetailSchema, type InteractionDetail, type TimelineEvent } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { Button } from "../atoms/button";
import { Failure } from "../chrome";
import { contactTypeLabel, formatCallDuration, formatDateTime, formatDay, label } from "../lib/format";
import { useNumberTimeline } from "../data/use-numbers";

const t = copy.numbers.timeline;

function callIcon(detail: InteractionDetail) {
  const result = detail.provider_result ?? "";
  if (/missed/i.test(result)) return { Icon: PhoneMissed, tone: "danger" as const };
  if (detail.direction === "inbound") return { Icon: PhoneIncoming, tone: "blue" as const };
  if (detail.direction === "outbound") return { Icon: PhoneOutgoing, tone: "blue" as const };
  return { Icon: Phone, tone: "blue" as const };
}

/** The rep line: the reviewed Agent's name, else why no Agent is named, plus the extension when known. */
export function repText(rep: InteractionDetail["rep"]): string | null {
  if (!rep) return null;
  const who = rep.status === "reviewed" && rep.agent_name ? rep.agent_name : t.repStatus[rep.status] ?? label(rep.status);
  return rep.extension_number ? `${who} · ${t.extension(rep.extension_number)}` : who;
}

function CallBody({ event, detail }: { event: TimelineEvent; detail: InteractionDetail }) {
  const rep = repText(detail.rep);
  return (
    <>
      <p className="si-tl__title">{t.call(label(detail.direction ?? "unknown"))}{detail.provider_result ? ` · ${label(detail.provider_result)}` : ""}</p>
      <p className="si-tl__meta">
        {t.duration} {formatCallDuration(detail.duration_seconds)}
        {detail.contact_type ? ` · ${contactTypeLabel(detail.contact_type)}` : ""}
        {detail.recording_count ? ` · ${t.recordings(detail.recording_count)}` : ""}
      </p>
      {rep && <p className="si-text--sm">{t.rep}: {rep}</p>}
      {detail.call_log_state === "provisional" && <p className="si-text--sm si-text--amber">{t.provisional}</p>}
      {!!detail.legs?.length && (
        <details>
          <summary>{t.legs} ({detail.legs.length})</summary>
          <ul className="si-local-stack">
            {detail.legs.map((leg, index) => (
              <li key={index} className="si-text--sm">
                {[leg.leg_type, leg.direction, leg.result].filter(Boolean).map((value) => label(value!)).join(" · ")}
                {leg.start_time ? ` · ${formatDateTime(leg.start_time)}` : ""}
                {` · ${formatCallDuration(leg.duration_seconds)}`}
              </li>
            ))}
          </ul>
          {!!detail.legs_overflow_count && <p className="si-text--sm si-text--subtle">{t.legsMore(detail.legs_overflow_count)}</p>}
        </details>
      )}
      {event.observed_at !== event.happened_at && <p className="si-text--sm si-text--subtle">{t.observedLate(formatDateTime(event.observed_at))}</p>}
    </>
  );
}

function MessageBody({ event }: { event: TimelineEvent }) {
  const parsed = leadMessageDetailSchema.safeParse(event.detail);
  const detail = parsed.success ? parsed.data : null;
  return (
    <>
      <p className="si-tl__title">{t.leadMessage}</p>
      <p className="si-tl__meta">{event.description}</p>
      {detail?.status && <p className="si-text--sm">{t.messageStatus(label(detail.status))}</p>}
      {detail?.sent_at && <p className="si-text--sm si-text--subtle">{t.sentAt(formatDateTime(detail.sent_at))}</p>}
      {detail?.delivered_at && <p className="si-text--sm si-text--subtle">{t.deliveredAt(formatDateTime(detail.delivered_at))}</p>}
    </>
  );
}

export function TimelineEntry({ event }: { event: TimelineEvent }) {
  const call = event.kind === "interaction" ? interactionDetailSchema.safeParse(event.detail) : null;
  const { Icon, tone } = call?.success ? callIcon(call.data) : event.kind === "lead_message" ? { Icon: MessageSquare, tone: "navy" as const } : { Icon: Phone, tone: "blue" as const };
  return (
    <li className="si-tl__entry" data-kind={event.kind}>
      <span className={`si-tl__icon si-tl__icon--${tone}`}><Icon size={14} aria-hidden /></span>
      <div className="si-tl__body">
        {call?.success ? <CallBody event={event} detail={call.data} /> : event.kind === "lead_message" ? <MessageBody event={event} /> : (
          <>
            <p className="si-tl__title">{label(event.kind)}</p>
            <p className="si-tl__meta">{event.description}</p>
          </>
        )}
      </div>
      <time className="si-tl__time" dateTime={event.happened_at}>{formatDateTime(event.happened_at)}</time>
    </li>
  );
}

export function NumberTimeline({ numberId }: { numberId: string }) {
  const timeline = useNumberTimeline(numberId);
  const items = useMemo(() => timeline.data?.pages.flatMap((page) => page.data.items) ?? [], [timeline.data]);
  const days = useMemo(() => {
    const groups: { day: string; events: TimelineEvent[] }[] = [];
    for (const event of items) {
      const day = formatDay(event.happened_at);
      const last = groups.at(-1);
      if (last && last.day === day) last.events.push(event);
      else groups.push({ day, events: [event] });
    }
    return groups;
  }, [items]);
  return (
    <section className="si-tl" aria-label={copy.numbers.tabs.activity}>
      {timeline.isPending && <p role="status">{copy.ui1.prim.loading}</p>}
      {timeline.error && <Failure message={t.failed} error={timeline.error} retry={() => void timeline.refetch()} />}
      {timeline.isSuccess && items.length === 0 && <p>{t.empty}</p>}
      <ol className="si-tl__list">
        {days.map((group) => (
          <li key={group.day}>
            <h4 className="si-tl__day"><span>{group.day}</span></h4>
            <ol>
              {group.events.map((event) => <TimelineEntry key={`${event.kind}:${event.id}`} event={event} />)}
            </ol>
          </li>
        ))}
      </ol>
      {timeline.hasNextPage && (
        <Button disabled={timeline.isFetching} onClick={() => void timeline.fetchNextPage()}>{t.loadOlder}</Button>
      )}
    </section>
  );
}
