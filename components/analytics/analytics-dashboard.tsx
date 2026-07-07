"use client";

import { useEffect, useMemo } from "react";
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
import { DataTable, type DataTableColumn } from "@/components/data-table/table-shell";
import { analyticsExportUrl, fetchAnalyticsReport, type AnalyticsReport } from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { useFacetOptions, type FacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import type { DatabaseScope, SelectOption } from "@/lib/api/types";
import { DATABASE_SCOPE_LABELS, LOCAL_TYPE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { useDatabaseScope } from "@/lib/state/database-scope";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#2563eb", "#16a34a", "#db2777", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];

const GRANULARITY_OPTIONS: SelectOption[] = [
  { value: "day", label: "Daily" },
  { value: "month", label: "Monthly" },
];

const LEAD_TYPE_OPTIONS: SelectOption[] = [
  { value: "form", label: "Form leads" },
  { value: "call", label: "Call leads" },
];

type AnalyticsView = "visualization" | "table";
type AnalyticsTabId = "overview" | "sales" | "lead-sources" | "receiver-agents" | "geography" | "cancellations";
type FilterControl =
  | "source_company"
  | "source_granularity_key"
  | "agent"
  | "receiver_agent"
  | "merchant"
  | "source"
  | "local"
  | "lead_type"
  | "granularity";

type ReportConfig = {
  id: AnalyticsReport;
  label: string;
  description: string;
  kind: "area" | "bar" | "pie" | "table";
};

type TabConfig = {
  id: AnalyticsTabId;
  label: string;
  description: string;
  reports: ReportConfig[];
  filters: FilterControl[];
  primaryReport: AnalyticsReport;
};

const TAB_CONFIGS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Executive summary across leads, bookings, revenue, cancellations, cost, and receiver attribution.",
    primaryReport: "summary",
    filters: ["source_company", "source_granularity_key"],
    reports: [
      { id: "summary", label: "Executive Summary", description: "Top-level business totals for the selected period.", kind: "bar" },
      { id: "source-company-performance", label: "Deposit Mix", description: "Deposit amount by source company.", kind: "pie" },
      { id: "receiver-agent-performance", label: "Receiver Attribution Health", description: "Production receiver-agent coverage signal.", kind: "bar" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    description: "Revenue, closing performance, and booking/cancellation outcomes.",
    primaryReport: "revenue-trend",
    filters: ["source_company", "source_granularity_key", "agent", "merchant", "source", "granularity"],
    reports: [
      { id: "revenue-trend", label: "Revenue Trend", description: "Binder and deposit movement over time.", kind: "area" },
      { id: "agent-performance", label: "Agent Sales Performance", description: "Sales allocation performance, not receiver attribution.", kind: "bar" },
      { id: "booking-cancellation-ratio", label: "Booking And Cancellation Ratio", description: "Booked and cancelled lead outcomes.", kind: "bar" },
    ],
  },
  {
    id: "lead-sources",
    label: "Lead Sources",
    description: "Source-company funnel, CPL efficiency, and lead source quality.",
    primaryReport: "source-company-performance",
    filters: ["source_company", "source_granularity_key", "lead_type", "local"],
    reports: [
      { id: "source-company-performance", label: "Source Company Performance", description: "Bookings and revenue by source company.", kind: "bar" },
      { id: "source-company-funnel", label: "Source Company Funnel", description: "Lead volume and booking reconciliation by source.", kind: "bar" },
      { id: "lead-source-performance", label: "Lead Source Performance", description: "Booked-lead performance by CRM source label.", kind: "bar" },
    ],
  },
  {
    id: "receiver-agents",
    label: "Receiver Agents",
    description: "Received-lead workload, lead cost, and downstream booking/cancellation outcomes.",
    primaryReport: "receiver-agent-performance",
    filters: ["source_company", "source_granularity_key", "receiver_agent", "lead_type", "granularity"],
    reports: [
      { id: "receiver-agent-performance", label: "Performance", description: "Received, billable, booked, cancelled, and cost metrics by receiver agent.", kind: "bar" },
      { id: "receiver-agent-trend", label: "Trend", description: "Received lead volume over time by receiver agent.", kind: "area" },
      { id: "receiver-agent-source-breakdown", label: "Source Breakdown", description: "Source mix and quality by receiver agent and lead type.", kind: "table" },
    ],
  },
  {
    id: "geography",
    label: "Geography",
    description: "Pickup, delivery, lane, and local-vs-long-distance performance.",
    primaryReport: "pickup-state-performance",
    filters: ["source_company", "source_granularity_key", "lead_type", "local"],
    reports: [
      { id: "pickup-state-performance", label: "Pickup State", description: "Lead and booking performance by pickup state.", kind: "bar" },
      { id: "delivery-state-performance", label: "Delivery State", description: "Lead and booking performance by delivery state.", kind: "bar" },
      { id: "geographic-lanes", label: "Pickup To Delivery Lanes", description: "Full lane performance across form and call leads.", kind: "bar" },
      { id: "local-vs-long-distance", label: "Local Vs Long Distance", description: "Booking performance by move type.", kind: "bar" },
    ],
  },
  {
    id: "cancellations",
    label: "Cancellations",
    description: "Cancellation reasons, cancellation rate, and refund impact.",
    primaryReport: "cancellation-reasons",
    filters: ["source_company", "source_granularity_key", "merchant", "source"],
    reports: [
      { id: "cancellation-reasons", label: "Cancellation Reasons", description: "Refund and cancellation impact by reason.", kind: "bar" },
      { id: "booking-cancellation-ratio", label: "Booking And Cancellation Ratio", description: "Booked, cancelled, and active booked leads.", kind: "bar" },
    ],
  },
];

const TAB_SPECIFIC_FILTERS = ["source_granularity_key", "agent", "receiver_agent", "merchant", "source", "local", "lead_type", "granularity", "report"] as const;

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function parseTab(value: unknown): AnalyticsTabId {
  return TAB_CONFIGS.some((tab) => tab.id === value) ? (value as AnalyticsTabId) : "overview";
}

function parseView(value: unknown): AnalyticsView {
  return value === "table" ? "table" : "visualization";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanizeKey(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMoneyKey(key: string): boolean {
  return /amount|revenue|deposit|binder|refund|total_lead_cost|cpl|cost/i.test(key);
}

function isRateKey(key: string): boolean {
  return /rate$/i.test(key);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCellValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    if (isRateKey(key)) return `${(value * 100).toFixed(1)}%`;
    if (isMoneyKey(key)) return formatMoney(value);
    return Number.isInteger(value) ? formatNumber(value) : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function addDisplayFields(row: Record<string, unknown>, sourceKey?: string): Record<string, unknown> {
  const next = { ...row };
  if (sourceKey && !("category" in next)) next.category = humanizeKey(sourceKey);
  if ((sourceKey === "form_lanes" || sourceKey === "call_lanes") && !("lead_type" in next)) {
    next.lead_type = sourceKey === "form_lanes" ? "FormLead" : "CallLead";
  }
  if (!("lane" in next) && ("pickup_state" in next || "delivery_state" in next)) {
    next.lane = `${formatCellValue("pickup_state", next.pickup_state)} -> ${formatCellValue("delivery_state", next.delivery_state)}`;
  }
  return next;
}

function flattenRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (isRecord(item) ? [addDisplayFields(item)] : [{ label: String(item), value: item }]));
  }
  if (isRecord(value)) {
    for (const key of ["rows", "items", "series", "data", "trend", "results", "by_source_company"]) {
      const rows = flattenRows(value[key]);
      if (rows.length) return rows;
    }
    const arrayEntries = Object.entries(value).filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]));
    if (arrayEntries.length) {
      return arrayEntries.flatMap(([key, rows]) => flattenRows(rows).map((row) => addDisplayFields(row, key)));
    }
    return Object.entries(value).map(([key, nested]) => (isRecord(nested) ? addDisplayFields({ label: humanizeKey(key), ...nested }, key) : { label: humanizeKey(key), value: nested }));
  }
  return [];
}

