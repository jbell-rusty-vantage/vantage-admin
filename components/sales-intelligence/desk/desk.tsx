"use client";
/**
 * UI1-DESK (UI-1 §1, §3): the Sales Intelligence page. The route (`app/(dashboard)/sales-intelligence/page.tsx`)
 * checks the Owner, redirects old panel links (`legacyDeepLinkRedirect`) and mounts `<Desk userId={admin.id}/>`.
 *
 * Frame: the page header (title, search, live indicator + Refresh) and the view bar, then the view's body.
 * Above Needs Attention, All Outreach and Closed, in order: the preset bar, the metrics strip (Needs Attention and
 * All Outreach only), the active filter chips + `Clear filters`, then the list (the stale banner is the list's
 * first line). The Overview mounts its own header with the preset bar (UI1-OVERVIEW), so the desk doesn't repeat it.
 * Desktop: rail left (sticky), list right. Below 768 px: the `Filters (n)` sheet button and full-width cards.
 *
 * Every region (preset counts, metrics, rail, chips, list) is its own Suspense + error boundary. Filter, sort
 * and view changes go through the URL inside a transition, so old data stays with the 2 px progress bar.
 */
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { CoverageView } from "../coverage-view";
import { GuideView } from "../guide-view";
import { Reps } from "../reps";
import { useNewestAsOf } from "../data/live";
import { currentSalesIntelligenceHref } from "../lib/official-record";
import { rememberDeskHref } from "../outreach/deep-links";
import { siKeys } from "../data/query-keys";
import { attentionParamsFromDesk, closedHistoryParamsFromDesk, isDeskView, type DeskUrlPatch, type DeskUrlState, type PageView } from "../data/url-state";
import type { AttentionParams, DeskView } from "../data/requests";
import { useAttentionList } from "../data/use-attention";
import { useDeskUrlState } from "../data/use-url-state";
import { useReps } from "../data/use-reps";
import { CardShellSkeleton, DelayedSkeleton, Region, SkeletonBlock, SkeletonLines } from "../primitives";
import { FilterRail, FilterSheet, activeFilterChips, clearAll, closedRegions, outreachRegions, type RailRep } from "../rail";
import { PresetBar, usePresetSelection } from "./preset-bar";
import { ActiveChips } from "./active-chips";
import { ClosedListRegion } from "./closed-list";
import { NO_DEGRADE, applyDegrade, applyHistoryDegrade, degradeNotices, nextDegrade, useQueryError, type Degrade } from "./degrade";
import { ListControls } from "./list-controls";
import { MetricsStrip, type MetricTile } from "./metrics-strip";
import { LIST_HEADING_ID, OutreachListRegion, focusListHeading, requestListHeadingFocus } from "./outreach-list";
import { PageHeader } from "./page-header";
import { ViewTabs } from "./view-tabs";
import { copy } from "../sales-intelligence-copy";
import "../styles/sales-intelligence.css";

export type DeskProps = {
  /** The signed-in admin's id: the Priority preset is remembered per user. */
  userId?: string | null;
  /** Other stages' view bodies (UI1-OVERVIEW, UI1-COVER). Defaults: the kept Coverage / Guide / RingCentral Accounts. */
  overview?: ReactNode;
  coverage?: ReactNode;
  reps?: ReactNode;
  guide?: ReactNode;
  /** UI1-TL's five-event preview for the side dialog. */
  renderTimelinePreview?: (outreachId: string) => ReactNode;
};

/** The two notices under the list controls when the server refused a search or a sort. */
function Notices({ search, sort }: { search: boolean; sort: boolean }) {
  if (!search && !sort) return null;
  return (
    <div className="si-desk__notices" role="status">
      {search && <p className="si-desk__notice" data-notice="search">{copy.ui1.desk.search.unavailable}</p>}
      {sort && <p className="si-desk__notice" data-notice="sort">{copy.ui1.data.sortUnavailable}</p>}
    </div>
  );
}

