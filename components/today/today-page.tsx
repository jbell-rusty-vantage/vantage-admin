"use client";
/**
 * Today (`/`): one destination, four tabs (`?tab=pulse|operations|team|money`, default Pulse).
 * Owner: all four. Manager: Operations only. Admin has no Today and lands on Leads.
 * Operations re-homes the `/daily` board (its URL state, `lane`, `company`, `quiet_priorities`, rides on the same query).
 */
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DailyOperationsPage } from "@/components/daily/daily-shell";
import { useNowMs } from "@/components/daily/use-now";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { CrmCard, PageHeader, SkeletonLine, Tabs, formatLongDay, formatTime } from "@/components/ui/crm";
import { MoneyTab } from "./money-tab";
import { PulseTab, useSnapshotQuery } from "./pulse-view";
import { resyncAge } from "./pulse-math";
import { TeamTab } from "./team-tab";
import { todayCopy } from "./today-copy";
import { parseTodayTab, TODAY_ADMIN_REDIRECT, todayTabHref, todayTabsFor, type TodayRole, type TodayTab } from "./today-url";

/** "Monday, Oct 5 · 2:41 PM New York"; just "New York" until the browser clock is known (no hydration mismatch). */
export function todaySubtitle(nowMs: number | undefined): string {
  if (nowMs === undefined) return todayCopy.clockUnknown;
  const now = new Date(nowMs);
  return `${formatLongDay(now)} · ${formatTime(now)} ${todayCopy.clockUnknown}`;
}

/** "● Live · resynced 2 min ago", from the shared snapshot query's `dataUpdatedAt` (Pulse only). */
function LiveChip() {
  const nowMs = useNowMs();
  const snapshot = useSnapshotQuery();
  const age = resyncAge(snapshot.dataUpdatedAt || undefined, nowMs);
  return (
    <div className="crm-freshness" role="status" data-testid="today-live-chip">
      <span className="crm-freshness__chip">
        <span className="crm-dot crm-dot--green crm-dot--live" aria-hidden="true" />
        <span>
          {todayCopy.live}
          {age ? ` · ${todayCopy.resynced(age)}` : ""}
        </span>
      </span>
    </div>
  );
}

/** The Today header and tab strip. Pure over its props; a manager gets no strip (Operations is all they have). */
export function TodayChrome({
  role,
  tab,
  nowMs,
  liveChip,
}: {
  role: TodayRole;
  tab: TodayTab;
  nowMs: number | undefined;
  liveChip?: React.ReactNode;
}) {
  const tabs = todayTabsFor(role);
  return (
    <PageHeader
      title={todayCopy.title}
      subtitle={todaySubtitle(nowMs)}
      right={
        <>
          {liveChip}
          {tabs.length > 1 ? <Tabs<TodayTab> tabs={tabs} value={tab} hrefFor={todayTabHref} label={todayCopy.tabsLabel} /> : null}
        </>
      }
    />
  );
}

function TodayLoading() {
  return (
    <div className="crm-page" style={{ padding: 0 }} aria-busy="true" aria-label={todayCopy.redirecting}>
      <CrmCard>
        <div className="crm-stack" style={{ padding: 16 }}>
          <SkeletonLine width="30%" height={18} />
          <SkeletonLine />
          <SkeletonLine width="70%" />
        </div>
      </CrmCard>
    </div>
  );
}

export function TodayPage() {
  const role = useDashboardRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nowMs = useNowMs();

  useEffect(() => {
    if (role === "admin") router.replace(TODAY_ADMIN_REDIRECT);
  }, [role, router]);

  if (role !== "owner" && role !== "manager") return <TodayLoading />;

  const tab = parseTodayTab(searchParams.get("tab"), role);
  // The Operations board shows its own live chip; the Today header chip belongs to Pulse.
  const liveChip = tab === "pulse" ? <LiveChip /> : null;

  return (
    <div className="crm-page" style={{ padding: 0 }} data-today-tab={tab}>
      <TodayChrome role={role} tab={tab} nowMs={nowMs} liveChip={liveChip} />
      {tab === "pulse" ? <PulseTab /> : null}
      {tab === "operations" ? (
        <Suspense fallback={<TodayLoading />}>
          <DailyOperationsPage embedded />
        </Suspense>
      ) : null}
      {tab === "team" ? <TeamTab /> : null}
      {tab === "money" ? <MoneyTab /> : null}
    </div>
  );
}
