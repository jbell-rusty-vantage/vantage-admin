"use client";
/**
 * UI1-DESK (UI-1 §1.1, §3.4, final spec §5.7–5.8): the Needs Attention and All Outreach lists.
 *
 * - Attention order groups the cards under band headers (`{n} · {band name}`, count); a band with no rows isn't
 *   shown. Any other sort is flat, with the `Band {n} · {name}` tag on line 1.
 * - Under any sort except Attention order and Lead received the card shows `{Sort label}: {value}` from
 *   `sort_keys`, or the sort's null label.
 * - Keyset `Load more` on `cursor`; `total_items` is the server count; a failed `Load more` keeps what's shown.
 * - A live republish that reorders the list waits behind `Updated list available · Show` (UI1-LIVE).
 * - A card opens the full Outreach page; old query links are resolved by the desk.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useIsRep } from "../rep/viewer";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AttentionRow } from "@/lib/api/salesIntelligence";
import { OutreachCard } from "../card";
import { OutcomeLine } from "../card/outcome-line";
import { MessageRepPanel, useMessageRepAvailability } from "../composer";
import { UpdatedListPill, attentionListShape, useListRefresh, useReportAsOf } from "../data/live";
import { siKeys } from "../data/query-keys";
import { attentionQuery, type AttentionParams, type DeskView } from "../data/requests";
import { useAttentionList } from "../data/use-attention";
import { type DeskUrlPatch, type DeskUrlState } from "../data/url-state";
import { BandBadge, CardShellSkeleton, Region, RegionProgress, type BandNumber } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { formatDate, formatRelative, formatTimeOnly } from "../lib/time";
import { cx } from "../lib/format";
import { StaleBanner } from "./stale-banner";
import { saveReturnMemory, takeReturnMemory, totalReturnPages, totalReturnRows } from "./return-memory";

const d = copy.ui1.desk;
export const LIST_HEADING_ID = "si-desk-list";

/* ───────── pure helpers ───────── */

type SortLineValue = { label: string; value: string | null; nullLabel: string };

/** `{Sort label}: {value}` for a row, or null when the sort shows no line (Attention order, Lead received, Closed). */
export function sortLineFor(row: AttentionRow, sort: string, asOf: string): SortLineValue | null {
  if (sort === "attention" || sort === "lead_received") return null;
  const words = (copy.ui1.data.sorts as Record<string, { label: string; null: string | null }>)[sort];
  if (!words) return null;
  const keys = (row.sort_keys ?? {}) as Record<string, unknown>;
  const raw = keys[sort];
  const nullLabel = words.null ?? "";
  if (raw == null) return { label: words.label, value: null, nullLabel };
  if (sort === "transaction_intent" || sort === "move_likelihood") {
    const a = row.outreach?.move_assessment;
    const level = sort === "transaction_intent" ? a?.transaction_intent_level_label : a?.move_likelihood_level_label;
    return { label: words.label, value: level ? `${raw} / 100 · ${level}` : `${raw} / 100`, nullLabel };
  }
  if (sort === "move_date") return { label: words.label, value: formatDate(String(raw), asOf), nullLabel };
  if (typeof raw === "number") return { label: words.label, value: raw.toLocaleString("en-US"), nullLabel };
  return { label: words.label, value: formatRelative(String(raw), asOf), nullLabel };
}

export type BandGroup = { key: string; band: BandNumber | null; review: boolean; rows: AttentionRow[] };

/** Consecutive rows under one band header (the server's Attention order already sorts by band). */
export function groupByBand(rows: readonly AttentionRow[]): BandGroup[] {
  const groups: BandGroup[] = [];
  for (const row of rows) {
    const band = (row.derived.attention_band ?? null) as BandNumber | null;
    const review = band == null && (!row.outreach || !!row.filter_keys?.needs_review);
    const key = band != null ? `band-${band}` : review ? "review" : "none";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, band, review, rows: [row] });
  }
  return groups;
}

export function emptyText(view: DeskView, q: string | null): string {
  if (q) return d.empty.search(q);
  return view === "attention" ? d.empty.attention : view === "closed" ? d.empty.closed : d.empty.allOutreach;
}

