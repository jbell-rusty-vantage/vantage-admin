"use client";
/**
 * UI1-DESK (UI-1 §1, §3): the Sales Intelligence page. The route (`app/(dashboard)/sales-intelligence/page.tsx`)
 * checks the Owner, redirects old panel links (`legacyDeepLinkRedirect`) and mounts `<Desk userId={admin.id}/>`.
 *
 * Frame: the page header (title, search, live indicator + Refresh) and the view bar, then the view's body.
 * UX-C1: the bar has no Needs Attention tab and `view=attention` reads as All Outreach; the `attention` desk view stays
 * (the rep's old My work; a rep now has My Outreach only). Above Needs Attention, All Outreach and Closed, in order:
 * the metrics strip (the Owner's Needs Attention and All Outreach; a rep's My workload), then the filter sidebar beside
 * the list. The list column starts with the toolbar (the `Filters (n)` toggle and the one sort control), then the
 * active filter chips + `Clear filters`, then the list (the stale banner is the list's first line).
 * Filters (2026-09-29 cleanup): every filter, Granot Priority and the Lead toggle included, lives in the sidebar; the
 * sidebar opens and closes as a whole and per section. The Overview keeps its own preset bar (UI1-OVERVIEW).
 * Desktop: sidebar left (sticky), list right. Below 768 px: the `Filters (n)` sheet button and full-width cards.
 *
 * Every region (metrics, rail, chips, list) is its own Suspense + error boundary. Filter, sort and view changes go
 * through the URL inside a transition, so old data stays with the 2 px progress bar.
 */
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import type { PriorityCounts } from "@/lib/api/salesIntelligence";
import { CoverageView } from "../coverage-view";
import { GuideView } from "../guide-view";
import { Reps } from "../reps";
import { useNewestAsOf } from "../data/live";
import { currentSalesIntelligenceHref } from "../lib/official-record";
import { rememberDeskHref } from "../outreach/deep-links";
import { outreachRouteHref } from "../outreach/deep-links";
import { readOutreachByLead } from "../data/use-outreach";
import { isNotFoundError } from "../outreach/page-states";
import { siKeys } from "../data/query-keys";
import { attentionParamsFromDesk, clearDeskFilters, closedHistoryParamsFromDesk, deskUrlUpdate, isDeskView, serializeDeskUrl, tabsFor, type DeskUrlPatch, type DeskUrlState, type PageView, type UrlRole } from "../data/url-state";
import { RepGuide } from "../rep/rep-guide";
import { MyWorkload } from "../rep/my-workload";
import { RepView } from "../rep-view/rep-view";
import { useIsRep } from "../rep/viewer";
import { supportedAttentionParams, type AttentionParams, type DeskView } from "../data/requests";
import { useAttentionList } from "../data/use-attention";
import type { readAttentionPage } from "../data/use-attention";
import { SnapshotFreshness, isExpiredSnapshot } from "../rep-view/snapshot-freshness";
import { clearRepViewFilters } from "../rep-view/drills";
import { useDeskUrlState } from "../data/use-url-state";
import { useAttentionCapabilities, useSalesRoster } from "../data/use-search-contract";
import { CardShellSkeleton, DelayedSkeleton, Region, SkeletonBlock, SkeletonLines } from "../primitives";
import { FilterRail, FilterSheet, activeFilterChips, railRegionsFor, regionActiveCount, useFilterSidebarOpen, type RailRegion, type RailRep, type RailValue } from "../rail";
import { FOLLOWUP_WORK_OPTIONS } from "../rail/followup-filter";
import { ActiveChips } from "./active-chips";
import { ClosedListRegion } from "./closed-list";
import { NO_DEGRADE, applyDegrade, applyHistoryDegrade, degradeNotices, nextDegrade, useQueryError, type Degrade } from "./degrade";
import { ListControls } from "./list-controls";
import { MetricsStrip, MetricsStripView, type MetricTile } from "./metrics-strip";
import { LIST_HEADING_ID, OutreachListRegion, OutreachListView, focusListHeading, requestListHeadingFocus } from "./outreach-list";
import { PageHeader } from "./page-header";
import { ViewTabs, viewLabel } from "./view-tabs";
import { copy } from "../sales-intelligence-copy";
import { priorityLabel } from "./preset-bar";
import { formatDate } from "../lib/time";
import { cx } from "../lib/format";
import "../styles/sales-intelligence.css";

