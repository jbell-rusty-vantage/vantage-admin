"use client";
/**
 * UI1-CLOSED (UI-1 §3.5, final spec §8, addendum §2.2–2.2a): the Closed view and Closed history.
 *
 * - `GET /attention?view=closed`, flat, sorts `Closed` (default, newest first) · `Lead received` · `Time to close`.
 *   Line 6 is the outcome line (`OutcomeLine`); actions reduce to `Open` (the card's closed rule).
 * - When the 90-day partition runs out (`cursor: null`) the list ends with `Older than 90 days · Load closed history`.
 *   Pressing it pages `GET /outreach/closed-history` with the same filters (`outcome`, `priority`, `agent_id`,
 *   `closed_from`, `q`) and `closed_before` = the partition's edge (`as_of − 90 d`, or `closed_to` when earlier),
 *   so no row repeats. Each history row uses the same outcome line.
 * - Under `q` the server scans in bounded batches and may answer a short or empty page **with** a cursor: the
 *   history follows a non-null cursor (a few pages on its own, then `Load more closed history`) and ends only on
 *   `cursor: null`, with `Closed Outreach is kept for {days} days` or `That's every closed record we still have.`
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CLOSED_DEFAULT_SORT, type AttentionRow } from "@/lib/api/salesIntelligence";
import { OutreachCard } from "../card";
import { OutcomeLine } from "../card/outcome-line";
import { UpdatedListPill, attentionListShape, useListRefresh, useReportAsOf } from "../data/live";
import { siKeys } from "../data/query-keys";
import { CLOSED_HISTORY_PAGE_SIZE, attentionQuery, type AttentionParams, type ClosedHistoryParams } from "../data/requests";
import { useAttentionList } from "../data/use-attention";
import { useClosedHistory } from "../data/use-closed-history";
import type { DeskUrlPatch, DeskUrlState } from "../data/url-state";
import { CardShellSkeleton, Region, RegionProgress } from "../primitives";
import { CLOSED_WINDOWS, windowFrom } from "../rail";
import { copy } from "../sales-intelligence-copy";
import { LoadMore, OutreachListView } from "./outreach-list";
import { saveReturnMemory, takeReturnMemory, totalReturnPages, totalReturnRows, type ReturnMemory } from "./return-memory";

const k = copy.ui1.closed;
/** How many short pages the history follows on its own under `q` before asking (S11-SEARCH bounded scan). */
export const HISTORY_AUTO_PAGES = 3;
const PARTITION_MS = CLOSED_WINDOWS["90d"];

/** A closed row's card: the outcome line on line 6, `Open` only. */
export function ClosedCard({ row, asOf, returnTo, onOpen }: { row: AttentionRow; asOf: string; returnTo?: string | null; onOpen?: (row: AttentionRow) => void }) {
  return (
    <OutreachCard
      row={row}
      asOf={asOf}
      layout="grouped"
      view="closed"
      returnTo={returnTo ?? undefined}
      onNavigate={row.outreach && onOpen ? onOpen : undefined}
      line6Override={row.outcome ? <OutcomeLine outcome={row.outcome} asOf={asOf} receivedAt={row.outreach?.trigger_at ?? null} returnTo={returnTo} /> : undefined}
    />
  );
}

/** Closed history's `closed_before`: the partition's edge, or the Owner's `closed_to` when that is earlier. */
export function historyClosedBefore(asOf: string, closedTo: string | null | undefined): string | null {
  const edge = windowFrom(asOf, PARTITION_MS);
  if (!closedTo) return edge;
  if (!edge) return closedTo;
  return Date.parse(closedTo) < Date.parse(edge) ? closedTo : edge;
}

export function historyParams(base: ClosedHistoryParams, asOf: string, closedTo: string | null | undefined): ClosedHistoryParams {
  return { ...base, closed_before: historyClosedBefore(asOf, closedTo) };
}