export function resultsText(total: number | null, q: string | null): string | null {
  if (total == null) return null;
  return q ? d.search.results(total, q) : d.results(total);
}

/* ───────── pure view ───────── */

export type RenderCard = (row: AttentionRow, layout: "grouped" | "flat") => ReactNode;

export type ListViewProps = {
  view: DeskView;
  rows: readonly AttentionRow[];
  asOf: string;
  sort: string;
  q: string | null;
  totalItems: number | null;
  emptyOverride?: string;
  stale: boolean;
  hasMore: boolean;
  loadingMore?: boolean;
  loadMoreFailed?: boolean;
  onLoadMore?: () => void;
  renderCard?: RenderCard;
  /** Rendered above the rows (the Updated list pill). */
  top?: ReactNode;
  /** Rendered after the rows (Closed: the history row). */
  end?: ReactNode;
};

function defaultCard(view: DeskView, sort: string, asOf: string): RenderCard {
  return function renderDefaultCard(row, layout) {
    return (
      <OutreachCard
        row={row}
        asOf={asOf}
        layout={layout}
        view={view}
        sortLine={sortLineFor(row, sort, asOf)}
        line6Override={row.outcome ? <OutcomeLine outcome={row.outcome} asOf={asOf} receivedAt={row.outreach?.trigger_at ?? null} /> : undefined}
      />
    );
  };
}

