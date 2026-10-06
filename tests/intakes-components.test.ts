import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GranotBookingStatementView,
  PriorityPairingStory,
} from "../components/intakes/granot-booking-statement";
import {
  granotStatementIsBare,
  readGranotStatement,
} from "../components/intakes/granot-statement-reading";
import { IntakeReferenceDrawers } from "../components/intakes/intake-reference";
import {
  INTAKES_HREF,
  creatingObservationListHint,
  creatingObservationSelectionHint,
  creatingObservationSummary,
  creatingObservationTitle,
  granotStatementHeadline,
  INTAKE_COMMANDS_OFF,
  INTAKE_LIST_NO_ACTION,
  intakeActionLabel,
  intakeCardPrimaryLabel,
  intakeCaseHref,
  intakeCaseHowToFinish,
  intakeEmptyMessage,
  intakeJobHref,
  intakeKindFromCase,
  intakeKindLabel,
  intakeListNoActionConflictCopy,
  intakeQueueLabel,
  intakeMoreWaitingLabel,
  intakeWaitingEmptyMessage,
  intakeNextStep,
  intakeOwnerPosture,
  intakePairingLine,
  intakePublicCancelHref,
  intakeShowsListNoAction,
  intakeShowsPublicCancel,
  intakeWorkbenchShowsPublicCancel,
  intakeStatusLabel,
  intakeWhatVantageHas,
  intakeReleaseHeadline,
  intakeWhyHere,
  intakeWhyHereForCase,
  intakeOwnerCommandConflictCopy,
  isAllowedIntakeReturn,
} from "../components/intakes/intake-copy";
import type {
  BookingIntakeCreatingObservation,
  GranotLifecycleCaseDetail,
  GranotLifecycleCaseListItem,
} from "../lib/api/granotLifecycle";

const bookingCase: GranotLifecycleCaseListItem = {
  case_id: "case-booking",
  kind: "booking",
  state: "open",
  mode: "create_missing_booking",
  sequence_number: 1,
  normalized_job_no: "SYNTHETIC JOB 1",
  job_no: "Synthetic Job 1",
  source: { id: "source-1", label: "Synthetic Source" },
  customer_label: "Synthetic Waiting Customer",
  latest_action: "priority_5",
  evidence_count: 1,
  case_revision: 1,
  evidence_revision: 1,
  deterministic_booking: { present: false },
  opened_at: "2026-08-18T10:00:00.000Z",
  last_evidence_at: "2026-08-18T11:00:00.000Z",
};