function chartKeys(rows: Record<string, unknown>[]) {
  const first = rows[0] ?? {};
  const keys = Object.keys(first);
  const labelKey =
    [
      "period",
      "receiver_agent_name",
      "source_label",
      "source_company",
      "agent_name",
      "agent",
      "reason",
      "lead_source",
      "local_type",
      "lane",
      "state",
      "lead_type",
      "label",
      "category",
    ].find((key) => keys.includes(key) && ["string", "number", "boolean"].includes(typeof first[key])) ??
    keys.find((key) => ["string", "number", "boolean"].includes(typeof first[key])) ??
    "label";
  const preferredValues = [
    "received_leads",
    "total_binder_amount",
    "total_deposit_amount",
    "bookings",
    "booked_leads",
    "leads",
    "total_leads",
    "cancellations",
    "value",
  ];
  const valueKey = preferredValues.find((key) => typeof first[key] === "number" && key !== labelKey) ?? keys.find((key) => key !== labelKey && typeof first[key] === "number") ?? "value";
  return { labelKey, valueKey };
}

function ChartFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className ?? "h-72"}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label, valueKey }: { active?: boolean; payload?: { value?: number }[]; label?: string | number; valueKey: string }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{String(label)}</p>
      <p className="text-muted-foreground">{humanizeKey(valueKey)}: {formatCellValue(valueKey, value)}</p>
    </div>
  );
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function buildFilters(filters: Record<string, unknown>, scope: DatabaseScope, tab: TabConfig): SerializableFilters {
  const supported = new Set<FilterControl>(tab.filters);
  const next: SerializableFilters = {
    database_scope: scope,
    from: str(filters.from),
    to: str(filters.to),
  };
  for (const key of ["source_company", "source_granularity_key", "agent", "receiver_agent", "merchant", "source", "local", "lead_type", "granularity"] as const) {
    if (supported.has(key) && typeof filters[key] === "string" && filters[key] !== "") {
      next[key] = filters[key];
    }
  }
  if (tab.id === "receiver-agents" && !next.granularity) {
    next.granularity = "day";
  }
  return next;
}