export type DeskProps = {
  /** The signed-in admin's id: the Priority preset is remembered per user. */
  userId?: string | null;
  /** Other stages' view bodies (UI1-OVERVIEW, UI1-COVER). Defaults: the kept Coverage / Guide / RingCentral Accounts. */
  overview?: ReactNode;
  coverage?: ReactNode;
  reps?: ReactNode;
  guide?: ReactNode;
};

function LegacyOpen({ query }: { query: string }) {
  const router = useRouter();
  const rep = useIsRep();
  const params = new URLSearchParams(query);
  const panel = params.has("panel");
  const id = !panel ? params.get("outreach") : null;
  const lead = !panel && !id ? params.get("lead") : null;
  const model = params.get("lead_model");
  const kept = new URLSearchParams(params);
  for (const key of ["outreach", "lead", "lead_model"]) kept.delete(key);
  const back = currentSalesIntelligenceHref(kept);
  const lookup = useQuery({ queryKey: siKeys.outreachByLead(model ?? "", lead ?? ""), queryFn: ({ signal }) => readOutreachByLead(model!, lead!, signal), enabled: !rep && !!lead && !!model, retry: false });
  useEffect(() => {
    if (id) router.replace(outreachRouteHref(id, { siReturn: back }));
    else if (lookup.data?.data.outreach?.id) router.replace(outreachRouteHref(lookup.data.data.outreach.id, { siReturn: back }));
  }, [id, lookup.data, router, back]);
  const missing = !!lead && (!!rep || !model || (lookup.isSuccess && !lookup.data.data.outreach) || (lookup.isError && isNotFoundError(lookup.error)));
  if (missing) return <p role="status" className="si-desk__notice">{copy.oi.card.noOutreachForLead}</p>;
  if (lookup.isError) return <p role="alert" className="si-desk__notice">{copy.oi.card.leadLookupFailed}</p>;
  return null;
}

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

type RailProps = {
  view: DeskView; state: DeskUrlState; update: (patch: DeskUrlPatch) => void; asOf: string | null; rosterAvailable: boolean;
  capabilities?: ReturnType<typeof useAttentionCapabilities>; priorityCounts?: PriorityCounts | null;
};
const regionsFor = railRegionsFor;
const NO_REPS: RailRep[] = [];
const RAIL_ID = "si-desk-filters";

/** How many values the sidebar holds (the sum of its sections' counts), for `Filters (n)`. */
export function sidebarFilterCount(state: RailValue, regions: readonly RailRegion[]): number {
  return regions.reduce((n, region) => n + regionActiveCount(region, state), 0);
}

type AttentionPage = Awaited<ReturnType<typeof readAttentionPage>>;
/**
 * The list's `priority_counts`, read from the query cache without suspending, so the sidebar never waits on (or
 * fails with) the list. Null until the list's first page for these params has loaded.
 */
function useCachedPriorityCounts(params: AttentionParams, enabled: boolean): PriorityCounts | null {
  const client = useQueryClient();
  const key = siKeys.attention(params);
  const read = () => (enabled ? (client.getQueryData<InfiniteData<AttentionPage>>(key)?.pages[0]?.data.priority_counts ?? null) : null);
  return useSyncExternalStore((onChange) => client.getQueryCache().subscribe(onChange), read, () => null);
}

