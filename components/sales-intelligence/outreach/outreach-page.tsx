"use client";
/**
 * UI1-SHELL: the Outreach route, `/sales-intelligence/outreach/[id]` (UI-1 §5). The page header carries the back link
 * to the desk (honouring `si_return`), the live indicator with `Refresh` (`HeaderLive`, UI1-LIVE). Then the record
 * header in its own region, and the tabs `Analysis · Timeline · Work` (`?tab=`, default Analysis) as route links.
 *
 * Slots: `analysis` (default: the analysis kit, `<AnalysisTab role="owner" cardLines={false}/>` in its own region, with
 * `AnalysisTabSkeleton` while it loads; its anchors `#situation` … `#full-output` are where old deep links land) and
 * `timeline` (default `<Timeline scope="outreach"/>`).
 * Page states (final spec §11.9): a 404 on the detail read replaces the page body with `This Outreach doesn't exist or
 * was removed.`; any other failure stays inside the failing region.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderLive } from "../data/live";
import { siKeys } from "../data/query-keys";
import { readOutreach } from "../data/use-outreach";
import { DelayedSkeleton, Region, RouteTabs, type RouteTab } from "../primitives";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { Timeline, TimelineSkeleton } from "../timeline";
import { AnalysisTab, AnalysisTabSkeleton } from "./analysis";
import { OUTREACH_TABS, backHref, outreachRouteHref, parseOutreachTab, validReturn, type OutreachTab } from "./deep-links";
import { AnalysisSectionsSkeleton, OutreachNotFound, isNotFoundError } from "./page-states";
import { RecordHeader } from "./record-header";
import { WorkTab, WorkTabSkeleton } from "./work-tab";

const h = copy.ui1.outreach;

export type OutreachPageProps = {
  id: string;
  /** `?tab=` as received; anything unknown is Analysis. */
  tab?: string | null;
  /** `?run=`: the analysis run Full output opens on (from an old `analysis_run=` link). Passed to the analysis slot's owner. */
  run?: string | null;
  /** `?si_return=`: where the back link goes. Only a `/sales-intelligence…` path counts. */
  siReturn?: string | null;
  /** Overrides the analysis tab (default: the analysis kit, UI1-TOP / MOVE / FIND / CONV, wired by UI1-ANALYSIS-WIRE). */
  analysis?: ReactNode;
  /** Defaults to the outreach-scope Timeline (UI1-TL). */
  timeline?: ReactNode;
};

/** The tab bar's links; each keeps `si_return` so the back link survives switching tabs. */
export function outreachTabs(id: string, siReturn: string | null): RouteTab<OutreachTab>[] {
  return OUTREACH_TABS.map((key) => ({ key, label: h.tabs[key], href: outreachRouteHref(id, { tab: key, siReturn }) }));
}

/** The analysis tab until its sections land: the six titles (with their anchors) over skeleton lines, and a note. */
export function AnalysisPlaceholder({ run }: { run?: string | null }) {
  return <div data-run={run ?? undefined}><AnalysisSectionsSkeleton note={h.analysisPending} /></div>;
}

/**
 * The page frame without reads (tests render it): the bar, the header slot, the tabs and the active tab's content.
 * `notFound` swaps the header, tabs and content for the not-found page state.
 */
export function OutreachPageFrame({ back, header, tabs, active, notFound, children }: {
  back: string;
  header: ReactNode;
  tabs: RouteTab<OutreachTab>[];
  active: OutreachTab;
  notFound?: boolean;
  children?: ReactNode;
}) {
  // UI2-SCOPE (UI-2 §3): a rep's back link reads `Back`, and its live indicator reads no coverage (Owner-only) and links
  // to no Coverage page, as the desk header does for a rep.
  const rep = useIsRep();
  return (
    <div className="si-root si-outreach" data-viewer={rep ? "rep" : undefined}>
      <div className="si-outreach__bar">
        <Link className="si-btn si-btn--secondary si-btn--md si-hit si-outreach__back" href={back}>
          <ArrowLeft size={16} aria-hidden />
          {rep ? copy.ui2.scope.back : h.back}
        </Link>
        {rep ? <HeaderLive className="si-outreach__live" healthEnabled={false} coverageHref={null} /> : <HeaderLive className="si-outreach__live" />}
      </div>
      {notFound ? (
        <OutreachNotFound back={back} />
      ) : (
        <>
          {header}
          <RouteTabs items={tabs} active={active} label={h.tabsLabel} className="si-outreach__tabs" />
          <div className="si-outreach__body" data-tab={active}>{children}</div>
        </>
      )}
    </div>
  );
}

/**
 * Watches the same detail read as the header (shared key, no second request) without suspending, so a 404 becomes the
 * page state instead of the header region's error. UI2-SCOPE: `ready` is false until the detail read has answered, so
 * the active tab's regions (assessment, findings, timeline, …) never mount for a record that turns out to be a 404
 * (they logged `INVALID_INPUT` before, for the Owner too); any other failure lets them mount and fail in place.
 */
function useOutreachGate(id: string): { missing: boolean; ready: boolean } {
  const query = useQuery({ queryKey: siKeys.outreach(id), queryFn: ({ signal }) => readOutreach(id, signal), retry: false });
  const missing = isNotFoundError(query.error);
  return { missing, ready: !!query.data || (!!query.error && !missing) };
}

/** The active tab's shape while the detail read is pending (after 150 ms, UI-0 §2.4). */
function TabSkeleton({ tab, rep }: { tab: OutreachTab; rep: boolean }) {
  const shape = tab === "work" ? <WorkTabSkeleton /> : tab === "timeline" ? <TimelineSkeleton /> : <AnalysisTabSkeleton role={rep ? "rep" : "owner"} />;
  return <DelayedSkeleton>{shape}</DelayedSkeleton>;
}

export function OutreachPage({ id, tab, run, siReturn, analysis, timeline }: OutreachPageProps) {
  const active = parseOutreachTab(tab);
  const kept = validReturn(siReturn);
  const back = backHref(kept);
  // Official-record links return here, to this tab.
  const returnTo = outreachRouteHref(id, { tab: active, siReturn: kept });
  const { missing, ready } = useOutreachGate(id);
  // UI2-SCOPE (UX15): the analysis kit's role is the viewer's; a rep's kit has no Full output, Advanced or Apply.
  const rep = useIsRep();
  const role = rep ? "rep" : "owner";
  let content: ReactNode;
  if (!ready) content = <TabSkeleton tab={active} rep={rep} />;
  else if (active === "timeline") content = timeline ?? <Timeline scope="outreach" id={id} />;
  else if (active === "work") content = <WorkTab id={id} returnTo={returnTo} />;
  else
    content = analysis ?? (
      <Region name="outreach-analysis" skeleton={<AnalysisTabSkeleton role={role} />}>
        {/* The record header already shows the card's lines 1–4 and 7, so Situation doesn't repeat them. */}
        <AnalysisTab outreachId={id} role={role} run={rep ? null : run ?? null} cardLines={false} />
      </Region>
    );
  return (
    <OutreachPageFrame
      back={back}
      header={<RecordHeader id={id} returnTo={returnTo} />}
      tabs={outreachTabs(id, kept)}
      active={active}
      notFound={missing}
    >
      {content}
    </OutreachPageFrame>
  );
}
