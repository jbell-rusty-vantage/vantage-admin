import { sourceCompanyChartLabel } from "@/components/data-table/source-company-hierarchy-table";
import type { AnalyticsReport } from "@/lib/api/admin";

export const DEPOSIT_MIX_VALUE_KEY = "total_deposit_amount";

export type DepositMixSlice = {
  name: string;
  value: number;
};

export type AnalyticsColumnFormat = "money" | "count" | "rate" | "text" | "date";

export type AnalyticsColumnSpec = {
  key: string;
  header: string;
  format?: AnalyticsColumnFormat;
};

export type OverviewTableRow = {
  area: string;
  primary_metric: string;
  primary_key: string;
  value: unknown;
  secondary_metric: string;
  secondary_key: string;
  secondary_value: unknown;
  secondary_display?: string;
};

const col = (
  key: string,
  header: string,
  format: AnalyticsColumnFormat,
): AnalyticsColumnSpec => ({ key, header, format });

const SUMMARY_COLUMNS: AnalyticsColumnSpec[] = [
  col("total_leads", "Leads", "count"),
  col("form_leads", "Form Leads", "count"),
  col("call_leads", "Call Leads", "count"),
  col("bookings", "Bookings", "count"),
  col("active_bookings", "Active Bookings", "count"),
  col("cancelled_bookings", "Cancelled Bookings", "count"),
  col("cancellations", "Cancellations", "count"),
  col("total_binder_amount", "Binder", "money"),
  col("total_deposit_amount", "Deposits", "money"),
  col("total_refund_amount", "Refunds", "money"),
  col("booking_rate", "Booking rate", "rate"),
  col("cancellation_rate", "Cancellation rate", "rate"),
];

