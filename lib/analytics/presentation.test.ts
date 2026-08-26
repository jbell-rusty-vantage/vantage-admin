import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsMetadataMessage,
  chartTooltipTitle,
  depositMixSlices,
  formatAnalyticsLeadType,
  genericAnalyticsColumnKeys,
  isAnalyticsMoneyKey,
  receiverAgentDisplayName,
  receiverSourceBreakdownColumns,
  receiverSourceLabel,
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
  const keys = receiverSourceBreakdownColumns().map((column) => column.key);
  assert.deepEqual(keys.slice(0, 3), [
    "receiver_agent_name",
    "source_granularity_label",
    "lead_type",
  ]);
  assert.equal(keys.includes("receiver_agent_id"), false);
  assert.equal(keys.includes("source_granularity_key"), false);
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