function columnsForRows(rows: Record<string, unknown>[]): DataTableColumn<Record<string, unknown>>[] {
  const keys = Object.keys(rows[0] ?? {}).filter((key) => key !== "_id");
  return keys.map((key) => ({
    key,
    header: humanizeKey(key),
    cell: (row) => formatCellValue(key, row[key]),
    sticky: key === "receiver_agent_name" || key === "label" ? "left" : undefined,
  }));
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

function SummaryKpis({ filters }: { filters: SerializableFilters }) {
  const summary = useQuery({
    queryKey: queryKeys.analytics.report("summary", filters),
    queryFn: () => fetchAnalyticsReport("summary", filters),
  });
  const receiver = useQuery({
    queryKey: queryKeys.analytics.report("receiver-agent-performance", filters),
    queryFn: () => fetchAnalyticsReport("receiver-agent-performance", filters),
    enabled: filters.database_scope !== "historical",
  });
  const totals = (summary.data?.data as { totals?: Record<string, number> } | undefined)?.totals;
  const receiverRows = flattenRows(receiver.data?.data);
  const received = receiverRows.reduce((sum, row) => sum + Number(row.received_leads ?? 0), 0);
  const assigned = receiverRows
    .filter((row) => row.receiver_agent_group !== "unassigned")
    .reduce((sum, row) => sum + Number(row.received_leads ?? 0), 0);
  const receiverCoverage = received ? assigned / received : 0;

  if (summary.isLoading) return <TableLoadingState label="Loading summary..." />;
  if (!totals) return null;

  const num = (key: string) => Number(totals[key] ?? 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <KpiCard label="Revenue" value={formatMoney(num("total_binder_amount"))} hint={`${formatMoney(num("total_deposit_amount"))} deposits`} />
      <KpiCard label="Bookings" value={formatNumber(num("bookings"))} hint={`${formatNumber(num("active_bookings"))} active`} />
      <KpiCard label="Leads" value={formatNumber(num("total_leads"))} hint={`${(num("booking_rate") * 100).toFixed(1)}% booking rate`} />
      <KpiCard label="Cancellations" value={formatNumber(num("cancellations"))} hint={`${(num("cancellation_rate") * 100).toFixed(1)}% cancel rate`} />
      <KpiCard label="Refunds" value={formatMoney(num("total_refund_amount"))} />
      <KpiCard
        label="Receiver Attribution"
        value={filters.database_scope === "historical" ? "N/A" : `${(receiverCoverage * 100).toFixed(1)}%`}
        hint={filters.database_scope === "combined" ? "Production coverage; historical unavailable" : "Production received leads"}
      />
    </div>
  );
}

function ReportChart({ rows, report }: { rows: Record<string, unknown>[]; report: ReportConfig }) {
  if (report.kind === "table") {
    return <DataTable items={rows.slice(0, 12)} getRowKey={(row) => `${String(row.receiver_agent_id ?? row.label ?? row.period ?? "")}-${String(row.source_label ?? "")}-${String(row.lead_type ?? "")}`} columns={columnsForRows(rows).slice(0, 8)} horizontalControls />;
  }
  if (report.kind === "pie") {
    const { labelKey, valueKey } = chartKeys(rows);
    const items = rows
      .map((row) => ({ name: String(row.source_label ?? row.source_company ?? row[labelKey] ?? "Unknown"), value: Number(row.total_deposit_amount ?? row[valueKey] ?? 0) }))
      .filter((row) => row.value > 0)
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
    return (
      <ChartFrame className="h-80">
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2}>
            {items.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<ChartTooltip valueKey={valueKey} />} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ChartFrame>
    );
  }
  const { labelKey, valueKey } = chartKeys(rows);
  const money = isMoneyKey(valueKey);
  const axisFormatter = (value: number) => (money ? formatCompact(value) : formatNumber(value));
  const chartRows = rows.slice(0, report.id === "receiver-agent-trend" ? 60 : 12);
  if (report.kind === "area") {
    return (
      <ChartFrame>
        <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
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
          <Area type="monotone" dataKey={valueKey} stroke={CHART_COLORS[0]} strokeWidth={2} fill={`url(#fill-${report.id})`} />
        </AreaChart>
      </ChartFrame>
    );
  }
  return (
    <ChartFrame>
      <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={chartRows.length > 6 ? -20 : 0} textAnchor={chartRows.length > 6 ? "end" : "middle"} height={chartRows.length > 6 ? 56 : 30} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={axisFormatter} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTooltip valueKey={valueKey} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
          {chartRows.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

function ReportPanel({ report, filters }: { report: ReportConfig; filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report(report.id, filters),
    queryFn: () => fetchAnalyticsReport(report.id, filters),
  });
  const rows = flattenRows(query.data?.data);
  const metadata = isRecord(query.data?.data?.metadata) ? query.data.data.metadata : undefined;
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{report.label}</h2>
        <p className="text-xs text-muted-foreground">{report.description}</p>
      </div>
      {metadata?.message ? <FeedbackMessage className="mb-3">{String(metadata.message)}</FeedbackMessage> : null}
      {query.isLoading ? <TableLoadingState label="Loading analytics..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {rows.length ? <ReportChart rows={rows} report={report} /> : query.data ? <FeedbackMessage>No analytics data for these filters.</FeedbackMessage> : null}
    </section>
  );
}

function OverviewTable({ filters }: { filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report("summary", filters),
    queryFn: () => fetchAnalyticsReport("summary", filters),
  });
  const totals = (query.data?.data as { totals?: Record<string, number> } | undefined)?.totals ?? {};
  const rows = [
    { area: "Leads", primary_metric: "Total leads", value: totals.total_leads, secondary_metric: "Form / Call", secondary_value: `${totals.form_leads ?? 0} / ${totals.call_leads ?? 0}` },
    { area: "Revenue", primary_metric: "Binder", value: totals.total_binder_amount, secondary_metric: "Deposits", secondary_value: totals.total_deposit_amount },
    { area: "Bookings", primary_metric: "Bookings", value: totals.bookings, secondary_metric: "Booking rate", secondary_value: totals.booking_rate },
    { area: "Cancellations", primary_metric: "Cancellations", value: totals.cancellations, secondary_metric: "Cancellation rate", secondary_value: totals.cancellation_rate },
    { area: "Cost", primary_metric: "Refunds", value: totals.total_refund_amount, secondary_metric: "Cancelled bookings", secondary_value: totals.cancelled_bookings },
  ];
  if (query.isLoading) return <TableLoadingState label="Loading summary..." />;
  return (
    <DataTable
      items={rows}
      getRowKey={(row) => row.area}
      columns={[
        { key: "area", header: "Business area", cell: (row) => row.area, sticky: "left" },
        { key: "primary_metric", header: "Primary metric", cell: (row) => row.primary_metric },
        { key: "value", header: "Value", cell: (row) => formatCellValue(String(row.primary_metric), row.value) },
        { key: "secondary_metric", header: "Secondary metric", cell: (row) => row.secondary_metric },
        { key: "secondary_value", header: "Secondary value", cell: (row) => formatCellValue(String(row.secondary_metric), row.secondary_value) },
      ]}
    />
  );
}

function TableView({ report, filters }: { report: ReportConfig; filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report(report.id, filters),
    queryFn: () => fetchAnalyticsReport(report.id, filters),
  });
  const rows = flattenRows(query.data?.data);
  const metadata = isRecord(query.data?.data?.metadata) ? query.data.data.metadata : undefined;
  return (
    <section className="space-y-3 rounded-lg border bg-background p-4">
      <div>
        <h2 className="text-sm font-semibold">{report.label} Table</h2>
        <p className="text-xs text-muted-foreground">{report.description}</p>
      </div>
      {query.data?.generated_at ? <p className="text-xs text-muted-foreground">Last generated {new Date(query.data.generated_at).toLocaleString()}</p> : null}
      {metadata?.message ? <FeedbackMessage>{String(metadata.message)}</FeedbackMessage> : null}
      {query.isLoading ? <TableLoadingState label="Loading table..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {rows.length ? (
        <DataTable items={rows} getRowKey={(row) => `${String(row._id ?? row.receiver_agent_id ?? row.period ?? row.label ?? "")}-${String(row.source_label ?? "")}-${String(row.lead_type ?? "")}`} columns={columnsForRows(rows)} horizontalControls stickyHeader />
      ) : query.data ? (
        <FeedbackMessage>No table rows for these filters.</FeedbackMessage>
      ) : null}
    </section>
  );
}

