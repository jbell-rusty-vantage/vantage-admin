import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsMetadataMessage,
  analyticsTableRowKey,
  chartTooltipTitle,
  columnsForReport,
  depositMixSlices,
  formatAnalyticsCell,
  formatAnalyticsLeadType,
  formatMoveType,
  genericAnalyticsColumnKeys,
  isAnalyticsMoneyKey,
  overviewTableRows,
  receiverAgentDisplayName,
  receiverSourceBreakdownColumns,
  receiverSourceLabel,
  rowsForReportTable,
  textToBookedOriginRows,
  textToBookedSlices,
} from "./presentation";

test("deposit mix keeps Paid Overflow when more than eight sources have deposits", () => {
  const slices = depositMixSlices([
    { source_company_label: "TBM Forms", total_deposit_amount: 9000, total_binder_amount: 400 },
    { source_company_label: "Top10 Forms", total_deposit_amount: 8000, total_binder_amount: 350 },
    { source_company_label: "Main Site Forms", total_deposit_amount: 7000, total_binder_amount: 0 },
    { source_company_label: "Best Relocation Forms", total_deposit_amount: 6000, total_binder_amount: 200 },
    { source_company_label: "GetMovers Forms", total_deposit_amount: 5000, total_binder_amount: 180 },
    { source_company_label: "TBM Prime Forms", total_deposit_amount: 4000, total_binder_amount: 150 },
    { source_company_label: "Top10 Inbounds", total_deposit_amount: 3000, total_binder_amount: 120 },
    { source_company_label: "Main Site Inbounds", total_deposit_amount: 2000, total_binder_amount: 90 },
    { source_company_label: "Paid Overflow", total_deposit_amount: 1500, total_binder_amount: 80 },
    { source_company_label: "Best Relocation Inbounds", total_deposit_amount: 0, total_binder_amount: 500 },
  ]);

  assert.equal(slices.length, 9);
  assert.deepEqual(
    slices.map((slice) => slice.name),
    [
      "TBM Forms",
      "Top10 Forms",
      "Main Site Forms",
      "Best Relocation Forms",
      "GetMovers Forms",
      "TBM Prime Forms",
      "Top10 Inbounds",
      "Main Site Inbounds",
      "Paid Overflow",
    ],
  );
  assert.equal(slices.find((slice) => slice.name === "Paid Overflow")?.value, 1500);
  assert.equal(
    slices.some((slice) => slice.name === "Best Relocation Inbounds"),
    false,
  );
});

test("pie tooltip uses the slice name and never prints undefined", () => {
  assert.equal(
    chartTooltipTitle([{ name: "Paid Overflow" }], undefined),
    "Paid Overflow",
  );
  assert.equal(chartTooltipTitle([], undefined), "Unknown");
  assert.equal(chartTooltipTitle([{ name: "undefined" }], undefined), "Unknown");
});

test("unresolved CPL count is not treated as money", () => {
  assert.equal(isAnalyticsMoneyKey("unresolved_cpl_count"), false);
  assert.equal(isAnalyticsMoneyKey("total_deposit_amount"), true);
  assert.equal(isAnalyticsMoneyKey("average_cpl"), true);
  assert.equal(isAnalyticsMoneyKey("total_lead_cost"), true);
  assert.equal(isAnalyticsMoneyKey("booking_rate"), false);
});

test("receiver source breakdown leads with agent name, source, and lead type", () => {
  const columns = receiverSourceBreakdownColumns();
  const keys = columns.map((column) => column.key);
  assert.deepEqual(keys.slice(0, 3), [
    "receiver_agent_name",
    "source_granularity_label",
    "lead_type",
  ]);
  assert.equal(
    columns.find((column) => column.key === "source_granularity_label")?.header,
    "Source Granularity",
  );
  assert.equal(keys.includes("receiver_agent_id"), false);
  assert.equal(keys.includes("source_granularity_key"), false);
  assert.equal(keys.includes("form_leads"), false);
  assert.equal(keys.includes("call_leads"), false);
});

