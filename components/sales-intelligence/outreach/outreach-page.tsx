"use client";
/**
 * UI1-SHELL: the Outreach route, `/sales-intelligence/outreach/[id]` (UI-1 §5). The page header carries the back link
 * to the desk (honouring `si_return`), the live indicator with `Refresh` (`HeaderLive`, UI1-LIVE). Then the record
 * header in its own region, and the tabs `Analysis · Timeline · Work` (`?tab=`, default Analysis) as route links.
 *
 * Slots: `analysis` (the analysis kit, later stages; until then the six section titles over skeleton lines, with the
 * anchors `#situation` … `#full-output` so old deep links land) and `timeline` (default `<Timeline scope="outreach"/>`).
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
import { RouteTabs, type RouteTab } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { Timeline } from "../timeline";
import { OUTREACH_TABS, backHref, outreachRouteHref, parseOutreachTab, validReturn, type OutreachTab } from "./deep-links";
import { AnalysisSectionsSkeleton, OutreachNotFound, isNotFoundError } from "./page-states";
import { RecordHeader } from "./record-header";
import { WorkTab } from "./work-tab";

const h = copy.ui1.outreach;

export type OutreachPageProps = {
  id: string;
  /** `?tab=` as received; anything unknown is Analysis. */
  tab?: string | null;
  /** `?run=`: the analysis run Full output opens on (from an old `analysis_run=` link). Passed to the analysis slot's owner. */
  run?: string | null;
  /** `?si_return=`: where the back link goes. Only a `/sales-intelligence…` path counts. */
  siReturn?: string | null;
  /** The analysis kit (UI1-TOP / MOVE / FIND / CONV). Until it lands, the section titles over skeleton lines. */
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
  return (
    <div className="si-root si-outreach">
      <div className="si-outreach__bar">
        <Link className="si-outreach__back si-hit" href={back}>
          <ArrowLeft size={16} aria-hidden />
          {h.back}
        </Link>
        <HeaderLive className="si-outreach__live" />
      </div>
      {notFound ? (
        <OutreachNotFound back={back} />
      ) : (
        <>
          {header}
          <RouteTabs items={tabs} active={active} label={h.tabsLabel} />
          <div className="si-outreach__body" data-tab={active}>{children}</div>
        </>
      )}
    </div>
  );
}

/**
 * Watches the same detail read as the header (shared key, no second request) without suspending, so a 404 becomes the
 * page state instead of the header region's error.
 */
function useOutreachMissing(id: string): boolean {
  const query = useQuery({ queryKey: siKeys.outreach(id), queryFn: ({ signal }) => readOutreach(id, signal), retry: false });
  return isNotFoundError(query.error);
}

export function OutreachPage({ id, tab, run, siReturn, analysis, timeline }: OutreachPageProps) {
  const active = parseOutreachTab(tab);
  const kept = validReturn(siReturn);
  const back = backHref(kept);
  // Official-record links return here, to this tab.
  const returnTo = outreachRouteHref(id, { tab: active, siReturn: kept });
  const missing = useOutreachMissing(id);
  let content: ReactNode;
  if (active === "timeline") content = timeline ?? <Timeline scope="outreach" id={id} />;
  else if (active === "work") content = <WorkTab id={id} returnTo={returnTo} />;
  else content = analysis ?? <AnalysisPlaceholder run={run} />;
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
