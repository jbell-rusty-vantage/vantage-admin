import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookingCommandForm } from "../components/granot-lifecycle/booking-command-form";
import { BookingOwnerActions } from "../components/granot-lifecycle/booking-owner-actions";
import { ReleaseOwnerActions } from "../components/granot-lifecycle/release-owner-actions";
import { GranotLifecycleCaseList } from "../components/granot-lifecycle/case-list";
import { DiscrepancyList } from "../components/granot-lifecycle/discrepancy-list";
import { CaseDetail } from "../components/granot-lifecycle/case-detail";
import { GranotNavigationLinks } from "../components/granot-lifecycle/granot-navigation";
import { JobTimeline } from "../components/granot-lifecycle/job-timeline";
import {
  LeadCandidateResults,
  pickBestCandidate,
} from "../components/granot-lifecycle/lead-candidate-browser";
import { MatchedLeadPanel } from "../components/intakes/matched-lead-panel";
import { BOOKING_INTAKE_STORY } from "../components/intakes/intake-copy";
import {
  DEFAULT_GRANOT_LIFECYCLE_FILTERS,
  LifecycleDashboardView,
  buildGranotLifecycleQueueHref,
  parseGranotLifecycleUrlFilters,
} from "../components/granot-lifecycle/lifecycle-dashboard";
import {
  GRANOT_LIFECYCLE_HEALTH_HREF,
  LifecycleHealthView,
  formatAlertState,
  formatHealthUnit,
} from "../components/granot-lifecycle/lifecycle-health";
import { LiveWebhookReceiptCard, LiveWebhooksView } from "../components/granot-lifecycle/live-webhooks";
import type { GranotLifecycleHealth } from "../lib/api/granotLifecycle";
import type {
  GranotLifecycleCandidateItem,
  GranotLifecycleCaseDetail,
  GranotLifecycleCaseListItem,
  GranotTimelinePage,
} from "../lib/api/granotLifecycle";

const bookingCase: GranotLifecycleCaseListItem = {
  case_id: "case-booking",
  kind: "booking",
  state: "open",
  mode: "review_existing_booking",
  sequence_number: 1,
  normalized_job_no: "SYNTHETIC JOB 1",
  job_no: "Synthetic Job 1",
  source: { id: "source-1", label: "Synthetic Source" },
  customer_label: "Synthetic Queue Customer",
  latest_action: "booked",
  evidence_count: 2,
  case_revision: 1,
  evidence_revision: 2,
  deterministic_booking: { present: true, masked_ref: "boo…001" },
  opened_at: "2026-08-18T10:00:00.000Z",
  last_evidence_at: "2026-08-18T11:00:00.000Z",
};

const releaseCase: GranotLifecycleCaseListItem = {
  ...bookingCase,
  case_id: "case-release",
  kind: "release",
  sequence_number: 2,
  latest_action: "release",
  mode: "review_release",
};

const timeline: GranotTimelinePage = {
  items: [
    {
      id: "observation-1",
      type: "observation",
      event_at: "2026-08-18T10:00:00.000Z",
      type_priority: 10,
      data: { observation_id: "observation-1", receipt_id: "receipt-1", normalization_result: "valid", issue_codes: [] },
    },
    {
      id: "action-1",
      type: "booking_action",
      event_at: "2026-08-18T10:00:00.000Z",
      type_priority: 30,
      data: { observation_id: "observation-1", action: "booked" },
    },
    {
      id: "case-release-event",
      type: "case",
      event_at: "2026-08-18T11:00:00.000Z",
      type_priority: 50,
      data: { case_id: "case-release", kind: "release", event: "opened", state: "open", mode: "review_release", sequence_number: 2, case_revision: 1, evidence_revision: 1 },
    },
  ],
  next_cursor: "timeline-next",
  current: {},
  capabilities: { booking_cases: true, release_cases: true, discrepancies: false, official_facts: true },
};

function detail(overrides: Partial<GranotLifecycleCaseDetail> = {}): GranotLifecycleCaseDetail {
  return {
    case_id: "case-booking",
    kind: "booking",
    state: "open",
    mode: "create_missing_booking",
    sequence_number: 1,
    case_revision: 1,
    evidence_revision: 2,
    normalized_job_no: "SYNTHETIC JOB 1",
    job_no: "Synthetic Job 1",
    opened_at: "2026-08-18T10:00:00.000Z",
    last_evidence_at: "2026-08-18T11:00:00.000Z",
    evidence: [
      { observation_id: "observation-1", decision_id: "decision-1", captured_at: "2026-08-18T10:00:00.000Z", action: "priority_5", normalization_result: "valid", decision_outcome: "linked" },
      { observation_id: "observation-2", decision_id: "decision-2", captured_at: "2026-08-18T11:00:00.000Z", action: "booked", normalization_result: "valid", decision_outcome: "linked" },
    ],
    observed_context: {
      section_label: "Granot evidence — not official Vantage values",
      contact: { name: "A***", phone_number: "***1111", email: "a***@example.test" },
      estimate: "$synthetic",
      payment: "$synthetic",
      balance: "$synthetic",
    },
    contacts: {
      submitted_or_ingested: { name: "S***", phone_number: "***2222" },
      accepted_granot: { name: "A***", phone_number: "***1111" },
    },
    candidate_search: { available: true, default_scope: "source", all_scope_warning: true },
    official_current: {},
    official_draft: {},
    timeline,
    latest_action: "booked",
    capabilities: { commands: false, referral: false, confirm_cancellation: false, release_cases: false, discrepancies: false },
    ...overrides,
  };
}