const SOURCE_COMPANY_PERFORMANCE_COLUMNS: AnalyticsColumnSpec[] = [
  col("bookings", "Bookings", "count"),
  col("active_bookings", "Active Bookings", "count"),
  col("cancelled_bookings", "Cancelled Bookings", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("total_deposit_amount", "Deposits", "money"),
  col("total_binder_amount", "Binder", "money"),
  col("channel", "Lead type", "text"),
];

const SOURCE_COMPANY_FUNNEL_COLUMNS: AnalyticsColumnSpec[] = [
  col("total_leads", "Leads", "count"),
  col("form_leads", "Form Leads", "count"),
  col("call_leads", "Call Leads", "count"),
  col("sheet_booked_leads", "Sheet booked leads", "count"),
  col("reconciled_bookings", "Bookings", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("reconciled_cancelled_bookings", "Cancelled Bookings", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("total_deposit_amount", "Deposits", "money"),
  col("total_binder_amount", "Binder", "money"),
  col("over_2000_leads", "Leads over $2,000", "count"),
  col("over_4000_leads", "Leads over $4,000", "count"),
];

const RECEIVER_AGENT_PERFORMANCE_COLUMNS: AnalyticsColumnSpec[] = [
  col("receiver_agent_name", "Receiver Agent", "text"),
  col("received_leads", "Received Leads", "count"),
  col("billable_received_leads", "Billable Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("active_booked_leads", "Active Booked Leads", "count"),
  col("cancelled_leads", "Cancelled Leads", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("total_lead_cost", "Lead Cost", "money"),
  col("average_cpl", "Avg CPL", "money"),
  col("cost_per_booked_lead", "Cost per booked Lead", "money"),
  col("unresolved_cpl_count", "Unresolved CPL", "count"),
  col("form_leads", "Form Leads", "count"),
  col("call_leads", "Call Leads", "count"),
];

const RECEIVER_AGENT_TREND_COLUMNS: AnalyticsColumnSpec[] = [
  col("period", "Period", "date"),
  col("receiver_agent_name", "Receiver Agent", "text"),
  col("received_leads", "Received Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("cancelled_leads", "Cancelled Leads", "count"),
  col("total_lead_cost", "Lead Cost", "money"),
  col("billable_received_leads", "Billable Leads", "count"),
  col("unresolved_cpl_count", "Unresolved CPL", "count"),
];

const RECEIVER_SOURCE_BREAKDOWN_COLUMNS: AnalyticsColumnSpec[] = [
  col("receiver_agent_name", "Receiver Agent", "text"),
  col("source_granularity_label", "Source Granularity", "text"),
  col("lead_type", "Lead type", "text"),
  col("received_leads", "Received Leads", "count"),
  col("billable_received_leads", "Billable Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("active_booked_leads", "Active Booked Leads", "count"),
  col("cancelled_leads", "Cancelled Leads", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("total_lead_cost", "Lead Cost", "money"),
  col("average_cpl", "Avg CPL", "money"),
  col("unresolved_cpl_count", "Unresolved CPL", "count"),
];

const REVENUE_TREND_COLUMNS: AnalyticsColumnSpec[] = [
  col("period", "Period", "date"),
  col("bookings", "Bookings", "count"),
  col("cancelled_bookings", "Cancelled Bookings", "count"),
  col("active_bookings", "Active Bookings", "count"),
  col("total_binder_amount", "Binder", "money"),
  col("total_deposit_amount", "Deposits", "money"),
  col("cancellation_rate", "Cancellation rate", "rate"),
];

const AGENT_PERFORMANCE_COLUMNS: AnalyticsColumnSpec[] = [
  col("agent_name", "Sales Agent", "text"),
  col("bookings", "Bookings", "count"),
  col("active_bookings", "Active Bookings", "count"),
  col("cancelled_bookings", "Cancelled Bookings", "count"),
  col("total_binder_amount", "Binder", "money"),
  col("total_deposit_amount", "Deposits", "money"),
  col("average_binder_amount", "Avg Binder", "money"),
  col("average_deposit_amount", "Avg Deposit", "money"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("over_2000_bookings", "Bookings over $2k deposit", "count"),
  col("over_4000_bookings", "Bookings over $4k deposit", "count"),
];

const BOOKING_CANCELLATION_RATIO_COLUMNS: AnalyticsColumnSpec[] = [
  col("booked_leads", "Bookings", "count"),
  col("cancelled_leads", "Cancelled Bookings", "count"),
  col("active_booked_leads", "Active Bookings", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("booked_to_cancelled_ratio", "Bookings per Cancellation", "text"),
];

const BOOKING_CANCELLATION_RATIO_HIERARCHY_COLUMNS: AnalyticsColumnSpec[] = [
  col("booked_leads", "Bookings", "count"),
  col("cancelled_leads", "Cancelled Bookings", "count"),
  col("active_booked_leads", "Active Bookings", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
];

const CANCELLATION_REASONS_COLUMNS: AnalyticsColumnSpec[] = [
  col("reason", "Cancellation reason", "text"),
  col("cancellations", "Cancellations", "count"),
  col("share_of_cancellations", "Share of Cancellations", "rate"),
  col("total_refund_amount", "Refunds", "money"),
  col("affected_deposit_amount", "Deposits affected", "money"),
  col("affected_binder_amount", "Binder affected", "money"),
  col("linked_to_booked", "Linked to Booking", "count"),
];

const TEXT_TO_BOOKED_COLUMNS: AnalyticsColumnSpec[] = [
  col("label", "Message origin", "text"),
  col("texted_leads", "Texted Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("not_booked_leads", "Not booked", "count"),
  col("booking_rate", "Booking rate", "rate"),
];

const PICKUP_STATE_COLUMNS: AnalyticsColumnSpec[] = [
  col("state", "Pickup state", "text"),
  col("leads", "Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("cancelled_leads", "Cancelled Leads", "count"),
];

const DELIVERY_STATE_COLUMNS: AnalyticsColumnSpec[] = [
  col("state", "Delivery state", "text"),
  col("leads", "Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("cancelled_leads", "Cancelled Leads", "count"),
];

const GEOGRAPHIC_LANES_COLUMNS: AnalyticsColumnSpec[] = [
  col("lead_type", "Lead type", "text"),
  col("pickup_state", "Pickup state", "text"),
  col("delivery_state", "Delivery state", "text"),
  col("leads", "Leads", "count"),
  col("booked_leads", "Booked Leads", "count"),
  col("booking_rate", "Booking rate", "rate"),
  col("cancelled_leads", "Cancelled Leads", "count"),
];

const LOCAL_VS_LONG_DISTANCE_COLUMNS: AnalyticsColumnSpec[] = [
  col("local_type", "Move type", "text"),
  col("bookings", "Bookings", "count"),
  col("cancelled_bookings", "Cancelled Bookings", "count"),
  col("cancellation_rate", "Cancellation rate", "rate"),
  col("total_deposit_amount", "Deposits", "money"),
  col("total_binder_amount", "Binder", "money"),
];

const REPORT_COLUMNS: Record<AnalyticsReport, AnalyticsColumnSpec[]> = {
  summary: SUMMARY_COLUMNS,
  "source-company-performance": SOURCE_COMPANY_PERFORMANCE_COLUMNS,
  "lead-source-performance": SOURCE_COMPANY_PERFORMANCE_COLUMNS,
  "source-company-funnel": SOURCE_COMPANY_FUNNEL_COLUMNS,
  "receiver-agent-performance": RECEIVER_AGENT_PERFORMANCE_COLUMNS,
  "receiver-agent-trend": RECEIVER_AGENT_TREND_COLUMNS,
  "receiver-agent-source-breakdown": RECEIVER_SOURCE_BREAKDOWN_COLUMNS,
  "revenue-trend": REVENUE_TREND_COLUMNS,
  "agent-performance": AGENT_PERFORMANCE_COLUMNS,
  "booking-cancellation-ratio": BOOKING_CANCELLATION_RATIO_COLUMNS,
  "cancellation-reasons": CANCELLATION_REASONS_COLUMNS,
  "sms-successfully-sent-then-booked": TEXT_TO_BOOKED_COLUMNS,
  "pickup-state-performance": PICKUP_STATE_COLUMNS,
  "delivery-state-performance": DELIVERY_STATE_COLUMNS,
  "geographic-lanes": GEOGRAPHIC_LANES_COLUMNS,
  "local-vs-long-distance": LOCAL_VS_LONG_DISTANCE_COLUMNS,
};

const HIDDEN_GENERIC_TABLE_KEYS = new Set([
  "_id",
  "granularities",
  "receiver_agent_id",
  "origin",
  "source_granularity_key",
  "source_company",
  "receiver_agent_group",
  "receiver_attribution_rate",
  "cost_per_received_lead",
  "category",
  "lane",
  "metadata",
]);

const PREFERRED_ROW_KEYS = [
  "items",
  "rows",
  "series",
  "data",
  "trend",
  "results",
  "by_source_company",
] as const;

export type TextToBookedSlice = {
  name: string;
  value: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function flattenReportRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  for (const key of PREFERRED_ROW_KEYS) {
    if (Array.isArray(data[key])) return recordRows(data[key]);
  }
  return [];
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function inferColumnFormat(key: string): AnalyticsColumnFormat {
  if (key === "share_of_cancellations" || /rate$/i.test(key)) return "rate";
  if (isAnalyticsMoneyKey(key)) return "money";
  if (key === "period") return "date";
  return "text";
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function textToBookedSlices(rows: Record<string, unknown>[]): TextToBookedSlice[] {
  const overall = rows.find((row) => row.origin === "all" || row.label === "All") ?? rows[0];
  if (!overall) return [];
  const booked = Number(overall.booked_leads ?? 0);
  const notBooked = Number(overall.not_booked_leads ?? Math.max(Number(overall.texted_leads ?? 0) - booked, 0));
  return [
    { name: "Booked", value: booked },
    { name: "Not booked", value: notBooked },
  ].filter((slice) => slice.value > 0);
}

export function textToBookedOriginRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((row) => row.origin !== "all" && row.label !== "All");
}

function usableText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^(undefined|null)$/i.test(trimmed)) return undefined;
  return trimmed;
}

export function depositMixSlices(rows: Record<string, unknown>[]): DepositMixSlice[] {
  return rows
    .map((row) => ({
      name: sourceCompanyChartLabel(row),
      value: Number(row.total_deposit_amount ?? 0),
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

export function chartTooltipTitle(
  payload?: Array<{ name?: string }>,
  label?: string | number,
): string {
  const fromPayload = usableText(payload?.[0]?.name);
  if (fromPayload) return fromPayload;
  if (typeof label === "number") return String(label);
  return usableText(label) ?? "Unknown";
}

export function isAnalyticsMoneyKey(key: string): boolean {
  if (/count$/i.test(key) || /_rate$/i.test(key)) return false;
  return /amount|revenue|deposit|binder|refund|total_lead_cost|^average_cpl$|cost_per_/i.test(
    key,
  );
}

export function analyticsMetadataMessage(
  reportId: string,
  scope: string | undefined,
  metadata?: Record<string, unknown>,
): string | undefined {
  const message = usableText(metadata?.message);
  if (!message) return undefined;
  if (reportId.startsWith("receiver-agent") && scope === "production") {
    return undefined;
  }
  if (reportId === "sms-successfully-sent-then-booked" && scope === "production") {
    return undefined;
  }
  return message;
}

export function receiverAgentDisplayName(row: Record<string, unknown>): string {
  const name = usableText(row.receiver_agent_name);
  if (name) return name;
  if (row.receiver_agent_id === "unassigned" || row.receiver_agent_group === "unassigned") {
    return "Unassigned";
  }
  return "Unknown";
}

export function receiverSourceLabel(row: Record<string, unknown>): string {
  return (
    usableText(row.source_granularity_label) ??
    usableText(row.source_label) ??
    usableText(row.source_company_label) ??
    "Unknown"
  );
}

export function formatAnalyticsLeadType(value: unknown): string {
  const raw = usableText(value)?.toLowerCase();
  if (raw === "formlead" || raw === "form") return "Form";
  if (raw === "calllead" || raw === "call") return "Call";
  return usableText(value) ?? "-";
}

export function formatMoveType(value: unknown): string {
  const raw = usableText(value)?.toLowerCase();
  if (raw === "local") return "Local Move";
  if (raw === "long_distance") return "Long Distance Move";
  return "Unknown";
}

export function formatAnalyticsCell(
  key: string,
  value: unknown,
  row?: Record<string, unknown>,
  format?: AnalyticsColumnFormat,
): string {
  const resolved = format ?? inferColumnFormat(key);

  if (key === "receiver_agent_name" && row) return receiverAgentDisplayName(row);
  if (key === "source_granularity_label" && row) return receiverSourceLabel(row);
  if (key === "lead_type" || key === "channel") return formatAnalyticsLeadType(value);
  if (key === "local_type") return isEmptyCell(value) ? "-" : formatMoveType(value);

  if (isEmptyCell(value)) return "-";

  if (resolved === "rate") {
    const amount = asFiniteNumber(value);
    return amount === undefined ? "-" : formatRate(amount);
  }
  if (resolved === "money") {
    const amount = asFiniteNumber(value);
    return amount === undefined ? "-" : formatMoney(amount);
  }
  if (resolved === "count") {
    const amount = asFiniteNumber(value);
    return amount === undefined ? "-" : formatCount(amount);
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? formatCount(value) : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  const text = usableText(value);
  if (
    (key === "agent_name" || key === "reason" || key === "state") &&
    text?.toLowerCase() === "unknown"
  ) {
    return "Unknown";
  }
  if (text) return text;
  if (typeof value === "boolean") return String(value);
  return "-";
}

export function columnsForReport(reportId: AnalyticsReport): AnalyticsColumnSpec[] {
  return REPORT_COLUMNS[reportId] ?? [];
}

export function sourceHierarchyMetricColumns(reportId: AnalyticsReport): AnalyticsColumnSpec[] {
  if (reportId === "source-company-performance" || reportId === "lead-source-performance") {
    return SOURCE_COMPANY_PERFORMANCE_COLUMNS;
  }
  if (reportId === "source-company-funnel") return SOURCE_COMPANY_FUNNEL_COLUMNS;
  if (reportId === "booking-cancellation-ratio") return BOOKING_CANCELLATION_RATIO_HIERARCHY_COLUMNS;
  return [];
}

export function rowsForReportTable(
  reportId: AnalyticsReport,
  data: unknown,
): Record<string, unknown>[] {
  if (reportId === "summary") {
    if (isRecord(data) && isRecord(data.totals)) return [data.totals];
    return [];
  }

  if (reportId === "booking-cancellation-ratio") {
    if (!isRecord(data)) return [];
    const rows: Record<string, unknown>[] = [];
    if (isRecord(data.overall)) {
      rows.push({
        source_company_label: "All sources",
        source_company: "overall",
        ...data.overall,
      });
    }
    const companyRows = Array.isArray(data.by_source_company)
      ? recordRows(data.by_source_company)
      : recordRows(data.items);
    return [...rows, ...companyRows];
  }

  if (reportId === "sms-successfully-sent-then-booked") {
    return textToBookedOriginRows(flattenReportRows(data));
  }

  if (reportId === "geographic-lanes") {
    if (!isRecord(data)) return [];
    return [
      ...recordRows(data.form_lanes).map((row) => ({ ...row, lead_type: "form" })),
      ...recordRows(data.call_lanes).map((row) => ({ ...row, lead_type: "call" })),
    ];
  }

  const rows = flattenReportRows(data);

  if (reportId === "revenue-trend") {
    return rows.map((row) => {
      if (asFiniteNumber(row.active_bookings) !== undefined) return row;
      const bookings = asFiniteNumber(row.bookings) ?? 0;
      const cancelled = asFiniteNumber(row.cancelled_bookings) ?? 0;
      return { ...row, active_bookings: Math.max(bookings - cancelled, 0) };
    });
  }

  if (reportId === "cancellation-reasons") {
    const totalCancellations = rows.reduce(
      (sum, row) => sum + (asFiniteNumber(row.cancellations) ?? 0),
      0,
    );
    return rows.map((row) => {
      const cancellations = asFiniteNumber(row.cancellations) ?? 0;
      return {
        ...row,
        share_of_cancellations: totalCancellations > 0 ? cancellations / totalCancellations : 0,
      };
    });
  }

  return rows;
}

export function overviewTableRows(totals: Record<string, unknown>): OverviewTableRow[] {
  const formLeads = formatAnalyticsCell("form_leads", totals.form_leads, totals, "count");
  const callLeads = formatAnalyticsCell("call_leads", totals.call_leads, totals, "count");
  const activeBookings = formatAnalyticsCell(
    "active_bookings",
    totals.active_bookings,
    totals,
    "count",
  );
  const bookingRate = formatAnalyticsCell("booking_rate", totals.booking_rate, totals, "rate");

  return [
    {
      area: "Leads",
      primary_metric: "Leads",
      primary_key: "total_leads",
      value: totals.total_leads,
      secondary_metric: "Form Leads / Call Leads",
      secondary_key: "form_leads",
      secondary_value: totals.form_leads,
      secondary_display: `${formLeads} / ${callLeads}`,
    },
    {
      area: "Revenue",
      primary_metric: "Binder",
      primary_key: "total_binder_amount",
      value: totals.total_binder_amount,
      secondary_metric: "Deposits",
      secondary_key: "total_deposit_amount",
      secondary_value: totals.total_deposit_amount,
    },
    {
      area: "Bookings",
      primary_metric: "Bookings",
      primary_key: "bookings",
      value: totals.bookings,
      secondary_metric: "Active Bookings",
      secondary_key: "active_bookings",
      secondary_value: totals.active_bookings,
      secondary_display: `${activeBookings} · ${bookingRate}`,
    },
    {
      area: "Cancellations",
      primary_metric: "Cancellations",
      primary_key: "cancellations",
      value: totals.cancellations,
      secondary_metric: "Cancellation rate",
      secondary_key: "cancellation_rate",
      secondary_value: totals.cancellation_rate,
    },
    {
      area: "Refunds",
      primary_metric: "Refunds",
      primary_key: "total_refund_amount",
      value: totals.total_refund_amount,
      secondary_metric: "Cancelled Bookings",
      secondary_key: "cancelled_bookings",
      secondary_value: totals.cancelled_bookings,
    },
  ];
}

export function receiverSourceBreakdownColumns(): AnalyticsColumnSpec[] {
  return columnsForReport("receiver-agent-source-breakdown");
}

export function genericAnalyticsColumnKeys(rows: Record<string, unknown>[]): string[] {
  return Object.keys(rows[0] ?? {}).filter((key) => !HIDDEN_GENERIC_TABLE_KEYS.has(key));
}

const TABLE_ROW_KEY_FIELDS = [
  "_id",
  "receiver_agent_id",
  "period",
  "label",
  "agent_name",
  "reason",
  "state",
  "local_type",
  "source_company",
  "source_granularity_key",
  "source_granularity_label",
  "source_label",
  "lead_type",
  "pickup_state",
  "delivery_state",
  "lane",
] as const;

export function analyticsTableRowKey(row: Record<string, unknown>, index: number): string {
  const parts = TABLE_ROW_KEY_FIELDS.map((key) => usableText(row[key])).filter(
    (part): part is string => part !== undefined,
  );
  return parts.length ? `${parts.join("|")}|${index}` : `row:${index}`;
}
