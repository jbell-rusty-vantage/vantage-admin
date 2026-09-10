import type { ReportingDatasetKey } from "@/lib/api/reporting";

export type ReportingSheetExampleCell = string | number | boolean | null;

export type ReportingSheetExampleColumn = {
  id: string;
  label: string;
};

export type ReportingSheetExample = {
  key: ReportingDatasetKey;
  schemaVersion: 1;
  title: string;
  grain: string;
  columns: ReportingSheetExampleColumn[];
  rows: Array<Record<string, ReportingSheetExampleCell>>;
};

function titleCaseId(id: string): string {
  return id
    .split("_")
    .map((word) => (word === "cpl" ? "CPL" : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

const leadOutcomeColumns: ReportingSheetExampleColumn[] = [
  { id: "lead_type", label: "Lead Type" },
  { id: "lead_timestamp", label: "Lead Timestamp" },
  { id: "source_company", label: "Source Company" },
  { id: "source_granularity", label: "Granularity" },
  { id: "customer_name", label: "Name" },
  { id: "customer_phone", label: "Phone" },
  { id: "customer_email", label: "Email" },
  { id: "pickup_zip", label: "Pickup ZIP" },
  { id: "pickup_state", label: "Pickup State" },
  { id: "delivery_zip", label: "Delivery ZIP" },
  { id: "delivery_state", label: "Delivery State" },
  { id: "route_classification", label: "Route" },
  { id: "move_date", label: "Move Date" },
  { id: "move_size", label: "Move Size" },
  { id: "quoted", label: "Quoted" },
  { id: "duplicate_state", label: "Duplicate" },
  { id: "bad_lead_state", label: "Bad Lead" },
  { id: "cpl_value", label: "CPL" },
  { id: "cpl_resolution_status", label: "CPL Resolution" },
  { id: "booked", label: "Booked" },
  { id: "booking_count", label: "Booking Count" },
  { id: "primary_job_number", label: "Primary Job Number" },
  { id: "book_date", label: "Book Date" },
  { id: "assigned_agents", label: "Assigned Agent(s)" },
  { id: "merchant", label: "Merchant" },
  { id: "binder", label: "Binder" },
  { id: "deposit", label: "Deposit" },
  { id: "cancelled_or_refunded", label: "Cancelled/Refunded" },
  { id: "cancellation_or_refund_date", label: "Cancellation/Refund Date" },
  { id: "refund_amount", label: "Refund Amount" },
];

const exceptionColumns: ReportingSheetExampleColumn[] = [
  { id: "exception_type", label: "Exception Type" },
  { id: "date_basis", label: "Date Basis" },
  { id: "exception_timestamp", label: "Exception Timestamp" },
  { id: "source_company", label: "Source Company" },
  { id: "source_granularity", label: "Granularity" },
  { id: "summary", label: "Summary" },
  { id: "operational_status", label: "Operational Status" },
  { id: "related_record_count", label: "Related Record Count" },
];

const sourcePerformanceMeasureIds = [
  "total_leads",
  "valid_leads",
  "duplicates",
  "bad_leads",
  "quoted_form_leads",
  "booked_leads",
  "cancelled_bookings",
  "net_bookings",
  "lead_to_booking_conversion",
  "net_conversion",
  "resolved_cpl_spend",
  "unresolved_cpl_count",
  "total_binder",
  "total_deposit",
] as const;

const sourcePerformanceColumns: ReportingSheetExampleColumn[] = [
  { id: "period", label: "Period" },
  { id: "source_company", label: "Source Company" },
  { id: "source_granularity", label: "Granularity" },
  ...sourcePerformanceMeasureIds.map((id) => ({ id, label: titleCaseId(id) })),
];

export const REPORTING_SHEET_EXAMPLES: Record<ReportingDatasetKey, ReportingSheetExample> = {
  lead_outcome_detail: {
    key: "lead_outcome_detail",
    schemaVersion: 1,
    title: "Lead Outcome Detail",
    grain: "Exactly one canonical Lead per row, with current outcomes attached.",
    columns: leadOutcomeColumns,
    rows: [
      {
        lead_type: "form",
        lead_timestamp: "2026-03-04T09:14:22",
        source_company: "Top10",
        source_granularity: "Top10 Forms",
        customer_name: "Alex Rivera",
        customer_phone: "555-0101",
        customer_email: "alex.rivera@example.com",
        pickup_zip: "10001",
        pickup_state: "NY",
        delivery_zip: "33101",
        delivery_state: "FL",
        route_classification: "long_distance",
        move_date: "2026-04-18",
        move_size: "2 bedroom",
        quoted: true,
        duplicate_state: false,
        bad_lead_state: false,
        cpl_value: 85,
        cpl_resolution_status: "resolved",
        booked: true,
        booking_count: 1,
        primary_job_number: "18402",
        book_date: "2026-03-06T11:02:41",
        assigned_agents: "Jordan Hale",
        merchant: "Stripe",
        binder: 2400,
        deposit: 600,
        cancelled_or_refunded: false,
        cancellation_or_refund_date: null,
        refund_amount: null,
      },
      {
        lead_type: "call",
        lead_timestamp: "2026-03-05T16:41:08",
        source_company: "TBM",
        source_granularity: "TBM Inbounds",
        customer_name: "Sam Patel",
        customer_phone: "555-0144",
        customer_email: null,
        pickup_zip: "60611",
        pickup_state: "IL",
        delivery_zip: "60614",
        delivery_state: "IL",
        route_classification: "local",
        move_date: "2026-03-29",
        move_size: "studio",
        quoted: "not_applicable",
        duplicate_state: false,
        bad_lead_state: false,
        cpl_value: 45,
        cpl_resolution_status: "resolved",
        booked: false,
        booking_count: 0,
        primary_job_number: null,
        book_date: null,
        assigned_agents: null,
        merchant: null,
        binder: null,
        deposit: null,
        cancelled_or_refunded: false,
        cancellation_or_refund_date: null,
        refund_amount: null,
      },
      {
        lead_type: "form",
        lead_timestamp: "2026-03-07T08:05:19",
        source_company: "Main Site",
        source_granularity: "Main Site Organic",
        customer_name: "Riley Chen",
        customer_phone: "555-0177",
        customer_email: "riley.chen@example.com",
        pickup_zip: "94107",
        pickup_state: "CA",
        delivery_zip: "98101",
        delivery_state: "WA",
        route_classification: "long_distance",
        move_date: "2026-05-02",
        move_size: "3 bedroom",
        quoted: true,
        duplicate_state: true,
        bad_lead_state: false,
        cpl_value: 0,
        cpl_resolution_status: "resolved",
        booked: false,
        booking_count: 0,
        primary_job_number: null,
        book_date: null,
        assigned_agents: null,
        merchant: null,
        binder: null,
        deposit: null,
        cancelled_or_refunded: false,
        cancellation_or_refund_date: null,
        refund_amount: null,
      },
      {
        lead_type: "form",
        lead_timestamp: "2026-03-08T13:28:55",
        source_company: "Paid Overflow",
        source_granularity: "Paid Overflow",
        customer_name: "Morgan Ellis",
        customer_phone: "555-0190",
        customer_email: "morgan.ellis@example.com",
        pickup_zip: "02116",
        pickup_state: "MA",
        delivery_zip: "02903",
        delivery_state: "RI",
        route_classification: "long_distance",
        move_date: "2026-04-09",
        move_size: "1 bedroom",
        quoted: true,
        duplicate_state: false,
        bad_lead_state: false,
        cpl_value: 60,
        cpl_resolution_status: "resolved",
        booked: true,
        booking_count: 1,
        primary_job_number: "19110",
        book_date: "2026-03-09T10:17:03",
        assigned_agents: "Casey Brooks",
        merchant: "Stripe",
        binder: 1800,
        deposit: 450,
        cancelled_or_refunded: true,
        cancellation_or_refund_date: "2026-03-12T15:44:10",
        refund_amount: 450,
      },
    ],
  },
  lead_quality_exceptions: {
    key: "lead_quality_exceptions",
    schemaVersion: 1,
    title: "Lead Quality Exceptions",
    grain: "Exactly one report-quality exception occurrence per row.",
    columns: exceptionColumns,
    rows: [
      {
        exception_type: "duplicate",
        date_basis: "lead_timestamp",
        exception_timestamp: "2026-03-07T08:05:19",
        source_company: "Main Site",
        source_granularity: "Main Site Organic",
        summary: "Lead is marked duplicate.",
        operational_status: "open",
        related_record_count: 1,
      },
      {
        exception_type: "bad_lead",
        date_basis: "lead_timestamp",
        exception_timestamp: "2026-03-04T18:22:41",
        source_company: "Top10",
        source_granularity: "Top10 Forms",
        summary: "Lead is marked bad.",
        operational_status: "open",
        related_record_count: 1,
      },
      {
        exception_type: "unresolved_cpl_or_source_attribution",
        date_basis: "lead_timestamp",
        exception_timestamp: "2026-03-06T12:11:07",
        source_company: "TBM",
        source_granularity: "TBM Forms",
        summary: "CPL or Source Company is unresolved.",
        operational_status: "open",
        related_record_count: 1,
      },
      {
        exception_type: "leadless_booking",
        date_basis: "booking_or_observation_timestamp",
        exception_timestamp: "2026-03-09T09:40:00",
        source_company: "Paid Overflow",
        source_granularity: "Paid Overflow",
        summary: "Booking has no attached Lead.",
        operational_status: "open",
        related_record_count: 1,
      },
    ],
  },
  source_performance: {
    key: "source_performance",
    schemaVersion: 1,
    title: "Source Performance",
    grain: "Source Company, optional Granularity, and selected time dimension.",
    columns: sourcePerformanceColumns,
    rows: [
      {
        period: "2026-03",
        source_company: "Top10",
        source_granularity: "Top10 Forms",
        total_leads: 86,
        valid_leads: 74,
        duplicates: 8,
        bad_leads: 4,
        quoted_form_leads: 61,
        booked_leads: 18,
        cancelled_bookings: 3,
        net_bookings: 16,
        lead_to_booking_conversion: 0.209,
        net_conversion: 0.186,
        resolved_cpl_spend: 7310,
        unresolved_cpl_count: 2,
        total_binder: 41200,
        total_deposit: 9800,
      },
      {
        period: "2026-03",
        source_company: "Top10",
        source_granularity: "Top10 Inbounds",
        total_leads: 41,
        valid_leads: 37,
        duplicates: 3,
        bad_leads: 1,
        quoted_form_leads: 0,
        booked_leads: 7,
        cancelled_bookings: 1,
        net_bookings: 6,
        lead_to_booking_conversion: 0.171,
        net_conversion: 0.146,
        resolved_cpl_spend: 1845,
        unresolved_cpl_count: 0,
        total_binder: 12600,
        total_deposit: 2700,
      },
      {
        period: "2026-03",
        source_company: "Paid Overflow",
        source_granularity: "Paid Overflow",
        total_leads: 22,
        valid_leads: 20,
        duplicates: 1,
        bad_leads: 1,
        quoted_form_leads: 17,
        booked_leads: 4,
        cancelled_bookings: 1,
        net_bookings: 3,
        lead_to_booking_conversion: 0.182,
        net_conversion: 0.136,
        resolved_cpl_spend: 1320,
        unresolved_cpl_count: 1,
        total_binder: 7200,
        total_deposit: 1800,
      },
    ],
  },
};

export const REPORTING_SHEET_EXAMPLE_ORDER: ReportingDatasetKey[] = [
  "lead_outcome_detail",
  "lead_quality_exceptions",
  "source_performance",
];

export function reportingSheetExampleLabel(example: ReportingSheetExample): string {
  return `${example.title} @ ${example.schemaVersion}`;
}

export function columnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new TypeError("Column index must be a non-negative integer.");
  }
  let remaining = index + 1;
  let label = "";
  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }
  return label;
}

export function formatSheetExampleCell(value: ReportingSheetExampleCell): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}