/** The rail's rep list: the Owner's `GET /reps`. A rep never mounts the read (Owner-only; A04 "no 403"). */
function OwnerRail({ children, rosterAvailable }: { children: (reps: RailRep[]) => ReactNode; rosterAvailable: boolean }) {
  const agents = useSalesRoster(rosterAvailable);
  return <>{children(agents.map(({ id, name, active }) => ({ id, name, active })))}</>;
}
function WithRailReps({ children, rosterAvailable = true }: { children: (reps: RailRep[]) => ReactNode; rosterAvailable?: boolean }) {
  return useIsRep() ? <>{children(NO_REPS)}</> : <OwnerRail rosterAvailable={rosterAvailable}>{children}</OwnerRail>;
}

function RailArea({ view, state, update, asOf, rosterAvailable, capabilities, priorityCounts, onClearAll, onHide }: RailProps & { onClearAll: () => void; onHide: () => void }) {
  const rep = useIsRep();
  const regions = regionsFor(view, rep);
  return (
    <WithRailReps rosterAvailable={rosterAvailable}>
      {(reps) => <FilterRail id={RAIL_ID} regions={regions} value={state} onChange={update} reps={reps} asOf={asOf} capabilities={capabilities} priorityCounts={priorityCounts}
        onClearAll={onClearAll} onHide={onHide} filterCount={sidebarFilterCount(state, regions)} />}
    </WithRailReps>
  );
}
function SheetArea({ view, state, update, asOf, rosterAvailable, capabilities, priorityCounts, onClearAll }: RailProps & { onClearAll: () => void }) {
  const rep = useIsRep();
  const regions = regionsFor(view, rep);
  return <WithRailReps rosterAvailable={rosterAvailable}>{(reps) => <FilterSheet regions={regions} value={state} onChange={update} reps={reps} asOf={asOf} capabilities={capabilities} priorityCounts={priorityCounts} onClearAll={onClearAll} filterCount={sidebarFilterCount(state, regions)} />}</WithRailReps>;
}