test("[AC-18][AC-20][AC-40] queue renders Booking and Release rows without collapse", () => {
  const markup = renderToStaticMarkup(createElement(GranotLifecycleCaseList, {
    items: [bookingCase, releaseCase],
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  }));
  assert.match(markup, /booking #1/);
  assert.match(markup, /release #2/);
  assert.match(markup, /Synthetic Queue Customer/);
  assert.match(markup, /Synthetic Source/);
  assert.equal((markup.match(/case-booking/g) ?? []).length, 1);
  assert.equal((markup.match(/case-release/g) ?? []).length, 1);
});

test("detail stays mounted when official_current, evidence, contacts, or timeline are omitted", () => {
  const sparse = {
    ...detail(),
    official_current: undefined,
    evidence: undefined,
    contacts: undefined,
    observed_context: undefined,
    timeline: undefined,
    candidate_search: undefined,
    capabilities: undefined,
  } as unknown as GranotLifecycleCaseDetail;
  let markup = "";
  assert.doesNotThrow(() => {
    markup = renderToStaticMarkup(createElement(CaseDetail, { detail: sparse }));
  });
  assert.match(markup, /Official current Vantage facts/);
  assert.match(markup, /Official create fields remain blank/);
  assert.match(markup, /Granot evidence — not official Vantage values/);
  assert.match(markup, /How to finish this booking/);
});

test("booking case detail can render the Granot statement it was given", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail(),
    granotStatement: createElement("div", null, "Granot Booked payload"),
  }));
  assert.match(markup, /Granot Booked payload/);
  const releaseMarkup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail({ kind: "release", mode: "release" }),
  }));
  assert.equal(releaseMarkup.includes("Granot Booked payload"), false);
});

test("booking case detail shows Priority pairing without opening raw JSON", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail({
      priority_pairing: {
        pairing: "booked_without_priority_5",
        creating_booked: {
          observation_id: "observation-booked",
          receipt_id: "receipt-booked",
          captured_at: "2026-08-22T15:00:00.000Z",
          priority_valid: false,
          priority_is_5: false,
        },
      },
    }),
  }));
  assert.match(markup, /Priority history/);
  assert.match(markup, /without ever flagging it a priority 5/);
});

test("booking case detail shows best-case Priority 5 then Booked pairing", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail({
      priority_pairing: {
        pairing: "priority_5_then_booked",
        creating_booked: {
          observation_id: "observation-booked",
          receipt_id: "receipt-booked",
          captured_at: "2026-08-22T15:00:00.000Z",
          priority_valid: true,
          priority_is_5: true,
          priority_canonical: "5",
        },
        preceding_priority_5: {
          observation_id: "observation-priority",
          receipt_id: "receipt-priority",
          captured_at: "2026-08-22T14:00:00.000Z",
          route_event_class: "priority_updated",
          priority_canonical: "5",
        },
      },
    }),
  }));
  assert.match(markup, /Priority history/);
  assert.match(markup, /flagged this job a priority 5 first, then marked it booked/);
});

test("case detail can return to Intakes when opened from that queue", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail(),
    backHref: "/intakes",
    backLabel: "Back to Intakes",
  }));
  assert.match(markup, /Back to Intakes/);
  assert.match(markup, /href="\/intakes"/);
});

test("[AC-20][AC-35] detail separates Granot evidence, contacts, and blank official facts with no mutation copy", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail(),
    ownerWork: createElement("div", { "data-draft": "preserved" }, "Candidate draft remains mounted"),
  }));
  assert.match(markup, /Granot evidence — not official Vantage values/);
  assert.match(markup, /Official current Vantage facts/);
  assert.match(markup, /Submitted \/ ingested contact/);
  assert.match(markup, /Accepted Granot contact/);
  assert.match(markup, /Official create fields remain blank/);
  assert.match(markup, /Candidate draft remains mounted/);
  for (const forbidden of ["Confirm Booking", "Create Booking", "Attach Lead", "No Action", "Resolve case"]) {
    assert.equal(markup.includes(forbidden), false);
  }
});