test("owner copy names booking intakes without lifecycle jargon", () => {
  assert.equal(intakeKindFromCase("booking"), "booking");
  assert.equal(intakeKindFromCase("release"), "cancellation");
  assert.equal(intakeKindLabel("booking"), "Booking intake");
  assert.equal(intakeQueueLabel("booking"), "Booking intakes");
  assert.equal(intakeMoreWaitingLabel("booking"), "More booking intakes");
  assert.equal(intakeStatusLabel("open"), "Waiting for you");
  assert.equal(intakeStatusLabel("resolved"), "Finished");
  assert.equal(intakeWhyHere("priority_5"), "Opened under the retired Priority 5 trigger");
  assert.equal(intakeWhyHere("booked"), "Granot marked this job Booked.");
  assert.equal(intakeWhyHere("release"), "Granot released this job.");
  assert.equal(
    intakeReleaseHeadline({ latest_action: "release", deterministic_booking: { present: false }, mode: "create_missing_booking" }),
    "Granot released this job. Vantage still has no Booking.",
  );
  assert.equal(
    intakeReleaseHeadline({ latest_action: "release", deterministic_booking: { present: true }, mode: "review_existing_booking" }),
    "Granot released this job. That may be an edit. It is not a Vantage Cancellation by itself.",
  );
  assert.deepEqual(intakePairingLine({ pairing: "priority_5_then_booked", creating_booked_priority_is_5: true, has_preceding_priority_5: true, has_later_priority_5: false }), { text: "Priority 5 then Booked", tone: "quiet" });
  assert.deepEqual(intakePairingLine({ pairing: "booked_without_priority_5", creating_booked_priority_is_5: false, has_preceding_priority_5: false, has_later_priority_5: false }), { text: "Booked without Priority 5", tone: "warning" });
  assert.equal(intakePairingLine({ pairing: "booked_carries_priority_5", creating_booked_priority_is_5: true, has_preceding_priority_5: false, has_later_priority_5: false }), undefined);
  assert.equal(
    intakeWhatVantageHas(bookingCase),
    "No official Booking yet",
  );
  assert.equal(intakeActionLabel("booking"), "Finalize Booking");
  assert.equal(intakeActionLabel("cancellation"), "Finalize Booking");
  assert.equal(intakeActionLabel(), "Finalize Booking");
  assert.equal(intakeOwnerPosture(bookingCase), "finalize");
  assert.equal(intakeCardPrimaryLabel(bookingCase), "Finalize Booking");
  assert.match(intakeNextStep(bookingCase), /Leadless Booking/);
  assert.equal(intakeNextStep(bookingCase).includes("choose a lead"), false);
  assert.match(
    intakeCaseHowToFinish({
      kind: "booking",
      mode: "create_missing_booking",
      state: "open",
      commandsAvailable: true,
    })?.title ?? "",
    /How to finalize this booking/,
  );
  assert.equal(
    intakeEmptyMessage("booking", "open"),
    "No booking intakes waiting. When Granot records a Booked or Release job, it shows up here.",
  );
  assert.doesNotMatch(intakeEmptyMessage("booking", "open"), /cancell?ed|cancels/i);
  assert.equal(isAllowedIntakeReturn("/intakes"), true);
  assert.equal(isAllowedIntakeReturn("/intakes?tab=cancellations"), true);
  assert.equal(isAllowedIntakeReturn("/ingestion/granot/lifecycle"), false);
  assert.equal(intakeJobHref("5562924"), "/leads/timeline?job=5562924");
});

test("AC-RRF-07 GRANOT_IDENTITY_CONFLICT copy does not say case revision changed", () => {
  const copy = intakeOwnerCommandConflictCopy("GRANOT_IDENTITY_CONFLICT");
  assert.doesNotMatch(copy, /case revision changed/i);
  assert.match(copy, /identity or Referral evidence/);
  assert.match(copy, /not a revision change/);
});

test("AC-RRF-07 GRANOT_CASE_REVISION_CONFLICT copy explains revision or latest-action posture", () => {
  const copy = intakeOwnerCommandConflictCopy("GRANOT_CASE_REVISION_CONFLICT");
  assert.match(copy, /case revision or latest-action posture/);
});

test("AC-RRF-07 DOMAIN_REVISION_CONFLICT copy names the Booking revision", () => {
  const copy = intakeOwnerCommandConflictCopy("DOMAIN_REVISION_CONFLICT");
  assert.match(copy, /Booking revision/);
});

test("AC-RRF-07 other and undefined 409 copy does not say case revision changed", () => {
  assert.doesNotMatch(intakeOwnerCommandConflictCopy("GRANOT_POLICY_BLOCKED"), /case revision changed/i);
  assert.doesNotMatch(intakeOwnerCommandConflictCopy(undefined), /case revision changed/i);
});

test("Release intake copy never says Granot cancelled", () => {
  const surfaces = [
    intakeWhyHere("release"),
    intakeReleaseHeadline({ latest_action: "release", deterministic_booking: { present: false }, mode: "create_missing_booking" }) ?? "",
    intakeReleaseHeadline({ latest_action: "release", deterministic_booking: { present: true }, mode: "review_existing_booking" }) ?? "",
    creatingObservationTitle("preferred_release"),
    granotStatementHeadline({ jobNo: "Synthetic Job 2", whatGranotCalledIt: "Release" }),
    granotStatementHeadline({ jobNo: "Synthetic Job 2", whatGranotCalledIt: "cancelled" }),
    granotStatementHeadline({ jobNo: "Synthetic Job 2", whatGranotCalledIt: "canceled" }),
    creatingObservationSelectionHint("preferred_release"),
    intakeActionLabel("booking"),
    intakeEmptyMessage("booking", "open"),
    intakeWaitingEmptyMessage("booking"),
  ];
  for (const text of surfaces) {
    assert.doesNotMatch(text, /cancell?ed/i);
  }
});

