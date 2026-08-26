"use client";

import { useQuery } from "@tanstack/react-query";
import {
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
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { fetchAnalyticsReport } from "@/lib/api/admin";
import {
  analyticsMetadataMessage,
  chartTooltipTitle,
  textToBookedOriginRows,
  textToBookedSlices,
} from "@/lib/analytics/presentation";
import type { SerializableFilters } from "@/lib/api/filters";
import { queryKeys } from "@/lib/query/keys";

const SLICE_COLORS = ["#16a34a", "#94a3b8"];
const BAR_COLORS = ["#2563eb", "#16a34a"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flattenItems(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  return Array.isArray(value.items)
    ? value.items.filter(isRecord)
    : [];
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{chartTooltipTitle(payload, label)}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted-foreground">
          {entry.name}: {formatNumber(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export function TextToBookedPanel({ filters }: { filters: SerializableFilters }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.report("sms-successfully-sent-then-booked", filters),
    queryFn: () => fetchAnalyticsReport("sms-successfully-sent-then-booked", filters),
  });
  const rows = flattenItems(query.data?.data);
  const overall = rows.find((row) => row.origin === "all") ?? rows[0];
  const originRows = textToBookedOriginRows(rows);
  const slices = textToBookedSlices(rows);
  const metadata = isRecord(query.data?.data?.metadata) ? query.data.data.metadata : undefined;
  const metadataMessage = analyticsMetadataMessage(
    "sms-successfully-sent-then-booked",
    typeof filters.database_scope === "string" ? filters.database_scope : undefined,
    metadata,
  );
  const texted = Number(overall?.texted_leads ?? 0);
  const booked = Number(overall?.booked_leads ?? 0);
  const bookingRate = Number(overall?.booking_rate ?? 0);

  return (
    <section className="space-y-4 rounded-lg border bg-background p-4">
      <div>
        <h2 className="text-sm font-semibold">Texted leads booked</h2>
        <p className="text-xs text-muted-foreground">
          Only Leads whose confirmation text was accepted, sent, or delivered. Failed, undelivered, and skipped messages are excluded.
        </p>
      </div>
      {metadataMessage ? <FeedbackMessage>{metadataMessage}</FeedbackMessage> : null}
      {query.isLoading ? <TableLoadingState label="Loading texted-lead booking rate..." /> : null}
      {query.isError ? (
        <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} />
      ) : null}
      {overall ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-4 sm:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Booked of texted</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{formatPercent(bookingRate)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(booked)} booked of {formatNumber(texted)} texted leads
              </p>
            </div>
            <div className="h-56 sm:col-span-2">
              {slices.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {slices.map((_, index) => (
                        <Cell key={slices[index]?.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend verticalAlign="bottom" height={28} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <FeedbackMessage>No successfully texted leads for these filters.</FeedbackMessage>
              )}
            </div>
          </div>
          {originRows.length ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                By message origin
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={originRows} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend verticalAlign="bottom" height={28} iconType="circle" />
                    <Bar dataKey="texted_leads" name="Texted leads" fill={BAR_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="booked_leads" name="Booked" fill={BAR_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      ) : query.data ? (
        <FeedbackMessage>No successfully texted leads for these filters.</FeedbackMessage>
      ) : null}
    </section>
  );
}
