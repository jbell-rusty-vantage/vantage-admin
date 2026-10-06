import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadCard } from "../components/leads/lead-card";
import { leadStatus, leadTone, verdictChip } from "../components/leads/lead-card-model";
import type { SheetContainsItem } from "../lib/api/admin";
import type { LeadItem } from "../lib/api/leads";

const NOW = new Date("2026-10-05T20:00:00Z");

const formLead: LeadItem = {
  _id: "507f1f77bcf86cd799439011",
  __kind: "form",
  name: "Scarlette Stafford",
  phone_number: "2819001836",
  email: "s.stafford@example.com",
  timestamp: "2026-10-05T18:40:00Z",
  job_no: "P5563723",
  pickup_city: "Rancho Cordova",
  pickup_state: "CA",
  delivery_city: "Austin",
  delivery_state: "TX",
  move_date: "2026-10-29T00:00:00Z",
  move_size: "3 Bedrooms",
  quoted: 1978,
  granot_priority: 5,
  sms_message_sent: true,
  source_company: "top10",
  source_company_label_snapshot: "Top10 Forms",
  source_granularity_label_snapshot: "Top10 Forms (LD)",
  granot_contact_snapshot: { differs_from_ingested: true },
  no_sync: true,
};

const callLead: LeadItem = {
  _id: "507f1f77bcf86cd799439012",
  __kind: "call",
  name: "Kifornee Welch",
  phone_number: "(562) 276-8403",
  timestamp: "2026-10-05T18:31:00Z",
  job_no: "5563672",
  pickup_city: "Lancaster",
  pickup_state: "CA",
  delivery_city: "Las Cruces",
  delivery_state: "NM",
  local: "long_distance",
  receiver_agent: "507f1f77bcf86cd799439099",
  receiver_agent_name_snapshot: "Josh",
  source_granularity_label_snapshot: "10best Inbounds",
};

const render = (item: LeadItem, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(LeadCard, { item, now: NOW, ...props }));

test("icon tone: duplicate gray, cancelled or bad red, booked green, unassigned amber, else blue", () => {
  assert.equal(leadTone({ ...formLead, duplicate: true, booked: true }), "gray");
  assert.equal(leadTone({ ...formLead, cancelled: { _id: "x" } }), "red");
  assert.equal(leadTone({ ...formLead, bad_lead: "auto_only" }), "red");
  assert.equal(leadTone({ ...callLead, booked: { _id: "x" } }), "green");
  assert.equal(leadTone(formLead), "amber");
  assert.equal(leadTone(callLead), "blue");
});

test("status pill: cancelled beats booked, open otherwise", () => {
  assert.equal(leadStatus({ ...formLead, booked: { _id: "x" }, cancelled: { _id: "y" } }).label, "Cancelled");
  assert.equal(leadStatus({ ...formLead, booked: { _id: "x" } }).label, "Booked");
  assert.equal(leadStatus(callLead).label, "Open");
});

function verdict(overrides: Partial<SheetContainsItem>): SheetContainsItem {
  return {
    id: "x",
    entity_model: "FormLead",
    label: "Lead",
    verdict: "found",
    expected_tabs: ["Forms"],
    missing_expected_tabs: [],
    found: [],
    sheet_sync_hint: [],
    ...overrides,
  };
}

test("verdict chip text follows the doc 03 wording", () => {
  const location = { workbook: "Master Leads", workbook_key: "k", spreadsheet_id: "s", target: "t", role: "expected" as const, evidence: [] };
  assert.deepEqual(verdictChip(verdict({ found: [{ ...location, tab_name: "Forms", row_number: 5121 }] })), { state: "ok", text: "Forms row 5121", title: "Master Leads" });
  assert.deepEqual(verdictChip(verdict({ verdict: "missing", missing_expected_tabs: ["Forms"] })), { state: "bad", text: "Missing from Forms" });
  assert.deepEqual(
    verdictChip(verdict({ verdict: "wrong_tab", found: [{ ...location, tab_name: "Duplicates", row_number: 3, role: "sibling" }] })),
    { state: "warn", text: "In Duplicates, expected Forms" },
  );
  assert.deepEqual(verdictChip(verdict({ verdict: "not_expected", reason: "no_sync" })), { state: "none", text: "Not expected (hidden)" });
});

test("form lead card shows name, pill, source, unassigned, evidence and Book", () => {
  const html = render(formLead, { roster: [{ value: "a1", label: "Josh" }], onAssign: () => undefined });
  assert.match(html, /Scarlette Stafford/);
  assert.match(html, />Open</);
  assert.match(html, />P5</);
  assert.match(html, /Top10 Forms › Top10 Forms \(LD\)/);
  assert.match(html, /\(281\) 900-1836/);
  assert.match(html, /s\.stafford@example\.com/);
  assert.match(html, /Unassigned/);
  assert.match(html, /Job P5563723/);
  assert.match(html, /Rancho Cordova, CA → Austin, TX/);
  assert.match(html, /3 Bedrooms/);
  assert.match(html, /est \$1,978/);
  assert.match(html, /Lead message sent/);
  assert.match(html, /Granot contact differs/);
  assert.match(html, /Hidden from sheets/);
  assert.match(html, /crm-badge--amber/);
  assert.match(html, /href="\/bookings\/new\?lead_type=FormLead&amp;lead_id=507f1f77bcf86cd799439011"/);
  assert.match(html, /aria-label="Assign Scarlette Stafford"/);
});

test("call lead card shows the receiver agent, local type and no estimate, and a verdict chip", () => {
  const html = render(callLead, {
    verdict: verdict({ id: callLead._id as string, verdict: "missing", missing_expected_tabs: ["Calls"], entity_model: "CallLead" }),
  });
  assert.match(html, /Kifornee Welch/);
  assert.match(html, /Josh/);
  assert.match(html, /long distance/);
  assert.match(html, /no estimate yet/);
  assert.match(html, /Missing from Calls/);
  assert.match(html, /lead_type=CallLead/);
  assert.doesNotMatch(html, /crm-badge--amber/);
  assert.doesNotMatch(html, /aria-label="Assign/);
});

test("select mode turns the icon circle into a checkbox; booked leads have no Book action", () => {
  const html = render({ ...formLead, booked: { _id: "b" } }, { selectMode: true, selected: true });
  assert.match(html, /crm-record__check/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /\/bookings\/new/);
});