function repsOf(links: readonly { agent_id: string; agent_name: string }[]): RailRep[] {
  const seen = new Map<string, string>();
  for (const link of links) if (!seen.has(link.agent_id)) seen.set(link.agent_id, link.agent_name);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function useRailReps(): RailRep[] {
  const { links } = useReps();
  return useMemo(() => repsOf(links), [links]);
}

type RailProps = { view: DeskView; state: DeskUrlState; update: (patch: DeskUrlPatch) => void; asOf: string | null };
const regionsFor = (view: DeskView) => (view === "closed" ? closedRegions() : outreachRegions(view));

function RailArea({ view, state, update, asOf }: RailProps) {
  return <FilterRail regions={regionsFor(view)} value={state} onChange={update} reps={useRailReps()} asOf={asOf} />;
}
function SheetArea({ view, state, update, asOf }: RailProps) {
  return <FilterSheet regions={regionsFor(view)} value={state} onChange={update} reps={useRailReps()} asOf={asOf} />;
}
function ChipsArea({ view, state, update, asOf }: RailProps) {
  const regions = regionsFor(view);
  const chips = activeFilterChips(state, regions, useRailReps(), { onChange: update, asOf });
  return <ActiveChips chips={chips} onClearAll={() => update(clearAll(regions))} />;
}

function PresetArea({ view, params, value, onChange }: { view: DeskView; params: AttentionParams; value: ReturnType<typeof usePresetSelection>["value"]; onChange: (next: ReturnType<typeof usePresetSelection>["value"]) => void }) {
  const list = useAttentionList(params);
  return <PresetBar counts={list.priorityCounts} view={view} value={value} onChange={onChange} />;
}

/** Loose writer for the kept RingCentral Accounts view (it writes its own keys). */
function useLooseUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  return useCallback((values: Record<string, string | boolean | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === undefined || value === false || value === "") next.delete(key);
      else next.set(key, value === true ? "true" : value);
    }
    const text = next.toString();
    startTransition(() => router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false }));
  }, [params, pathname, router]);
}