/** The desktop sidebar toggle (the sheet button takes its place below 768 px). */
function SidebarToggle({ open, onToggle, count }: { open: boolean; onToggle: () => void; count: number }) {
  const r = copy.ui1.desk.rail;
  return (
    <button type="button" className={cx("si-btn si-btn--secondary si-btn--md si-hit si-railtoggle", open && "is-open")} aria-expanded={open} aria-controls={RAIL_ID}
      title={open ? r.hide : r.show} onClick={onToggle}>
      <SlidersHorizontal size={16} aria-hidden />
      {count > 0 ? r.filtersCount(count) : r.filters}
    </button>
  );
}
function ChipsArea({ view, state, update, asOf, rosterAvailable, onClearAll, resolvedWindow }: RailProps & { onClearAll: () => void; resolvedWindow?: { from: string | null; through: string | null } | null }) {
  const rep = useIsRep();
  const regions = regionsFor(view, rep);
  return (
    <WithRailReps rosterAvailable={rosterAvailable}>
      {(reps) => {
        const chips = activeFilterChips(state, regions, reps, { onChange: update, asOf, rep });
        const add = (key: string, label: string, patch: DeskUrlPatch) => chips.push({ key, label, patch, remove: () => update(patch) });
        for (const code of state.priority) add(`priority:${code}`, `Granot Priority: ${priorityLabel(code)}`, { priority: state.priority.filter((item) => item !== code) });
        if (state.attachment) add("attachment", state.attachment === "lead" ? "Has a Lead" : "No Lead", { attachment: null });
        if (state.q) add("q", `Search: ${state.q}`, { q: null });
        for (const id of state.assigned_agent_id) add(`assigned:${id}`, `Assigned: ${reps.find((item) => item.id === id)?.name ?? "Unknown rep"}`, { assigned_agent_id: state.assigned_agent_id.filter((item) => item !== id) });
        if (state.assignment) add("assignment", "Assigned: Unassigned", { assignment: null });
        for (const id of state.followup_agent_id) add(`followup-agent:${id}`, `Follow-up assignee: ${reps.find((item) => item.id === id)?.name ?? "Unknown rep"}`, { followup_agent_id: state.followup_agent_id.filter((item) => item !== id) });
        for (const key of state.work) add(`work:${key}`, `Follow-up: ${FOLLOWUP_WORK_OPTIONS.find(([option]) => option === key)?.[1] ?? key.replaceAll("_", " ")}`, { work: state.work.filter((item) => item !== key) });
        if (state.relationship && state.agent) add("relationship", `${state.relationship === "involved" ? "Involved" : state.relationship === "assigned" ? "Assigned rep" : "Follow-up assignee"}: ${reps.find((item) => item.id === state.agent)?.name ?? "Unknown rep"}`, { relationship: null, agent: null });
        if (state.move_date_mode) {
          // Open-ended windows (Future, Today onward, Past) say so; a single date alone would read as an exact day.
          const day = (value: string) => formatDate(value, asOf ?? undefined);
          const range = resolvedWindow?.from && resolvedWindow.through ? `${day(resolvedWindow.from)}${resolvedWindow.through !== resolvedWindow.from ? `–${day(resolvedWindow.through)}` : ""}`
            : resolvedWindow?.from ? `${day(resolvedWindow.from)} onward` : resolvedWindow?.through ? `through ${day(resolvedWindow.through)}` : state.move_date_mode.replaceAll("_", " ");
          add("move-date", `Move ${range}${state.move_date_mode === "within" ? ` (Within ${state.move_days} days)` : ""}`, { move_date_mode: null, move_days: null, move_on: null, move_from: null, move_through: null });
        }
        if (state.loc_side && (state.loc_city || state.loc_state || state.loc_zip)) add("loc_side", `Location side: ${state.loc_side}`, { loc_side: "either" });
        for (const [key, label] of [["loc_city", "City"], ["loc_state", "State"], ["loc_zip", "ZIP"]] as const) if (state[key]) {
          const others = ["loc_city", "loc_state", "loc_zip"].some((item) => item !== key && !!state[item as "loc_city" | "loc_state" | "loc_zip"]);
          add(key, `${state.loc_side && state.loc_side !== "either" ? `${state.loc_side} ` : ""}${label}: ${state[key]}`, { [key]: null, ...(others ? {} : { loc_side: null }) });
        }
        if (state.snapshot_id) add("snapshot", "Opened from overview snapshot", { snapshot_id: null });
        return <ActiveChips chips={chips} onClearAll={onClearAll} />;
      }}
    </WithRailReps>
  );
}

function ConnectedChipsArea({ params, ...props }: RailProps & { params: AttentionParams; onClearAll: () => void }) {
  const list = useAttentionList(params);
  return <ChipsArea {...props} resolvedWindow={list.data.pages[0]?.data.resolved_move_window} />;
}

