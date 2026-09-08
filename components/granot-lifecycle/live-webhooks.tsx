"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  DAILY_COPY,
  DAILY_OPERATIONS_HREF,
  formatDailyOperationsClock,
  formatDailyOperationsRelative,
} from "@/components/daily/daily-copy";
import { LiveDot, type LiveDotState } from "@/components/daily/live-dot";
import { bumpNow, useNowMs } from "@/components/daily/use-now";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  clearAllArrivalHighlightTimers,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
} from "@/lib/api/dailyOperationsBoard";
import { kindToneFor, toneClasses, type DailyOperationsToneClasses } from "@/lib/api/dailyOperationsColors";
import {
  GRANOT_LIVE_RECEIPTS_STREAM_PATH,
  LIVE_WEBHOOK_EVENT_LABELS,
  applyLiveWebhookSsePayload,
  type LiveWebhookEventClass,
  type LiveWebhookLead,
  type LiveWebhookReceipt,
} from "@/lib/api/granotLiveReceipts";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import { intakeCaseHref } from "@/components/intakes/intake-copy";
import { cn } from "@/lib/utils";
import { prettyJson } from "./pretty-json";

export type LiveStreamStatus = "connecting" | "live" | "reconnecting";

/**
 * Live Events shares the Daily Operations colour catalog: a Granot receipt
 * class maps onto the Daily Operations Event kind it produces, so a Booked
 * receipt is the same green on `/live-events` and on `/daily`.
 */
export const LIVE_WEBHOOK_CLASS_KINDS: Record<LiveWebhookEventClass, string> = {
  lead_created: "granot.lead_created",
  priority_updated: "granot.priority_updated",
  booking_status_changed: "granot.booked",
};

function classTone(eventClass: LiveWebhookEventClass, eventType: string | null): DailyOperationsToneClasses {
  const kind =
    eventClass === "booking_status_changed" && eventType?.toLowerCase().includes("release")
      ? "granot.release"
      : LIVE_WEBHOOK_CLASS_KINDS[eventClass];
  return toneClasses(kindToneFor(kind, null, "granot"));
}

function liveDotState(status: LiveStreamStatus): LiveDotState {
  if (status === "live") return "live";
  if (status === "reconnecting") return "reconnecting";
  return "paused";
}

function LeadFact({ label, value }: { label: string; value?: string | null }) {
  const sent = Boolean(value?.trim());
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("wrap-break-word text-sm leading-snug", sent ? "text-navy" : "text-steel/70")}>
        {sent ? value : "Not sent"}
      </dd>
    </div>
  );
}

export function LiveWebhookLeadFacts({ lead }: { lead: LiveWebhookLead }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
      <LeadFact label="Name" value={lead.display_name} />
      <LeadFact label="Phone" value={lead.phone} />
      <LeadFact label="Email" value={lead.email} />
      <LeadFact label="Job number" value={lead.job_no} />
      <LeadFact label="Granot event" value={lead.event_type} />
      <LeadFact label="Priority" value={lead.priority} />
      <LeadFact label="Moving from" value={lead.origin} />
      <LeadFact label="Moving to" value={lead.destination} />
      <LeadFact label="Move date" value={lead.move_date} />
    </dl>
  );
}

/**
 * One Granot receipt with every lead fact visible. Only the raw Granot
 * payload sits behind `Show details`.
 */
