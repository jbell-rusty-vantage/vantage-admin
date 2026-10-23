"use client";

import Link from "next/link";
import { Star, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { useDailyOperationsRead } from "./daily-read-provider";
import { type DailyOperationsEventItem } from "@/lib/api/dailyOperationsLive";

export const MILESTONE_TOAST_SEEN_KEY = "vantage-admin-milestone-toast-seen";
const MILESTONE_MAX_AGE_MS = 15 * 60_000;

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

/** Best-effort delayed milestones from the shell's one shared read view. */
export function MilestoneToastHost() {
  const [queue, setQueue] = useState<readonly MilestoneFact[]>([]);
  const read = useDailyOperationsRead();
  const initialized = useRef(false);
  useEffect(() => {
    const view = read.data;
    if (!view) {
      const timer = setTimeout(() => setQueue([]), 0);
      return () => clearTimeout(timer);
    }
    const firstLoad = !initialized.current;
    initialized.current = true;
    const additions: MilestoneFact[] = [];
    for (const event of view.milestones) {
      const fresh = firstSight(event.event_id);
      const age = Date.now() - Date.parse(event.occurred_at);
      if (firstLoad || !fresh || !Number.isFinite(age) || age < 0 || age > MILESTONE_MAX_AGE_MS || document.querySelector("[data-daily-feed]")) continue;
      const milestone = readMilestone(event);
      if (milestone) additions.push(milestone);
    }
    if (!additions.length) return;
    const timer = setTimeout(() => setQueue(current => [...current, ...additions].slice(-50)), 0);
    return () => clearTimeout(timer);
  }, [read.data]);

  const current = queue[0] ?? null;
  const currentId = current?.eventId ?? null;
  useEffect(() => {
    if (currentId === null) {
      return;
    }
    const timer = setTimeout(() => setQueue((list) => list.filter((fact) => fact.eventId !== currentId)), MILESTONE_TOAST_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  if (!read.data || !current) {
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