/** The end row of the 90-day partition. */
export function HistoryRow({ onLoad }: { onLoad: () => void }) {
  return (
    <div className="si-closed__historyrow" data-history-row>
      <span className="si-closed__historylabel">{k.historyRow}</span>
      <span aria-hidden>{k.sep.trim()}</span>
      <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit" onClick={onLoad}>{k.loadHistory}</button>
    </div>
  );
}

/**
 * What ends the Closed list: nothing while the 90-day partition has a next page (or a live update is waiting),
 * then the `Older than 90 days · Load closed history` row, then Closed history once the Owner opens it.
 */
export function closedListEnd({ cursor, pending, historyOpen }: { cursor: string | null | undefined; pending: boolean; historyOpen: boolean }): "row" | "history" | null {
  if (pending || cursor) return null;
  return historyOpen ? "history" : "row";
}

/** The end of Closed history (`cursor: null`). */
export function historyEndText(retentionDays: number | null | undefined): string {
  return retentionDays != null ? k.retention(retentionDays) : k.historyEnd;
}

export function ClosedHistoryView({ rows, asOf, hasMore, loadingMore, loadMoreFailed, onLoadMore, retentionDays, renderCard }: {
  rows: readonly AttentionRow[]; asOf: string; hasMore: boolean; loadingMore?: boolean; loadMoreFailed?: boolean; onLoadMore?: () => void;
  retentionDays: number | null | undefined; renderCard?: (row: AttentionRow) => ReactNode;
}) {
  const headingId = useId();
  const card = renderCard ?? ((row: AttentionRow) => <ClosedCard row={row} asOf={asOf} />);
  return (
    <section className="si-closed__history" aria-labelledby={headingId} data-history>
      <h3 id={headingId} className="si-closed__historyheading">{k.historyRow}</h3>
      {rows.length > 0 && (
        <ol className="si-desk__cards">
          {rows.map((row) => <li key={row.subject_key}>{card(row)}</li>)}
        </ol>
      )}
      {hasMore ? (
        <LoadMore hasMore loading={loadingMore} failed={loadMoreFailed} onLoadMore={onLoadMore} label={k.loadMoreHistory} />
      ) : (
        <p className="si-closed__historyend" data-history-end>{historyEndText(retentionDays)}</p>
      )}
    </section>
  );
}

function HistorySkeleton() {
  return (
    <ol className="si-desk__cards" aria-hidden>
      {[0, 1].map((i) => <li key={i}><CardShellSkeleton actions={false} /></li>)}
    </ol>
  );
}

function ClosedHistory({ params, returnTo, onOpen, restore, onRestored }: {
  params: ClosedHistoryParams; returnTo: string; onOpen: (row: AttentionRow, historyPages: number, historyRows: number) => void;
  restore?: ReturnMemory | null; onRestored?: (found: boolean) => void;
}) {
  const client = useQueryClient();
  const history = useClosedHistory(params);
  useReportAsOf(history.asOf);
  const pages = history.data.pages;
  const last = pages[pages.length - 1]!;
  const limit = params.limit ?? CLOSED_HISTORY_PAGE_SIZE;
  const auto = useRef(0);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = history;
  useEffect(() => {
    if (!restore?.history) return;
    if (pages.length > restore.history.pagesLoaded) {
      client.setQueryData(siKeys.closedHistory(params), { ...history.data, pages: pages.slice(0, restore.history.pagesLoaded), pageParams: history.data.pageParams.slice(0, restore.history.pagesLoaded) });
      return;
    }
    if (pages.length < restore.history.pagesLoaded) {
      if (isFetchingNextPage) return;
      if (hasNextPage) { void fetchNextPage(); return; }
    }
    if (history.isFetching) return;
    const card = [...document.querySelectorAll<HTMLElement>(".si-closed__history .si-outreachcard")].find((el) => el.dataset.outreachId === restore.outreachId);
    if (card) {
      const scroll = document.querySelector<HTMLElement>(".si-desk__content");
      if (scroll) scroll.scrollTop = restore.scrollTop;
      card.querySelector<HTMLElement>(".si-cardshell__hit")?.focus({ preventScroll: true });
      card.classList.add("is-return-focus");
      window.setTimeout(() => card.classList.remove("is-return-focus"), 1500);
    }
    onRestored?.(!!card);
  }, [restore, pages, isFetchingNextPage, hasNextPage, fetchNextPage, history, client, params, onRestored]);
  // Bounded scan under `q`: a short page with a cursor means "keep going". Follow it a few times on its own.
  useEffect(() => {
    if (restore?.history) return;
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    if (last.data.items.length >= limit || auto.current >= HISTORY_AUTO_PAGES) return;
    auto.current += 1;
    void fetchNextPage();
  }, [restore, hasNextPage, isFetchingNextPage, isFetchNextPageError, last, limit, fetchNextPage]);
  return (
    <ClosedHistoryView
      rows={history.items}
      asOf={history.asOf}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
      loadMoreFailed={isFetchNextPageError}
      onLoadMore={() => {
        auto.current = 0;
        void fetchNextPage();
      }}
      retentionDays={history.retention.days}
      renderCard={(row) => <ClosedCard row={row} asOf={history.asOf} returnTo={returnTo} onOpen={() => onOpen(row, pages.length, history.items.length)} />}
    />
  );
}