test("[AC-25][AC-35][AC-40] Release detail is visibly distinct and exposes no candidate or mutation controls", () => {
  const releaseDetail = detail({
    case_id: "case-release",
    kind: "release",
    mode: "release",
    sequence_number: 2,
    evidence: [{
      observation_id: "release-observation",
      decision_id: "release-decision",
      captured_at: "2026-08-18T11:00:00.000Z",
      action: "release",
      normalization_result: "valid_with_issues",
      decision_outcome: "linked",
    }],
    candidate_search: { available: false, default_scope: "source", all_scope_warning: false },
    capabilities: { commands: false, referral: false, release_cases: true, discrepancies: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(CaseDetail, {
      detail: releaseDetail,
      ownerWork: createElement(ReleaseOwnerActions, { detail: releaseDetail }),
    })));
  assert.match(markup, /release #2/);
  assert.match(markup, /Current Booking|No official Booking exists/);
  assert.match(markup, /release opened; sequence 2/);
  // Release commands are switched off in this fixture, so the owner actions self-gate to nothing.
  for (const forbidden of ["Confirm Booking", "Create Booking", "Attach Lead", "No Action", "Resolve case"]) {
    assert.equal(markup.includes(forbidden), false);
  }
});

test("[AC-22][AC-32] enabled Owner command renders blank labeled fields and an explicit review step", () => {
  const commandDetail = detail({
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const form = createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingCommandForm, { detail: commandDetail }));
  const formMarkup = renderToStaticMarkup(form);
  for (const label of ["Finish the booking", "Book Date", "Deposit Amount", "Binder amount", "Active Merchant", "Primary Agent", "Secondary Agent", "Review Booking"]) {
    assert.match(formMarkup, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(formMarkup, /value=""/);
  assert.equal(formMarkup.includes("$synthetic"), false);
  // Who the booking is for is settled above this card, so the form only asks for the numbers.
  assert.match(formMarkup, /No strong match/);
  assert.equal(formMarkup.includes("Search by name, phone, email, job number, or reference"), false);

  const detailMarkup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: commandDetail,
    ownerWork: createElement("span", null, "OWNER COMMAND FORM"),
  }));
  assert.match(detailMarkup, /OWNER COMMAND FORM/);
  assert.match(detailMarkup, /How to finish this booking/);
  assert.ok(detailMarkup.indexOf("OWNER COMMAND FORM") < detailMarkup.indexOf("Granot evidence"));
});

test("[AC-19][AC-39] review detail shows deterministic official Booking and Employee delegation separately", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail({
      mode: "review_existing_booking",
      official_current: {
        booking: {
          id: "booking-safe-id",
          normalized_job_no: "SYNTHETIC JOB 1",
          job_no: "Synthetic Job 1",
          book_date: "2026-08-17T12:00:00.000Z",
          customer_name: "Masked Owner Work",
          source: "Synthetic Source",
          merchant: "Synthetic Merchant",
          deposit_amount: 100,
          total_binder_amount: 200,
          agent_allocations: [{ agent_id: "agent-1", agent_name: "Synthetic Agent", binder_amount: 200 }],
          domain_revision: 4,
        },
      },
      employee_booking_lead_reconciliation: {
        case_id: "employee-case-1",
        status: "pending",
        href: "/bookings/reconciliation?record=employee-case-1",
      },
    }),
  }));
  assert.match(markup, /Current Booking/);
  assert.match(markup, /booking-safe-id/);
  assert.match(markup, /separate Employee Booking Lead Reconciliation workflow/);
  assert.match(markup, /\/bookings\/reconciliation\?record=employee-case-1/);
});

test("[AC-20][AC-24][AC-32] review-existing actions initialize from live values and expose exact final labels", () => {
  const commandDetail = detail({
    mode: "review_existing_booking",
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
    official_current: {
      booking: {
        id: "booking-safe-id",
        normalized_job_no: "SYNTHETIC JOB 1",
        job_no: "Synthetic Job 1",
        book_date: "2026-08-17T00:00:00.000Z",
        customer_name: "Masked Owner Work",
        source: "Synthetic Source",
        merchant: "Synthetic Merchant",
        merchant_id: "merchant-1",
        deposit_amount: 100.25,
        total_binder_amount: 200.5,
        agent_allocations: [{ agent_id: "agent-1", agent_name: "Synthetic Agent", binder_amount: 200.5 }],
        domain_revision: 4,
        lead_ref: { model: "FormLead", id: "lead-1" },
      },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingOwnerActions, { detail: commandDetail })));
  for (const value of [
    "Update Existing Booking",
    "Full replacement initialized once from live official Vantage values",
    "2026-08-17",
    "100.25",
    "200.5",
    "Review Booking Update",
    "No Action",
    "Review No Action",
  ]) assert.match(markup, new RegExp(value));
  assert.equal(markup.includes("Finish the booking"), false);
});

test("review plus latest Release exposes Update, Confirm Cancellation, and No Action", () => {
  const commandDetail = detail({
    mode: "review_existing_booking",
    latest_action: "release",
    capabilities: {
      commands: true,
      referral: false,
      confirm_cancellation: true,
      release_cases: false,
      discrepancies: false,
    },
    official_current: {
      booking: {
        id: "booking-safe-id",
        normalized_job_no: "SYNTHETIC JOB 1",
        job_no: "Synthetic Job 1",
        book_date: "2026-08-17T00:00:00.000Z",
        customer_name: "Masked Owner Work",
        source: "Synthetic Source",
        merchant: "Synthetic Merchant",
        merchant_id: "merchant-1",
        deposit_amount: 100.25,
        total_binder_amount: 200.5,
        agent_allocations: [{ agent_id: "agent-1", agent_name: "Synthetic Agent", binder_amount: 200.5 }],
        domain_revision: 4,
      },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingOwnerActions, { detail: commandDetail })));
  assert.match(markup, /Update Existing Booking/);
  assert.match(markup, /Create Cancellation/);
  assert.match(markup, /No Action/);
});

test("create-missing plus latest Release does not expose Confirm Cancellation", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingOwnerActions, { detail: detail({
      mode: "create_missing_booking",
      latest_action: "release",
      capabilities: { commands: true, referral: false, confirm_cancellation: false, release_cases: false, discrepancies: false },
    }) })));
  assert.match(markup, /Finish the booking/);
  assert.match(markup, /No Action/);
  assert.equal(markup.includes("Create Cancellation"), false);
});

