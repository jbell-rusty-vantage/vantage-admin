"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileBarChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { DataTable } from "@/components/data-table/table-shell";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { formatDateTime } from "@/components/data-table/formatters";
import {
  fetchObservabilityOverview,
  observabilityEventsExportUrl,
  type ObservabilityOverviewResponse,
  type OperationalEvent,
  type OperationalIncident,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { formatDurationMs, humanizeKey } from "./entity-link";
import { IncidentStatusBadge, LevelBadge, SeverityBadge } from "./severity-badge";

const STATUS_STYLES: Record<string, string> = {
  healthy: "text-emerald-700",
  degraded: "text-amber-700",
  critical: "text-destructive",
};

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  const mounted = useMounted();
  return (
    <div className="h-64">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  href,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  valueClassName?: string;
}) {
  const body = (
    <div className="rounded-lg border bg-background p-4 transition-colors hover:border-steel-200">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold", valueClassName)}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function CountBarChart({
  title,
  rows,
  linkPrefix,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
  linkPrefix?: string;
}) {
  const data = rows.map((row) => ({ ...row, label: humanizeKey(String(row.key)) }));
  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events in this period.</p>
      ) : (
        <ChartFrame>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} height={50} textAnchor="end" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartFrame>
      )}
      {linkPrefix && data.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {data.slice(0, 6).map((row) => (
            <Link
              key={row.key}
              href={`${linkPrefix}${encodeURIComponent(String(row.key))}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {row.label} ({row.count})
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ObservationalOverview() {
  const [exportError, setExportError] = useState<string | null>(null);
  const query = useQuery<ObservabilityOverviewResponse>({
    queryKey: queryKeys.observability.overview(),
    queryFn: () => fetchObservabilityOverview({}),
    refetchInterval: 60_000,
  });

  if (query.isPending) {
    return <TableLoadingState label="Loading operational overview..." />;
  }
  if (query.isError) {
    return (
      <TableErrorState
        title="Unable to load the operational overview."
        error={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  const sheetSync = (data.sheet_sync ?? {}) as Record<string, unknown>;
  const sheetPending = typeof sheetSync.pending === "number" ? sheetSync.pending : null;
  const sheetProcessing = typeof sheetSync.processing === "number" ? sheetSync.processing : 0;
  const sheetFailed = typeof sheetSync.failed === "number" ? sheetSync.failed : 0;
  const eventsToday = data.event_counts_by_level.reduce((sum, row) => sum + row.count, 0);

  async function exportTodayEvents() {
    setExportError(null);
    try {
      await downloadCsvFromProxy(
        observabilityEventsExportUrl({ from: data.period.from, to: data.period.to }),
        "operational-events.csv",
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Period {formatDateTime(data.period.from)} – {formatDateTime(data.period.to)} (
          {data.period.timezone}). Generated {formatDateTime(data.generated_at)}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", query.isFetching ? "animate-spin" : undefined)} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportTodayEvents}>
            <Download className="mr-2 h-4 w-4" />
            Export events CSV
          </Button>
          <Link
            href="/ingestion/granot/lifecycle/health"
            className="inline-flex h-10 items-center justify-center rounded-md border border-steel-200 bg-white px-4 py-2 font-heading text-sm font-bold uppercase tracking-wide text-navy shadow-sm transition-all hover:border-trust-blue/30 hover:bg-steel-100"
          >
            Granot lifecycle health
          </Link>
          <Link
            href="/observational?tab=reports&report_key=daily-owner-operational-summary"
            className="inline-flex h-10 items-center justify-center rounded-md border border-steel-200 bg-white px-4 py-2 font-heading text-sm font-bold uppercase tracking-wide text-navy shadow-sm transition-all hover:border-trust-blue/30 hover:bg-steel-100"
          >
            <FileBarChart className="mr-2 h-4 w-4" />
            Run daily report
          </Link>
        </div>
      </div>

      {exportError ? <FeedbackMessage tone="error">{exportError}</FeedbackMessage> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Overall status"
          value={humanizeKey(data.health.overall_status)}
          valueClassName={STATUS_STYLES[data.health.overall_status]}
          href="/observational?tab=incidents&status=open"
        />
        <MetricCard
          label="Open critical"
          value={data.health.open_critical}
          valueClassName={data.health.open_critical > 0 ? "text-destructive" : undefined}
          href="/observational?tab=incidents&status=open&severity=critical"
        />
        <MetricCard
          label="Open errors"
          value={data.health.open_error}
          valueClassName={data.health.open_error > 0 ? "text-destructive" : undefined}
          href="/observational?tab=incidents&status=open&severity=error"
        />
        <MetricCard
          label="Open warnings"
          value={data.health.open_warn}
          valueClassName={data.health.open_warn > 0 ? "text-amber-700" : undefined}
          href="/observational?tab=incidents&status=open&severity=warn"
        />
        <MetricCard label="Events today" value={eventsToday} href="/observational?tab=events" />
        <MetricCard
          label="Notifications sent today"
          value={data.notifications.sent_today}
          href="/observational?tab=notifications&status=sent"
        />
        <MetricCard
          label="Notification failures today"
          value={data.notifications.failed_today}
          valueClassName={data.notifications.failed_today > 0 ? "text-destructive" : undefined}
          href="/observational?tab=notifications&status=failed"
        />
        <MetricCard
          label="Sheet sync active jobs"
          value={
            sheetPending !== null
              ? `${sheetPending} pending / ${sheetProcessing} processing / ${sheetFailed} failed`
              : "-"
          }
          valueClassName={sheetFailed > 0 ? "text-destructive" : sheetProcessing > 0 ? "text-amber-700" : undefined}
          href="/observational?tab=sheet-sync"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CountBarChart
          title="Events by level"
          rows={data.event_counts_by_level.map((row) => ({ key: String(row.key), count: row.count }))}
          linkPrefix="/observational?tab=events&level="
        />
        <CountBarChart
          title="Events by category"
          rows={data.event_counts_by_category.map((row) => ({ key: String(row.key), count: row.count }))}
          linkPrefix="/observational?tab=events&category="
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-semibold">Top workflows by event volume</h3>
          {data.event_counts_by_workflow.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events in this period.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.event_counts_by_workflow.slice(0, 12).map((row) => (
                <li key={String(row.key)} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/observational?tab=events&workflow=${encodeURIComponent(String(row.key))}`}
                    className="text-primary hover:underline"
                  >
                    {humanizeKey(String(row.key))}
                  </Link>
                  <span className="font-medium tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-background p-4">
          <h3 className="mb-3 text-sm font-semibold">Integrations</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Sheet sync mode</span>
              <span className="font-medium">{String(sheetSync.mode ?? "-")}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Sheet sync backlog age</span>
              <span className="font-medium">
                {formatDurationMs(typeof sheetSync.backlog_age_ms === "number" ? sheetSync.backlog_age_ms : null)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>RingCentral open incidents</span>
              <Link
                href="/observational?tab=incidents&category=ringcentral&status=open"
                className={cn(
                  "font-medium",
                  data.ringcentral.open_incidents > 0 ? "text-destructive" : undefined,
                )}
              >
                {data.ringcentral.open_incidents}
              </Link>
            </li>
            <li className="flex items-center justify-between">
              <span>Notifications suppressed today</span>
              <span className="font-medium">{data.notifications.suppressed_today}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top open incidents</h3>
          <Link
            href="/observational?tab=incidents&status=open"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all incidents
          </Link>
        </div>
        {data.top_open_incidents.length === 0 ? (
          <FeedbackMessage tone="success">No open incidents. All clear.</FeedbackMessage>
        ) : (
          <DataTable<OperationalIncident>
            items={data.top_open_incidents}
            getRowKey={(incident) => incident._id}
            compact
            columns={[
              {
                key: "last_seen_at",
                header: "Last Seen",
                cell: (incident) => formatDateTime(incident.last_seen_at),
              },
              {
                key: "severity",
                header: "Severity",
                cell: (incident) => <SeverityBadge severity={incident.severity} />,
              },
              {
                key: "status",
                header: "Status",
                cell: (incident) => <IncidentStatusBadge status={incident.status} />,
              },
              {
                key: "title",
                header: "Title",
                truncate: true,
                cell: (incident) => (
                  <Link
                    href={`/observational?tab=incidents&record=${incident._id}`}
                    className="text-primary hover:underline"
                  >
                    {incident.title}
                  </Link>
                ),
              },
              {
                key: "workflow",
                header: "Workflow",
                cell: (incident) => humanizeKey(incident.workflow),
              },
              { key: "count", header: "Count", cell: (incident) => incident.count ?? 1 },
            ]}
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent critical events</h3>
          <Link
            href="/observational?tab=events&level=critical"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all critical events
          </Link>
        </div>
        {data.recent_critical_events.length === 0 ? (
          <FeedbackMessage tone="success">No critical events in this period.</FeedbackMessage>
        ) : (
          <DataTable<OperationalEvent>
            items={data.recent_critical_events}
            getRowKey={(event) => event._id}
            compact
            columns={[
              {
                key: "occurred_at",
                header: "Occurred",
                cell: (event) => formatDateTime(event.occurred_at),
              },
              {
                key: "level",
                header: "Level",
                cell: (event) => <LevelBadge level={event.level} />,
              },
              {
                key: "event_key",
                header: "Event",
                cell: (event) => (
                  <Link
                    href={`/observational?tab=events&record=${event._id}`}
                    className="text-primary hover:underline"
                  >
                    {event.event_key}
                  </Link>
                ),
              },
              { key: "summary", header: "Summary", truncate: true, cell: (event) => event.summary },
              {
                key: "source_company",
                header: "Source",
                cell: (event) => event.source_company ?? "-",
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
