import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookingCommandForm } from "../components/granot-lifecycle/booking-command-form";
import { GranotLifecycleCaseList } from "../components/granot-lifecycle/case-list";
import { CaseDetail } from "../components/granot-lifecycle/case-detail";
import { GranotNavigationLinks } from "../components/granot-lifecycle/granot-navigation";
import { JobTimeline } from "../components/granot-lifecycle/job-timeline";
import { LeadCandidateResults } from "../components/granot-lifecycle/lead-candidate-browser";
import {
  DEFAULT_GRANOT_LIFECYCLE_FILTERS,
  LifecycleDashboardView,
  buildGranotLifecycleQueueHref,
  parseGranotLifecycleUrlFilters,
} from "../components/granot-lifecycle/lifecycle-dashboard";
import type {
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
  masked_contact_label: "A*** · ***1111",
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
  capabilities: { booking_cases: true, release_cases: false, discrepancies: false, official_facts: true },
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
    capabilities: { commands: false, referral: false, release_cases: false, discrepancies: false },
    ...overrides,
  };
}

test("[AC-18][AC-20][AC-40] queue renders masked Booking and Release rows without collapse", () => {
  const markup = renderToStaticMarkup(createElement(GranotLifecycleCaseList, {
    items: [bookingCase, releaseCase],
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  }));
  assert.match(markup, /booking #1/);
  assert.match(markup, /release #2/);
  assert.match(markup, /A\*\*\* · \*\*\*1111/);
  assert.match(markup, /Synthetic Source/);
  assert.equal(markup.includes("5550001111"), false);
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
});

test("[AC-20][AC-35] detail separates Granot evidence, contacts, and blank official facts with no mutation copy", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail(),
    candidateBrowser: createElement("div", { "data-draft": "preserved" }, "Candidate draft remains mounted"),
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

test("[AC-22][AC-32] enabled Owner command renders blank labeled fields and an explicit review step", () => {
  const commandDetail = detail({
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const form = createElement(QueryClientProvider, { client: queryClient },
    createElement(BookingCommandForm, { detail: commandDetail }));
  const formMarkup = renderToStaticMarkup(form);
  for (const label of ["Confirm Granot Booking", "Book Date", "Deposit Amount", "Total Binder Amount", "Active Merchant", "Active Agent 1", "Binder Amount 1", "Review Booking"]) {
    assert.match(formMarkup, new RegExp(label));
  }
  assert.match(formMarkup, /value=""/);
  assert.equal(formMarkup.includes("$synthetic"), false);

  const detailMarkup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: commandDetail,
    candidateBrowser: createElement("span", null, "READ ONLY BROWSER"),
    commandForm: createElement("span", null, "OWNER COMMAND FORM"),
  }));
  assert.match(detailMarkup, /OWNER COMMAND FORM/);
  assert.equal(detailMarkup.includes("READ ONLY BROWSER"), false);
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
          agent_allocations: [{ agent_name: "Synthetic Agent", binder_amount: 200 }],
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

test("[AC-20] evidence-only refetch architecture keeps the candidate draft slot while counts change", () => {
  const draft = createElement("textarea", { defaultValue: "unfinished owner note", "aria-label": "Future draft" });
  const before = renderToStaticMarkup(createElement(CaseDetail, { detail: detail({ evidence_revision: 2 }), candidateBrowser: draft }));
  const after = renderToStaticMarkup(createElement(CaseDetail, { detail: detail({ evidence_revision: 3, evidence: [...detail().evidence, { observation_id: "observation-3", decision_id: "decision-3", captured_at: "2026-08-18T12:00:00.000Z", action: "booked" }] }), candidateBrowser: draft }));
  assert.match(before, /unfinished owner note/);
  assert.match(after, /unfinished owner note/);
  assert.match(before, /Evidence history \(2\)/);
  assert.match(after, /Evidence history \(3\)/);
});

test("referral-shaped detail hides the Lead browser foundation", () => {
  const markup = renderToStaticMarkup(createElement(CaseDetail, {
    detail: detail({ capabilities: { commands: false, referral: true, release_cases: false, discrepancies: false } }),
    candidateBrowser: createElement("span", null, "MUST NOT RENDER"),
  }));
  assert.equal(markup.includes("MUST NOT RENDER"), false);
});

test("candidate rows show scope and warning metadata without selection controls", () => {
  const markup = renderToStaticMarkup(createElement(LeadCandidateResults, { items: [{
    lead_ref: { model: "FormLead", id: "lead-1" },
    masked_contact_label: "L*** · ***3333",
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
  assert.match(markup, /Outside Source Scope/);
  assert.match(markup, /require an override reason in a later command workflow/);
  assert.equal(markup.includes("Select"), false);
  assert.equal(markup.includes("Attach"), false);
});

test("timeline preserves server order and individual Booking/Release discriminants", () => {
  const markup = renderToStaticMarkup(createElement(JobTimeline, { page: timeline }));
  assert.ok(markup.indexOf("Observation") < markup.indexOf("Booking action"));
  assert.ok(markup.indexOf("Booking action") < markup.indexOf("release opened"));
  assert.match(markup, /Evidence is never collapsed/);
  assert.match(markup, /Release cases/);
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

test("Granot navigation keeps Automation and Lifecycle distinct", () => {
  const lifecycleMarkup = renderToStaticMarkup(createElement(GranotNavigationLinks, { pathname: "/ingestion/granot/lifecycle/cases/case-1" }));
  assert.match(lifecycleMarkup, />Automation</);
  assert.match(lifecycleMarkup, />Lifecycle</);
  assert.match(lifecycleMarkup, /href="\/ingestion\/granot"/);
  assert.match(lifecycleMarkup, /aria-current="page"[^>]+href="\/ingestion\/granot\/lifecycle"/);
});
