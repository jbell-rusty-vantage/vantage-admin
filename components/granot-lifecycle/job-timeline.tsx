"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  fetchGranotJobTimeline,
  type GranotTimelineEntry,
  type GranotTimelinePage,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";

const typeLabels: Record<GranotTimelineEntry["type"], string> = {
  observation: "Observation",
  priority_effect: "Priority effect",
  booking_action: "Booking action",
  decision: "Decision",
  case: "Reconciliation case",
  discrepancy: "Discrepancy",
  record_link_change: "Record Link change",
  entity_change: "Entity Change",
  official_booking: "Official Booking fact",
  official_cancellation: "Official Cancellation fact",
};

function entrySummary(entry: GranotTimelineEntry): string {
  switch (entry.type) {
    case "observation":
      return `${entry.data.normalization_result}; ${entry.data.issue_codes.length} issue(s)`;
    case "priority_effect":
      return `Priority ${entry.data.canonical_priority}`;
    case "booking_action":
      return entry.data.action;
    case "decision":
      return `${entry.data.outcome}: ${entry.data.reason_code}`;
    case "case":
      return `${entry.data.kind} ${entry.data.event}; sequence ${entry.data.sequence_number}`;
    case "discrepancy":
      return `${entry.data.kind} ${entry.data.state}: ${entry.data.reason_code}`;
    case "record_link_change":
      return `${entry.data.event}; revision ${entry.data.domain_revision}`;
    case "entity_change":
      return `revision ${entry.data.revision_before} → ${entry.data.revision_after}`;
    case "official_booking":
      return `Booking ${entry.data.booking_id}; revision ${entry.data.domain_revision}`;
    case "official_cancellation":
      return `Cancellation ${entry.data.cancellation_id}; revision ${entry.data.domain_revision}`;
  }
}

export function JobTimeline({ page }: { page: GranotTimelinePage }) {
  return (
    <section aria-labelledby="lifecycle-timeline-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="lifecycle-timeline-heading" className="text-lg font-semibold text-navy">
            Job lifecycle timeline
          </h2>
          <p className="text-sm text-muted-foreground">
            Server-ordered by event time, type priority, and stable ID. Evidence is never collapsed.
          </p>
        </div>
        <div className="flex flex-wrap gap-1" aria-label="Available timeline capabilities">
          <StatusBadge tone={page.capabilities.booking_cases ? "success" : "muted"}>Booking cases</StatusBadge>
          <StatusBadge tone={page.capabilities.release_cases ? "success" : "muted"}>Release cases</StatusBadge>
          <StatusBadge tone={page.capabilities.discrepancies ? "success" : "muted"}>Discrepancies</StatusBadge>
          <StatusBadge tone="success">Official facts</StatusBadge>
        </div>
      </div>

      {page.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lifecycle events are available.</p>
      ) : (
        <ol className="space-y-3">
          {page.items.map((entry) => (
            <li key={`${entry.type}:${entry.id}`} className="rounded-md border border-steel-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{typeLabels[entry.type]}</p>
                  <p className="text-sm text-muted-foreground">{entrySummary(entry)}</p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={entry.event_at}>
                  {formatDateTime(entry.event_at)}
                </time>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{entry.id}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function GranotJobTimelinePage({ jobNo }: { jobNo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => {
    const limit = Number(searchParams.get("limit"));
    return {
      cursor: searchParams.get("cursor") || undefined,
      limit: Number.isInteger(limit) && limit >= 1 && limit <= 200 ? limit : 100,
    };
  }, [searchParams]);
  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.jobTimeline(jobNo, filters),
    queryFn: () => fetchGranotJobTimeline(jobNo, filters),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">Job Number timeline</p>
        <h1 className="break-all text-2xl font-semibold text-navy">{jobNo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only evidence and current official facts.</p>
      </header>
      {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading Job timeline…</p> : null}
      {query.isError ? <FeedbackMessage tone="error">{query.error instanceof Error ? query.error.message : "Unable to load Job timeline."}</FeedbackMessage> : null}
      {query.data ? <JobTimeline page={query.data} /> : null}
      {query.data?.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("cursor", query.data?.next_cursor ?? "");
            params.set("limit", String(filters.limit));
            router.push(`${pathname}?${params.toString()}`);
          }}
        >
          Next timeline page
        </Button>
      ) : null}
    </div>
  );
}
