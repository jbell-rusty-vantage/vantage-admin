"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useFacetOptions, type FacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import type { DatabaseScope, SelectOption } from "@/lib/api/types";
import { DATABASE_SCOPE_LABELS, LOCAL_TYPE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { useDatabaseScope } from "@/lib/state/database-scope";

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

const GRANULARITY_OPTIONS: SelectOption[] = [
  { value: "month", label: "Monthly" },
  { value: "day", label: "Daily" },
];

type FilterControl = "date" | "source" | "agent" | "merchant" | "local" | "granularity";

const reports: {
  id: AnalyticsReport;
  title: string;
  kind: "area" | "bar";
  controls: FilterControl[];
}[] = [
  { id: "revenue-trend", title: "Revenue Trend", kind: "area", controls: ["date", "source", "granularity"] },
  { id: "source-company-performance", title: "Source Company Performance", kind: "bar", controls: ["date", "source"] },
  { id: "source-company-funnel", title: "Source Company Funnel", kind: "bar", controls: ["date", "source"] },
  { id: "lead-source-performance", title: "Lead Source Performance", kind: "bar", controls: ["date", "source"] },
  { id: "agent-performance", title: "Agent Performance", kind: "bar", controls: ["date", "agent"] },
  { id: "booking-cancellation-ratio", title: "Booking And Cancellation Ratio", kind: "area", controls: ["date", "source", "merchant"] },
  { id: "cancellation-reasons", title: "Cancellation Reasons", kind: "bar", controls: ["date", "source", "merchant"] },
  { id: "local-vs-long-distance", title: "Local Vs Long Distance", kind: "bar", controls: ["date", "local"] },
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
    next.lane = `${formatCellValue(next.pickup_state)} \u2192 ${formatCellValue(next.delivery_state)}`;
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
      "state",
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

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

// Per-card filter state. Card-level values override the dashboard globals; an
// empty card value falls back to the corresponding global filter.
function useCardFilters(base: SerializableFilters) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const setOverride = (key: string, value: string) => {
    setOverrides((current) => {
      const next = { ...current };
      if (value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const effective = useMemo<SerializableFilters>(() => {
    const merged: SerializableFilters = { ...base };
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== "") {
        merged[key] = value;
      }
    }
    return merged;
  }, [base, overrides]);

  return { effective, setOverride };
}

function CardFilters({
  controls,
  effective,
  setOverride,
  facetOptions,
}: {
  controls: FilterControl[];
  effective: SerializableFilters;
  setOverride: (key: string, value: string) => void;
  facetOptions: FacetOptions;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      {controls.includes("date") ? (
        <div className="min-w-[210px]">
          <DateRangeFilter
            from={str(effective.from)}
            to={str(effective.to)}
            onChange={(range) => {
              setOverride("from", range.from ?? "");
              setOverride("to", range.to ?? "");
            }}
          />
        </div>
      ) : null}
      {controls.includes("source") ? (
        <div className="w-44">
          <SelectFilter
            value={str(effective.source_company) ?? ""}
            options={facetOptions.sourceCompanyOptions}
            placeholder="All sources"
            onChange={(value) => setOverride("source_company", value)}
          />
        </div>
      ) : null}
      {controls.includes("agent") ? (
        <div className="w-44">
          <SelectFilter
            value={str(effective.agent) ?? ""}
            options={facetOptions.agentOptions}
            placeholder="All agents"
            onChange={(value) => setOverride("agent", value)}
          />
        </div>
      ) : null}
      {controls.includes("merchant") ? (
        <div className="w-44">
          <SelectFilter
            value={str(effective.merchant) ?? ""}
            options={facetOptions.merchantOptions}
            placeholder="All merchants"
            onChange={(value) => setOverride("merchant", value)}
          />
        </div>
      ) : null}
      {controls.includes("local") ? (
        <div className="w-44">
          <SelectFilter
            value={str(effective.local) ?? ""}
            options={LOCAL_TYPE_OPTIONS as readonly SelectOption[]}
            placeholder="All move types"
            onChange={(value) => setOverride("local", value)}
          />
        </div>
      ) : null}
      {controls.includes("granularity") ? (
        <div className="w-32">
          <SelectFilter
            value={str(effective.granularity) ?? "month"}
            options={GRANULARITY_OPTIONS}
            placeholder="Monthly"
            onChange={(value) => setOverride("granularity", value || "month")}
          />
        </div>
      ) : null}
    </div>
  );
}

function ChartAndTable({
  rows,
  kind,
  reportId,
}: {
  rows: Record<string, unknown>[];
  kind: "area" | "bar";
  reportId: string;
}) {
  const { labelKey, valueKey } = chartKeys(rows);
  const money = isMoneyKey(valueKey);
  const axisFormatter = (value: number) => (money ? formatCompact(value) : formatNumber(value));

  return (
    <div className="space-y-4">
      <ChartFrame>
        {kind === "area" ? (
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id={`fill-${reportId}`} x1="0" y1="0" x2="0" y2="1">
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
              fill={`url(#fill-${reportId})`}
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
  );
}

function CardShell({
  title,
  description,
  onExport,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {onExport ? (
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            CSV
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ReportCard({
  report,
  base,
  facetOptions,
}: {
  report: (typeof reports)[number];
  base: SerializableFilters;
  facetOptions: FacetOptions;
}) {
  const { effective, setOverride } = useCardFilters(base);
  const query = useQuery({
    queryKey: queryKeys.analytics.report(report.id, effective),
    queryFn: () => fetchAnalyticsReport(report.id, effective),
  });
  const rows = flattenRows(query.data?.data);
  const { labelKey, valueKey } = chartKeys(rows);

  return (
    <CardShell
      title={report.title}
      description={`${humanizeKey(valueKey)} by ${humanizeKey(labelKey)}`}
      onExport={() => downloadCsvFromProxy(analyticsExportUrl(report.id, effective), `${report.id}.csv`)}
    >
      <CardFilters controls={report.controls} effective={effective} setOverride={setOverride} facetOptions={facetOptions} />
      {query.isLoading ? <TableLoadingState label="Loading analytics..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {rows.length ? (
        <ChartAndTable rows={rows} kind={report.kind} reportId={report.id} />
      ) : query.data ? (
        <FeedbackMessage>No analytics data for these filters.</FeedbackMessage>
      ) : null}
    </CardShell>
  );
}

type LaneRow = { lane: string; leads: number; booked_leads: number; cancelled_leads: number };

function buildLaneRows(data: Record<string, unknown> | undefined): LaneRow[] {
  const form = Array.isArray(data?.form_lanes) ? (data?.form_lanes as Record<string, unknown>[]) : [];
  const call = Array.isArray(data?.call_lanes) ? (data?.call_lanes as Record<string, unknown>[]) : [];
  const map = new Map<string, LaneRow>();
  for (const row of [...form, ...call]) {
    const lane = `${formatCellValue(row.pickup_state)} \u2192 ${formatCellValue(row.delivery_state)}`;
    const existing = map.get(lane) ?? { lane, leads: 0, booked_leads: 0, cancelled_leads: 0 };
    existing.leads += Number(row.leads ?? 0);
    existing.booked_leads += Number(row.booked_leads ?? 0);
    existing.cancelled_leads += Number(row.cancelled_leads ?? 0);
    map.set(lane, existing);
  }
  return Array.from(map.values())
    .sort((left, right) => right.leads - left.leads)
    .slice(0, 12);
}

const GEO_VIEWS: { id: "pickup" | "delivery" | "lane"; label: string; report: AnalyticsReport }[] = [
  { id: "pickup", label: "Pickup state", report: "pickup-state-performance" },
  { id: "delivery", label: "Delivery state", report: "delivery-state-performance" },
  { id: "lane", label: "Pickup \u2192 Delivery", report: "geographic-lanes" },
];

function GeographicCard({
  base,
  facetOptions,
}: {
  base: SerializableFilters;
  facetOptions: FacetOptions;
}) {
  const { effective, setOverride } = useCardFilters(base);
  const [view, setView] = useState<"pickup" | "delivery" | "lane">("pickup");
  const activeView = GEO_VIEWS.find((entry) => entry.id === view) ?? GEO_VIEWS[0];
  const report = activeView.report;
  const query = useQuery({
    queryKey: queryKeys.analytics.report(report, effective),
    queryFn: () => fetchAnalyticsReport(report, effective),
  });

  const laneRows = view === "lane" ? buildLaneRows(query.data?.data) : [];
  const stateRows = view !== "lane" ? flattenRows(query.data?.data) : [];

  return (
    <CardShell
      title="Geographic Performance"
      description="Leads and bookings by pickup state, delivery state, or full lane."
      onExport={() => downloadCsvFromProxy(analyticsExportUrl(report, effective), `${report}.csv`)}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {GEO_VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setView(entry.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              view === entry.id
                ? "border-primary bg-primary text-white hover:bg-navy hover:text-white"
                : "bg-background hover:bg-muted"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <CardFilters controls={["date", "source"]} effective={effective} setOverride={setOverride} facetOptions={facetOptions} />
      {query.isLoading ? <TableLoadingState label="Loading geography..." /> : null}
      {query.isError ? <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} /> : null}
      {view === "lane" ? (
        laneRows.length ? (
          <div className="space-y-4">
            {/* Horizontal layout keeps two-letter lane labels (e.g. CA -> TX) from
                overlapping along a crowded category axis. */}
            <ChartFrame className="h-96">
              <BarChart
                data={laneRows}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <YAxis
                  type="category"
                  dataKey="lane"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                  interval={0}
                />
                <Tooltip content={<ChartTooltip valueKey="leads" />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                  {laneRows.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartFrame>
            <DataTable<LaneRow>
              items={laneRows.slice(0, 10)}
              getRowKey={(row) => row.lane}
              columns={[
                { key: "lane", header: "Lane", cell: (row) => row.lane },
                { key: "leads", header: "Leads", cell: (row) => formatNumber(row.leads) },
                { key: "booked_leads", header: "Booked", cell: (row) => formatNumber(row.booked_leads) },
                { key: "cancelled_leads", header: "Cancelled", cell: (row) => formatNumber(row.cancelled_leads) },
              ]}
            />
          </div>
        ) : query.data ? (
          <FeedbackMessage>No lane data for these filters.</FeedbackMessage>
        ) : null
      ) : stateRows.length ? (
        <ChartAndTable rows={stateRows} kind="bar" reportId={report} />
      ) : query.data ? (
        <FeedbackMessage>No state data for these filters.</FeedbackMessage>
      ) : null}
    </CardShell>
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

function DepositBySourcePie({
  base,
  facetOptions,
}: {
  base: SerializableFilters;
  facetOptions: FacetOptions;
}) {
  const { effective, setOverride } = useCardFilters(base);
  const query = useQuery({
    queryKey: queryKeys.analytics.report("source-company-performance", effective),
    queryFn: () => fetchAnalyticsReport("source-company-performance", effective),
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
    <CardShell
      title="Deposit Amount by Source Company"
      description={total > 0 ? `${formatMoney(total)} total deposits` : "Total deposits split by source company"}
      onExport={() =>
        downloadCsvFromProxy(
          analyticsExportUrl("source-company-performance", effective),
          "source-company-performance.csv",
        )
      }
    >
      <CardFilters controls={["date", "source"]} effective={effective} setOverride={setOverride} facetOptions={facetOptions} />
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
    </CardShell>
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
  const { scope } = useDatabaseScope();
  const { filters, update, reset } = useUrlTableState({ database_scope: scope });
  const effectiveScope = (filters.database_scope ?? scope) as DatabaseScope;
  const facetOptions = useFacetOptions(effectiveScope);

  const base: SerializableFilters = useMemo(
    () => ({
      database_scope: effectiveScope,
      from: typeof filters.from === "string" ? filters.from : undefined,
      to: typeof filters.to === "string" ? filters.to : undefined,
      source_company: typeof filters.source_company === "string" ? filters.source_company : undefined,
    }),
    [effectiveScope, filters.from, filters.to, filters.source_company],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each visualization has its own filters. The date range and source company below set the dashboard
            defaults; change the database from the header.
          </p>
        </div>
        <StatusBadge tone={effectiveScope === "historical" ? "warning" : effectiveScope === "combined" ? "muted" : "success"}>
          Scope: {DATABASE_SCOPE_LABELS[effectiveScope]}
        </StatusBadge>
      </div>
      <FilterBar onReset={reset}>
        <FilterField label="Date range (default)">
          <DateRangeFilter
            from={typeof filters.from === "string" ? filters.from : undefined}
            to={typeof filters.to === "string" ? filters.to : undefined}
            onChange={(range) => update(range)}
          />
        </FilterField>
        <FilterField label="Source company (default)">
          <SelectFilter
            value={String(filters.source_company ?? "")}
            options={facetOptions.sourceCompanyOptions}
            placeholder="All sources"
            onChange={(value) => update({ source_company: value })}
          />
        </FilterField>
      </FilterBar>
      <SummaryCards filters={base} />
      <div className="grid gap-5 xl:grid-cols-2">
        <DepositBySourcePie base={base} facetOptions={facetOptions} />
        <GeographicCard base={base} facetOptions={facetOptions} />
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} base={base} facetOptions={facetOptions} />
        ))}
      </div>
    </div>
  );
}