/** Scrolls the list heading to the top (instant under reduced motion) and focuses it (`tabIndex={-1}`). */
export function focusListHeading(heading: HTMLElement | null = typeof document === "undefined" ? null : document.getElementById(LIST_HEADING_ID)) {
  if (!heading) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  heading.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

/**
 * FIX-UI1 (A10/m4): a metric tile that changes view asks for the focus before the new view's list exists; the
 * request is served when that view's heading mounts (its ref), after layout, so focus never drops to `<body>` and
 * the heading scrolls into view at 390 px too.
 */
let listFocusRequested = false;
export function requestListHeadingFocus() {
  listFocusRequested = true;
}
function onHeadingMount(heading: HTMLHeadingElement | null) {
  if (!heading || !listFocusRequested) return;
  listFocusRequested = false;
  requestAnimationFrame(() => focusListHeading(heading));
}

export function ListHeading({ view, count }: { view: DeskView; count: string | null }) {
  // UI2-SHELL: a rep's list heading is its view name (My Outreach, Closed).
  const rep = useIsRep();
  return (
    <div className="si-desk__listhead">
      <h2 ref={onHeadingMount} id={LIST_HEADING_ID} className="si-desk__listheading" tabIndex={-1}>{rep ? copy.ui2.shell.views[view] : d.listHeading[view]}</h2>
      {rep && copy.ui2.shell.viewIntro[view] && <p className="si-text--sm si-text--subtle" data-view-intro>{copy.ui2.shell.viewIntro[view]}</p>}
      {count && <span className="si-desk__count" data-results>{count}</span>}
    </div>
  );
}

export function LoadMore({ hasMore, loading, failed, onLoadMore, label = d.loadMore }: { hasMore: boolean; loading?: boolean; failed?: boolean; onLoadMore?: () => void; label?: string }) {
  if (!hasMore) return null;
  return (
    <div className="si-desk__more">
      {failed && <p className="si-desk__morefailed" role="status">{d.loadMoreFailed}</p>}
      <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit" disabled={loading} aria-busy={loading || undefined} onClick={onLoadMore}>
        {label}
      </button>
    </div>
  );
}

export function OutreachListView({ view, rows, asOf, sort, q, totalItems, emptyOverride, stale, hasMore, loadingMore, loadMoreFailed, onLoadMore, renderCard, top, end }: ListViewProps) {
  const card = renderCard ?? defaultCard(view, sort, asOf);
  const grouped = view !== "closed" && sort === "attention";
  return (
    <div className="si-desk__listbody" data-layout={grouped ? "grouped" : "flat"} data-view={view}>
      {stale && <StaleBanner asOf={asOf} />}
      <ListHeading view={view} count={resultsText(totalItems, q)} />
      {totalItems != null && <p className="si-desk__asof">as of {formatTimeOnly(asOf)}</p>}
      {top}
      {rows.length === 0 ? (
        <p className="si-desk__empty" data-empty>{emptyOverride ?? emptyText(view, q)}</p>
      ) : grouped ? (
        groupByBand(rows).map((group, index) => (
          <section key={`${group.key}-${index}`} className="si-desk__group" data-band={group.band ?? group.key}>
            <BandBadge band={group.band} variant={group.review ? "needs_review" : "header"} count={group.rows.length} />
            {group.review && <span className="si-desk__groupcount">{group.rows.length.toLocaleString("en-US")}</span>}
            <ol className="si-desk__cards">
              {group.rows.map((row) => <li key={row.subject_key}>{card(row, "grouped")}</li>)}
            </ol>
          </section>
        ))
      ) : (
        <ol className="si-desk__cards">
          {rows.map((row) => <li key={row.subject_key}>{card(row, view === "closed" ? "grouped" : "flat")}</li>)}
        </ol>
      )}
      <LoadMore hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={onLoadMore} />
      {end}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="si-desk__listbody is-skeleton">
      <span className="si-skeleton si-skeleton--line" style={{ width: 180 }} />
      <ol className="si-desk__cards">
        {[0, 1, 2].map((i) => <li key={i}><CardShellSkeleton /></li>)}
      </ol>
    </div>
  );
}
OutreachListView.Skeleton = ListSkeleton;

/* ───────── connected ───────── */

/** A card with the Message rep rule from the nudge destinations (UI1-CHAT). */
function DeskCard({ row, layout, view, sort, asOf, returnTo, onNavigate, onMessage, selectedFollowup }: {
  row: AttentionRow; layout: "grouped" | "flat"; view: DeskView; sort: string; asOf: string; returnTo: string;
  onNavigate: (row: AttentionRow) => void; onMessage: (row: AttentionRow) => void;
  selectedFollowup?: { id: string; name: string } | null;
}) {
  const { disabledReason } = useMessageRepAvailability(row.outreach);
  return (
    <OutreachCard
      row={row}
      asOf={asOf}
      layout={layout}
      view={view}
      sortLine={sortLineFor(row, sort, asOf)}
      returnTo={returnTo}
      onNavigate={row.outreach ? onNavigate : undefined}
      onMessageRep={onMessage}
      messageRepDisabledReason={disabledReason}
      selectedFollowup={selectedFollowup}
      line6Override={row.outcome ? <OutcomeLine outcome={row.outcome} asOf={asOf} receivedAt={row.outreach?.trigger_at ?? null} returnTo={returnTo} /> : undefined}
    />
  );
}

export type OutreachListProps = {
  view: Exclude<DeskView, "closed">;
  params: AttentionParams;
  state: DeskUrlState;
  update: (patch: DeskUrlPatch) => void;
  pending: boolean;
  returnTo: string;
  selectedFollowupName?: string;
};

export function OutreachList({ view, params, state, pending, returnTo, selectedFollowupName }: OutreachListProps) {
  const client = useQueryClient();
  const list = useAttentionList(params);
  useReportAsOf(list.asOf);
  const requestKey = attentionQuery(params).toString();
  const [resetForKey, setResetForKey] = useState<string | null>(null);
  const resetToFirst = resetForKey === requestKey;
  const pendingProjection = list.status === "pending_projection" && list.data.pages[0]?.data.pending_reason === "snapshot_missing_query_keys";
  const refreshData = useMemo(() => resetToFirst ? { ...list.data, pages: list.data.pages.slice(0, 1), pageParams: list.data.pageParams.slice(0, 1) } : list.data, [list.data, resetToFirst]);
  const refresh = useListRefresh(refreshData, { key: `${requestKey}|${pendingProjection ? "pending" : resetToFirst ? "return-first" : "normal"}`, shape: attentionListShape, hold: pendingProjection });
  const [messaging, setMessaging] = useState<AttentionRow | null>(null);
  const [missingNotice, setMissingNotice] = useState(false);
  const { shown, pending: refreshPending, apply: applyRefresh } = refresh;
  const first = shown.pages[0]!;
  const rows = shown.pages.flatMap((page) => page.data.items);
  const asOf = first.as_of;
  const sort = params.sort ?? "attention";
  const restore = useRef<ReturnType<typeof takeReturnMemory> | undefined>(undefined);
  useEffect(() => {
    if (restore.current === undefined) restore.current = takeReturnMemory(returnTo);
    const memory = restore.current;
    if (!memory) return;
    if (pendingProjection) return;
    if (totalReturnPages(memory) > 4 || totalReturnRows(memory) > 200) {
      client.setQueryData(siKeys.attention(params), { ...list.data, pages: list.data.pages.slice(0, 1), pageParams: list.data.pageParams.slice(0, 1) });
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
    const scroll = document.querySelector<HTMLElement>(".si-desk__content");
    const card = [...document.querySelectorAll<HTMLElement>(".si-outreachcard")].find((el) => el.dataset.outreachId === memory.outreachId);
    if (card) {
      if (scroll) scroll.scrollTop = memory.scrollTop;
      const link = card.querySelector<HTMLElement>(".si-cardshell__hit");
      link?.focus({ preventScroll: true });
      card.classList.add("is-return-focus");
      window.setTimeout(() => card.classList.remove("is-return-focus"), 1500);
    } else setMissingNotice(true);
    restore.current = null;
  }, [shown.pages.length, list, client, params, returnTo, refreshPending, applyRefresh, requestKey, pendingProjection]);
  const onNavigate = (row: AttentionRow) => {
    if (!row.outreach) return;
    saveReturnMemory(returnTo, { scrollTop: document.querySelector<HTMLElement>(".si-desk__content")?.scrollTop ?? 0, outreachId: row.outreach.id, pagesLoaded: shown.pages.length, rowsLoaded: rows.length });
  };
  return (
    <>
      <RegionProgress active={pending || (list.isFetching && !list.isFetchingNextPage)} />
      <OutreachListView
        view={view}
        rows={rows}
        asOf={asOf}
        sort={pendingProjection && refresh.held ? first.data.sort ?? sort : sort}
        q={params.q ?? null}
        totalItems={pendingProjection ? null : first.data.total_items}
        emptyOverride={pendingProjection ? "Results are not available until the next publish." : undefined}
        stale={first.data.stale ?? false}
        hasMore={!pendingProjection && !refreshPending && list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        loadMoreFailed={list.isFetchNextPageError}
        onLoadMore={() => { setResetForKey(null); void list.fetchNextPage(); }}
        top={<>{pendingProjection && <p role="status" className="si-desk__notice">{refresh.held ? "New filters are awaiting the next publish. Showing previous results; these rows and their count are not results for the current filters." : "These filters are awaiting the next publish. Results are not available yet."}</p>}{missingNotice && <p role="status">{copy.oi.card.noLongerMatches}</p>}{refreshPending && <UpdatedListPill onShow={applyRefresh} />}</>}
        renderCard={(row, layout) => (
          <DeskCard row={row} layout={layout} view={view} sort={sort} asOf={asOf} returnTo={returnTo} onNavigate={onNavigate} onMessage={setMessaging} selectedFollowup={state.view === "rep" && state.relationship === "followup" && state.agent ? { id: state.agent, name: selectedFollowupName ?? "Selected rep" } : null} />
        )}
      />
      {messaging?.outreach && <MessageRepPanel key={messaging.outreach.id} outreach={messaging.outreach} asOf={asOf} mode="panel" onClose={() => setMessaging(null)} />}
    </>
  );
}

export function OutreachListRegion(props: OutreachListProps & { regionKey: string }) {
  const client = useQueryClient();
  const { regionKey, ...rest } = props;
  return (
    <Region key={regionKey} name={`list-${props.view}`} className={cx("si-desk__list")} skeleton={<ListSkeleton />} onRetry={() => void client.resetQueries({ queryKey: siKeys.attention(props.params) })}>
      <OutreachList {...rest} />
    </Region>
  );
}