test("[AC-20][AC-28] create-missing and Referral expose only their explicit Owner actions", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const createMarkup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingOwnerActions, { detail: detail({
      mode: "create_missing_booking",
      capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
    }) })));
  assert.match(createMarkup, /Finish the booking/);
  assert.match(createMarkup, /No Action/);
  assert.equal(createMarkup.includes("Update Existing Booking"), false);

  const referralMarkup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingOwnerActions, { detail: detail({
      mode: "create_referral_booking",
      capabilities: { commands: true, referral: true, release_cases: false, discrepancies: false },
    }) })));
  assert.equal(referralMarkup.includes("Finish the booking"), false);
  assert.equal(referralMarkup.includes("Update Existing Booking"), false);
  assert.match(referralMarkup, /Create Referral Booking/);
  assert.match(referralMarkup, /Review Booking/);
  assert.match(referralMarkup, /No Action/);
  assert.equal(referralMarkup.includes("Who this booking is for"), false);
});

test("[AC-25][AC-32] open Release cases expose exactly the three explicit Owner actions", () => {
  const releaseDetail = detail({
    kind: "release",
    mode: "release",
    capabilities: { commands: true, referral: false, release_cases: true, discrepancies: false },
    official_current: {
      booking: {
        id: "booking-safe-id", normalized_job_no: "SYNTHETIC JOB 1", job_no: "Synthetic Job 1",
        book_date: "2026-08-17T00:00:00.000Z", customer_name: "Masked Owner Work",
        source: "Synthetic Source", merchant: "Synthetic Merchant", merchant_id: "merchant-1",
        deposit_amount: 100.25, total_binder_amount: 200.5,
        agent_allocations: [{ agent_id: "agent-1", agent_name: "Synthetic Agent", binder_amount: 200.5 }],
        domain_revision: 4,
      },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(ReleaseOwnerActions, { detail: releaseDetail })));
  for (const value of ["Create Cancellation", "Review Cancellation", "Update Existing Booking", "Review Booking Update", "No Action", "Review No Action", "Granot evidence is context only"]) assert.match(markup, new RegExp(value));
  assert.equal(markup.includes("Finish the booking"), false);
  assert.equal(markup.includes("Attach Lead"), false);
});

test("[AC-20] evidence-only refetch architecture keeps the candidate draft slot while counts change", () => {
  const draft = createElement("textarea", { defaultValue: "unfinished owner note", "aria-label": "Future draft" });
  const before = renderToStaticMarkup(createElement(CaseDetail, { detail: detail({ evidence_revision: 2 }), ownerWork: draft }));
  const after = renderToStaticMarkup(createElement(CaseDetail, { detail: detail({ evidence_revision: 3, evidence: [...detail().evidence, { observation_id: "observation-3", decision_id: "decision-3", captured_at: "2026-08-18T12:00:00.000Z", action: "booked" }] }), ownerWork: draft }));
  assert.match(before, /unfinished owner note/);
  assert.match(after, /unfinished owner note/);
  assert.match(before, /Evidence history \(2\)/);
  assert.match(after, /Evidence history \(3\)/);
});

test("candidate rows show where a customer came from, without selection controls", () => {
  const markup = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [{
    lead_ref: { model: "FormLead", id: "lead-1" },
    customer_label: "Synthetic Other Source Customer",
    job_no: "Synthetic Job 1",
    source: { source_company_label: "Other Synthetic Source", source_granularity_label: "Other Form" },
    confidence: "medium",
    reason_codes: ["contact_match"],
    match_method: "source_scoped_contact",
    in_source_scope: false,
    eligibility: "eligible",
    suggested: false,
    requires_override_reason: true,
  }] }));
  assert.match(markup, /Different lead source/);
  assert.match(markup, /came in through a different lead source than this job/);
  assert.equal(markup.includes("Use this customer instead"), false);
});

const ownerWorkCandidate: GranotLifecycleCandidateItem = {
  lead_ref: { model: "CallLead", id: "lead-owner-work" },
  customer_label: "Synthetic Owner Work",
  contact: {
    name: "Synthetic Owner Work",
    phone_number: "(305) 555-0142",
    email: "synthetic.owner@example.invalid",
  },
  job_no: "P5557206",
  reference: "DT_syntheticRef",
  source: { source_company_label: "Synthetic Source", source_granularity_label: "Synthetic Inbounds" },
  confidence: "high",
  reason_codes: ["candidate_job_compatible"],
  match_method: "call_job_no_exact",
  in_source_scope: true,
  eligibility: "eligible",
  suggested: true,
  requires_override_reason: false,
};

test("pre-selection is unique high only; medium never wins; ambiguous highs stay empty", () => {
  const candidate = (
    overrides: Partial<GranotLifecycleCandidateItem>,
  ): GranotLifecycleCandidateItem => ({ ...ownerWorkCandidate, suggested: false, ...overrides });
  const suggested = candidate({ lead_ref: { model: "CallLead", id: "suggested" }, suggested: true, confidence: "medium" });
  const high = candidate({ lead_ref: { model: "CallLead", id: "high" }, confidence: "high" });
  const otherHigh = candidate({ lead_ref: { model: "CallLead", id: "other-high" }, confidence: "high" });
  const inScope = candidate({ lead_ref: { model: "CallLead", id: "scoped" }, confidence: "medium" });
  const outOfScope = candidate({ lead_ref: { model: "CallLead", id: "outside" }, confidence: "medium", in_source_scope: false });

  assert.equal(pickBestCandidate([outOfScope, inScope, high, suggested])?.lead_ref.id, "high");
  assert.equal(pickBestCandidate([outOfScope, inScope, high])?.lead_ref.id, "high");
  assert.equal(pickBestCandidate([outOfScope, inScope]), undefined);
  assert.equal(pickBestCandidate([high, otherHigh]), undefined);
  assert.equal(
    pickBestCandidate([
      otherHigh,
      { ...high, lead_ref: { model: "CallLead", id: "suggested-high" }, suggested: true, confidence: "high" },
    ])?.lead_ref.id,
    "suggested-high",
  );
  assert.equal(pickBestCandidate([]), undefined);
  assert.equal(pickBestCandidate(undefined), undefined);
});