const bookedStatement: BookingIntakeCreatingObservation = {
  case_id: "case-booking",
  job_no: "Synthetic Job 1",
  normalized_job_no: "SYNTHETIC JOB 1",
  observation_id: "observation-booked",
  receipt_id: "receipt-booked",
  captured_at: "2026-08-22T15:00:00.000Z",
  route_event_class: "booking_status_changed",
  payload_event_type_raw: "Booked",
  booking_action: "booked",
  evidence_action: "booked",
  selection: "preferred_booked",
  observation: {
    observation_id: "observation-booked",
    receipt_id: "receipt-booked",
    captured_at: "2026-08-22T15:00:00.000Z",
    route_event_class: "booking_status_changed",
    payload_event_type_raw: "Booked",
    booking_action: { raw: "Booked", normalized: "booked" },
    source_label_raw: "Synthetic Source",
    identity: { job_no_raw: "Synthetic Job 1", form_ref_raw: "DT_syntheticRef" },
    contact: {
      first_name: "Synthetic",
      last_name: "Customer",
      phone_raw: "(305) 555-0142",
      email_raw: "synthetic.customer@example.invalid",
    },
    move: {
      move_date: "2026-09-04T00:00:00.000Z",
      estimated_cubic_feet: 780,
      origin: { city: "Miami", state: "FL", zip: "33101" },
      destination: { city: "Austin", state: "TX" },
    },
    priority: { canonical: "5", valid: true },
    display_money: { estimate: { raw: "$4,200" }, payment: { raw: "$500" }, balance: { raw: "$3,700" } },
    agent_identity: { user_raw: "synthetic.rep" },
  },
  granot_statement: { event_type: "Booked", job_no: "Synthetic Job 1", estimate: "1200" },
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
};

test("the Granot statement is read into the facts an owner recognizes", () => {
  const statement = readGranotStatement(bookedStatement.observation);
  assert.deepEqual(statement.customer, {
    name: "Synthetic Customer",
    phone: "(305) 555-0142",
    email: "synthetic.customer@example.invalid",
  });
  assert.equal(statement.move.from, "Miami, FL 33101");
  assert.equal(statement.move.to, "Austin, TX");
  assert.equal(statement.move.cubicFeet, 780);
  assert.deepEqual(statement.money, { estimate: "$4,200", payment: "$500", balance: "$3,700" });
  assert.equal(statement.whatGranotCalledIt, "Booked");
  assert.equal(statement.granotPriority, "5");
  assert.equal(statement.granotUser, "synthetic.rep");
  assert.equal(statement.sourceName, "Synthetic Source");
  assert.equal(granotStatementIsBare(statement), false);
  assert.equal(
    granotStatementIsBare(readGranotStatement({
      observation_id: "bare",
      receipt_id: "bare",
      captured_at: "2026-08-22T15:00:00.000Z",
      identity: {},
      contact: {},
      move: {},
    })),
    true,
  );
});