test("receiver source breakdown display values hide raw ids", () => {
  assert.equal(
    receiverAgentDisplayName({
      receiver_agent_id: "6a22eb273fcb5d44d0324380",
      receiver_agent_name: "Nick Smith",
    }),
    "Nick Smith",
  );
  assert.equal(
    receiverAgentDisplayName({
      receiver_agent_id: "unassigned",
      receiver_agent_group: "unassigned",
    }),
    "Unassigned",
  );
  assert.equal(
    receiverSourceLabel({
      source_granularity_key: "paid_overflow",
      source_granularity_label: "Paid Overflow",
    }),
    "Paid Overflow",
  );
  assert.equal(formatAnalyticsLeadType("CallLead"), "Call");
  assert.equal(formatAnalyticsLeadType("form"), "Form");
});

test("production receiver-agent reports do not surface the historical warning", () => {
  assert.equal(
    analyticsMetadataMessage("receiver-agent-source-breakdown", "production", {
      message: "Historical lead records do not include receiver_agent attribution.",
    }),
    undefined,
  );
  assert.equal(
    analyticsMetadataMessage("receiver-agent-source-breakdown", "historical", {
      message: "Historical lead records do not include receiver_agent attribution.",
    }),
    "Historical lead records do not include receiver_agent attribution.",
  );
});

test("production SMS conversion reports do not surface the historical warning", () => {
  assert.equal(
    analyticsMetadataMessage("sms-successfully-sent-then-booked", "production", {
      message: "This rate counts production Leads that successfully received a confirmation text.",
    }),
    undefined,
  );
  assert.equal(
    analyticsMetadataMessage("sms-successfully-sent-then-booked", "historical", {
      message: "Lead Messages live on production only. Switch to Production or Combined to view the texted-lead booking rate.",
    }),
    "Lead Messages live on production only. Switch to Production or Combined to view the texted-lead booking rate.",
  );
});

test("text-to-booked visualization uses the All row and hides origin keys", () => {
  const rows = [
    { origin: "all", label: "All", texted_leads: 3, booked_leads: 1, not_booked_leads: 2, booking_rate: 1 / 3 },
    { origin: "public_form", label: "Public form", texted_leads: 3, booked_leads: 1, not_booked_leads: 2, booking_rate: 1 / 3 },
  ];
  assert.deepEqual(textToBookedSlices(rows), [
    { name: "Booked", value: 1 },
    { name: "Not booked", value: 2 },
  ]);
  assert.deepEqual(
    textToBookedOriginRows(rows).map((row) => row.label),
    ["Public form"],
  );
  assert.deepEqual(
    genericAnalyticsColumnKeys(rows),
    ["label", "texted_leads", "booked_leads", "not_booked_leads", "booking_rate"],
  );
});

test("generic analytics tables hide receiver agent ObjectIds", () => {
  assert.deepEqual(
    genericAnalyticsColumnKeys([
      {
        receiver_agent_id: "6a22eb273fcb5d44d0324380",
        receiver_agent_name: "Nick Smith",
        received_leads: 2,
      },
    ]),
    ["receiver_agent_name", "received_leads"],
  );
});

test("formatAnalyticsCell formats rates and money by field key", () => {
  assert.equal(formatAnalyticsCell("booking_rate", 0.125), "12.5%");
  assert.match(formatAnalyticsCell("total_binder_amount", 12000), /\$/);
});

test("formatMoveType uses Owner move-type language", () => {
  assert.equal(formatMoveType("long_distance"), "Long Distance Move");
  assert.equal(formatMoveType("local"), "Local Move");
  assert.equal(formatMoveType("unknown"), "Unknown");
});

test("booking-cancellation-ratio table prepends All sources from overall", () => {
  const rows = rowsForReportTable("booking-cancellation-ratio", {
    overall: {
      booked_leads: 10,
      cancelled_leads: 2,
      active_booked_leads: 8,
      cancellation_rate: 0.2,
    },
    by_source_company: [
      {
        source_company: "tbm_leads",
        source_company_label: "TBM Leads",
        booked_leads: 6,
        granularities: [{ source_granularity_key: "tbm_form" }],
      },
    ],
  });
  assert.equal(rows[0]?.source_company_label, "All sources");
  assert.equal(rows[0]?.source_company, "overall");
  assert.equal(rows[0]?.booked_leads, 10);
  assert.equal(rows[1]?.source_company, "tbm_leads");
  assert.ok(Array.isArray(rows[1]?.granularities));
});

