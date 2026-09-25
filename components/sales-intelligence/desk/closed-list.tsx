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
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AttentionRow } from "@/lib/api/salesIntelligence";
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
import { DialogHost, LoadMore, OutreachListView } from "./outreach-list";

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
      onOpen={row.outreach && onOpen ? onOpen : undefined}
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

function ClosedHistory({ params, returnTo, onOpen }: { params: ClosedHistoryParams; returnTo: string; onOpen: (row: AttentionRow) => void }) {
  const history = useClosedHistory(params);
  useReportAsOf(history.asOf);
  const pages = history.data.pages;
  const last = pages[pages.length - 1]!;
  const limit = params.limit ?? CLOSED_HISTORY_PAGE_SIZE;
  const auto = useRef(0);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = history;
  // Bounded scan under `q`: a short page with a cursor means "keep going". Follow it a few times on its own.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return;
    if (last.data.items.length >= limit || auto.current >= HISTORY_AUTO_PAGES) return;
    auto.current += 1;
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, last, limit, fetchNextPage]);
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
      renderCard={(row) => <ClosedCard row={row} asOf={history.asOf} returnTo={returnTo} onOpen={onOpen} />}
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
  renderTimeline?: (outreachId: string) => ReactNode;
};

export function ClosedList({ params, history, state, update, pending, returnTo, renderTimeline }: ClosedListProps) {
  const client = useQueryClient();
  const list = useAttentionList(params);
  useReportAsOf(list.asOf);
  const requestKey = attentionQuery(params).toString();
  const refresh = useListRefresh(list.data, { key: requestKey, shape: attentionListShape });
  const shown = refresh.shown;
  const first = shown.pages[0]!;
  const rows = shown.pages.flatMap((page) => page.data.items);
  const asOf = first.as_of;
  // History stays open only for the request it was opened for; any control change closes it again. Its
  // `closed_before` is fixed when it opens, so a live republish (a new `as_of`) doesn't restart it.
  const [opened, setOpened] = useState<{ key: string; params: ClosedHistoryParams } | null>(null);
  const hp = opened?.key === requestKey ? opened.params : null;
  const ending = closedListEnd({ cursor: list.hasNextPage ? "more" : null, pending: refresh.pending, historyOpen: !!hp });
  const onOpen = (row: AttentionRow) => row.outreach && update({ outreach: row.outreach.id, lead: null, lead_model: null });
  let end: ReactNode = null;
  if (ending) {
    end = ending === "history" && hp ? (
      <Region name="closed-history" skeleton={<HistorySkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.closedHistory(hp) })}>
        <ClosedHistory params={hp} returnTo={returnTo} onOpen={onOpen} />
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
        sort={params.sort ?? "closed"}
        q={params.q ?? null}
        totalItems={first.data.total_items}
        stale={first.data.stale ?? false}
        hasMore={!refresh.pending && list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        loadMoreFailed={list.isFetchNextPageError}
        onLoadMore={() => void list.fetchNextPage()}
        top={refresh.pending ? <UpdatedListPill onShow={refresh.apply} /> : null}
        renderCard={(row) => <ClosedCard row={row} asOf={asOf} returnTo={returnTo} onOpen={onOpen} />}
        end={end}
      />
      <DialogHost state={state} rows={rows} update={update} renderTimeline={renderTimeline} />
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