test("the matched customer panel names the customer, how sure Vantage is, and why", () => {
  const markup = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: {
      lead: ownerWorkCandidate,
      origin: "vantage_matched",
      stillSearching: false,
      chooseLead: () => {},
    },
  }));
  for (const value of [
    "Who this booking is for",
    "Synthetic Owner Work",
    "\\(305\\) 555-0142",
    "synthetic.owner@example.invalid",
    "P5557206",
    "DT_syntheticRef",
    "Strong match",
    "Vantage matched this customer",
    "Everything on this customer",
    "The job number on this phone lead matches exactly",
  ]) assert.match(markup, new RegExp(value));
  assert.equal(markup.includes("•••"), false);
});

test("the matched customer panel says plainly when nobody is attached yet", () => {
  const markup = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: { origin: "none", stillSearching: false, chooseLead: () => {} },
    onFindDifferentCustomer: () => {},
  }));
  assert.match(markup, /No stored lead/);
  assert.match(markup, /No strong match/);
  assert.equal(markup.includes("Strong match"), false);
});

const formSubmittedCandidate: GranotLifecycleCandidateItem = {
  ...ownerWorkCandidate,
  lead_ref: { model: "FormLead", id: "lead-form-submitted" },
  customer_label: "Form Submitted",
  contact: {
    name: "Form Submitted",
    phone_number: "555-0001",
    email: "form@example.invalid",
  },
  match_method: "form_ref_no_exact",
  known_contacts: {
    form_submitted: {
      name: "Form Submitted",
      phone_number: "555-0001",
      email: "form@example.invalid",
    },
  },
};

const matchingGranotCandidate: GranotLifecycleCandidateItem = {
  ...formSubmittedCandidate,
  lead_ref: { model: "FormLead", id: "lead-form-matching" },
  known_contacts: {
    form_submitted: formSubmittedCandidate.known_contacts!.form_submitted,
    granot: {
      name: "Form Submitted",
      phone_number: "555-0001",
      email: "form@example.invalid",
      differs_from_ingested: false,
      captured_at: "2026-08-01T12:00:00.000Z",
    },
  },
};

const changedGranotCandidate: GranotLifecycleCandidateItem = {
  ...formSubmittedCandidate,
  lead_ref: { model: "FormLead", id: "lead-form-changed" },
  known_contacts: {
    form_submitted: formSubmittedCandidate.known_contacts!.form_submitted,
    granot: {
      name: "Granot Later",
      phone_number: "555-9999",
      email: "granot@example.invalid",
      differs_from_ingested: true,
      captured_at: "2026-08-01T12:00:00.000Z",
    },
  },
};

const forbiddenFieldNames = [
  "ingested_contact_snapshot",
  "granot_contact_snapshot",
  "differs_from_ingested",
  "wordpress_form",
  "legacy_baseline",
  "observation_id",
];

test("no snapshot shows Form submitted only and no Granot chip on the hero", () => {
  const hero = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: { lead: formSubmittedCandidate, origin: "vantage_matched", stillSearching: false, chooseLead: () => {} },
  }));
  const rows = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [formSubmittedCandidate] }));
  for (const markup of [hero, rows]) {
    assert.match(markup, /Form submitted/);
    assert.match(markup, /Form Submitted/);
    assert.doesNotMatch(markup, />Granot</);
    assert.doesNotMatch(markup, /Changed in Granot/);
    assert.doesNotMatch(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.line));
    for (const forbidden of forbiddenFieldNames) {
      assert.doesNotMatch(markup, new RegExp(forbidden));
    }
  }
});

test("matching snapshot shows Granot chip, both cards, and the cycle line", () => {
  const hero = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: { lead: matchingGranotCandidate, origin: "vantage_matched", stillSearching: false, chooseLead: () => {} },
  }));
  const rows = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [matchingGranotCandidate] }));
  for (const markup of [hero, rows]) {
    assert.match(markup, /Form submitted/);
    assert.match(markup, />Granot</);
    assert.match(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.line));
    assert.doesNotMatch(markup, /Changed in Granot/);
    assert.doesNotMatch(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.changed));
    for (const forbidden of forbiddenFieldNames) {
      assert.doesNotMatch(markup, new RegExp(forbidden));
    }
  }
});

test("differing snapshot shows Changed in Granot and keeps the Form submitted headline", () => {
  const hero = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: { lead: changedGranotCandidate, origin: "vantage_matched", stillSearching: false, chooseLead: () => {} },
  }));
  const rows = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [changedGranotCandidate] }));
  for (const markup of [hero, rows]) {
    assert.match(markup, /Form Submitted/);
    assert.match(markup, /Changed in Granot/);
    assert.match(markup, /Granot Later/);
    assert.match(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.changed));
    assert.match(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.line));
    for (const forbidden of forbiddenFieldNames) {
      assert.doesNotMatch(markup, new RegExp(forbidden));
    }
  }
});