test("text-to-booked table rows exclude the All rollup", () => {
  const rows = rowsForReportTable("sms-successfully-sent-then-booked", {
    items: [
      { origin: "all", label: "All", texted_leads: 3, booked_leads: 1, not_booked_leads: 2, booking_rate: 1 / 3 },
      { origin: "public_form", label: "Public form", texted_leads: 3, booked_leads: 1, not_booked_leads: 2, booking_rate: 1 / 3 },
    ],
  });
  assert.deepEqual(
    rows.map((row) => row.label),
    ["Public form"],
  );
});

test("geographic-lanes table rows carry lead type without category or lane", () => {
  const rows = rowsForReportTable("geographic-lanes", {
    form_lanes: [{ pickup_state: "FL", delivery_state: "NY", leads: 2 }],
    call_lanes: [{ pickup_state: "TX", delivery_state: "CA", leads: 1 }],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.lead_type, "form");
  assert.equal(rows[1]?.lead_type, "call");
  assert.equal("category" in (rows[0] ?? {}), false);
  assert.equal("lane" in (rows[0] ?? {}), false);
});

test("receiver source breakdown catalog uses Source Granularity and omits form/call lead counts", () => {
  const columns = columnsForReport("receiver-agent-source-breakdown");
  assert.equal(
    columns.find((column) => column.key === "source_granularity_label")?.header,
    "Source Granularity",
  );
  assert.equal(columns.some((column) => column.key === "form_leads"), false);
  assert.equal(columns.some((column) => column.key === "call_leads"), false);
});

test("source-company-performance catalog omits booking_rate", () => {
  assert.equal(
    columnsForReport("source-company-performance").some((column) => column.key === "booking_rate"),
    false,
  );
});

test("generic analytics tables hide leaked identity and blob keys", () => {
  assert.deepEqual(
    genericAnalyticsColumnKeys([
      {
        _id: "x",
        granularities: [],
        receiver_agent_id: "y",
        origin: "all",
        source_granularity_key: "paid_overflow",
        source_company: "tbm_leads",
        receiver_agent_group: "unassigned",
        receiver_attribution_rate: 0.5,
        cost_per_received_lead: 12,
        category: "Form Lanes",
        lane: "FL -> NY",
        metadata: {},
        received_leads: 2,
      },
    ]),
    ["received_leads"],
  );
});

test("analytics table row keys stay unique when identity fields are missing or shared", () => {
  assert.notEqual(analyticsTableRowKey({}, 0), "--");
  assert.notEqual(analyticsTableRowKey({}, 0), analyticsTableRowKey({}, 1));
  assert.notEqual(
    analyticsTableRowKey({ agent_name: "Ada" }, 0),
    analyticsTableRowKey({ agent_name: "Ada" }, 1),
  );
  assert.notEqual(
    analyticsTableRowKey({ lead_type: "form", pickup_state: "FL", delivery_state: "NY" }, 0),
    analyticsTableRowKey({ lead_type: "form", pickup_state: "TX", delivery_state: "CA" }, 1),
  );
  assert.match(analyticsTableRowKey({ reason: "Moved herself" }, 0), /Moved herself/);
});

test("overview table rows format money by field key and do not label refunds as Cost", () => {
  const rows = overviewTableRows({
    total_leads: 10,
    form_leads: 6,
    call_leads: 4,
    bookings: 3,
    active_bookings: 2,
    cancelled_bookings: 1,
    cancellations: 1,
    total_binder_amount: 12000,
    total_deposit_amount: 5000,
    total_refund_amount: 800,
    booking_rate: 0.3,
    cancellation_rate: 1 / 3,
  });
  assert.equal(rows.some((row) => row.area === "Cost"), false);
  const refunds = rows.find((row) => row.area === "Refunds");
  assert.equal(refunds?.primary_metric, "Refunds");
  assert.equal(refunds?.primary_key, "total_refund_amount");
  assert.equal(refunds?.secondary_key, "cancelled_bookings");
  const revenue = rows.find((row) => row.area === "Revenue");
  assert.equal(revenue?.primary_key, "total_binder_amount");
  assert.match(formatAnalyticsCell(revenue?.primary_key ?? "", revenue?.value), /\$/);
  const bookings = rows.find((row) => row.area === "Bookings");
  assert.equal(bookings?.secondary_key, "active_bookings");
});
