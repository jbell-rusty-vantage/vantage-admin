"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  PhoneCall,
  PlusCircle,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableLoadingState } from "@/components/data-table/table-states";
import { fetchAnalyticsReport } from "@/lib/api/admin";
import type { SerializableFilters } from "@/lib/api/filters";
import { queryKeys } from "@/lib/query/keys";

const PRODUCTION_FILTERS: SerializableFilters = { database_scope: "production" };

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

type SummaryTotals = {
  total_binder_amount?: number;
  total_deposit_amount?: number;
  total_refund_amount?: number;
  bookings?: number;
  active_bookings?: number;
  cancellations?: number;
  total_leads?: number;
  form_leads?: number;
  call_leads?: number;
  booking_rate?: number;
  cancellation_rate?: number;
};

type AgentRow = {
  agent_name?: string;
  bookings?: number;
  total_binder_amount?: number;
  total_deposit_amount?: number;
};

const quickLinks = [
  { href: "/form-leads", label: "Form Leads", description: "Web form submissions", icon: Users },
  { href: "/call-leads", label: "Call Leads", description: "Inbound phone leads", icon: PhoneCall },
  { href: "/bookings", label: "Bookings", description: "Booked deals", icon: PlusCircle },
  { href: "/cancellations", label: "Cancellations", description: "Cancelled deals", icon: XCircle },
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

export function HomeOverview() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.dashboard.overview({ report: "summary", ...PRODUCTION_FILTERS }),
    queryFn: () => fetchAnalyticsReport("summary", PRODUCTION_FILTERS),
  });
  const agentQuery = useQuery({
    queryKey: queryKeys.dashboard.overview({ report: "agent-performance", ...PRODUCTION_FILTERS }),
    queryFn: () => fetchAnalyticsReport("agent-performance", PRODUCTION_FILTERS),
  });

  const totals = (summaryQuery.data?.data as { totals?: SummaryTotals } | undefined)?.totals ?? {};
  const agents = ((agentQuery.data?.data as { items?: AgentRow[] } | undefined)?.items ?? []).slice(0, 5);
  const topBinder = agents.reduce((max, agent) => Math.max(max, Number(agent.total_binder_amount ?? 0)), 0);

  const summaryLoading = summaryQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Production performance at a glance for Vantage Movers. Start a workflow or jump into operational data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/bookings/new"
          className="group flex items-center justify-between rounded-lg border bg-primary p-5 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <div className="flex items-center gap-3">
            <PlusCircle className="h-6 w-6" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold">Create a Booking</p>
              <p className="text-sm text-primary-foreground/80">Book a form or call lead into a deal.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <Link
          href="/cancellations/new"
          className="group flex items-center justify-between rounded-lg border bg-background p-5 shadow-sm transition-colors hover:bg-muted"
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

      {summaryQuery.isError ? (
        <FeedbackMessage tone="error">
          {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Unable to load summary metrics."}
        </FeedbackMessage>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Revenue (Binder)"
          value={formatMoney(Number(totals.total_binder_amount ?? 0))}
          hint={`${formatMoney(Number(totals.total_deposit_amount ?? 0))} deposits collected`}
          loading={summaryLoading}
        />
        <MetricCard
          label="Bookings"
          value={formatNumber(Number(totals.bookings ?? 0))}
          hint={`${formatNumber(Number(totals.active_bookings ?? 0))} active deals`}
          loading={summaryLoading}
        />
        <MetricCard
          label="Total Leads"
          value={formatNumber(Number(totals.total_leads ?? 0))}
          hint={`${(Number(totals.booking_rate ?? 0) * 100).toFixed(1)}% booking rate`}
          loading={summaryLoading}
        />
        <MetricCard
          label="Cancellations"
          value={formatNumber(Number(totals.cancellations ?? 0))}
          hint={`${(Number(totals.cancellation_rate ?? 0) * 100).toFixed(1)}% cancel rate`}
          loading={summaryLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
                Top Sales by Agent
              </CardTitle>
              <CardDescription>Ranked by total binder amount (production).</CardDescription>
            </div>
            <Link
              href="/agents"
              className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {agentQuery.isLoading ? (
              <TableLoadingState label="Loading agents..." />
            ) : agents.length === 0 ? (
              <FeedbackMessage>No agent booking data available.</FeedbackMessage>
            ) : (
              <ol className="space-y-3">
                {agents.map((agent, index) => {
                  const binder = Number(agent.total_binder_amount ?? 0);
                  const pct = topBinder > 0 ? Math.round((binder / topBinder) * 100) : 0;
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
                          {formatMoney(binder)}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatNumber(Number(agent.bookings ?? 0))} bookings
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Jump To</CardTitle>
            <CardDescription>Operational data and reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quickLinks.map((link) => {
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