test("the Granot statement panel shows plain facts first and the raw message behind a drawer", () => {
  assert.equal(creatingObservationTitle("preferred_booked"), "Granot Booked payload");
  assert.equal(creatingObservationTitle("preferred_release"), "Granot Release payload");
  assert.equal(creatingObservationTitle(undefined, "cancellation"), "Granot Release payload");
  assert.equal(
    creatingObservationTitle("latest_creating"),
    "Latest Granot payload that created this intake",
  );
  assert.equal(
    creatingObservationListHint("booking"),
    "Latest payload that created this booking intake",
  );
  assert.match(
    granotStatementHeadline({
      jobNo: "Synthetic Job 2",
      whatGranotCalledIt: "Release",
      capturedAt: "2026-08-24T16:00:00.000Z",
    }),
    /Granot released job Synthetic Job 2/,
  );
  assert.equal(
    creatingObservationSummary({
      route_event_class: "booking_status_changed",
      payload_event_type_raw: "Booked",
    }),
    "booking status changed · Booked",
  );
  const markup = renderToStaticMarkup(createElement(GranotBookingStatementView, {
    data: bookedStatement,
  }));
  assert.match(markup, /Granot marked job Synthetic Job 1 booked/);
  assert.match(markup, /flagged this job a priority 5 first, then marked it booked/);
  for (const fact of [
    "Synthetic Customer",
    "\\(305\\) 555-0142",
    "synthetic.customer@example.invalid",
    "Miami, FL 33101",
    "Austin, TX",
    "\\$4,200",
    "Entered in Granot by synthetic.rep",
  ]) assert.match(markup, new RegExp(fact));
  assert.match(markup, /The exact message Granot sent/);
  assert.match(markup, /How Vantage read that message/);
  assert.match(markup, /&quot;event_type&quot;: &quot;Booked&quot;/);
  assert.equal(markup.includes("•••"), false);
});

const releasedStatement: BookingIntakeCreatingObservation = {
  ...bookedStatement,
  case_id: "case-release",
  job_no: "Synthetic Job 2",
  normalized_job_no: "SYNTHETIC JOB 2",
  observation_id: "observation-release",
  receipt_id: "receipt-release",
  captured_at: "2026-08-24T16:00:00.000Z",
  payload_event_type_raw: "Release",
  booking_action: "release",
  evidence_action: "release",
  selection: "preferred_release",
  observation: {
    ...bookedStatement.observation,
    observation_id: "observation-release",
    receipt_id: "receipt-release",
    captured_at: "2026-08-24T16:00:00.000Z",
    payload_event_type_raw: "Release",
    booking_action: { raw: "Release", normalized: "release" },
  },
  granot_statement: { event_type: "Release", job_no: "Synthetic Job 2", estimate: "4200" },
  priority_pairing: null,
};

test("the cancellation statement shows the same evidence cards and the exact Granot payload", () => {
  const markup = renderToStaticMarkup(createElement(GranotBookingStatementView, {
    data: releasedStatement,
  }));
  assert.match(markup, /Granot released job Synthetic Job 2/);
  assert.match(markup, /This is the Release update Granot sent/);
  for (const fact of [
    "Synthetic Customer",
    "\\(305\\) 555-0142",
    "synthetic.customer@example.invalid",
    "Miami, FL 33101",
    "Austin, TX",
    "\\$4,200",
  ]) assert.match(markup, new RegExp(fact));
  assert.match(markup, /The exact message Granot sent/);
  assert.match(markup, /&quot;event_type&quot;: &quot;Release&quot;/);
});

test("the priority story warns when Granot booked a job it never flagged", () => {
  const markup = renderToStaticMarkup(createElement(PriorityPairingStory, {
    pairing: {
      pairing: "booked_without_priority_5",
      creating_booked: {
        observation_id: "observation-booked",
        receipt_id: "receipt-booked",
        captured_at: "2026-08-22T15:00:00.000Z",
        priority_valid: false,
        priority_is_5: false,
      },
    },
    normalizedJobNo: "SYNTHETIC JOB 1",
  }));
  assert.match(markup, /without ever flagging it a priority 5/);
  assert.match(markup, /text-amber-800/);
  assert.match(markup, /How this job got here/);
});