function DeskList({ view, state, query, update, pending, userId, renderTimelinePreview }: {
  view: DeskView; state: DeskUrlState; query: string; update: (patch: DeskUrlPatch) => void; pending: boolean; userId?: string | null;
  renderTimelinePreview?: (outreachId: string) => ReactNode;
}) {
  const client = useQueryClient();
  const preset = usePresetSelection({ userId });
  const asOf = useNewestAsOf();
  const [degrade, setDegrade] = useState<Degrade>(NO_DEGRADE);
  const requested = attentionParamsFromDesk(state, view);
  const params = applyDegrade(requested, degrade);
  const error = useQueryError(siKeys.attention(params));
  const next = nextDegrade(error, params, degrade);
  // Render-time adjust (no effect): a 400 on `q` or on a sort moves to the degraded params at once.
  if (next !== degrade) setDegrade(next);
  const notices = degradeNotices(requested, degrade);
  const regionKey = `${degrade.qOff ? "q-off" : "q"}|${degrade.badSorts.join(",")}`;
  const returnTo = currentSalesIntelligenceHref(new URLSearchParams(query));
  const reset = (key: readonly unknown[]) => () => void client.resetQueries({ queryKey: key });
  const railProps: RailProps = { view, state, update, asOf };
  const onTile = (tile: MetricTile) => {
    // A view-changing tile remounts the list: the new heading takes the focus when it mounts (FIX-UI1 A10/m4).
    const changesView = !!tile.patch.view && tile.patch.view !== view;
    if (changesView) requestListHeadingFocus();
    update(tile.patch);
    if (!changesView) focusListHeading();
  };
  const busy = pending || preset.isPending;
  return (
    <div className="si-desk__body" data-view={view}>
      <Region key={`preset-${regionKey}`} name="preset-bar" className="si-desk__preset" skeleton={<PresetBar.Skeleton />} onRetry={reset(siKeys.attention(params))}>
        <PresetArea view={view} params={params} value={preset.value} onChange={preset.setValue} />
      </Region>
      {view !== "closed" && (
        <Region key={`metrics-${regionKey}`} name="metrics" className="si-desk__metrics" skeleton={<MetricsStrip.Skeleton />} onRetry={reset(siKeys.attention(params))}>
          <MetricsStrip params={params} onApply={onTile} />
        </Region>
      )}
      <div className="si-desk__grid">
        <Region name="rail" className="si-desk__railregion" skeleton={<FilterRail.Skeleton regions={view === "closed" ? 3 : 5} />} onRetry={reset(siKeys.reps("limit=100"))}>
          <RailArea {...railProps} />
        </Region>
        <section className="si-desk__main" aria-labelledby={LIST_HEADING_ID}>
          <div className="si-desk__toolbar">
            <Region name="rail-sheet" className="si-desk__sheetregion" skeleton={null}>
              <SheetArea {...railProps} />
            </Region>
            <ListControls view={view} sort={params.sort ?? "attention"} direction={params.direction ?? "asc"} freshness={params.freshness === "fresh" ? "fresh" : null} onChange={update} />
          </div>
          <Region name="chips" skeleton={null}>
            <ChipsArea {...railProps} />
          </Region>
          <Notices search={notices.search} sort={notices.sort} />
          {view === "closed" ? (
            <ClosedListRegion
              regionKey={`closed-${regionKey}`}
              params={params}
              history={applyHistoryDegrade(closedHistoryParamsFromDesk(state), degrade)}
              state={state}
              update={update}
              pending={busy}
              returnTo={returnTo}
              renderTimeline={renderTimelinePreview}
            />
          ) : (
            <OutreachListRegion
              regionKey={`${view}-${regionKey}`}
              view={view}
              params={params}
              state={state}
              update={update}
              pending={busy}
              returnTo={returnTo}
              renderTimeline={renderTimelinePreview}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function OtherView({ view, slot }: { view: Exclude<PageView, DeskView>; slot?: ReactNode }) {
  const update = useLooseUpdate();
  const params = useSearchParams();
  if (slot !== undefined) return <Region className="si-desk__other" name={`view-${view}`} skeleton={<SkeletonLines lines={6} />}>{slot}</Region>;
  const body =
    view === "coverage" ? <CoverageView /> :
    view === "guide" ? <GuideView topic={params.get("topic")} /> :
    view === "reps" ? <Reps params={new URLSearchParams(params.toString())} update={update} /> :
    <SkeletonLines lines={6} />;
  return <Region className="si-desk__other" name={`view-${view}`} skeleton={<SkeletonLines lines={6} />}>{body}</Region>;
}

/**
 * The scroll area's visible height as `--si-scroll-h`, so the sticky filter rail's `max-height` fits the part of the
 * page that scrolls (not the whole window, which also holds the app header and the desk header).
 */
function useScrollHeightVar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const write = () => el.style.setProperty("--si-scroll-h", `${el.clientHeight}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function Desk({ userId, overview, coverage, reps, guide, renderTimelinePreview }: DeskProps) {
  const { state, update, isPending, query } = useDeskUrlState();
  const contentRef = useScrollHeightVar();
  // A record's `Back` returns to this view with its filters and sort (not the open side dialog).
  useEffect(() => {
    const kept = new URLSearchParams(query);
    for (const key of ["outreach", "lead", "lead_model"]) kept.delete(key);
    rememberDeskHref(currentSalesIntelligenceHref(kept));
  }, [query]);
  const view = state.view;
  const onSearch = (q: string | null) => update(isDeskView(view) || q === null ? { q } : { view: "all_outreach", q });
  const slots: Record<Exclude<PageView, DeskView>, ReactNode | undefined> = { overview, coverage, reps, guide };
  return (
    <div className="si-root si-desk">
      <header className="si-desk__header">
        <PageHeader q={state.q} onSearch={onSearch} />
        <ViewTabs active={view} query={query} />
      </header>
      <div ref={contentRef} className="si-desk__content">
        {isDeskView(view) ? (
          <DeskList key={view} view={view} state={state} query={query} update={update} pending={isPending} userId={userId} renderTimelinePreview={renderTimelinePreview} />
        ) : (
          <OtherView view={view} slot={slots[view]} />
        )}
      </div>
    </div>
  );
}

/** UI-0 §2.4 route level: the page frame (title, view bar) with skeleton regions; shown after 150 ms. */
export function DeskRouteSkeleton() {
  const d = copy.ui1.desk;
  return (
    <div className="si-root si-desk is-skeleton">
      <header className="si-desk__header">
        <div className="si-desk__titlebar">
          <h1 className="si-desk__title">{copy.page.title}</h1>
        </div>
        <nav className="si-tabs si-routetabs si-desk__views" aria-label={d.viewsLabel}>
          {Object.values(d.views).map((label) => <span key={label} className="si-tab si-routetab">{label}</span>)}
        </nav>
      </header>
      <div className="si-desk__content">
        <DelayedSkeleton>
          <div className="si-desk__body">
            <PresetBar.Skeleton />
            <MetricsStrip.Skeleton />
            <div className="si-desk__grid">
              <FilterRail.Skeleton />
              <div className="si-desk__main">
                <SkeletonBlock height={36} width={240} />
                <ol className="si-desk__cards">
                  {[0, 1, 2].map((i) => <li key={i}><CardShellSkeleton /></li>)}
                </ol>
              </div>
            </div>
          </div>
        </DelayedSkeleton>
      </div>
    </div>
  );
}
