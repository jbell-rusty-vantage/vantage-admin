import assert from "node:assert/strict";
import test from "node:test";
import { MANUAL_COPY } from "../components/manual/manual-copy";
import {
  allSourceChoices,
  bookingJobExplainFilters,
  bookingJobSearchFilters,
  buildManualCreateLeadPayload,
  createdLeadRecordHref,
  defaultGranularityKey,
  defaultSourceChoice,
  emptyManualCreateLeadDraft,
  emptyManualLeadSearchDraft,
  findSourceChoice,
  granularitiesForChannel,
  hasLeadSearchCriteria,
  isBookingObjectId,
  leadKindFromResource,
  leadSearchFilters,
  leadSearchResources,
  sanitizeLeadSearchDraft,
  leadlessBookingListFilters,
  sourceChoicesForChannel,
  validateManualCreateLeadDraft,
} from "../components/manual/manual-create-lead";
import { MANUAL_TABS, manualTabHref, parseManualTab } from "../components/manual/manual-tabs";
import type { LeadSourceCompany } from "../lib/api/sourceCompanies";

const forbidden = [
  "ingestion_origin",
  "vantage_admin",
  "is_leadless_booking",
  "lead_ref",
  "snake_case",
  "granularity",
];

const top10: LeadSourceCompany = {
  id: "1",
  _id: "1",
  company_slug: "top10_leads",
  name: "Top10",
  owner_label: "Top10",
  aliases: [],
  active: true,
  created_from: "registry",
  granularities: [
    {
      id: "a",
      _id: "a",
      granularity_key: "top10_forms",
      channel: "form",
      owner_label: "Top10 Forms",
      crm_label: "Top10 Forms",
      aliases: [],
      active: true,
      cpl: 0,
      source_sites: [],
      priority: 1,
    },
    {
      id: "b",
      _id: "b",
      granularity_key: "top10_inbounds",
      channel: "call",
      owner_label: "Top10 Inbounds",
      crm_label: "Top10 Inbounds",
      aliases: [],
      active: true,
      cpl: 0,
      source_sites: [],
      priority: 2,
    },
  ],
};

test("Manual copy uses owner words and never names create internals", () => {
  const blob = JSON.stringify(MANUAL_COPY);
  for (const word of forbidden) {
    assert.equal(blob.includes(word), false, word);
  }
  assert.match(MANUAL_COPY.createTitle, /Create a Lead/);
  assert.match(MANUAL_COPY.connectTitle, /Connect Booking to Lead/);
  assert.match(MANUAL_COPY.createTab, /Create a Lead/);
  assert.match(MANUAL_COPY.attachTab, /Connect Booking to Lead/);
  assert.match(MANUAL_COPY.sourceCompanyHint, /Top10 Inbounds/);
  assert.match(MANUAL_COPY.successForm, /Master Leads/);
  assert.doesNotMatch(MANUAL_COPY.successForm, /synced|already/i);
});

test("Manual tabs stay on /manual and default to create", () => {
  assert.deepEqual(MANUAL_TABS.map((tab) => tab.id), ["create", "attach"]);
  assert.equal(parseManualTab(null), "create");
  assert.equal(parseManualTab("create"), "create");
  assert.equal(parseManualTab("attach"), "attach");
  assert.equal(parseManualTab("other"), "create");
  assert.equal(manualTabHref("create"), "/manual");
  assert.equal(manualTabHref("attach"), "/manual?tab=attach");
});

test("Form Lead create requires contact, zips, move size, and Source Company stream", () => {
  const draft = emptyManualCreateLeadDraft("FormLead");
  assert.deepEqual(validateManualCreateLeadDraft(draft), [
    "Source Company",
    "name",
    "phone",
    "pickup zip",
    "delivery zip",
    "move size",
  ]);

  const ready = {
    ...draft,
    source_company: "top10_leads",
    source_granularity_key: "top10_forms",
    name: "Ada Lovelace",
    phone_number: "5550100100",
    email: "ada@example.com",
    pickup_zip: "10001",
    destination_zip: "94105",
    move_size: "Studio",
    post_to_granot: true,
  };
  assert.deepEqual(validateManualCreateLeadDraft(ready), []);
  assert.deepEqual(buildManualCreateLeadPayload(ready), {
    source_company: "top10_leads",
    source_granularity_key: "top10_forms",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone_number: "5550100100",
    pickup_zip: "10001",
    destination_zip: "94105",
    move_size: "Studio",
    move_date: undefined,
    post_to_granot: true,
  });
});

test("Call Lead create requires Source Company stream plus phone or job number", () => {
  const draft = emptyManualCreateLeadDraft("CallLead");
  assert.deepEqual(validateManualCreateLeadDraft(draft), [
    "Source Company",
    "name",
    "phone or job number",
  ]);

  const ready = {
    ...draft,
    source_company: "top10_leads",
    source_granularity_key: "top10_inbounds",
    name: "Ada Lovelace",
    job_no: "P5562014",
    email: "  ",
  };
  assert.deepEqual(validateManualCreateLeadDraft(ready), []);
  assert.deepEqual(buildManualCreateLeadPayload(ready), {
    source_company: "top10_leads",
    source_granularity_key: "top10_inbounds",
    name: "Ada Lovelace",
    email: undefined,
    phone_number: undefined,
    job_no: "P5562014",
  });
});

