"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FilterBar } from "@/components/filters/filter-bar";
import { FilterField } from "@/components/filters/filter-field";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { SelectFilter } from "@/components/filters/select-filter";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DataTable } from "@/components/data-table/table-shell";
import { analyticsExportUrl, fetchAnalyticsReport, type AnalyticsReport } from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import type { DatabaseScope } from "@/lib/api/types";
import {
  AGENT_OPTIONS,
  DATABASE_SCOPE_LABELS,
  LOCAL_TYPE_OPTIONS,
  MERCHANT_OPTIONS,
  SOURCE_COMPANY_OPTIONS,
} from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";

const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

const reports: { id: AnalyticsReport; title: string; kind: "area" | "bar" }[] = [
  { id: "revenue-trend", title: "Revenue Trend", kind: "area" },
  { id: "source-company-performance", title: "Source Company Performance", kind: "bar" },
  { id: "agent-performance", title: "Agent Performance", kind: "bar" },
  { id: "booking-cancellation-ratio", title: "Booking And Cancellation Ratio", kind: "area" },
  { id: "cancellation-reasons", title: "Cancellation Reasons", kind: "bar" },
  { id: "local-vs-long-distance", title: "Local Vs Long Distance", kind: "bar" },
  { id: "geographic-lanes", title: "Geographic Lanes", kind: "bar" },
];

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

// Recharts' ResponsiveContainer logs a width(-1)/height(-1) warning when it
// tries to measure before the element has layout (server render and first
// client paint). Only mounting the container after the effect runs guarantees
// a measurable box and removes the warning.
function ChartFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const mounted = useMounted();
  return (
    <div className={className ?? "h-72"}>
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMoneyKey(key: string): boolean {
  return /amount|revenue|deposit|binder|refund|total|value/i.test(key);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? formatNumber(value) : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function addDisplayFields(row: Record<string, unknown>, sourceKey?: string): Record<string, unknown> {
  const next = { ...row };
  if (sourceKey && !("category" in next)) {
    next.category = humanizeKey(sourceKey);
  }
  if ((sourceKey === "form_lanes" || sourceKey === "call_lanes") && !("lead_type" in next)) {
    next.lead_type = sourceKey === "form_lanes" ? "Form Leads" : "Call Leads";
  }
  if (!("lane" in next) && ("pickup_state" in next || "delivery_state" in next)) {
    next.lane = `${formatCellValue(next.pickup_state)} to ${formatCellValue(next.delivery_state)}`;
  }
  return next;
}

function flattenRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item)) {
        return [addDisplayFields(item)];
      }
      return [{ label: formatCellValue(item), value: item }];
    });
  }
  if (isRecord(value)) {
    const object = value;
    for (const key of ["rows", "items", "series", "data", "trend", "results", "by_source_company"]) {
      const rows = flattenRows(object[key]);
      if (rows.length) {
        return rows;
      }
    }
    const arrayEntries = Object.entries(object).filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
    if (arrayEntries.length) {
      return arrayEntries.flatMap(([key, rows]) => flattenRows(rows).map((row) => addDisplayFields(row, key)));
    }
    return Object.entries(object).map(([key, nested]) => {
      if (isRecord(nested)) {
        return addDisplayFields({ label: humanizeKey(key), ...nested }, key);
      }
      return { label: humanizeKey(key), value: nested };
    });
  }
  return [];
}

function chartKeys(rows: Record<string, unknown>[]) {
  const first = rows[0] ?? {};
  const keys = Object.keys(first);
  const labelKey =
    [
      "period",
      "date",
      "day",
      "month",
      "lane",
      "source_company",
      "agent_name",
      "agent",
      "reason",
      "lead_source",
      "local_type",
      "lead_type",
      "label",
      "category",
      "name",
    ].find((key) => keys.includes(key) && ["string", "number", "boolean"].includes(typeof first[key])) ??
    keys.find((key) => /date|day|month|label|source|agent|reason|local|lane|name|state|type|category/i.test(key) && ["string", "number", "boolean"].includes(typeof first[key])) ??
    keys.find((key) => ["string", "number", "boolean"].includes(typeof first[key])) ??
    "label";
  const valueKey =
    keys.find((key) => key !== labelKey && typeof first[key] === "number") ??
    "value";
  return { labelKey, valueKey };
}

function ChartTooltip({
  active,
  payload,
  label,
  valueKey,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string | number;
  valueKey: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{String(label)}</p>
      <p className="text-muted-foreground">
        {humanizeKey(valueKey)}: {isMoneyKey(valueKey) ? formatMoney(value) : formatNumber(value)}
      </p>
    </div>
  );
}

