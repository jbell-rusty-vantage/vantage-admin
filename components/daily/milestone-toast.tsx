"use client";

import Link from "next/link";
import { Star, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DAILY_COPY } from "@/components/daily/daily-copy";
import { DailyBoardStyle } from "@/components/daily/daily-board-style";
import {
  isMilestoneEvent,
  MILESTONE_TOAST_MS,
  milestoneHeadline,
  milestoneLinks,
  milestoneName,
  milestoneProgressText,
  milestoneRankLine,
  milestoneRepsLine,
  readMilestone,
  type MilestoneFact,
} from "@/components/daily/milestone";
import { Avatar, IconBadge } from "@/components/ui/crm";
import { DAILY_OPERATIONS_LIVE_PATH, type DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

export const MILESTONE_TOAST_SEEN_KEY = "vantage-admin-milestone-toast-seen";
const RECONNECT_AFTER_CLOSE_MS = 30_000;

/** `true` the first time a fact id is seen this browser session; `false` after, and when storage is unavailable it shows (once per mount). */
function firstSight(eventId: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(MILESTONE_TOAST_SEEN_KEY);
    const seen: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(seen) ? seen.filter((value): value is string => typeof value === "string") : [];
    if (list.includes(eventId)) {
      return false;
    }
    window.sessionStorage.setItem(MILESTONE_TOAST_SEEN_KEY, JSON.stringify([...list, eventId].slice(-50)));
    return true;
  } catch {
    return true;
  }
}

/** The milestone behind one SSE `event` message, or null (any other kind, a bad payload, a payload with no id). */
export function milestoneFromSsePayload(raw: string): MilestoneFact | null {
  try {
    const payload = JSON.parse(raw) as Partial<DailyOperationsEventItem> | null;
    if (!payload || typeof payload.kind !== "string" || typeof payload.event_id !== "string" || !isMilestoneEvent({ kind: payload.kind })) {
      return null;
    }
    return readMilestone({
      day: "",
      occurred_at: new Date().toISOString(),
      lane: "outreach",
      title: payload.kind,
      source_company: null,
      ingestion_origin: null,
      lead_kind: null,
      job_no: null,
      entity_type: null,
      entity_id: null,
      parent_receipt_id: null,
      links: {},
      card: {},
      metric_touches: [],
      ...payload,
    } as DailyOperationsEventItem);
  } catch {
    return null;
  }
}

/**
 * The goal-milestone toast for the whole dashboard (doc 16): bottom right, eight seconds, once per fact (by id, in
 * `sessionStorage`). No page-wide confetti; with motion allowed, a single soft burst on the icon circle (CSS, off
 * under `prefers-reduced-motion`).
 *
 * Self-contained so the shell can mount it on every page: it opens its own `EventSource` to the Daily Operations
 * stream, listens to `event` messages only, and ignores every kind but the two milestones. The browser retries a
 * dropped connection natively; if the server closes the stream for good, it is reopened after 30 s. It closes on
 * unmount. Where the live feed is on screen (Today > Operations) the feed already pins the card, so no toast shows.
 */
export function MilestoneToastHost() {
  const [queue, setQueue] = useState<readonly MilestoneFact[]>([]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      source = new EventSource(DAILY_OPERATIONS_LIVE_PATH);
      source.addEventListener("event", (message) => {
        const fact = milestoneFromSsePayload((message as MessageEvent).data);
        if (!fact || document.querySelector("[data-daily-feed]") || !firstSight(fact.eventId)) {
          return;
        }
        setQueue((current) => [...current, fact]);
      });
      source.addEventListener("error", () => {
        if (!closed && source?.readyState === EventSource.CLOSED) {
          retry = setTimeout(connect, RECONNECT_AFTER_CLOSE_MS);
        }
      });
    };
    connect();
    return () => {
      closed = true;
      if (retry) {
        clearTimeout(retry);
      }
      source?.close();
    };
  }, []);

  const current = queue[0] ?? null;
  const currentId = current?.eventId ?? null;
  useEffect(() => {
    if (currentId === null) {
      return;
    }
    const timer = setTimeout(() => setQueue((list) => list.filter((fact) => fact.eventId !== currentId)), MILESTONE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  if (!current) {
    return null;
  }
  return <MilestoneToast fact={current} onDismiss={() => setQueue((list) => list.filter((fact) => fact.eventId !== current.eventId))} />;
}

/** The toast itself, pure over its fact so it renders in tests. */
export function MilestoneToast({ fact, onDismiss }: { fact: MilestoneFact; onDismiss: () => void }) {
  const progressText = milestoneProgressText(fact);
  const secondary = milestoneRankLine(fact) ?? milestoneRepsLine(fact);
  return (
    <div className="dboard-toast" role="status" aria-live="polite" data-milestone-toast={fact.eventId}>
      <DailyBoardStyle />
      <div className="dboard-toast__card">
        <button type="button" className="dboard-toast__close" aria-label={DAILY_COPY.milestone.toastClose} onClick={onDismiss}>
          <X aria-hidden="true" width={14} height={14} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="dboard-burst">
            <IconBadge icon={fact.scope === "team" ? Users : Star} tone="gold" size="sm" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-sm font-bold text-navy">{milestoneHeadline(fact)}</p>
            {progressText ? <p className="m-0 text-[12.5px] text-muted-foreground">{progressText}</p> : null}
            {secondary ? <p className="m-0 text-[12.5px] text-muted-foreground">{secondary}</p> : null}
          </div>
          {fact.scope === "rep" ? <Avatar name={milestoneName(fact)} size="sm" /> : null}
        </div>
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {milestoneLinks(fact).map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={index === 0 ? "crm-button crm-button--sm crm-button--primary" : "crm-button crm-button--sm"}
              onClick={onDismiss}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