test("Call Lead fixture has no Granot card and owner strings come from intake-copy", () => {
  const hero = renderToStaticMarkup(createElement(MatchedLeadPanel, {
    matched: { lead: ownerWorkCandidate, origin: "vantage_matched", stillSearching: false, chooseLead: () => {} },
  }));
  const rows = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [ownerWorkCandidate] }));
  for (const markup of [hero, rows]) {
    assert.doesNotMatch(markup, />Granot</);
    assert.doesNotMatch(markup, /Changed in Granot/);
    assert.doesNotMatch(markup, /Form submitted/);
    assert.doesNotMatch(markup, new RegExp(BOOKING_INTAKE_STORY.contactCycle.line));
    for (const forbidden of forbiddenFieldNames) {
      assert.doesNotMatch(markup, new RegExp(forbidden));
    }
  }
  assert.match(hero, new RegExp(BOOKING_INTAKE_STORY.whoThisIsFor.title));
});

test("selectable candidate rows show full Lead data and mark the row already on the booking", () => {
  const other: GranotLifecycleCandidateItem = {
    ...ownerWorkCandidate,
    lead_ref: { model: "FormLead", id: "lead-other" },
    contact: { name: "Synthetic Other", phone_number: "(305) 555-0199", email: "other@example.invalid" },
    suggested: false,
  };
  const markup = renderToStaticMarkup(createElement(LeadCandidateResults, {
    items: [ownerWorkCandidate, other],
    selected: ownerWorkCandidate,
    onSelect: () => {},
  }));
  for (const value of [
    "Synthetic Owner Work",
    "synthetic.owner@example.invalid",
    "Synthetic Other",
    "other@example.invalid",
    "On this booking",
    "Use this customer instead",
    "The job number on this phone lead matches exactly",
  ]) assert.match(markup, new RegExp(value));
});

test("the booking form files under the customer settled above it and never asks for one", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const commandDetail = detail({
    mode: "create_missing_booking",
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
  });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingCommandForm, {
      detail: commandDetail,
      matchedLead: ownerWorkCandidate,
    })));
  assert.match(markup, /This customer will be attached when you file the booking/);
  assert.match(markup, /Synthetic Owner Work/);
  assert.equal(markup.includes("Who this booking is for"), false);
  assert.equal(markup.includes("Find the right customer"), false);
});

test("the booking form can review official details with no Lead selected", () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const commandDetail = detail({
    mode: "create_missing_booking",
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
  });
  const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingCommandForm, { detail: commandDetail })));
  assert.match(markup, /No strong match/);
  assert.match(markup, /Review Booking/);
  assert.equal(markup.includes("Choose the customer this booking belongs to"), false);
  const formSource = readFileSync(
    path.join(process.cwd(), "components/granot-lifecycle/booking-command-form.tsx"),
    "utf8",
  );
  assert.match(formSource, /reviewNoLead/);
  assert.match(formSource, /No lead — Master Booked only|INTAKE_LEAD_OPTIONAL\.reviewNoLead/);
});

test("timeline preserves server order and individual Booking/Release discriminants", () => {
  const markup = renderToStaticMarkup(createElement(JobTimeline, { page: timeline }));
  assert.ok(markup.indexOf("Observation") < markup.indexOf("Booking action"));
  assert.ok(markup.indexOf("Booking action") < markup.indexOf("release opened"));
  assert.match(markup, /Evidence is never collapsed/);
  assert.match(markup, /Release cases/);
});

test("[AC-35][AC-36] discrepancy queue renders masked explicit review links without bulk actions", () => {
  const markup = renderToStaticMarkup(createElement(DiscrepancyList, { items: [{
    discrepancy_id: "discrepancy-1", kind: "booking", state: "open",
    reason_code: "booked_record_link_conflict", normalized_job_no: "SYNTHETIC JOB 29",
    masked_contact_label: "A•••", evidence_count: 2, revision: 1, evidence_revision: 2,
    opened_at: "2026-08-19T12:00:00.000Z", last_evidence_at: "2026-08-19T13:00:00.000Z",
  }] }));
  assert.match(markup, /booked record link conflict/);
  assert.match(markup, /A•••/);
  assert.match(markup, /discrepancies\/discrepancy-1/);
  assert.equal(markup.includes("Bulk"), false);
});

test("default queue and URL parser preserve all filters and opaque cursor", () => {
  assert.deepEqual(DEFAULT_GRANOT_LIFECYCLE_FILTERS, { state: "open", sort: "last_evidence_at", order: "desc", limit: 25 });
  const filters = parseGranotLifecycleUrlFilters(new URLSearchParams("kind=release&state=resolved&mode=review_release&source_id=s1&normalized_job_no=JOB+1&opened_from=2026-08-01T00%3A00%3A00.000Z&opened_to=2026-08-18T23%3A59%3A59.999Z&sort=opened_at&order=asc&cursor=opaque%2Bcursor&limit=50"));
  assert.deepEqual(filters, {
    kind: "release", state: "resolved", mode: "review_release", source_id: "s1",
    normalized_job_no: "JOB 1", opened_from: "2026-08-01T00:00:00.000Z",
    opened_to: "2026-08-18T23:59:59.999Z", sort: "opened_at", order: "asc",
    cursor: "opaque+cursor", limit: 50,
  });
  const href = buildGranotLifecycleQueueHref("/ingestion/granot/lifecycle", filters);
  assert.match(href, /cursor=opaque%2Bcursor/);
});

test("queue loading, error, and empty states are explicit", () => {
  assert.match(renderToStaticMarkup(createElement(LifecycleDashboardView, { loading: true })), /Loading lifecycle cases/);
  assert.match(renderToStaticMarkup(createElement(LifecycleDashboardView, { error: "Synthetic failure" })), /Synthetic failure/);
  assert.match(renderToStaticMarkup(createElement(LifecycleDashboardView, { data: { items: [], next_cursor: null } })), /No lifecycle cases match/);
});