function PriorityClosedLink({ params, state, role, capabilities }: { params: AttentionParams; state: DeskUrlState; role: UrlRole; capabilities: ReturnType<typeof useAttentionCapabilities> }) {
  const list = useAttentionList(params);
  if (params.view === "closed" || !state.priority.length || list.status !== "ready" || list.totalItems !== 0) return null;
  const closed = capabilities?.closed_history;
  const query = serializeDeskUrl({ view: "closed", priority: state.priority, q: state.q, agent_id: state.agent_id,
    ...(closed?.assignment ? { assigned_agent_id: state.assigned_agent_id, assignment: state.assignment } : {}),
    ...(closed?.location ? { loc_side: state.loc_side, loc_city: state.loc_city, loc_state: state.loc_state, loc_zip: state.loc_zip } : {}),
    ...(closed?.move_date ? { move_date_mode: state.move_date_mode, move_days: state.move_days, move_on: state.move_on, move_from: state.move_from, move_through: state.move_through } : {}),
  }, role).toString();
  return <p className="si-desk__notice">Closed Outreach records are available in <Link href={`/sales-intelligence?${query}`}>Closed</Link>.</p>;
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

function DeskList({ view, state, query, update, pending, repView = false, selectedFollowupName }: {
  view: DeskView; state: DeskUrlState; query: string; update: (patch: DeskUrlPatch) => void; pending: boolean; repView?: boolean; selectedFollowupName?: string;
}) {
  const client = useQueryClient();
  const asOf = useNewestAsOf();
  const [sidebarOpen, setSidebarOpen] = useFilterSidebarOpen();
  const capabilities = useAttentionCapabilities();
  const rep = useIsRep();
  const [degrade, setDegrade] = useState<Degrade>(NO_DEGRADE);
  const requested = attentionParamsFromDesk(state, view);
  const supported = supportedAttentionParams(requested, capabilities ?? null);
  // OI §10: while capabilities load, a list using additive families waits in skeletons instead of reading unavailable.
  const capabilitiesPending = capabilities === undefined && supported.unavailable.length > 0;
  const closedUnsupported = view === "closed" ? [
    ...(state.work.length || state.followup_agent_id.length ? ["Follow-up"] : []),
    ...(state.relationship || state.agent ? ["Involvement"] : []),
    ...(state.snapshot_id ? ["Snapshot"] : []),
    ...(state.sort === "move_date" ? ["Move date sort"] : []),
  ] : [];
  const raw = new URLSearchParams(query);
  const invalidRaw = [
    ...(raw.has("assignment") && raw.get("assignment") !== "unassigned" ? ["Invalid assigned rep"] : []),
    ...(raw.has("relationship") && !["assigned", "followup", "involved"].includes(raw.get("relationship") ?? "") ? ["Invalid involvement"] : []),
    ...(raw.has("loc_side") && !["either", "pickup", "delivery"].includes(raw.get("loc_side") ?? "") ? ["Invalid location"] : []),
    ...(raw.has("move_days") && state.move_days == null ? ["Invalid move date"] : []),
    ...(state.snapshot_id && !/^outreach:[^\s]{1,91}$/.test(state.snapshot_id) ? ["Invalid snapshot"] : []),
  ];
  const unavailable = [...new Set([...(capabilities === undefined ? [] : supported.unavailable), ...closedUnsupported, ...invalidRaw])];
  const params = applyDegrade(supported.params, degrade);
  const error = useQueryError(siKeys.attention(params));
  const expired = isExpiredSnapshot(error, state.snapshot_id);
  const blocked = unavailable.length > 0 || expired || capabilitiesPending;
  const next = nextDegrade(error, params, degrade);
  // Render-time adjust (no effect): a 400 on `q` or on a sort moves to the degraded params at once.
  if (next !== degrade) setDegrade(next);
  const notices = degradeNotices(requested, degrade);
  const regionKey = `${degrade.qOff ? "q-off" : "q"}|${degrade.badSorts.join(",")}`;
  const returnTo = currentSalesIntelligenceHref(new URLSearchParams(query));
  const reset = (key: readonly unknown[]) => () => void client.resetQueries({ queryKey: key });
  const priorityCounts = useCachedPriorityCounts(params, !blocked);
  const railProps: RailProps = { view, state, update, asOf, rosterAvailable: capabilities?.roster === true, capabilities, priorityCounts };
  const onTile = (tile: MetricTile) => {
    // A view-changing tile remounts the list: the new heading takes the focus when it mounts (FIX-UI1 A10/m4).
    const changesView = !!tile.patch.view && tile.patch.view !== view;
    if (changesView) requestListHeadingFocus();
    update(tile.patch);
    if (!changesView) focusListHeading();
  };
  const busy = pending;
  const clearFilters = () => update(repView ? clearRepViewFilters(state) : clearDeskFilters());
  return (
    <div className="si-desk__body" data-view={view}>
      {rep && !repView && view === "all_outreach" && <MyWorkload priority={state.priority} />}
      {view !== "closed" && !rep && !repView && (capabilitiesPending ? <MetricsStrip.Skeleton /> : blocked ? <MetricsStripView metrics={null} asOf={asOf} /> :
        <Region key={`metrics-${regionKey}`} name="metrics" className="si-desk__metrics" skeleton={<MetricsStrip.Skeleton />} onRetry={reset(siKeys.attention(params))}>
          <MetricsStrip params={params} onApply={onTile} />
        </Region>
      )}
      <div className={cx("si-desk__grid", !sidebarOpen && "is-rail-hidden")}>
        {sidebarOpen && (
          <Region name="rail" className="si-desk__railregion" skeleton={<FilterRail.Skeleton regions={view === "closed" ? 5 : 8} />} onRetry={reset(siKeys.reps("limit=100"))}>
            <RailArea {...railProps} onClearAll={clearFilters} onHide={() => setSidebarOpen(false)} />
          </Region>
        )}
        <section className="si-desk__main" aria-labelledby={LIST_HEADING_ID}>
          <div className="si-desk__toolbar">
            <Region name="rail-sheet" className="si-desk__sheetregion" skeleton={null}>
            <SheetArea {...railProps} onClearAll={clearFilters} />
            </Region>
            <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} count={sidebarFilterCount(state, regionsFor(view, rep))} />
            <ListControls view={view} sort={state.sort ?? requested.sort ?? "attention"} direction={requested.direction ?? "asc"} freshness={params.freshness === "fresh" ? "fresh" : null} moveDateAvailable={view !== "closed" && capabilities?.move_date_sort === true} onChange={update} />
          </div>
          <Region name="chips" skeleton={null}>
            {blocked ? <ChipsArea {...railProps} onClearAll={clearFilters} /> : <ConnectedChipsArea {...railProps} params={params} onClearAll={clearFilters} />}
          </Region>
          {expired ? <p role="status" className="si-desk__notice">{copy.oi.repView.expired} <Link href={`/sales-intelligence?${deskUrlUpdate(query, { snapshot_id: null }, rep ? "rep" : "owner").toString()}`}>{copy.oi.repView.latest}</Link></p> : capabilitiesPending ? <OutreachListView.Skeleton /> : blocked && <div role="status" className="si-desk__notice"><p>{unavailable.join(", ")}: {unavailable.some((name) => name.startsWith("Invalid")) ? "Invalid filter value." : "Not available yet."} Your selections remain in the URL. Remove a chip or clear filters to continue.</p>{view === "closed" && state.sort === "move_date" && <button type="button" className="si-btn si-btn--secondary si-hit" onClick={() => update({ sort: null, direction: null })}>Reset sort</button>}</div>}
          {!repView && !expired && state.snapshot_id && <SnapshotFreshness pinned={state.snapshot_id} query={query} priority={state.priority} role={rep ? "rep" : "owner"} />}
          {!blocked && <Region name="priority-closed-link" skeleton={null}><PriorityClosedLink params={params} state={state} role={rep ? "rep" : "owner"} capabilities={capabilities} /></Region>}
          <Notices search={notices.search} sort={notices.sort} />
          {blocked ? null : view === "closed" ? (
            <ClosedListRegion
              regionKey={`closed-${regionKey}`}
              params={params}
              history={applyHistoryDegrade({ ...closedHistoryParamsFromDesk(state), assigned_agent_id: params.assigned_agent_id, assignment: params.assignment,
                move_date_mode: params.move_date_mode, move_days: params.move_days, move_on: params.move_on, move_from: params.move_from, move_through: params.move_through,
                loc_side: params.loc_side, loc_city: params.loc_city, loc_state: params.loc_state, loc_zip: params.loc_zip }, degrade)}
              state={state}
              update={update}
              pending={busy}
              returnTo={returnTo}
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
              selectedFollowupName={selectedFollowupName}
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
  const rep = useIsRep();
  if (slot !== undefined) return <Region className="si-desk__other" name={`view-${view}`} skeleton={<SkeletonLines lines={6} />}>{slot}</Region>;
  // UI2-SHELL: a rep reaches only Overview (its slot) and Guide here; the Owner-only fallbacks never mount for a rep.
  if (rep) return <Region className="si-desk__other" name={`view-${view}`} skeleton={<SkeletonLines lines={6} />}>{view === "guide" ? <RepGuide topic={params.get("topic")} withHealth /> : <SkeletonLines lines={6} />}</Region>;
  const body =
    view === "coverage" ? <CoverageView /> :
    view === "guide" ? <GuideView topic={params.get("topic")} withHealth /> :
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

export function Desk({ userId, overview, coverage, reps, guide }: DeskProps) {
  const { state, update, isPending, query } = useDeskUrlState({ userId });
  const router = useRouter();
  const contentRef = useScrollHeightVar();
  // A record's `Back` returns to this view with its filters and sort (not the open side dialog).
  useEffect(() => {
    const kept = new URLSearchParams(query);
    for (const key of ["outreach", "lead", "lead_model"]) kept.delete(key);
    rememberDeskHref(currentSalesIntelligenceHref(kept));
  }, [query]);
  const view = state.view;
  const role: UrlRole = useIsRep() ? "rep" : "owner";
  useEffect(() => {
    if (role !== "rep" || new URLSearchParams(query).get("view") !== "rep") return;
    const clean = deskUrlUpdate(query, {}, "rep").toString();
    router.replace(clean ? `/sales-intelligence?${clean}` : "/sales-intelligence", { scroll: false });
  }, [query, role, router]);
  const onSearch = (q: string | null) => update(isDeskView(view) || view === "rep" || q === null ? { q } : { view: "all_outreach", q });
  const slots: Record<Exclude<PageView, DeskView>, ReactNode | undefined> = { overview, rep: undefined, coverage, reps, guide };
  return (
    <div className="si-root si-desk">
      <header className="si-desk__header">
        <PageHeader q={state.q} onSearch={onSearch} />
        <ViewTabs active={view} query={query} role={role} />
      </header>
      <div ref={contentRef} className="si-desk__content">
        <LegacyOpen query={query} />
        {view === "rep" ? (
          <RepView state={state} query={query}>{(row) => <DeskList key="rep" view="all_outreach" state={{ ...state, relationship: state.relationship ?? "assigned" }} query={query} update={update} pending={isPending} repView selectedFollowupName={row?.agent.name} />}</RepView>
        ) : isDeskView(view) ? (
          <DeskList key={view} view={view} state={state} query={query} update={update} pending={isPending} />
        ) : (
          <OtherView view={view} slot={slots[view]} />
        )}
      </div>
    </div>
  );
}

/** UI-0 §2.4 route level: the page frame (title, view bar) with skeleton regions; shown after 150 ms. */
export function DeskRouteSkeleton({ role = "owner" }: { role?: UrlRole } = {}) {
  const d = copy.ui1.desk;
  return (
    <div className="si-root si-desk is-skeleton">
      <header className="si-desk__header">
        <div className="si-desk__titlebar">
          <h1 className="si-desk__title">{copy.page.title}</h1>
        </div>
        <nav className="si-tabs si-routetabs si-desk__views" aria-label={role === "rep" ? copy.ui2.shell.viewsLabel : d.viewsLabel}>
          {tabsFor(role).map((view) => <span key={view} className="si-tab si-routetab">{viewLabel(view, role)}</span>)}
        </nav>
      </header>
      <div className="si-desk__content">
        <DelayedSkeleton>
          <div className="si-desk__body">
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