function bookingIntakeDetail(
  overrides: Partial<GranotLifecycleCaseDetail> = {},
): GranotLifecycleCaseDetail {
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
    opened_at: "2026-08-22T14:00:00.000Z",
    last_evidence_at: "2026-08-22T15:00:00.000Z",
    source: { id: "source-1", label: "Synthetic Source" },
    evidence: [
      {
        observation_id: "observation-priority",
        decision_id: "decision-priority",
        captured_at: "2026-08-22T14:00:00.000Z",
        action: "priority_5",
        normalization_result: "valid",
      },
      {
        observation_id: "observation-booked",
        decision_id: "decision-booked",
        captured_at: "2026-08-22T15:00:00.000Z",
        action: "booked",
        normalization_result: "valid_with_issues",
      },
    ],
    observed_context: {
      section_label: "Granot evidence — not official Vantage values",
      contact: {
        name: "Synthetic Customer",
        phone_number: "(305) 555-0142",
        email: "synthetic.customer@example.invalid",
      },
    },
    contacts: {},
    candidate_search: { available: true, default_scope: "source", all_scope_warning: true },
    official_current: {},
    official_draft: {},
    timeline: {
      items: [],
      next_cursor: null,
      current: {},
      capabilities: { booking_cases: true, release_cases: true, discrepancies: false, official_facts: true },
    },
    latest_action: "booked",
    capabilities: { commands: true, referral: false, confirm_cancellation: false, release_cases: false, discrepancies: false },
    ...overrides,
  };
}

test("the reference drawers explain the job in owner words, not schema words", () => {
  const detail = bookingIntakeDetail();
  const markup = renderToStaticMarkup(createElement(IntakeReferenceDrawers, {
    job: detail.job_no,
    official: detail.official_current,
    updates: detail.evidence,
    timeline: detail.timeline,
  }));
  assert.match(markup, /Vantage has no booking on this job yet/);
  assert.match(markup, /This job has not been cancelled in Vantage/);
  assert.match(markup, /Granot flagged the job a priority 5/);
  assert.match(markup, /Granot marked the job booked/);
  assert.match(markup, /Vantage read it cleanly/);
  assert.match(markup, /some fields looked wrong/);
  assert.match(markup, /Every update Granot sent on this job \(2\)/);
  assert.match(markup, /href="\/leads\/timeline\?job=Synthetic/);
  assert.match(markup, /Open Job timeline/);
  for (const jargon of ["normalization_result", "priority_5", "observation_id", "decision_id"]) {
    assert.equal(markup.includes(jargon), false);
  }
});

test("the intake copy helpers the finish sheet still leans on keep their rules", () => {
  assert.equal(INTAKES_HREF, "/intakes");
  assert.equal(intakeCaseHref("case-booking"), "/intakes?case=case-booking");
  assert.match(INTAKE_COMMANDS_OFF, /not ready to file Bookings/);
  assert.equal(intakeWhyHereForCase(bookingCase), "Opened under the retired Priority 5 trigger");
  assert.equal(intakeWhyHereForCase({ ...bookingCase, latest_action: "booked" }), "Granot marked this job Booked. Vantage does not have a Booking yet.");
  const review = { ...bookingCase, mode: "review_existing_booking", deterministic_booking: { present: true, id: "booking-1", public_cancel_allowed: true } };
  assert.equal(intakeShowsListNoAction(review), true);
  assert.equal(intakeShowsListNoAction(review, false), false);
  assert.equal(intakeShowsListNoAction(bookingCase), false);
  assert.equal(intakeShowsPublicCancel(review), true);
  assert.equal(intakePublicCancelHref("booking-1"), "/cancellations/new?booked_lead=booking-1");
  assert.equal(intakeListNoActionConflictCopy("GRANOT_CASE_REVISION_CONFLICT"), INTAKE_LIST_NO_ACTION.conflict);
  assert.equal(
    intakeWorkbenchShowsPublicCancel({
      state: "open",
      mode: "review_existing_booking",
      capabilities: { referral: false },
      official_current: { booking: { id: "booking-1", lead_ref: { model: "FormLead", id: "lead-1" } } },
    }),
    true,
  );
});
