"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableLoadingState } from "@/components/data-table/table-states";
import type { GranotLifecycleCaseListItem, GranotLifecycleCaseListPage } from "@/lib/api/granotLifecycle";
import { cn } from "@/lib/utils";
import { IntakeCardActions } from "@/components/intakes/intake-card-actions";
import {
  INTAKES_HREF,
  intakeCaseHref,
  intakeKindFromCase,
  intakeMoreWaitingLabel,
  intakeQueueLabel,
  intakeStatusLabel,
  intakeWaitingEmptyMessage,
  intakeWhyHereForCase,
  type IntakeKind,
} from "@/components/intakes/intake-copy";
import { OVERVIEW_INTAKE_PREVIEW_LIMIT, overviewCopy } from "./overview-copy";

export type NeedsYouQueue = {
  items: GranotLifecycleCaseListItem[];
  next_cursor: string | null;
  loading?: boolean;
  error?: string;
};

export function openIntakePreviewFilters(kind: "booking" | "release") {
  return {
    kind,
    state: "open" as const,
    sort: "last_evidence_at" as const,
    order: "desc" as const,
    limit: OVERVIEW_INTAKE_PREVIEW_LIMIT,
  };
}

export function emptyNeedsYouQueue(): NeedsYouQueue {
  return { items: [], next_cursor: null };
}

export function needsYouQueueFromPage(
  page?: GranotLifecycleCaseListPage,
  status?: { loading?: boolean; error?: string },
): NeedsYouQueue {
  return {
    items: page?.items ?? [],
    next_cursor: page?.next_cursor ?? null,
    loading: status?.loading,
    error: status?.error,
  };
}

function ageLabel(value: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(value).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return `${Math.floor(elapsed / 60_000)}m`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function intakesHref(kind: IntakeKind): string {
  return kind === "cancellation" ? `${INTAKES_HREF}?tab=cancellations` : INTAKES_HREF;
}

function WaitingRow({
  item,
  kind,
  now,
  bookingCommandsEnabled,
  onClosed,
}: {
  item: GranotLifecycleCaseListItem;
  kind: IntakeKind;
  now: number;
  bookingCommandsEnabled: boolean;
  onClosed?: (message: string) => void;
}) {
  const href = intakeCaseHref(item.case_id, { tab: kind, state: "open" });
  return (
    <li className="rounded-md border border-transparent px-3 py-2.5 hover:border-steel-200 hover:bg-steel-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-navy">
            <Link className="hover:underline" href={href}>
              {item.job_no}
            </Link>
          </p>
          <p className="truncate text-sm text-foreground">{item.customer_label || "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{intakeWhyHereForCase(item)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs tabular-nums text-muted-foreground">
            {ageLabel(item.last_evidence_at, now)} ago
          </p>
          <div className="mt-1">
            <IntakeCardActions
              item={item}
              href={href}
              bookingCommandsEnabled={bookingCommandsEnabled}
              compact
              onClosed={onClosed}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

function WaitingQueue({
  kind,
  queue,
  now,
  bookingCommandsEnabled,
  onClosed,
}: {
  kind: IntakeKind;
  queue: NeedsYouQueue;
  now: number;
  bookingCommandsEnabled: boolean;
  onClosed?: (message: string) => void;
}) {
  const rows = queue.items.filter((item) => intakeKindFromCase(item.kind) === kind);
  const href = intakesHref(kind);

  return (
    <section aria-labelledby={`overview-waiting-${kind}`}>
      <div className="mb-2">
        <h3 id={`overview-waiting-${kind}`} className="text-sm font-semibold">
          <Link href={href} className="text-navy hover:text-primary hover:underline">
            {intakeQueueLabel(kind)}
          </Link>
        </h3>
      </div>
      {queue.error ? (
        <FeedbackMessage tone="error">{overviewCopy.intakesLoadError}</FeedbackMessage>
      ) : queue.loading ? (
        <TableLoadingState label={overviewCopy.loadingIntakes} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{intakeWaitingEmptyMessage(kind)}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((item) => (
            <WaitingRow
              key={`${item.kind}:${item.case_id}`}
              item={item}
              kind={kind}
              now={now}
              bookingCommandsEnabled={bookingCommandsEnabled}
              onClosed={onClosed}
            />
          ))}
          {queue.next_cursor ? (
            <li>
              <Link
                href={href}
                className="block px-3 py-2 text-sm font-medium text-primary hover:underline"
              >
                {intakeMoreWaitingLabel(kind)}
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

export function NeedsYouBand({
  booking,
  now = Date.now(),
  bookingCommandsEnabled = true,
}: {
  booking: NeedsYouQueue;
  now?: number;
  bookingCommandsEnabled?: boolean;
}) {
  const waiting = booking.items.length > 0 || Boolean(booking.next_cursor);
  const [notice, setNotice] = useState<string>();

  return (
    <Card className={cn(waiting && "border-trust-blue/35")}>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-lg font-extrabold tracking-tight text-navy">
          {intakeStatusLabel("open")}
        </h2>
      </CardHeader>
      <CardContent className="space-y-2">
        {notice ? <FeedbackMessage>{notice}</FeedbackMessage> : null}
        <WaitingQueue
          kind="booking"
          queue={booking}
          now={now}
          bookingCommandsEnabled={bookingCommandsEnabled}
          onClosed={setNotice}
        />
      </CardContent>
    </Card>
  );
}