function ReportCard({ report, filters }: { report: (typeof reports)[number]; filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report(report.id, filters),
    queryFn: () => fetchAnalyticsReport(report.id, filters),
  });
  const rows = flattenRows(query.data?.data);
  const { labelKey, valueKey } = chartKeys(rows);
  const money = isMoneyKey(valueKey);
  const axisFormatter = (value: number) => (money ? formatCompact(value) : formatNumber(value));

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{report.title}</h2>
          <p className="text-xs text-muted-foreground">
            {humanizeKey(valueKey)} by {humanizeKey(labelKey)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCsvFromProxy(analyticsExportUrl(report.id, filters), `${report.id}.csv`)}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          CSV
        </Button>
      </div>
      {query.isLoading ? <TableLoadingState label="Loading analytics..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {rows.length ? (
        <div className="space-y-4">
          <ChartFrame>
              {report.kind === "area" ? (
                <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id={`fill-${report.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip valueKey={valueKey} />} />
                  <Area
                    type="monotone"
                    dataKey={valueKey}
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    fill={`url(#fill-${report.id})`}
                  />
                </AreaChart>
              ) : (
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={rows.length > 6 ? -20 : 0} textAnchor={rows.length > 6 ? "end" : "middle"} height={rows.length > 6 ? 56 : 30} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip valueKey={valueKey} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
                    {rows.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
          </ChartFrame>
          <DataTable<Record<string, unknown>>
            items={rows.slice(0, 10)}
            getRowKey={(row) => String(row[labelKey] ?? Math.random())}
            columns={Object.keys(rows[0] ?? {}).slice(0, 6).map((key) => ({
              key,
              header: humanizeKey(key),
              cell: (row) =>
                typeof row[key] === "number" && isMoneyKey(key)
                  ? formatMoney(row[key] as number)
                  : formatCellValue(row[key]),
            }))}
          />
        </div>
      ) : query.data ? (
        <FeedbackMessage>No analytics data for these filters.</FeedbackMessage>
      ) : null}
    </section>
  );
}

function PieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  total: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const value = Number(payload[0]?.value ?? 0);
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{String(payload[0]?.name ?? "")}</p>
      <p className="text-muted-foreground">
        {formatMoney(value)} · {pct}%
      </p>
    </div>
  );
}

function DepositBySourcePie({ filters }: { filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report("source-company-performance", filters),
    queryFn: () => fetchAnalyticsReport("source-company-performance", filters),
  });
  const items = ((query.data?.data as { items?: Record<string, unknown>[] } | undefined)?.items ?? [])
    .map((row) => ({
      name: humanizeKey(String(row.source_company ?? "unknown")),
      value: Number(row.total_deposit_amount ?? 0),
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
  const total = items.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Deposit Amount by Source Company</h2>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${formatMoney(total)} total deposits` : "Total deposits split by source company"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsvFromProxy(
              analyticsExportUrl("source-company-performance", filters),
              "source-company-performance.csv",
            )
          }
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          CSV
        </Button>
      </div>
      {query.isLoading ? <TableLoadingState label="Loading deposits..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {items.length ? (
        <ChartFrame className="h-80">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
            >
              {items.map((_, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip total={total} />} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ChartFrame>
      ) : query.data ? (
        <FeedbackMessage>No deposit data for these filters.</FeedbackMessage>
      ) : null}
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SummaryCards({ filters }: { filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report("summary", filters),
    queryFn: () => fetchAnalyticsReport("summary", filters),
  });
  const totals = (query.data?.data as { totals?: Record<string, number> } | undefined)?.totals;

  if (query.isLoading) {
    return <TableLoadingState label="Loading summary..." />;
  }
  if (!totals) {
    return null;
  }

  const num = (key: string) => Number(totals[key] ?? 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Revenue (Binder)"
        value={formatMoney(num("total_binder_amount"))}
        hint={`${formatMoney(num("total_deposit_amount"))} deposits collected`}
      />
      <KpiCard
        label="Bookings"
        value={formatNumber(num("bookings"))}
        hint={`${formatNumber(num("active_bookings"))} active`}
      />
      <KpiCard
        label="Total Leads"
        value={formatNumber(num("total_leads"))}
        hint={`${(num("booking_rate") * 100).toFixed(1)}% booking rate`}
      />
      <KpiCard
        label="Cancellations"
        value={formatNumber(num("cancellations"))}
        hint={`${(num("cancellation_rate") * 100).toFixed(1)}% cancel rate · ${formatMoney(num("total_refund_amount"))} refunded`}
      />
    </div>
  );
}

export function AnalyticsDashboard() {
  const { filters, update, reset } = useUrlTableState({ database_scope: "production" });
  const scope = (filters.database_scope ?? "production") as DatabaseScope;
  const reportFilters: SerializableFilters = {
    database_scope: scope,
    from: filters.from,
    to: filters.to,
    source_company: filters.source_company,
    agent: filters.agent,
    merchant: filters.merchant,
    local: filters.local,
    lead_type: filters.lead_type,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Charts and backing tables use the backend analytics API. Change the database scope from the header.
          </p>
        </div>
        <StatusBadge tone={scope === "historical" ? "warning" : scope === "combined" ? "muted" : "success"}>
          Scope: {DATABASE_SCOPE_LABELS[scope]}
        </StatusBadge>
      </div>
      <FilterBar onReset={reset}>
        <FilterField label="Date range">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update(range)}
          />
        </FilterField>
        <FilterField label="Source company">
          <SelectFilter value={String(filters.source_company ?? "")} options={SOURCE_COMPANY_OPTIONS} onChange={(value) => update({ source_company: value })} />
        </FilterField>
        <FilterField label="Agent">
          <SelectFilter value={String(filters.agent ?? "")} options={AGENT_OPTIONS} onChange={(value) => update({ agent: value })} />
        </FilterField>
        <FilterField label="Merchant">
          <SelectFilter value={String(filters.merchant ?? "")} options={MERCHANT_OPTIONS} onChange={(value) => update({ merchant: value })} />
        </FilterField>
        <FilterField label="Local">
          <SelectFilter value={String(filters.local ?? "")} options={LOCAL_TYPE_OPTIONS} onChange={(value) => update({ local: value })} />
        </FilterField>
      </FilterBar>
      <SummaryCards filters={reportFilters} />
      <div className="grid gap-5 xl:grid-cols-2">
        <DepositBySourcePie filters={reportFilters} />
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} filters={reportFilters} />
        ))}
      </div>
    </div>
  );
}
