"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Paperclip, Phone, PhoneMissed, Sparkles, StickyNote } from "lucide-react";
import { fetchCatalogItems } from "@/lib/api/catalog";
import { readSalesIntelligence, timelineSchema } from "@/lib/api/salesIntelligence";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { Button } from "./atoms/button";
import { copy } from "./sales-intelligence-copy";
import { formatDateTime, formatDay, label } from "./lib/format";
import { toggleValue } from "./lib/filter-state";

const KIND_FILTERS = ["calls", "attachments", "work", "analysis"] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

function bucket(kind: string): KindFilter {
  if (kind === "interaction") return "calls";
  if (kind === "attachment" || kind === "attachment_decision") return "attachments";
  if (kind === "conversation" || kind === "analysis" || kind === "analysis_published") return "analysis";
  return "work";
}

function iconTone(kind: string, detail: Record<string, unknown>) {
  const contact = String(detail.contact_type ?? "");
  const result = String(detail.provider_result ?? "");
  const direction = String(detail.direction ?? "").toLowerCase();
  if (kind === "interaction" && (contact === "voicemail" || /voicemail/i.test(result))) return { tone: "gold" as const, Icon: Phone };
  if (kind === "interaction" && (/missed/i.test(result) || direction === "inbound")) return { tone: direction === "inbound" && /missed/i.test(result) ? "danger" as const : "blue" as const, Icon: /missed/i.test(result) ? PhoneMissed : Phone };
  if (kind === "interaction") return { tone: "blue" as const, Icon: Phone };
  if (bucket(kind) === "attachments") return { tone: "navy" as const, Icon: Paperclip };
  if (bucket(kind) === "analysis") return { tone: "green" as const, Icon: Sparkles };
  return { tone: "neutral" as const, Icon: StickyNote };
}

function HistoryValues({ value, agents }: { value: unknown; agents: Map<string, string> }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return (
    <>
      {typeof data.note === "string" && <p>{data.note}</p>}
      {typeof data.reason === "string" && <p>Reason: {data.reason}</p>}
      {typeof data.resolution_reason === "string" && <p>Decision reason: {data.resolution_reason}</p>}
      {typeof data.cancel_reason === "string" && <p>Cancellation reason: {data.cancel_reason}</p>}
      {typeof data.description === "string" && <p>{data.description}</p>}
      {typeof data.disposition === "string" && <p>Outcome: {label(data.disposition)}</p>}
      {"due_at" in data && <p>Due {typeof data.due_at === "string" ? formatDateTime(data.due_at) : "Undated"}</p>}
      {typeof data.snoozed_until === "string" && <p>Snoozed until {formatDateTime(data.snoozed_until)}</p>}
      {typeof data.closed_reason === "string" && <p>Closure: {label(data.closed_reason)}</p>}
      {"responsible_agent_id" in data && (
        <p>
          {typeof data.responsible_agent_id === "string"
            ? `${"outreach_record_id" in data ? "Assigned to" : "Outreach owned by"} ${agents.get(data.responsible_agent_id) ?? "Unknown Agent"}`
            : "Unassigned"}
        </p>
      )}
    </>
  );
}

export function NumberTimeline({ numberId }: { numberId: string }) {
  const [kinds, setKinds] = useState<string[]>([...KIND_FILTERS]);
  const agents = useQuery({ queryKey: ["catalog", "agents", "csi-current"], queryFn: () => fetchCatalogItems("agents", { includeInactive: true }) });
  const names = new Map(agents.data?.map((agent) => [agent.id, agent.name]));
  const timeline = useInfiniteQuery({
    queryKey: [...salesIntelligenceKeys.all, "timeline", numberId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      readSalesIntelligence(`numbers/${encodeURIComponent(numberId)}/timeline?limit=25${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, timelineSchema, signal),
    getNextPageParam: (page) => page.data.cursor ?? undefined,
    retry: false,
  });
  const items = useMemo(
    () => (timeline.data?.pages.flatMap((page) => page.data.items) ?? []).filter((event) => kinds.includes(bucket(event.kind))),
    [kinds, timeline.data],
  );
  const days = useMemo(() => {
    const groups: { day: string; events: typeof items }[] = [];
    for (const event of items) {
      const day = formatDay(event.happened_at);
      const last = groups.at(-1);
      if (last && last.day === day) last.events.push(event);
      else groups.push({ day, events: [event] });
    }
    return groups;
  }, [items]);

  return (
    <section className="si-tl" aria-label={copy.panel.tabs.activity}>
      <h3>{copy.panel.tabs.activity}</h3>
      <div className="si-tl__filters" role="group" aria-label={copy.panel.tabs.activity}>
        {KIND_FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={kinds.includes(key) ? "si-toggle is-on" : "si-toggle"}
            aria-pressed={kinds.includes(key)}
            onClick={() => setKinds(toggleValue(kinds, key))}
          >
            {copy.timeline[key]}
          </button>
        ))}
      </div>
      {timeline.isPending && <p role="status">Loading activity…</p>}
      {timeline.error && (
        <p role="alert">
          Activity could not refresh. <Button onClick={() => void timeline.refetch()}>Retry activity</Button>
        </p>
      )}
      {timeline.data?.pages[0].data.items.length === 0 && <p>No activity observed in available history.</p>}
      {timeline.data && items.length === 0 && timeline.data.pages[0].data.items.length > 0 && <p>No activity matches these filters.</p>}
      <ol className="si-tl__list">
        {days.map((group) => (
          <li key={group.day}>
            <h4 className="si-tl__day"><span>{group.day}</span></h4>
            <ol>
              {group.events.map((event) => {
                const detail = event.detail as Record<string, unknown>;
                const { tone, Icon } = iconTone(event.kind, detail);
                return (
                  <li key={`${event.kind}:${event.id}`} className="si-tl__entry">
                    <span className={`si-tl__icon${tone === "neutral" ? "" : ` si-tl__icon--${tone}`}`}>
                      <Icon size={14} aria-hidden />
                    </span>
                    <div className="si-tl__body">
                      <p className="si-tl__title">{event.kind === "restriction" ? "Contact restriction" : label(event.kind)}</p>
                      <p className="si-tl__meta">{event.description}</p>
                      <HistoryValues value={event.detail.current} agents={names} />
                      {typeof event.detail.actor === "string" && <p className="si-text--subtle">Recorded by {event.detail.actor}</p>}
                      {event.detail.prior && (
                        <details>
                          <summary>Earlier values</summary>
                          <HistoryValues value={event.detail.prior} agents={names} />
                        </details>
                      )}
                      {event.kind === "interaction" && (
                        <p>
                          Contact:{" "}
                          {event.detail.contact_type === "human_conversation"
                            ? "Human conversation"
                            : event.detail.contact_type === "voicemail"
                              ? "Voicemail—speaker unknown"
                              : "Connected status does not establish human contact"}
                        </p>
                      )}
                      {event.observed_at !== event.happened_at && <p className="si-text--subtle">Observed {formatDateTime(event.observed_at)}</p>}
                    </div>
                    <time className="si-tl__time" dateTime={event.happened_at}>{formatDateTime(event.happened_at)}</time>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {timeline.hasNextPage && (
        <Button disabled={timeline.isFetching} onClick={() => void timeline.fetchNextPage()}>
          {copy.timeline.loadOlder}
        </Button>
      )}
    </section>
  );
}
