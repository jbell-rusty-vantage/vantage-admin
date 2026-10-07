"use client";
/**
 * Insights › Analytics (dashboard-redesign-proposal/09-analytics-redesign.md): how a period went, compared with
 * another period, and who or what drove it. Every number carries its comparison and every list is a ranking. State
 * lives in the URL (`?period&compare&from&to&sources&tab&basis&cmp`, `lib/insights/url.ts`), so any view can be
 * bookmarked or shared.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchInsightsAnalytics, insightsSearchParams, type InsightsAnalyticsReport, type InsightsQuery } from "@/lib/api/insights";
import { queryKeys } from "@/lib/query/keys";
import { ANALYTICS_TAB_LABELS, ANALYTICS_TABS, analyticsSearch, parseAnalyticsUrl, patchAnalyticsState, type AnalyticsTab, type AnalyticsUrlState } from "@/lib/insights/url";
import { PageHeader, ReadFailure, SkeletonLine } from "@/components/ui/crm";
import { BookingsTab } from "./bookings-tab";
import { OverviewTab } from "./overview-tab";
import { PeriodBar } from "./period-bar";
import { ReviewsTab } from "./reviews-tab";
import { ScorecardSkeleton } from "./scorecard";
import { SourcesTab } from "./sources-tab";
import { TeamTab } from "./team-tab";

function CardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="crm-card" style={{ padding: 16, display: "grid", gap: 10, minHeight: height }} aria-hidden="true">
      <SkeletonLine width="35%" height={16} />
      <SkeletonLine width="60%" height={11} />
      <SkeletonLine width="100%" height={Math.max(40, height - 90)} />
    </div>
  );
}

function TabSkeleton({ tab }: { tab: AnalyticsTab }) {
  return (
    <div className="ia-body" role="status" aria-label="Loading analytics">
      {tab === "overview" ? (
        <>
          <div className="ia-scoregrid">
            {Array.from({ length: 8 }, (_, index) => (
              <ScorecardSkeleton key={index} />
            ))}
          </div>
          <div className="ia-scoregrid ia-scoregrid--quiet">
            {Array.from({ length: 4 }, (_, index) => (
              <ScorecardSkeleton key={index} quiet />
            ))}
          </div>
          <CardSkeleton height={320} />
        </>
      ) : (
        <>
          <CardSkeleton height={360} />
          <CardSkeleton height={300} />
        </>
      )}
    </div>
  );
}

function SubTabs({ value, onChange }: { value: AnalyticsTab; onChange: (tab: AnalyticsTab) => void }) {
  return (
    <div className="ia-subtabs" role="tablist" aria-label="Analytics views">
      {ANALYTICS_TABS.map((tab) => (
        <button key={tab} type="button" role="tab" className="ia-subtab" aria-selected={tab === value} data-tab={tab} onClick={() => onChange(tab)}>
          {ANALYTICS_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}

function TabBody({ state, report, navigate }: { state: AnalyticsUrlState; report: InsightsAnalyticsReport; navigate: (patch: Partial<AnalyticsUrlState>, push?: boolean) => void }) {
  switch (state.tab) {
    case "sources":
      return <SourcesTab report={report} basis={state.basis} cmp={state.cmp} onBasis={(basis) => navigate({ basis })} onCompare={(cmp) => navigate({ cmp })} />;
    case "team":
      return <TeamTab report={report} cmp={state.cmp} onCompare={(cmp) => navigate({ cmp })} />;
    case "bookings":
      return <BookingsTab report={report} />;
    default:
      return <OverviewTab report={report} />;
  }
}

export function AnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "/insights";
  const searchParams = useSearchParams();
  const state = parseAnalyticsUrl(searchParams);
  const filters = Object.fromEntries(insightsSearchParams(state.query));

  const navigate = (patch: Partial<AnalyticsUrlState>, push = false) => {
    const next = patchAnalyticsState(state, patch);
    const href = `${pathname}${analyticsSearch(next)}`;
    if (push) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };
  const setQuery = (query: InsightsQuery) => navigate({ query }, true);

  const analytics = useQuery({
    queryKey: queryKeys.insights.analytics(filters),
    queryFn: () => fetchInsightsAnalytics(state.query),
    placeholderData: keepPreviousData,
  });
  const report = analytics.data;

  return (
    <div className="ia-page" data-refreshing={analytics.isPlaceholderData ? "true" : undefined} data-testid="insights-analytics">
      <PageHeader
        title="Analytics"
        subtitle="How a period went, compared with another, and who or what drove it."
        help={
          <>
            Every number carries its comparison: counts and money change in %, rates in points, and below 20 on either side the two raw numbers are
            shown instead. Green and red mean good or bad for the business, not up or down. Lead costs are read live from Setup › Lead sources.
          </>
        }
      />
      <PeriodBar query={state.query} report={report} onChange={setQuery} updating={analytics.isFetching} />
      <SubTabs value={state.tab} onChange={(tab) => navigate({ tab }, true)} />
      {state.tab === "reviews" ? (
        <div className="ia-body">
          <ReviewsTab query={state.query} />
        </div>
      ) : analytics.isError && !report ? (
        <ReadFailure what="Analytics could not be read." error={analytics.error} onRetry={() => void analytics.refetch()} />
      ) : !report ? (
        <TabSkeleton tab={state.tab} />
      ) : (
        <div className="ia-body">
          {analytics.isError ? <ReadFailure what="The latest numbers could not be read; showing the previous ones." error={analytics.error} onRetry={() => void analytics.refetch()} /> : null}
          <TabBody state={state} report={report} navigate={navigate} />
        </div>
      )}
    </div>
  );
}