test("queue stays mounted when the list page omits items instead of throwing on .length", () => {
  let markup = "";
  assert.doesNotThrow(() => {
    markup = renderToStaticMarkup(createElement(LifecycleDashboardView, {
      data: { next_cursor: null },
    }));
  });
  assert.match(markup, /No lifecycle cases match/);
});

test("Granot navigation keeps Automation, Lifecycle, Intakes, and Health distinct", () => {
  const lifecycleMarkup = renderToStaticMarkup(createElement(GranotNavigationLinks, { pathname: "/ingestion/granot/lifecycle/cases/case-1" }));
  assert.match(lifecycleMarkup, />Automation</);
  assert.match(lifecycleMarkup, />Lifecycle</);
  assert.doesNotMatch(lifecycleMarkup, /Live webhooks/);
  assert.doesNotMatch(lifecycleMarkup, /\/ingestion\/granot\/live/);
  assert.match(lifecycleMarkup, /Intakes/);
  assert.doesNotMatch(lifecycleMarkup, />New</);
  assert.match(lifecycleMarkup, />Health</);
  assert.match(lifecycleMarkup, /href="\/ingestion\/granot"/);
  assert.match(lifecycleMarkup, /href="\/intakes"/);
  assert.match(lifecycleMarkup, /href="\/job-timeline"/);
  assert.match(lifecycleMarkup, />Job timeline</);
  assert.match(lifecycleMarkup, /href="\/ingestion\/granot\/lifecycle\/health"/);
  assert.match(lifecycleMarkup, /aria-current="page"[^>]+href="\/ingestion\/granot\/lifecycle"/);
  const healthMarkup = renderToStaticMarkup(createElement(GranotNavigationLinks, { pathname: "/ingestion/granot/lifecycle/health" }));
  assert.match(healthMarkup, /aria-current="page"[^>]+href="\/ingestion\/granot\/lifecycle\/health"/);
  const intakesMarkup = renderToStaticMarkup(createElement(GranotNavigationLinks, { pathname: "/intakes" }));
  assert.match(intakesMarkup, /aria-current="page"[^>]+href="\/intakes"/);
});

test("[AC-31][AC-35][AC-38] health view is read-only, unit-labeled, and never renders raw payload", () => {
  const health: GranotLifecycleHealth = {
    generated_at: "2026-08-19T16:00:00.000Z",
    flags: {
      GRANOT_LIFECYCLE_PROCESSING_ENABLED: true,
      GRANOT_LIFECYCLE_SHADOW_MODE: true,
      GRANOT_LIFECYCLE_LEAD_WRITES_ENABLED: false,
      GRANOT_LIFECYCLE_LEAD_CREATION_ENABLED: false,
      GRANOT_LIFECYCLE_BOOKING_CASES_ENABLED: false,
      GRANOT_LIFECYCLE_BOOKING_COMMANDS_ENABLED: false,
      GRANOT_LIFECYCLE_RELEASE_CASES_ENABLED: false,
      GRANOT_LIFECYCLE_RELEASE_COMMANDS_ENABLED: false,
      GRANOT_LIFECYCLE_REFERRAL_BOOKING_ENABLED: false,
      GRANOT_LIFECYCLE_EMAIL_ENABLED: false,
    },
    activation: { present: true, id: "aaaaaa...bbbb", processor_version: "unit-30", activated_at: "2026-08-19T12:00:00.000Z" },
    receipts: {
      by_work_state: { pending: 1, dead_letter: 1 },
      due_count: 1,
      oldest_due_at: "2026-08-19T15:00:00.000Z",
      oldest_due_age_ms: 3_600_000,
      claimed_count: 0,
      expired_claim_count: 0,
      dead_letter_count: 1,
    },
    decisions_last_24h: [
      { execution_mode: "historical_shadow", outcome: "policy_blocked", reason_code: "source_policy_blocked", count: 2 },
    ],
    open_cases: [{ kind: "booking", mode: "create_missing_booking", count: 1 }],
    open_discrepancies: [{ kind: "release", reason_code: "release_record_link_conflict", count: 1 }],
    command_conflicts_last_24h: [],
    record_links: { active: 0, disputed: 0 },
    last_queue_run: { at: "2026-08-19T15:30:00.000Z", status: "completed" },
    last_cron_run: null,
    ringcentral: {
      state_present: true,
      last_run_at: "2026-08-19T15:00:00.000Z",
      last_run_status: "success",
      cursor_to: "2026-08-19T14:30:00.000Z",
      lease: { held: false, acquired_at: null, expires_at: null, age_ms: 0, expired: false },
      last_runtime_ms: 1200,
      last_adopted_count: 0,
      last_adoption_conflict_count: 0,
      last_throttled_count: 0,
    },
    alerts: [
      { code: "source_ambiguity_policy_blocked_rate", scope_ref: "aaaaaa...bbbb", state: "firing", observed_value: 0.2, threshold: 0.05, unit: "ratio" },
    ],
  };
  const markup = renderToStaticMarkup(createElement(LifecycleHealthView, {
    data: health,
    stale: true,
    refreshing: true,
    error: "synthetic health error",
    onRefresh: () => undefined,
  }));
  assert.match(markup, /historical_shadow/);
  assert.match(markup, /not promoted when off/);
  assert.match(markup, /Firing/);
  assert.match(markup, /20\.00%/);
  assert.match(markup, /3600000 ms/);
  assert.match(markup, /Refresh/);
  assert.match(markup, /Refreshing lifecycle health/);
  assert.match(markup, /stale/);
  for (const telemetry of ["Claimed", "Oldest due at", "Command conflicts", "Record links", "Lease acquired", "Lease expires", "Last run status", "Last adopted", "Last adoption conflicts", "Last throttled"]) {
    assert.match(markup, new RegExp(telemetry));
  }
  assert.doesNotMatch(markup, /confirm-booking|no-action|correct-record-link/);
  assert.doesNotMatch(markup, /owner@example\.invalid|5550001234|payload/);
  assert.equal(formatAlertState("insufficient_data"), "Insufficient data");
  assert.equal(formatHealthUnit("ratio", 0.05), "5.00%");
});

