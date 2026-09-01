"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { IntakeCasePage } from "./intake-case-page";
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
    summary: "Granot recorded a Booked or Release job.",
  },
] as const;

type IntakeState = "open" | "resolved";

function parseTab(value: string | null): IntakeKind {
  return value === "cancellations" ? "cancellation" : "booking";
}

function parseState(value: string | null): IntakeState {
  return value === "resolved" ? "resolved" : "open";
}

export const INTAKE_PAGE_SIZE = 10;

function buildIntakesHref(input: {
  tab: IntakeKind;
  state: IntakeState;
  job?: string;
  cursor?: string;
  cursors?: string[];
  caseId?: string;
}): string {
  const params = new URLSearchParams();
  if (input.tab === "cancellation") params.set("tab", "cancellations");
  if (input.state === "resolved") params.set("state", "resolved");
  if (input.job?.trim()) params.set("job", input.job.trim());
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.cursors?.length) params.set("cursors", JSON.stringify(input.cursors));
  if (input.caseId) params.set("case", input.caseId);
  const query = params.toString();
  return query ? `${INTAKES_HREF}?${query}` : INTAKES_HREF;
}

export function parseCursorHistory(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function pushCursorHistory(history: string[], currentCursor?: string): string[] {
  return [...history, currentCursor ?? ""];
}

export function popCursorHistory(history: string[]): { cursor?: string; history: string[] } {
  if (history.length === 0) return { cursor: undefined, history: [] };
  const cursor = history[history.length - 1];
  return { cursor: cursor || undefined, history: history.slice(0, -1) };
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
          This is the waiting room for Granot booking work. A case appears when Granot records a
          Booked or Release job. Choose a case, then enter one binder amount, up to two agents,
          deposit, and merchant from the same catalog as a normal booking. Granot is not creating
          those official records for you.
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

export function IntakesPagination({
  page,
  hasPrevious,
  hasNext,
  loading,
  onPrevious,
  onNext,
}: {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted-foreground" role="status">
        Page {page}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!hasPrevious || loading}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!hasNext || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function IntakesDashboardView({
  kind,
  state,
  data,
  loading,
  error,
  selectedCaseId,
  job,
  page = 1,
  hasNextPage = false,
  paging,
  onPrevious,
  onNext,
}: {
  kind: IntakeKind;
  state: IntakeState;
  data?: { items?: GranotLifecycleCaseListItem[]; next_cursor?: string | null };
  loading?: boolean;
  error?: string;
  selectedCaseId?: string;
  job?: string;
  page?: number;
  hasNextPage?: boolean;
  paging?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const title = "Booking intakes";
  const description = "Choose a booked or released job, then finish the official booking: lead, one binder amount, up to two agents, deposit, and merchant.";
  const itemCount = data?.items?.length ?? 0;
  const showPager = itemCount > 0 || page > 1;

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
          <>
            <IntakeList
              kind={kind}
              items={data?.items ?? []}
              emptyMessage={intakeEmptyMessage(kind, state)}
              selectedCaseId={selectedCaseId}
              listQuery={{ state, job }}
            />
            {showPager ? (
              <IntakesPagination
                page={page}
                hasPrevious={page > 1}
                hasNext={hasNextPage}
                loading={paging}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function IntakesDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = "booking" as const;
  const state = parseState(searchParams?.get("state") ?? null);
  const job = searchParams?.get("job") ?? "";
  const cursor = searchParams?.get("cursor") ?? undefined;
  const cursorHistory = parseCursorHistory(searchParams?.get("cursors") ?? null);
  const selectedCaseId = searchParams?.get("case") ?? "";
  const [jobDraft, setJobDraft] = useState(job);
  const page = Math.max(cursorHistory.length + 1, cursor ? 2 : 1);

  const filters = useMemo(() => ({
    kind: "booking" as const,
    state,
    normalized_job_no: job.trim() || undefined,
    sort: "last_evidence_at" as const,
    order: "desc" as const,
    limit: INTAKE_PAGE_SIZE,
    cursor,
  }), [state, job, cursor]);

  const query = useQuery({
    queryKey: queryKeys.granotLifecycle.cases(filters),
    queryFn: () => fetchGranotLifecycleCases(filters),
    placeholderData: keepPreviousData,
  });

  function go(next: {
    tab?: IntakeKind;
    state?: IntakeState;
    job?: string;
    cursor?: string;
    cursors?: string[];
    caseId?: string;
  }) {
    const href = buildIntakesHref({
      tab: next.tab ?? tab,
      state: next.state ?? state,
      job: next.job ?? job,
      cursor: next.cursor,
      cursors: next.cursors,
      caseId: next.caseId,
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
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected="true"
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {TABS[0].summary} Open a waiting case to enter the official booking form.
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

      {selectedCaseId ? (
        <IntakeCasePage
          caseId={selectedCaseId}
          returnTo={buildIntakesHref({ tab, state, job, cursor, cursors: cursorHistory })}
          backLabel="Back to waiting intakes"
        />
      ) : (
        <IntakesDashboardView
          kind={tab}
          state={state}
          data={query.data}
          loading={query.isPending}
          error={undefined}
          job={job}
          page={page}
          hasNextPage={Boolean(query.data?.next_cursor)}
          paging={query.isFetching}
          onPrevious={() => {
            if (cursorHistory.length === 0) {
              go({ cursor: undefined, cursors: [] });
              return;
            }
            const previous = popCursorHistory(cursorHistory);
            go({ cursor: previous.cursor, cursors: previous.history });
          }}
          onNext={() => {
            if (!query.data?.next_cursor) return;
            go({
              cursor: query.data.next_cursor,
              cursors: pushCursorHistory(cursorHistory, cursor),
            });
          }}
        />
      )}
    </div>
  );
}

export { TABS, buildIntakesHref, parseTab, parseState };
