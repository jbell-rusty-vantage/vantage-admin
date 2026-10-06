"use client";
/**
 * Bookings → To finish (doc 06): the open booking cases as compact cards, the finish sheet opened by `?case=<id>`,
 * and "Finished today" folded below. URL contract: `case` only (the older `tab`, `state`, `job`, `cursor` and
 * `cursors` keys are ignored; the list pages itself).
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CircleCheck, RefreshCw } from "lucide-react";
import { RecordList, useInfiniteScroll, useUrlState } from "@/components/records";
import { formatRelative } from "@/components/ui/crm/format";
import { IconBadge, PageHeader, ReadFailure } from "@/components/ui/crm/primitives";
import {
  finishedToday,
  TO_FINISH_OPEN_FILTERS,
  TO_FINISH_RESOLVED_FILTERS,
} from "@/lib/api/bookingsToFinish";
import { fetchGranotLifecycleCases, type GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";
import { queryKeys } from "@/lib/query/keys";
import { type UrlStateUpdate } from "@/lib/api/url-state-update";
import { FinishBookingSheet } from "./finish-booking-sheet";
import { ToFinishCard } from "./to-finish-card";
import { TO_FINISH_COPY as COPY } from "./to-finish-copy";

type ToFinishUrlPatch = { case: string | null };
const toUpdate = (patch: ToFinishUrlPatch): UrlStateUpdate => ({ case: patch.case });

/** The `case` query key: the booking to finish whose sheet is open, if any. */
export function parseToFinishUrl(searchParams: { get(name: string): string | null } | null | undefined): { caseId: string | null } {
  const value = searchParams?.get("case")?.trim();
  return { caseId: value ? value : null };
}

export function ToFinishPage() {
  const searchParams = useSearchParams();
  const { caseId } = useMemo(() => parseToFinishUrl(searchParams), [searchParams]);
  const update = useUrlState<ToFinishUrlPatch>(toUpdate);

  const open = useInfiniteQuery({
    queryKey: queryKeys.granotLifecycle.cases({ ...TO_FINISH_OPEN_FILTERS, view: "to-finish" }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchGranotLifecycleCases({ ...TO_FINISH_OPEN_FILTERS, cursor: pageParam }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const items = useMemo(() => open.data?.pages.flatMap((page) => page.items) ?? [], [open.data]);
  const canFetchMore = Boolean(open.hasNextPage && !open.isFetchingNextPage);
  const sentinelRef = useInfiniteScroll({
    canFetchMore,
    fetchMore: () => {
      void open.fetchNextPage();
    },
    visibleCount: items.length,
  });

  return (
    <div className="crm-page" style={{ padding: 0 }} data-testid="to-finish-page">
      <PageHeader
        title={COPY.title}
        subtitle={COPY.subtitle}
        help={COPY.help}
        right={
          <button type="button" className="crm-button crm-button--quiet" disabled={open.isFetching} onClick={() => void open.refetch()}>
            <RefreshCw aria-hidden="true" width={16} height={16} />
            {open.isFetching && !open.isFetchingNextPage ? COPY.refreshing : COPY.refresh}
          </button>
        }
      />

      <RecordList<GranotLifecycleCaseListItem>
        items={items}
        keyOf={(item) => item.case_id}
        renderItem={(item) => <ToFinishCard item={item} active={item.case_id === caseId} onOpen={(row) => update({ case: row.case_id })} />}
        loading={open.isPending}
        error={open.error}
        onRetry={() => void open.refetch()}
        canFetchMore={canFetchMore}
        fetchingMore={open.isFetchingNextPage}
        sentinelRef={sentinelRef}
        density="comfortable"
        copy={{ loadFailed: COPY.loadFailed, loadMore: COPY.loadMore, allLoaded: COPY.allLoaded, empty: COPY.empty, emptyHint: COPY.emptyHint }}
        emptyTestId="to-finish-empty"
        stackTestId="to-finish-stack"
      />

      <FinishedToday activeCaseId={caseId} onOpen={(id) => update({ case: id })} />

      {caseId ? <FinishBookingSheet key={caseId} caseId={caseId} onClose={() => update({ case: null })} /> : null}
    </div>
  );
}

function FinishedToday({ activeCaseId, onOpen }: { activeCaseId: string | null; onOpen: (caseId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const resolved = useQuery({
    queryKey: queryKeys.granotLifecycle.cases({ ...TO_FINISH_RESOLVED_FILTERS, view: "to-finish-resolved" }),
    queryFn: () => fetchGranotLifecycleCases(TO_FINISH_RESOLVED_FILTERS),
  });
  const today = finishedToday(resolved.data?.items ?? []);
  return (
    <section className="tf-finished" data-testid="to-finish-finished-today">
      <button type="button" className="crm-button crm-button--quiet" style={{ minHeight: 44 }} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        {COPY.finishedToday(today.length)} {expanded ? "▴" : "▾"}
      </button>
      {expanded ? (
        <div className="crm-stack">
          {resolved.isError ? <ReadFailure what={COPY.finishedTodayFailed} error={resolved.error} onRetry={() => void resolved.refetch()} /> : null}
          {resolved.isSuccess && today.length === 0 ? <p className="crm-subtitle">{COPY.finishedTodayEmpty}</p> : null}
          {today.map((item) => (
            <article
              key={item.case_id}
              className="crm-card crm-record crm-card--clickable"
              data-testid="finished-today-card"
              tabIndex={0}
              data-selected={item.case_id === activeCaseId ? "true" : undefined}
              onClick={() => onOpen(item.case_id)}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onOpen(item.case_id);
                }
              }}
            >
              <IconBadge icon={CircleCheck} tone="green" />
              <div className="crm-record__body">
                <div className="crm-record__line crm-record__line--top">
                  <span className="crm-record__name">{item.job_no}</span>
                  <span>{item.customer_label}</span>
                  <span className="crm-record__source">{item.source.label ?? ""}</span>
                </div>
                <div className="crm-record__line">{item.resolved_at ? `Finished ${formatRelative(item.resolved_at)}` : null}</div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