test("[AC-31] health URL stays stable for dashboard and observational links", () => {
  assert.equal(GRANOT_LIFECYCLE_HEALTH_HREF, "/ingestion/granot/lifecycle/health");
});

test("live webhook accordion shows lead facts and the three Granot event classes", () => {
  const markup = renderToStaticMarkup(createElement(LiveWebhooksView, {
    status: "live",
    receipts: [
      {
        receipt_id: "64aaaaaaaaaaaaaaaaaaaaaa",
        captured_at: "2026-08-28T15:00:00.000Z",
        route_event_class: "lead_created",
        observation_channel: "granot_webhook",
        processing_state: "pending",
        lead: {
          display_name: "Ada Lovelace",
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.invalid",
          phone: "212-555-0100",
          job_no: "P5562401",
          event_type: "Lead",
          priority: null,
          origin: "Brooklyn, NY",
          destination: "Austin, TX",
          move_date: "2026-09-01",
        },
        granot_statement: { first_name: "Ada", job_no: "P5562401" },
      },
      {
        receipt_id: "64bbbbbbbbbbbbbbbbbbbbbb",
        captured_at: "2026-08-28T15:01:00.000Z",
        route_event_class: "priority_updated",
        observation_channel: "granot_webhook",
        processing_state: "completed",
        lead: {
          display_name: "Ada Lovelace",
          first_name: "Ada",
          last_name: "Lovelace",
          email: null,
          phone: "212-555-0100",
          job_no: "P5562401",
          event_type: "Priority",
          priority: "5",
          origin: null,
          destination: null,
          move_date: null,
        },
        granot_statement: { priority: "5" },
      },
      {
        receipt_id: "64cccccccccccccccccccccc",
        captured_at: "2026-08-28T15:02:00.000Z",
        route_event_class: "booking_status_changed",
        observation_channel: "granot_webhook",
        processing_state: "pending",
        lead: {
          display_name: "Ada Lovelace",
          first_name: "Ada",
          last_name: "Lovelace",
          email: null,
          phone: null,
          job_no: "P5562401",
          event_type: "Booked",
          priority: null,
          origin: null,
          destination: null,
          move_date: null,
        },
        granot_statement: { event_type: "Booked" },
      },
    ],
  }));
  assert.match(markup, /Lead created/);
  assert.match(markup, /Priority updated/);
  assert.match(markup, /Booking status changed/);
  assert.match(markup, /Ada Lovelace/);
  assert.match(markup, /212-555-0100/);
  assert.match(markup, /ada@example\.invalid/);
  assert.match(markup, /P5562401/);
  assert.match(markup, /Brooklyn, NY/);
  assert.match(markup, /Full Granot payload/);
  assert.match(markup, /Open job timeline/);
  assert.match(markup, /Show details/);
  assert.match(markup, /Hide details/);
  assert.match(markup, /Click a row to open the lead facts/);
  assert.doesNotMatch(markup, /Open booking intake/);
});

test("LiveWebhookReceiptCard shows Open booking intake only when intake_link is present", () => {
  const base = {
    receipt_id: "64cccccccccccccccccccccc",
    captured_at: "2026-08-28T15:02:00.000Z",
    route_event_class: "booking_status_changed" as const,
    observation_channel: "granot_webhook" as const,
    processing_state: "completed",
    lead: {
      display_name: "Ada Lovelace",
      first_name: "Ada",
      last_name: "Lovelace",
      email: null,
      phone: null,
      job_no: "P5562401",
      event_type: "Booked",
      priority: null,
      origin: null,
      destination: null,
      move_date: null,
    },
    granot_statement: { event_type: "Booked" },
  };
  const withoutLink = renderToStaticMarkup(createElement(LiveWebhookReceiptCard, { receipt: base }));
  assert.match(withoutLink, /Open job timeline/);
  assert.doesNotMatch(withoutLink, /Open booking intake/);
  assert.doesNotMatch(withoutLink, /no intake yet/i);

  const withLink = renderToStaticMarkup(createElement(LiveWebhookReceiptCard, {
    receipt: {
      ...base,
      observation_id: "65cccccccccccccccccccccc",
      intake_link: {
        case_id: "66bbbbbbbbbbbbbbbbbbbbbb",
        kind: "booking",
        state: "open",
        matched_via: "evidence_observation_id",
      },
    },
  }));
  assert.match(withLink, /Open job timeline/);
  assert.match(withLink, /Open booking intake/);
  assert.match(withLink, /\/intakes\?job=P5562401&amp;case=66bbbbbbbbbbbbbbbbbbbbbb/);
});

test("LiveWebhooks listens for receipt_updated and reuses the merge helper", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/granot-lifecycle/live-webhooks.tsx"),
    "utf8",
  );
  assert.match(source, /addEventListener\("receipt_updated"/);
  assert.match(source, /applyLiveWebhookSsePayload/);
});