export type ClosedListProps = {
  params: AttentionParams;
  history: ClosedHistoryParams;
  state: DeskUrlState;
  update: (patch: DeskUrlPatch) => void;
  pending: boolean;
  returnTo: string;
};

export function ClosedList({ params, history, state, pending, returnTo }: ClosedListProps) {
  const client = useQueryClient();
  const list = useAttentionList(params);
  useReportAsOf(list.asOf);
  const requestKey = attentionQuery(params).toString();
  const [resetForKey, setResetForKey] = useState<string | null>(null);
  const resetToFirst = resetForKey === requestKey;
  const pendingProjection = list.status === "pending_projection" && list.data.pages[0]?.data.pending_reason === "snapshot_missing_query_keys";
  const refreshData = useMemo(() => resetToFirst ? { ...list.data, pages: list.data.pages.slice(0, 1), pageParams: list.data.pageParams.slice(0, 1) } : list.data, [list.data, resetToFirst]);
  const refresh = useListRefresh(refreshData, { key: `${requestKey}|${pendingProjection ? "pending" : resetToFirst ? "return-first" : "normal"}`, shape: attentionListShape, hold: pendingProjection });
  const { shown, pending: refreshPending, apply: applyRefresh } = refresh;
  const first = shown.pages[0]!;
  const rows = shown.pages.flatMap((page) => page.data.items);
  const asOf = first.as_of;
  const [opened, setOpened] = useState<{ key: string; params: ClosedHistoryParams; restore?: ReturnMemory | null } | null>(null);
  const hp = opened?.key === requestKey ? opened.params : null;
  const restore = useRef<ReturnType<typeof takeReturnMemory> | undefined>(undefined);
  const [missingNotice, setMissingNotice] = useState(false);
  useEffect(() => {
    if (restore.current === undefined) restore.current = takeReturnMemory(returnTo);
    const memory = restore.current;
    if (!memory) return;
    if (pendingProjection) return;
    if (totalReturnPages(memory) > 4 || totalReturnRows(memory) > 200) {
      client.setQueryData(siKeys.attention(params), { ...list.data, pages: list.data.pages.slice(0, 1), pageParams: list.data.pageParams.slice(0, 1) });
      if (memory.history) client.removeQueries({ queryKey: siKeys.closedHistory(memory.history.params), exact: true });
      requestAnimationFrame(() => setResetForKey(requestKey));
      document.querySelector<HTMLElement>(".si-desk__content")?.scrollTo(0, 0);
      restore.current = null;
      return;
    }
    if (shown.pages.length < memory.pagesLoaded) {
      if (list.isFetchingNextPage) return;
      if (list.hasNextPage) { void list.fetchNextPage(); return; }
    }
    if (list.isFetching) return;
    if (refreshPending) { applyRefresh(); return; }
    if (memory.history) {
      if (list.hasNextPage) { restore.current = null; requestAnimationFrame(() => setMissingNotice(true)); return; }
      if (!hp) {
        restore.current = null;
        requestAnimationFrame(() => setOpened({ key: requestKey, params: memory.history!.params, restore: memory }));
      }
      return;
    }
    const card = [...document.querySelectorAll<HTMLElement>(".si-outreachcard")].find((el) => el.dataset.outreachId === memory.outreachId);
    if (card) {
      const scroll = document.querySelector<HTMLElement>(".si-desk__content");
      if (scroll) scroll.scrollTop = memory.scrollTop;
      card.querySelector<HTMLElement>(".si-cardshell__hit")?.focus({ preventScroll: true });
      card.classList.add("is-return-focus");
      window.setTimeout(() => card.classList.remove("is-return-focus"), 1500);
    } else requestAnimationFrame(() => setMissingNotice(true));
    restore.current = null;
  }, [shown.pages.length, list, client, params, returnTo, refreshPending, applyRefresh, hp, requestKey, pendingProjection]);
  // History stays open only for the request it was opened for; any control change closes it again. Its
  // `closed_before` is fixed when it opens, so a live republish (a new `as_of`) doesn't restart it.
  const ending = pendingProjection ? null : closedListEnd({ cursor: list.hasNextPage ? "more" : null, pending: refreshPending, historyOpen: !!hp });
  const onOpen = (row: AttentionRow, historyPages?: number, historyRows?: number) => row.outreach && saveReturnMemory(returnTo, {
    scrollTop: document.querySelector<HTMLElement>(".si-desk__content")?.scrollTop ?? 0,
    outreachId: row.outreach.id,
    pagesLoaded: shown.pages.length,
    rowsLoaded: rows.length,
    ...(historyPages && historyRows && hp ? { history: { pagesLoaded: historyPages, rowsLoaded: historyRows, params: hp } } : {}),
  });
  let end: ReactNode = null;
  if (ending) {
    end = ending === "history" && hp ? (
      <Region name="closed-history" skeleton={<HistorySkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.closedHistory(hp) })}>
        <ClosedHistory params={hp} returnTo={returnTo} onOpen={onOpen} restore={opened?.restore} onRestored={(found) => {
          if (!found) setMissingNotice(true);
          restore.current = null;
          setOpened((current) => current ? { ...current, restore: null } : current);
        }} />
      </Region>
    ) : (
      <HistoryRow onLoad={() => setOpened({ key: requestKey, params: historyParams(history, asOf, state.closed_to) })} />
    );
  }
  return (
    <>
      <RegionProgress active={pending || (list.isFetching && !list.isFetchingNextPage)} />
      <OutreachListView
        view="closed"
        rows={rows}
        asOf={asOf}
        sort={params.sort ?? CLOSED_DEFAULT_SORT}
        q={params.q ?? null}
        totalItems={pendingProjection ? null : first.data.total_items}
        emptyOverride={pendingProjection ? "Results are not available until the next publish." : undefined}
        stale={first.data.stale ?? false}
        hasMore={!pendingProjection && !refreshPending && list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        loadMoreFailed={list.isFetchNextPageError}
        onLoadMore={() => { setResetForKey(null); void list.fetchNextPage(); }}
        top={<>{pendingProjection && <p role="status" className="si-desk__notice">{refresh.held ? "New filters are awaiting the next publish. Showing previous results; these rows and their count are not results for the current filters." : "These filters are awaiting the next publish. Results are not available yet."}</p>}{missingNotice && <p role="status">{copy.oi.card.noLongerMatches}</p>}{refreshPending && <UpdatedListPill onShow={applyRefresh} />}</>}
        renderCard={(row) => <ClosedCard row={row} asOf={asOf} returnTo={returnTo} onOpen={onOpen} />}
        end={end}
      />
    </>
  );
}

export function ClosedListRegion(props: ClosedListProps & { regionKey: string }) {
  const client = useQueryClient();
  const { regionKey, ...rest } = props;
  return (
    <Region key={regionKey} name="list-closed" className="si-desk__list" skeleton={<OutreachListView.Skeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.attention(props.params) })}>
      <ClosedList {...rest} />
    </Region>
  );
}