function ViewToggle({ value, onChange }: { value: AnalyticsView; onChange: (view: AnalyticsView) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-background p-1">
      {(["visualization", "table"] as const).map((view) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
            value === view ? "bg-pale-gold/70 text-navy" : "text-steel hover:bg-steel-100 hover:text-navy",
          )}
        >
          {view === "visualization" ? "Visualization" : "Table"}
        </button>
      ))}
    </div>
  );
}

function AnalyticsFilterPanel({
  tab,
  filters,
  update,
  reset,
  facetOptions,
}: {
  tab: TabConfig;
  filters: Record<string, unknown>;
  update: (next: Record<string, string | number | boolean | null | undefined>) => void;
  reset: () => void;
  facetOptions: FacetOptions;
}) {
  const has = (control: FilterControl) => tab.filters.includes(control);
  return (
    <FilterBar onReset={reset}>
      <FilterField label="Date range">
        <DateRangeFilter from={str(filters.from)} to={str(filters.to)} onChange={(range) => update(range)} />
      </FilterField>
      {has("source_company") ? (
        <FilterField label="Source company">
          <SelectFilter value={str(filters.source_company) ?? ""} options={facetOptions.sourceCompanyOptions} placeholder="All sources" onChange={(value) => update({ source_company: value })} />
        </FilterField>
      ) : null}
      {has("source_granularity_key") && facetOptions.sourceGranularityOptions.length > 0 ? (
        <FilterField label="Source granularity">
          <SelectFilter value={str(filters.source_granularity_key) ?? ""} options={facetOptions.sourceGranularityOptions} placeholder="All granularities" onChange={(value) => update({ source_granularity_key: value })} />
        </FilterField>
      ) : null}
      {has("lead_type") ? (
        <FilterField label="Lead type">
          <SelectFilter value={str(filters.lead_type) ?? ""} options={LEAD_TYPE_OPTIONS} placeholder="All lead types" onChange={(value) => update({ lead_type: value })} />
        </FilterField>
      ) : null}
      {has("receiver_agent") ? (
        <FilterField label="Receiver agent">
          <SelectFilter value={str(filters.receiver_agent) ?? ""} options={facetOptions.agentIdOptions} placeholder="All receiver agents" onChange={(value) => update({ receiver_agent: value })} />
        </FilterField>
      ) : null}
      {has("agent") ? (
        <FilterField label="Sales agent">
          <SelectFilter value={str(filters.agent) ?? ""} options={facetOptions.agentOptions} placeholder="All sales agents" onChange={(value) => update({ agent: value })} />
        </FilterField>
      ) : null}
      {has("merchant") ? (
        <FilterField label="Merchant">
          <SelectFilter value={str(filters.merchant) ?? ""} options={facetOptions.merchantOptions} placeholder="All merchants" onChange={(value) => update({ merchant: value })} />
        </FilterField>
      ) : null}
      {has("source") ? (
        <FilterField label="Source">
          <SelectFilter value={str(filters.source) ?? ""} options={facetOptions.sourceOptions} placeholder="All source labels" onChange={(value) => update({ source: value })} />
        </FilterField>
      ) : null}
      {has("local") ? (
        <FilterField label="Move type">
          <SelectFilter value={str(filters.local) ?? ""} options={LOCAL_TYPE_OPTIONS as readonly SelectOption[]} placeholder="All move types" onChange={(value) => update({ local: value })} />
        </FilterField>
      ) : null}
      {has("granularity") ? (
        <FilterField label="Granularity">
          <SelectFilter value={str(filters.granularity) ?? (tab.id === "receiver-agents" ? "day" : "month")} options={GRANULARITY_OPTIONS} placeholder="Granularity" onChange={(value) => update({ granularity: value })} />
        </FilterField>
      ) : null}
    </FilterBar>
  );
}

