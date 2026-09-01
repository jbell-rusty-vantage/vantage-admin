"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PlusCircle, Trophy, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableLoadingState } from "@/components/data-table/table-states";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import {
  fetchOverviewReport,
  type OverviewAgentRow,
  type OverviewLeadCost,
  type OverviewReportResponse,
  type OverviewTotals,
} from "@/lib/api/admin";
import { fetchGranotLifecycleCases } from "@/lib/api/granotLifecycle";
import type { DatabaseScope } from "@/lib/api/types";
import { DATABASE_SCOPE_LABELS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { useDatabaseScope } from "@/lib/state/database-scope";
import { overviewCopy } from "./overview-copy";
import {
  emptyNeedsYouQueue,
  NeedsYouBand,
  needsYouQueueFromPage,
  openIntakePreviewFilters,
  type NeedsYouQueue,
} from "./needs-you";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  hint,
  loading,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardContent className={compact ? "p-4" : "p-5"}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 font-semibold tabular-nums ${compact ? "text-2xl" : "text-3xl"}`}>
          {loading ? "—" : value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function AgentRankingList({
  agents,
  loading,
  emptyMessage,
  valueKey = "total_deposit_amount",
}: {
  agents: OverviewAgentRow[];
  loading?: boolean;
  emptyMessage: string;
  valueKey?: "total_deposit_amount" | "total_binder_amount";
}) {
  const topValue = agents.reduce((max, agent) => Math.max(max, Number(agent[valueKey] ?? 0)), 0);

  if (loading) {
    return <TableLoadingState label="Loading agents..." />;
  }

  if (agents.length === 0) {
    return <FeedbackMessage>{emptyMessage}</FeedbackMessage>;
  }

  return (
    <ol className="space-y-3">
      {agents.map((agent, index) => {
        const primary = Number(agent[valueKey] ?? 0);
        const pct = topValue > 0 ? Math.round((primary / topValue) * 100) : 0;
        return (
          <li key={agent.agent_name ?? index} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                {agent.agent_name ?? "Unknown"}
              </span>
              <span className="tabular-nums">
                {formatMoney(primary)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatNumber(Number(agent.bookings ?? 0))} bookings
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-steel-100">
              <div className="h-full rounded-full bg-trust-blue" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StartARecordCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{overviewCopy.startARecord}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href="/bookings/new"
          className="group flex items-center justify-between rounded-md bg-primary px-4 py-3 text-white transition-colors hover:bg-navy"
        >
          <span className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold">{overviewCopy.createBooking}</span>
              <span className="block text-xs text-white/80">{overviewCopy.createBookingHint}</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <Link
          href="/cancellations/new"
          className="group flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold">{overviewCopy.createCancellation}</span>
              <span className="block text-xs text-muted-foreground">{overviewCopy.createCancellationHint}</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function ThisWeekSection({
  last7Days,
  loading,
}: {
  last7Days?: NonNullable<OverviewReportResponse["last_7_days"]>;
  loading?: boolean;
}) {
  const totals = last7Days?.totals ?? {};
  const leadCost = last7Days?.lead_cost;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{overviewCopy.thisWeek}</h2>
          <p className="text-sm text-muted-foreground">{overviewCopy.thisWeekHint}</p>
        </div>
        <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">
          {overviewCopy.openAnalytics}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Sales (Deposits)"
          value={formatMoney(Number(totals.total_deposit_amount ?? 0))}
          hint={`${formatMoney(Number(totals.total_binder_amount ?? 0))} agent binder`}
          loading={loading}
        />
        <MetricCard
          label="Bookings"
          value={formatNumber(Number(totals.bookings ?? 0))}
          hint={`${formatNumber(Number(totals.active_bookings ?? 0))} active deals`}
          loading={loading}
        />
        <MetricCard
          label="Booking Rate"
          value={formatPercent(Number(totals.booking_rate ?? 0) * 100)}
          hint={`${formatNumber(Number(totals.total_leads ?? 0))} leads`}
          loading={loading}
        />
        <MetricCard
          label="Cancel Rate"
          value={formatPercent(Number(totals.cancellation_rate ?? 0) * 100)}
          hint={`${formatNumber(Number(totals.cancelled_bookings ?? 0))} cancelled bookings`}
          loading={loading}
        />
        <MetricCard
          label="Lead Cost"
          value={formatMoney(Number(leadCost?.total ?? 0))}
          hint={`${formatNumber((leadCost?.by_source_company ?? []).reduce((sum, row) => sum + Number(row.lead_count ?? 0), 0))} billable leads`}
          loading={loading}
        />
      </div>
    </div>
  );
}

function AllTimeSection({
  totals,
  leadCost,
  loading,
  scope,
}: {
  totals: OverviewTotals;
  leadCost?: OverviewLeadCost | null;
  loading?: boolean;
  scope: DatabaseScope;
}) {
  const gridClass = leadCost ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{overviewCopy.allTime}</h2>
          <p className="text-sm text-muted-foreground">
            {DATABASE_SCOPE_LABELS[scope]} totals. {overviewCopy.allTimeHint}
          </p>
        </div>
        <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">
          {overviewCopy.openAnalytics}
        </Link>
      </div>
      <div className={`grid gap-4 ${gridClass}`}>
        <MetricCard
          label="Total Sales (Deposits)"
          value={formatMoney(Number(totals.total_deposit_amount ?? 0))}
          hint={`${formatMoney(Number(totals.total_binder_amount ?? 0))} agent binder`}
          loading={loading}
          compact
        />
        <MetricCard
          label="Bookings"
          value={formatNumber(Number(totals.bookings ?? 0))}
          hint={`${formatNumber(Number(totals.active_bookings ?? 0))} active deals`}
          loading={loading}
          compact
        />
        <MetricCard
          label="Total Leads"
          value={formatNumber(Number(totals.total_leads ?? 0))}
          hint={`${formatPercent(Number(totals.booking_rate ?? 0) * 100)} booking rate`}
          loading={loading}
          compact
        />
        <MetricCard
          label="Cancellations"
          value={formatNumber(Number(totals.cancellations ?? 0))}
          hint={`${formatPercent(Number(totals.cancellation_rate ?? 0) * 100)} cancel rate`}
          loading={loading}
          compact
        />
        {leadCost ? (
          <MetricCard
            label="Lead Cost"
            value={formatMoney(Number(leadCost.total ?? 0))}
            hint={`${formatNumber(leadCost.by_source_company.reduce((sum, row) => sum + Number(row.lead_count ?? 0), 0))} billable leads`}
            loading={loading}
            compact
          />
        ) : null}
      </div>
    </div>
  );
}

export function HomeOverviewView({
  role,
  scope,
  overview,
  overviewLoading,
  overviewError,
  bookingQueue,
}: {
  role: "owner" | "admin" | null;
  scope: DatabaseScope;
  overview?: OverviewReportResponse;
  overviewLoading?: boolean;
  overviewError?: string;
  bookingQueue?: NeedsYouQueue;
}) {
  const allTime = overview?.all_time;
  const last7Days = overview?.last_7_days;
  const totals = allTime?.totals ?? {};
  const showThisWeek = scope === "production" && (Boolean(last7Days) || Boolean(overviewLoading));
  const showLeadCost = scope === "production";
  const weekAgents = last7Days?.top_agents ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{overviewCopy.eyebrow}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{overviewCopy.title}</h1>
        <p className="mt-2 max-w-2xl text-steel">{overviewCopy.subtitle}</p>
      </div>

      {role === "owner" ? (
        <NeedsYouBand booking={bookingQueue ?? emptyNeedsYouQueue()} />
      ) : null}

      {overviewError ? <FeedbackMessage tone="error">{overviewError}</FeedbackMessage> : null}

      {showThisWeek ? (
        <ThisWeekSection last7Days={last7Days ?? undefined} loading={overviewLoading} />
      ) : null}

      {showThisWeek ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
                  {overviewCopy.topAgentsThisWeek}
                </CardTitle>
                <CardDescription>{overviewCopy.topAgentsHint}</CardDescription>
              </div>
              <Link href="/agents" className="whitespace-nowrap text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <AgentRankingList
                agents={weekAgents}
                loading={overviewLoading}
                emptyMessage="No agent booking data in the last 7 days."
              />
            </CardContent>
          </Card>
          <StartARecordCard />
        </div>
      ) : (
        <StartARecordCard />
      )}

      <AllTimeSection
        totals={totals}
        leadCost={showLeadCost ? allTime?.lead_cost : null}
        loading={overviewLoading}
        scope={scope}
      />
    </div>
  );
}

export function HomeOverview() {
  const role = useDashboardRole();
  const { scope } = useDatabaseScope();
  const overviewQuery = useQuery({
    queryKey: queryKeys.dashboard.overview({ database_scope: scope }),
    queryFn: () => fetchOverviewReport(scope),
  });

  const bookingFilters = openIntakePreviewFilters("booking");
  const owner = role === "owner";

  const bookingQuery = useQuery({
    queryKey: queryKeys.granotLifecycle.cases(bookingFilters),
    queryFn: () => fetchGranotLifecycleCases(bookingFilters),
    enabled: owner,
  });

  return (
    <HomeOverviewView
      role={role}
      scope={scope}
      overview={overviewQuery.data}
      overviewLoading={overviewQuery.isLoading}
      overviewError={
        overviewQuery.isError
          ? overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Unable to load summary metrics."
          : undefined
      }
      bookingQueue={
        owner
          ? needsYouQueueFromPage(bookingQuery.data, {
              loading: bookingQuery.isLoading,
              error: bookingQuery.isError ? overviewCopy.intakesLoadError : undefined,
            })
          : undefined
      }
    />
  );
}
