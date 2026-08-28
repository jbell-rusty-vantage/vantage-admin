"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  GRANOT_LIVE_RECEIPTS_STREAM_PATH,
  LIVE_WEBHOOK_EVENT_LABELS,
  mergeLiveWebhookReceipts,
  trimLiveWebhookReceipts,
  type LiveWebhookEventClass,
  type LiveWebhookLead,
  type LiveWebhookReceipt,
} from "@/lib/api/granotLiveReceipts";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";

export type LiveStreamStatus = "connecting" | "live" | "reconnecting";

function eventTone(eventClass: LiveWebhookEventClass): "default" | "success" | "warning" {
  if (eventClass === "lead_created") return "success";
  if (eventClass === "priority_updated") return "warning";
  return "default";
}

function LeadFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 wrap-break-word text-sm">{value?.trim() ? value : "Not sent"}</dd>
    </div>
  );
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function LiveWebhookLeadFacts({ lead }: { lead: LiveWebhookLead }) {
  return (
    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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

export function LiveWebhookReceiptCard({ receipt }: { receipt: LiveWebhookReceipt }) {
  const jobHref = receipt.lead.job_no
    ? buildJobTimelineHref({ job: receipt.lead.job_no })
    : null;
  return (
    <details className="group rounded-md border bg-background">
      <summary className="cursor-pointer list-none px-4 py-3 hover:bg-steel-100 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
              <StatusBadge tone={eventTone(receipt.route_event_class)}>
                {LIVE_WEBHOOK_EVENT_LABELS[receipt.route_event_class]}
              </StatusBadge>
              <span>{receipt.lead.display_name ?? "No name sent"}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {receipt.lead.job_no ? `Job ${receipt.lead.job_no}` : "No job number"}
              {receipt.lead.phone ? ` · ${receipt.lead.phone}` : ""}
              {receipt.lead.priority ? ` · Priority ${receipt.lead.priority}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <time dateTime={receipt.captured_at}>{formatDateTime(receipt.captured_at)}</time>
              <div className="mt-1">
                <StatusBadge tone="muted">{receipt.processing_state}</StatusBadge>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 pt-0.5 text-sm font-semibold text-trust-blue">
              <span className="group-open:hidden">Show details</span>
              <span className="hidden group-open:inline">Hide details</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </div>
        </div>
      </summary>
      <div className="space-y-3 border-t px-4 py-3">
        <LiveWebhookLeadFacts lead={receipt.lead} />
        {jobHref ? (
          <Link className="inline-flex text-sm font-medium text-trust-blue hover:underline" href={jobHref}>
            Open job timeline
          </Link>
        ) : null}
        <details className="rounded-md border bg-steel-100">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-navy">
            Full Granot payload
          </summary>
          <pre className="max-h-96 overflow-auto border-t p-3 text-xs leading-5">
            {prettyJson(receipt.granot_statement)}
          </pre>
        </details>
      </div>
    </details>
  );
}

export function LiveWebhooksView({
  receipts,
  status,
  error,
}: {
  receipts: LiveWebhookReceipt[];
  status: LiveStreamStatus;
  error?: string | null;
}) {
  const statusLabel =
    status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Granot webhooks</CardTitle>
        <CardDescription>
          Lead created, priority updated, and booking status changed — as Granot delivers them.
          Click a row to open the lead facts.
        </CardDescription>
        <p className="text-sm font-medium text-navy" aria-live="polite">
          <span
            className={
              status === "live"
                ? "text-emerald-700"
                : status === "reconnecting"
                  ? "text-amber-700"
                  : "text-muted-foreground"
            }
          >
            ● {statusLabel}
          </span>
          {receipts.length > 0 ? ` · ${receipts.length} in the last 30 minutes` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <FeedbackMessage tone="warning">{error}</FeedbackMessage> : null}
        {receipts.length === 0 && status !== "connecting" ? (
          <p className="text-sm text-muted-foreground">
            Waiting for the next Granot webhook. Recent lead created, priority updated, and booking
            status changed receipts will appear here.
          </p>
        ) : null}
        {receipts.map((receipt) => (
          <LiveWebhookReceiptCard key={receipt.receipt_id} receipt={receipt} />
        ))}
      </CardContent>
    </Card>
  );
}

export function LiveWebhooks() {
  const [receipts, setReceipts] = useState<LiveWebhookReceipt[]>([]);
  const [status, setStatus] = useState<LiveStreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource(GRANOT_LIVE_RECEIPTS_STREAM_PATH);
    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { receipts?: LiveWebhookReceipt[] };
        setReceipts(trimLiveWebhookReceipts(Array.isArray(payload.receipts) ? payload.receipts : []));
        setStatus("live");
        setError(null);
      } catch {
        setError("Could not read the live snapshot.");
      }
    });
    source.addEventListener("receipt", (event) => {
      try {
        const receipt = JSON.parse((event as MessageEvent).data) as LiveWebhookReceipt;
        setReceipts((current) => mergeLiveWebhookReceipts(current, receipt));
        setStatus("live");
        setError(null);
      } catch {
        setError("Could not read a live webhook.");
      }
    });
    source.addEventListener("heartbeat", () => {
      setStatus("live");
      setReceipts((current) => {
        const next = trimLiveWebhookReceipts(current);
        return next.length === current.length ? current : next;
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

  return <LiveWebhooksView receipts={receipts} status={status} error={error} />;
}
