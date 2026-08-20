"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { IntakeList } from "./intake-list";
import {
  INTAKES_HREF,
  intakeEmptyMessage,
  type IntakeKind,
} from "./intake-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchGranotLifecycleCases,
  type GranotLifecycleCaseListItem,
} from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "booking" as const,
    label: "Booking intakes",
    summary: "Granot marked a lead booked (priority 5) or recorded a booking.",
  },
  {
    id: "cancellation" as const,
    label: "Cancellation intakes",
    summary: "Granot sent a booking status change that cancelled the job.",
  },
] as const;

type IntakeState = "open" | "resolved";

function parseTab(value: string | null): IntakeKind {
  return value === "cancellations" ? "cancellation" : "booking";
}

function parseState(value: string | null): IntakeState {
  return value === "resolved" ? "resolved" : "open";
}

function buildIntakesHref(input: {
  tab: IntakeKind;
  state: IntakeState;
  job?: string;
  cursor?: string;
}): string {
  const params = new URLSearchParams();
  if (input.tab === "cancellation") params.set("tab", "cancellations");
  if (input.state === "resolved") params.set("state", "resolved");
  if (input.job?.trim()) params.set("job", input.job.trim());
  if (input.cursor) params.set("cursor", input.cursor);
  const query = params.toString();
  return query ? `${INTAKES_HREF}?${query}` : INTAKES_HREF;
}

function formatCheckedAt(timestamp: number | undefined): string {
  if (!timestamp) return "Not checked yet";
  return new Date(timestamp).toLocaleString();
}

export function IntakesHeader({
  refreshing,
  lastCheckedAt,
  onRefresh,
}: {
  refreshing?: boolean;
  lastCheckedAt?: number;
  onRefresh?: () => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-trust-blue">Owner review</p>
        <h1 className="text-2xl font-semibold text-navy">Intakes</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is the waiting room for Granot booking and cancellation work. A case appears when
          Granot sets a lead to priority 5, records a booking, or cancels a job. Granot is not
          creating the official Vantage booking or cancellation — you still review each case.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh intakes"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
          {refreshing ? "Checking…" : "Refresh"}
        </Button>
        <p className="text-xs text-muted-foreground" role="status">
          Last checked: {refreshing ? "Checking now…" : formatCheckedAt(lastCheckedAt)}
        </p>
      </div>
    </header>
  );
}

export function IntakesDashboardView({
  kind,
  state,
  data,
  loading,
  error,
}: {
  kind: IntakeKind;
  state: IntakeState;
  data?: { items?: GranotLifecycleCaseListItem[] };
  loading?: boolean;
  error?: string;
}) {
  const title = kind === "cancellation" ? "Cancellation intakes" : "Booking intakes";
  const description = kind === "cancellation"
    ? "Jobs Granot cancelled. Review them here before they become an official Vantage cancellation."
    : "Jobs Granot marked booked. Review them here before they become an official Vantage booking.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading intakes…</p> : null}
        {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
        {!loading && !error ? (
          <IntakeList
            kind={kind}
            items={data?.items ?? []}
            emptyMessage={intakeEmptyMessage(kind, state)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function IntakesDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams?.get("tab") ?? null);
  const state = parseState(searchParams?.get("state") ?? null);
  const job = searchParams?.get("job") ?? "";
  const cursor = searchParams?.get("cursor") ?? undefined;
  const [jobDraft, setJobDraft] = useState(job);

  const filters = useMemo(() => ({
    kind: tab === "cancellation" ? "release" as const : "booking" as const,
    state,
    normalized_job_no: job.trim() || undefined,
    sort: "last_evidence_at" as const,
    order: "desc" as const,
    limit: 25,
    cursor,
  }), [tab, state, job, cursor]);

  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.cases(filters),
    queryFn: () => fetchGranotLifecycleCases(filters),
  });

  function go(next: { tab?: IntakeKind; state?: IntakeState; job?: string; cursor?: string }) {
    const href = buildIntakesHref({
      tab: next.tab ?? tab,
      state: next.state ?? state,
      job: next.job ?? job,
      cursor: next.cursor,
    });
    router.push(href);
  }

  return (
    <div className="space-y-5">
      <IntakesHeader
        refreshing={query.isFetching}
        lastCheckedAt={query.dataUpdatedAt}
        onRefresh={() => { void query.refetch(); }}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Intake type">
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                active ? "bg-primary text-white" : "border border-steel-200 bg-white text-navy hover:bg-steel-100",
              )}
              onClick={() => {
                setJobDraft(job);
                go({ tab: item.id, cursor: undefined });
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {TABS.find((item) => item.id === tab)?.summary}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>What you are looking at</CardTitle>
          <CardDescription>
            Waiting cases still need your decision. Finished cases were already reviewed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              go({ job: jobDraft, cursor: undefined });
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="intakes-state">Show</Label>
              <select
                id="intakes-state"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={state}
                onChange={(event) => go({ state: parseState(event.target.value), cursor: undefined })}
              >
                <option value="open">Waiting for you</option>
                <option value="resolved">Finished</option>
              </select>
            </div>
            <div className="min-w-[16rem] flex-1 space-y-1">
              <Label htmlFor="intakes-job">Job number</Label>
              <Input
                id="intakes-job"
                value={jobDraft}
                placeholder="Optional — look up one job"
                onChange={(event) => setJobDraft(event.target.value)}
              />
            </div>
            <Button type="submit">Apply</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setJobDraft("");
                go({ job: "", cursor: undefined });
              }}
            >
              Clear job
            </Button>
          </form>
        </CardContent>
      </Card>

      {query.isError ? (
        <FeedbackMessage tone="error">
          {query.error instanceof Error ? query.error.message : "Unable to load intakes. Press Refresh to try again."}
        </FeedbackMessage>
      ) : null}

      <IntakesDashboardView
        kind={tab}
        state={state}
        data={query.data}
        loading={query.isPending}
        error={undefined}
      />

      {query.data?.next_cursor ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => go({ cursor: query.data?.next_cursor ?? undefined })}
        >
          Show more
        </Button>
      ) : null}
    </div>
  );
}

export { buildIntakesHref, parseTab, parseState };