test("Hide from Master Leads defaults checked and only sends no_sync when unchecked", () => {
  const formDraft = emptyManualCreateLeadDraft("FormLead");
  const callDraft = emptyManualCreateLeadDraft("CallLead");
  assert.equal(formDraft.hide_from_master_leads, true);
  assert.equal(callDraft.hide_from_master_leads, true);

  const formReady = {
    ...formDraft,
    source_company: "top10_leads",
    source_granularity_key: "top10_forms",
    name: "Ada Lovelace",
    phone_number: "5550100100",
    pickup_zip: "10001",
    destination_zip: "94105",
    move_size: "Studio",
  };
  const formChecked = buildManualCreateLeadPayload(formReady);
  assert.equal("no_sync" in formChecked, false);
  assert.notEqual(formChecked.no_sync, true);

  const formUnchecked = buildManualCreateLeadPayload({
    ...formReady,
    hide_from_master_leads: false,
  });
  assert.equal(formUnchecked.no_sync, false);

  const callReady = {
    ...callDraft,
    source_company: "top10_leads",
    source_granularity_key: "top10_inbounds",
    name: "Ada Lovelace",
    job_no: "P5562014",
  };
  const callChecked = buildManualCreateLeadPayload(callReady);
  assert.equal("no_sync" in callChecked, false);
  assert.notEqual(callChecked.no_sync, true);

  const callUnchecked = buildManualCreateLeadPayload({
    ...callReady,
    hide_from_master_leads: false,
  });
  assert.equal(callUnchecked.no_sync, false);
});

test("Source Company options are the exact streams the Owner already knows", () => {
  const forms = sourceChoicesForChannel([top10], "form");
  const calls = sourceChoicesForChannel([top10], "call");
  assert.deepEqual(forms.map((item) => item.owner_label), ["Top10 Forms"]);
  assert.deepEqual(calls.map((item) => item.owner_label), ["Top10 Inbounds"]);
  assert.equal(findSourceChoice(calls, "top10_inbounds")?.source_company, "top10_leads");
  assert.equal(defaultSourceChoice(forms)?.source_granularity_key, "top10_forms");
  assert.equal(defaultSourceChoice(allSourceChoices([top10])), undefined);
  assert.deepEqual(granularitiesForChannel(top10, "form").map((item) => item.granularity_key), ["top10_forms"]);
  assert.equal(defaultGranularityKey(granularitiesForChannel(top10, "call")), "top10_inbounds");
});

test("Booking search uses job number and lead search uses Owner Source Company plus contact fields", () => {
  assert.deepEqual(bookingJobSearchFilters("  P5562014  "), {
    job_no: "P5562014",
    leadless: true,
    cancelled: false,
    limit: 10,
  });
  assert.deepEqual(bookingJobExplainFilters("P5562014"), {
    job_no: "P5562014",
    limit: 10,
  });
  assert.equal(hasLeadSearchCriteria(emptyManualLeadSearchDraft()), false);
  const draft = {
    ...emptyManualLeadSearchDraft(),
    source_granularity_key: "top10_inbounds",
    phone_number: "5550100100",
    name: "Ada",
    email: "ada@example.com",
    job_no: "P5562014",
    ref_no: "R1",
  };
  assert.equal(hasLeadSearchCriteria(draft), true);
  assert.deepEqual(leadSearchResources(draft, "call"), ["call-leads"]);
  assert.deepEqual(leadSearchResources(draft, "form"), ["form-leads"]);
  assert.deepEqual(leadSearchResources({ ...emptyManualLeadSearchDraft(), job_no: "P1" }), ["call-leads"]);
  assert.deepEqual(leadSearchResources({ ...emptyManualLeadSearchDraft(), ref_no: "R1" }), ["form-leads"]);
  assert.deepEqual(leadSearchResources({ ...emptyManualLeadSearchDraft(), name: "Ada" }), [
    "form-leads",
    "call-leads",
  ]);
  assert.deepEqual(leadSearchFilters(draft, "call-leads"), {
    duplicate: false,
    booked: false,
    limit: 10,
    source_granularity_key: "top10_inbounds",
    phone_number: "5550100100",
    name: "Ada",
    email: "ada@example.com",
    job_no: "P5562014",
  });
  assert.equal("ref_no" in leadSearchFilters(draft, "call-leads"), false);
  assert.equal("job_no" in leadSearchFilters(draft, "form-leads"), false);
  assert.deepEqual(sanitizeLeadSearchDraft(draft, "call").ref_no, "");
  assert.deepEqual(sanitizeLeadSearchDraft(draft, "form").job_no, "");
  assert.equal(leadKindFromResource("call-leads"), "CallLead");
  assert.equal(isBookingObjectId("64b7f4d9e6c2a1b0f3d5e799"), true);
  assert.deepEqual(leadlessBookingListFilters("P5562014"), {
    leadless: true,
    cancelled: false,
    limit: 10,
    q: "P5562014",
  });
  assert.equal(createdLeadRecordHref("FormLead", "abc 1"), "/form-leads?record=abc%201");
  assert.equal(createdLeadRecordHref("CallLead", "abc"), "/call-leads?record=abc");
});
