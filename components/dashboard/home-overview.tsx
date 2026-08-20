"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Inbox,
  PhoneCall,
  PlusCircle,
  RefreshCw,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import {
  SourceCompanyHierarchyTable,
  type SourceCompanyHierarchyColumn,
} from "@/components/data-table/source-company-hierarchy-table";
import { TableLoadingState } from "@/components/data-table/table-states";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import {
  fetchOverviewReport,
  type OverviewAgentRow,
  type OverviewLeadCost,
  type OverviewTotals,
  type SourceCompanyMetricRow,
} from "@/lib/api/admin";
import { DATABASE_SCOPE_LABELS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { useDatabaseScope } from "@/lib/state/database-scope";

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

const quickLinks: Array<{
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
  ownerOnly?: boolean;
}> = [
  { href: "/form-leads", label: "Form Leads", description: "Web form submissions", icon: Users },
  { href: "/call-leads", label: "Call Leads", description: "Inbound phone leads", icon: PhoneCall },
  { href: "/bookings", label: "Bookings", description: "Booked deals", icon: PlusCircle },
  { href: "/cancellations", label: "Cancellations", description: "Cancelled deals", icon: XCircle },
  {
    href: "/intakes",
    label: "Intakes",
    description: "Granot booking and cancellation cases waiting for you",
    icon: Inbox,
    ownerOnly: true,
  },
  {
    href: "/ingestion/granot",
    label: "Granot Automation",
    description: "Preview and enrich CRM leads",
    icon: RefreshCw,
    ownerOnly: true,
  },
  { href: "/analytics", label: "Analytics", description: "Charts and trends", icon: BarChart3 },
];

function MetricCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{loading ? "—" : value}</p>
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
  const topValue = agents.reduce(
    (max, agent) => Math.max(max, Number(agent[valueKey] ?? 0)),
    0,
  );

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

function OverviewSourceCompanyTable({
  rows,
  loading,
  emptyMessage,
  showLeadCost = false,
}: {
  rows: SourceCompanyMetricRow[];
  loading?: boolean;
  emptyMessage: string;
  showLeadCost?: boolean;
}) {
  if (loading) {
    return <TableLoadingState label="Loading..." />;
  }

  if (rows.length === 0) {
    return <FeedbackMessage>{emptyMessage}</FeedbackMessage>;
  }

  const columns: SourceCompanyHierarchyColumn[] = showLeadCost
    ? [
        {
          key: "lead_count",
          header: "Leads",
          cell: (row) => formatNumber(Number(row.lead_count ?? 0)),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
        {
          key: "total_lead_cost",
          header: "Lead Cost",
          cell: (row) => formatMoney(Number(row.total_lead_cost ?? 0)),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
      ]
    : [
        {
          key: "bookings",
          header: "Bookings",
          cell: (row) => formatNumber(Number(row.bookings ?? 0)),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
        {
          key: "total_deposit_amount",
          header: "Deposits",
          cell: (row) => formatMoney(Number(row.total_deposit_amount ?? 0)),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
      ];

  return <SourceCompanyHierarchyTable rows={rows} columns={columns} defaultExpanded compact />;
}

function TotalsCards({
  totals,
  loading,
  leadCost,
}: {
  totals: OverviewTotals;
  loading?: boolean;
  leadCost?: OverviewLeadCost | null;
}) {
  const gridClass = leadCost ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      <MetricCard
        label="Total Sales (Deposits)"
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
        label="Total Leads"
        value={formatNumber(Number(totals.total_leads ?? 0))}
        hint={`${formatPercent(Number(totals.booking_rate ?? 0) * 100)} booking rate`}
        loading={loading}
      />
      <MetricCard
        label="Cancellations"
        value={formatNumber(Number(totals.cancellations ?? 0))}
        hint={`${formatPercent(Number(totals.cancellation_rate ?? 0) * 100)} cancel rate`}
        loading={loading}
      />
      {leadCost ? (
        <MetricCard
          label="Lead Cost (All Time)"
          value={formatMoney(Number(leadCost.total ?? 0))}
          hint={`${formatNumber(leadCost.by_source_company.reduce((sum, row) => sum + Number(row.lead_count ?? 0), 0))} billable leads`}
          loading={loading}
        />
      ) : null}
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

  const allTime = overviewQuery.data?.all_time;
  const last7Days = overviewQuery.data?.last_7_days;
  const totals = allTime?.totals ?? {};
  const agents = allTime?.top_agents ?? [];
  const loading = overviewQuery.isLoading;
  const showProductionExtras = scope === "production";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Dashboard</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Overview</h1>
        <p className="mt-2 max-w-2xl text-steel">
          {DATABASE_SCOPE_LABELS[scope]} performance at a glance for Vantage Movers. Switch the database from the
          header. Start a workflow or jump into operational data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/bookings/new"
          className="group flex items-center justify-between rounded-md border border-trust-blue/20 bg-primary p-5 text-white shadow-[0_6px_16px_rgba(20,93,160,0.28)] transition-all hover:-translate-y-0.5 hover:bg-navy hover:text-white hover:shadow-[0_12px_26px_rgba(6,43,85,0.30)]"
        >
          <div className="flex items-center gap-3">
            <PlusCircle className="h-6 w-6" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-white">Create a Booking</p>
              <p className="text-sm text-white/80">Book a form or call lead into a deal.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <Link
          href="/cancellations/new"
          className="group flex items-center justify-between rounded-md border border-steel-200 bg-white p-5 shadow-sm transition-colors hover:border-steel-200 hover:bg-steel-100"
        >
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold">Create a Cancellation</p>
              <p className="text-sm text-muted-foreground">Cancel an existing booking or booked lead.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>

      {overviewQuery.isError ? (
        <FeedbackMessage tone="error">
          {overviewQuery.error instanceof Error ? overviewQuery.error.message : "Unable to load summary metrics."}
        </FeedbackMessage>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Time</h2>
        <TotalsCards
          totals={totals}
          loading={loading}
          leadCost={showProductionExtras ? allTime?.lead_cost : null}
        />
        {showProductionExtras && allTime?.lead_cost ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Cost by Source (All Time)</CardTitle>
              <CardDescription>
                By source company and registered child granularity (production), using stored CPL values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OverviewSourceCompanyTable
                rows={allTime.lead_cost.by_source_company}
                loading={loading}
                emptyMessage="No lead cost data available."
                showLeadCost
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {showProductionExtras && last7Days ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Last 7 Days</h2>
            <p className="text-sm text-muted-foreground">Rolling window for production activity only.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Sales (Deposits)"
              value={formatMoney(Number(last7Days.totals.total_deposit_amount ?? 0))}
              hint={`${formatMoney(Number(last7Days.totals.total_binder_amount ?? 0))} agent binder`}
              loading={loading}
            />
            <MetricCard
              label="Bookings"
              value={formatNumber(Number(last7Days.totals.bookings ?? 0))}
              hint={`${formatNumber(Number(last7Days.totals.active_bookings ?? 0))} active deals`}
              loading={loading}
            />
            <MetricCard
              label="Booking Rate"
              value={formatPercent(Number(last7Days.totals.booking_rate ?? 0) * 100)}
              hint={`${formatNumber(Number(last7Days.totals.total_leads ?? 0))} leads`}
              loading={loading}
            />
            <MetricCard
              label="Cancel Rate"
              value={formatPercent(Number(last7Days.totals.cancellation_rate ?? 0) * 100)}
              hint={`${formatNumber(Number(last7Days.totals.cancelled_bookings ?? 0))} cancelled bookings`}
              loading={loading}
            />
            <MetricCard
              label="Lead Cost"
              value={formatMoney(Number(last7Days.lead_cost.total ?? 0))}
              hint={`${formatNumber(last7Days.lead_cost.by_source_company.reduce((sum, row) => sum + Number(row.lead_count ?? 0), 0))} billable leads`}
              loading={loading}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Source Company</CardTitle>
                <CardDescription>
                  By source company and registered child granularity (production) for the last 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OverviewSourceCompanyTable
                  rows={last7Days.by_source_company}
                  loading={loading}
                  emptyMessage="No source company sales in the last 7 days."
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lead Cost by Source</CardTitle>
                <CardDescription>
                  By source company and registered child granularity (production), with stored CPL totals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OverviewSourceCompanyTable
                  rows={last7Days.lead_cost.by_source_company}
                  loading={loading}
                  emptyMessage="No lead cost data in the last 7 days."
                  showLeadCost
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
                Top Agents (Last 7 Days)
              </CardTitle>
              <CardDescription>Ranked by deposit amount with booking count shown.</CardDescription>
            </CardHeader>
            <CardContent>
              <AgentRankingList
                agents={last7Days.top_agents}
                loading={loading}
                emptyMessage="No agent booking data in the last 7 days."
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
                Top Sales by Agent
              </CardTitle>
              <CardDescription>
                Ranked by total deposit amount ({DATABASE_SCOPE_LABELS[scope].toLowerCase()}).
              </CardDescription>
            </div>
            <Link
              href="/agents"
              className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <AgentRankingList
              agents={agents}
              loading={loading}
              emptyMessage="No agent booking data available."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jump To</CardTitle>
            <CardDescription>Operational data and reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quickLinks
                .filter((link) => !link.ownerOnly || role === "owner")
                .map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{link.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{link.description}</span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