export function LiveWebhookReceiptCard({
  receipt,
  nowMs,
  highlight = false,
}: {
  receipt: LiveWebhookReceipt;
  nowMs?: number;
  highlight?: boolean;
}) {
  const jobHref = receipt.lead.job_no
    ? buildJobTimelineHref({ job: receipt.lead.job_no })
    : null;
  const tone = classTone(receipt.route_event_class, receipt.lead.event_type);
  const absolute = formatDateTime(receipt.captured_at);
  const stamp = nowMs !== undefined ? formatDailyOperationsRelative(receipt.captured_at, nowMs) : formatDailyOperationsClock(receipt.captured_at);
  return (
    <article
      data-receipt-id={receipt.receipt_id}
      data-event-class={receipt.route_event_class}
      className={cn(
        "relative rounded-md border bg-background py-3 pl-5 pr-4 transition-colors",
        highlight && "daily-arrival-highlight bg-amber-50 ring-1 ring-trust-blue/30",
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-2 left-2 w-1 rounded-full", tone.dot)} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            tone.badge,
          )}
        >
          <span className={cn("size-1.5 rounded-full", tone.dot)} aria-hidden="true" />
          {LIVE_WEBHOOK_EVENT_LABELS[receipt.route_event_class]}
        </span>
        <span className="text-sm font-semibold text-navy">{receipt.lead.display_name ?? "No name sent"}</span>
        {receipt.lead.job_no ? (
          <span className="text-sm tabular-nums text-muted-foreground">Job {receipt.lead.job_no}</span>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge tone="muted">{receipt.processing_state}</StatusBadge>
          <time dateTime={receipt.captured_at} title={absolute} className="tabular-nums font-medium text-navy">
            {stamp}
          </time>
          <span className="tabular-nums">{absolute}</span>
        </span>
      </div>

      <div className="mt-2">
        <LiveWebhookLeadFacts lead={receipt.lead} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {receipt.intake_link?.kind === "booking" ? (
          <Link
            className="inline-flex h-7 items-center rounded-md border border-trust-blue/25 bg-white px-2 text-xs font-semibold text-trust-blue hover:bg-steel-100"
            href={intakeCaseHref(receipt.intake_link.case_id, {
              state: receipt.intake_link.state,
              job: receipt.lead.job_no ?? undefined,
            })}
          >
            Open booking intake
          </Link>
        ) : null}
        {jobHref ? (
          <Link className="inline-flex text-xs font-semibold text-trust-blue hover:underline" href={jobHref}>
            Open job timeline
          </Link>
        ) : null}
      </div>
      <details className="group mt-1">
        <summary className="flex cursor-pointer list-none items-center justify-end gap-1 text-xs font-semibold text-trust-blue [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Show details</span>
          <span className="hidden group-open:inline">Hide details</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 rounded-md border bg-steel-100">
          <p className="px-3 py-1.5 text-xs font-semibold text-navy">Full Granot payload</p>
          <pre className="max-h-96 overflow-auto border-t p-3 text-xs leading-5">
            {prettyJson(receipt.granot_statement)}
          </pre>
        </div>
      </details>
    </article>
  );
}

export function LiveWebhooksView({
  receipts,
  status,
  error,
  nowMs,
  highlightedIds,
}: {
  receipts: LiveWebhookReceipt[];
  status: LiveStreamStatus;
  error?: string | null;
  nowMs?: number;
  highlightedIds?: ReadonlySet<string>;
}) {
  const statusLabel =
    status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…";
  const newest = receipts.reduce<string | null>(
    (best, receipt) => (best === null || receipt.captured_at > best ? receipt.captured_at : best),
    null,
  );
  const lastFact =
    newest && nowMs !== undefined ? formatDailyOperationsRelative(newest, nowMs) : null;
  return (
    <Card>
      <CardHeader className="border-b border-steel-100">
        <div className="flex flex-wrap items-center gap-2">
          <LiveDot state={liveDotState(status)} />
          <CardTitle>Live Granot webhooks</CardTitle>
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              status === "live"
                ? "text-emerald-700"
                : status === "reconnecting"
                  ? "text-amber-700"
                  : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {statusLabel}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-3 text-xs tabular-nums text-muted-foreground">
            {receipts.length > 0 ? (
              <span>
                <span className="font-semibold text-navy">{receipts.length}</span> in the last 30 minutes
              </span>
            ) : null}
            {lastFact ? (
              <span data-last-fact>
                {DAILY_COPY.lastFact} {lastFact}
              </span>
            ) : null}
            <Link href={DAILY_OPERATIONS_HREF} className="font-semibold text-trust-blue hover:underline">
              Open Daily Operations
            </Link>
          </span>
        </div>
        <CardDescription>
          Lead created, priority updated, and booking status changed — as Granot delivers them.
          Every lead fact is on the row; Show details opens the raw Granot payload.
        </CardDescription>
      </CardHeader>
      <CardContent className="daily-stream-body relative space-y-3 pt-4">
        {error ? <FeedbackMessage tone="warning">{error}</FeedbackMessage> : null}
        {receipts.length === 0 && status !== "connecting" ? (
          <p className="text-sm text-muted-foreground">
            Waiting for the next Granot webhook. Recent lead created, priority updated, and booking
            status changed receipts will appear here.
          </p>
        ) : null}
        <ol className="space-y-3">
          {receipts.map((receipt) => (
            <li
              key={receipt.receipt_id}
              className={cn(highlightedIds?.has(receipt.receipt_id) && "daily-arrival-enter")}
            >
              <LiveWebhookReceiptCard
                receipt={receipt}
                nowMs={nowMs}
                highlight={highlightedIds?.has(receipt.receipt_id) ?? false}
              />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function LiveWebhooks() {
  const [receipts, setReceipts] = useState<LiveWebhookReceipt[]>([]);
  const [status, setStatus] = useState<LiveStreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const highlightTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nowMs = useNowMs();
  const receiptKey = receipts.map((receipt) => receipt.receipt_id).join("\0");

  useEffect(() => {
    const source = new EventSource(GRANOT_LIVE_RECEIPTS_STREAM_PATH);
    const applyEvent = (eventName: string, rawData: string) => {
      setReceipts((current) => {
        const next = applyLiveWebhookSsePayload(eventName, rawData, current);
        if (next.error) {
          setError(next.error);
          return current;
        }
        setStatus("live");
        setError(null);
        return next.receipts;
      });
    };
    source.addEventListener("snapshot", (event) => {
      applyEvent("snapshot", (event as MessageEvent).data);
    });
    source.addEventListener("receipt", (event) => {
      applyEvent("receipt", (event as MessageEvent).data);
    });
    source.addEventListener("receipt_updated", (event) => {
      applyEvent("receipt_updated", (event as MessageEvent).data);
    });
    source.addEventListener("heartbeat", () => {
      setStatus("live");
      setReceipts((current) => {
        const next = applyLiveWebhookSsePayload("heartbeat", "{}", current);
        return next.receipts.length === current.length ? current : next.receipts;
      });
    });
    source.onerror = () => {
      setStatus("reconnecting");
    };
    source.onopen = () => {
      setStatus("live");
    };
    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    const ids = receiptKey === "" ? [] : receiptKey.split("\0");
    const { arrived, seen, seeded } = seedOrArriveDailyOperationsEventIds(seenIdsRef.current, ids, {
      hydrated: status !== "connecting",
      seeded: seededRef.current,
    });
    seenIdsRef.current = seen;
    seededRef.current = seeded;
    if (arrived.length === 0) {
      return;
    }
    bumpNow();
    setHighlightedIds((current) => new Set([...current, ...arrived]));
    schedulePerIdArrivalHighlightClear(highlightTimersRef.current, arrived, (expired) => {
      setHighlightedIds((current) => {
        const next = new Set(current);
        for (const id of expired) {
          next.delete(id);
        }
        return next;
      });
    });
  }, [receiptKey, status]);

  useEffect(() => {
    const timers = highlightTimersRef.current;
    return () => clearAllArrivalHighlightTimers(timers);
  }, []);

  return (
    <LiveWebhooksView
      receipts={receipts}
      status={status}
      error={error}
      nowMs={nowMs}
      highlightedIds={highlightedIds}
    />
  );
}
