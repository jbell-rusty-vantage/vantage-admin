import { sourceCompanyChartLabel } from "@/components/data-table/source-company-hierarchy-table";

export const DEPOSIT_MIX_VALUE_KEY = "total_deposit_amount";

export type DepositMixSlice = {
  name: string;
  value: number;
};

export type AnalyticsColumnSpec = {
  key: string;
  header: string;
};

const RECEIVER_SOURCE_BREAKDOWN_COLUMNS: AnalyticsColumnSpec[] = [
  { key: "receiver_agent_name", header: "Receiver agent" },
  { key: "source_granularity_label", header: "Source company" },
  { key: "lead_type", header: "Lead type" },
  { key: "received_leads", header: "Received leads" },
  { key: "billable_received_leads", header: "Billable received leads" },
  { key: "unresolved_cpl_count", header: "Unresolved CPL count" },
  { key: "form_leads", header: "Form leads" },
  { key: "call_leads", header: "Call leads" },
  { key: "booked_leads", header: "Booked leads" },
  { key: "cancelled_leads", header: "Cancelled leads" },
  { key: "active_booked_leads", header: "Active booked leads" },
  { key: "total_lead_cost", header: "Total lead cost" },
  { key: "average_cpl", header: "Average CPL" },
  { key: "booking_rate", header: "Booking rate" },
  { key: "cancellation_rate", header: "Cancellation rate" },
];

const HIDDEN_GENERIC_TABLE_KEYS = new Set([
  "_id",
  "granularities",
  "receiver_agent_id",
  "origin",
]);

export type TextToBookedSlice = {
  name: string;
  value: number;
};

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

export function receiverSourceBreakdownColumns(): AnalyticsColumnSpec[] {
  return RECEIVER_SOURCE_BREAKDOWN_COLUMNS;
}

export function genericAnalyticsColumnKeys(rows: Record<string, unknown>[]): string[] {
  return Object.keys(rows[0] ?? {}).filter((key) => !HIDDEN_GENERIC_TABLE_KEYS.has(key));
}