export function AnalyticsDashboard() {
  const { scope } = useDatabaseScope();
  const defaultRange = useMemo(() => defaultDateRange(), []);
  const defaults = useMemo(() => ({ database_scope: scope, view: "visualization", ...defaultRange }), [defaultRange, scope]);
  const { filters, update, reset } = useUrlTableState(defaults);
  const activeTab = TAB_CONFIGS.find((tab) => tab.id === parseTab(filters.tab)) ?? TAB_CONFIGS[0];
  const view = parseView(filters.view);
  const effectiveScope = (filters.database_scope ?? scope) as DatabaseScope;
  const facetOptions = useFacetOptions(effectiveScope);
  const activeReport = activeTab.reports.find((report) => report.id === filters.report) ?? activeTab.reports.find((report) => report.id === activeTab.primaryReport) ?? activeTab.reports[0];
  const reportFilters = useMemo(() => buildFilters(filters, effectiveScope, activeTab), [activeTab, effectiveScope, filters]);
  const receiverHistoricalUnsupported = activeTab.id === "receiver-agents" && effectiveScope === "historical";

  useEffect(() => {
    if (!activeTab.reports.some((report) => report.id === filters.report) && filters.report) {
      update({ report: null }, { resetPage: false });
    }
  }, [activeTab, filters.report, update]);

  function selectTab(tabId: AnalyticsTabId) {
    const next: Record<string, string | null> = { tab: tabId === "overview" ? null : tabId };
    for (const key of TAB_SPECIFIC_FILTERS) next[key] = null;
    update(next);
  }

  function resetFilters() {
    reset();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Focused views for owner decisions. Choose a report area, switch between charts and table review, and export the filtered data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={effectiveScope === "historical" ? "warning" : effectiveScope === "combined" ? "muted" : "success"}>
            Scope: {DATABASE_SCOPE_LABELS[effectiveScope]}
          </StatusBadge>
          <Button variant="outline" onClick={() => downloadCsvFromProxy(analyticsExportUrl(activeReport.id, reportFilters), `${activeReport.id}.csv`)}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1" role="tablist">
        {TAB_CONFIGS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab.id === tab.id}
            onClick={() => selectTab(tab.id)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              activeTab.id === tab.id ? "bg-pale-gold/70 text-navy" : "text-steel hover:bg-steel-100 hover:text-navy",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{activeTab.label}</h2>
          <p className="text-sm text-muted-foreground">{activeTab.description}</p>
        </div>
        <ViewToggle value={view} onChange={(next) => update({ view: next })} />
      </div>

      <AnalyticsFilterPanel tab={activeTab} filters={filters} update={update} reset={resetFilters} facetOptions={facetOptions} />

      {receiverHistoricalUnsupported ? (
        <FeedbackMessage>
          Historical lead records do not include receiver_agent attribution. Switch to Production or Combined to view receiver-agent analytics.
        </FeedbackMessage>
      ) : null}

      {activeTab.id === "overview" && view === "visualization" ? (
        <div className="space-y-5">
          <SummaryKpis filters={reportFilters} />
          <div className="grid gap-5 xl:grid-cols-2">
            {activeTab.reports.slice(1).map((report) => (
              <ReportPanel key={report.id} report={report} filters={reportFilters} />
            ))}
          </div>
        </div>
      ) : null}

      {activeTab.id === "overview" && view === "table" ? <OverviewTable filters={reportFilters} /> : null}

      {activeTab.id !== "overview" && view === "visualization" && !receiverHistoricalUnsupported ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {activeTab.reports.map((report) => (
            <ReportPanel key={report.id} report={report} filters={reportFilters} />
          ))}
        </div>
      ) : null}

      {activeTab.id !== "overview" && view === "table" && !receiverHistoricalUnsupported ? (
        <div className="space-y-3">
          {activeTab.reports.length > 1 ? (
            <div className="max-w-sm">
              <SelectFilter
                value={activeReport.id}
                options={activeTab.reports.map((report) => ({ value: report.id, label: report.label }))}
                onChange={(value) => update({ report: value || activeTab.primaryReport })}
              />
            </div>
          ) : null}
          <TableView report={activeReport} filters={reportFilters} />
        </div>
      ) : null}
    </div>
  );
}
