import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  GranotBookingStatementView,
  PriorityPairingStory,
} from "../components/intakes/granot-booking-statement";
import {
  granotStatementIsBare,
  readGranotStatement,
} from "../components/intakes/granot-statement-reading";
import { BookingIntakeWorkbench } from "../components/intakes/booking-intake-workbench";
import { IntakeReferenceDrawers } from "../components/intakes/intake-reference";
import {
  INTAKES_HREF,
  creatingObservationSummary,
  creatingObservationTitle,
  intakeActionLabel,
  intakeCaseHref,
  intakeCaseHowToFinish,
  intakeEmptyMessage,
  intakeKindFromCase,
  intakeKindLabel,
  intakeNextStep,
  intakePairingLine,
  intakeStatusLabel,
  intakeWhatVantageHas,
  intakeWhyHere,
  isAllowedIntakeReturn,
} from "../components/intakes/intake-copy";
import { IntakeList } from "../components/intakes/intake-list";
import {
  INTAKE_PAGE_SIZE,
  IntakesDashboardView,
  IntakesHeader,
  IntakesPagination,
  buildIntakesHref,
  parseCursorHistory,
  parseState,
  parseTab,
  popCursorHistory,
  pushCursorHistory,
} from "../components/intakes/intakes-dashboard";
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

function renderIntakeList(props: Parameters<typeof IntakeList>[0]): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: queryClient }, createElement(IntakeList, props)),
  );
}

const cancellationCase: GranotLifecycleCaseListItem = {
  ...bookingCase,
  case_id: "case-release",
  kind: "release",
  mode: "release",
  sequence_number: 2,
  job_no: "Synthetic Job 2",
  normalized_job_no: "SYNTHETIC JOB 2",
  latest_action: "release",
  evidence_count: 2,
  deterministic_booking: { present: true, masked_ref: "boo…002" },
};

test("owner copy names booking and cancellation intakes without lifecycle jargon", () => {
  assert.equal(intakeKindFromCase("booking"), "booking");
  assert.equal(intakeKindFromCase("release"), "cancellation");
  assert.equal(intakeKindLabel("booking"), "Booking intake");
  assert.equal(intakeKindLabel("cancellation"), "Cancellation intake");
  assert.equal(intakeStatusLabel("open"), "Waiting for you");
  assert.equal(intakeStatusLabel("resolved"), "Finished");
  assert.equal(intakeWhyHere("priority_5"), "Opened under the retired Priority 5 trigger");
  assert.equal(intakeWhyHere("booked"), "Granot recorded a booking");
  assert.equal(intakeWhyHere("release"), "Granot recorded a cancellation");
  assert.deepEqual(intakePairingLine({ pairing: "priority_5_then_booked", creating_booked_priority_is_5: true, has_preceding_priority_5: true, has_later_priority_5: false }), { text: "Priority 5 then Booked", tone: "quiet" });
  assert.deepEqual(intakePairingLine({ pairing: "booked_without_priority_5", creating_booked_priority_is_5: false, has_preceding_priority_5: false, has_later_priority_5: false }), { text: "Booked without Priority 5", tone: "warning" });
  assert.equal(intakePairingLine({ pairing: "booked_carries_priority_5", creating_booked_priority_is_5: true, has_preceding_priority_5: false, has_later_priority_5: false }), undefined);
  assert.equal(
    intakeWhatVantageHas(bookingCase),
    "No official Vantage booking yet",
  );
  assert.equal(
    intakeWhatVantageHas(cancellationCase),
    "Vantage has an official booking on this job",
  );
  assert.equal(intakeActionLabel("booking"), "Finish booking");
  assert.equal(intakeActionLabel("cancellation"), "Review cancellation");
  assert.match(intakeNextStep(bookingCase), /one binder amount, up to two agents, deposit, and merchant/);
  assert.match(
    intakeCaseHowToFinish({
      kind: "booking",
      mode: "create_missing_booking",
      state: "open",
      commandsAvailable: true,
    })?.body ?? "",
    /Operations Registry catalog/,
  );
  assert.equal(
    intakeEmptyMessage("booking", "open"),
    "No booking intakes waiting. When Granot records a Booked job, it will show up here.",
  );
  assert.match(intakeEmptyMessage("cancellation", "open"), /cancels a job/);
  assert.equal(isAllowedIntakeReturn("/intakes"), true);
  assert.equal(isAllowedIntakeReturn("/intakes?tab=cancellations"), true);
  assert.equal(isAllowedIntakeReturn("/ingestion/granot/lifecycle"), false);
});

test("intake list uses owner language and keeps booking and cancellation rows distinct", () => {
  const bookingMarkup = renderIntakeList({
    items: [bookingCase, cancellationCase],
    kind: "booking",
    emptyMessage: "none",
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  });
  assert.match(bookingMarkup, /Synthetic Job 1/);
  assert.match(bookingMarkup, /Opened under the retired Priority 5 trigger/);
  assert.match(bookingMarkup, /No official Vantage booking yet/);
  assert.match(bookingMarkup, /Waiting for you/);
  assert.match(bookingMarkup, /Finish booking/);
  assert.match(bookingMarkup, /choose a lead and enter one binder amount/);
  assert.match(bookingMarkup, /href="\/intakes\?case=case-booking"/);
  assert.equal(bookingMarkup.includes("Synthetic Job 2"), false);
  assert.equal(bookingMarkup.includes("release #"), false);

  const cancellationMarkup = renderIntakeList({
    items: [bookingCase, cancellationCase],
    kind: "cancellation",
    emptyMessage: "none",
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  });
  assert.match(cancellationMarkup, /Synthetic Job 2/);
  assert.match(cancellationMarkup, /Granot recorded a cancellation/);
  assert.match(cancellationMarkup, /Vantage has an official booking on this job/);
  assert.equal(cancellationMarkup.includes("priority 5"), false);
});

test("intake queue loading, error, and empty states stay explicit", () => {
  assert.match(
    renderToStaticMarkup(createElement(IntakesDashboardView, { kind: "booking", state: "open", loading: true })),
    /Loading intakes/,
  );
  assert.match(
    renderToStaticMarkup(createElement(IntakesDashboardView, { kind: "booking", state: "open", error: "Synthetic failure" })),
    /Synthetic failure/,
  );
  assert.match(
    renderToStaticMarkup(createElement(IntakesDashboardView, {
      kind: "booking",
      state: "open",
      data: { items: [] },
    })),
    /No booking intakes waiting/,
  );
  assert.match(
    renderToStaticMarkup(createElement(IntakesDashboardView, {
      kind: "booking",
      state: "open",
      data: { items: [] },
    })),
    /official booking/,
  );
  assert.match(
    renderToStaticMarkup(createElement(IntakesDashboardView, {
      kind: "cancellation",
      state: "open",
      data: {},
    })),
    /No cancellation intakes waiting/,
  );
});

test("intakes header keeps owner language and a refresh control", () => {
  const markup = renderToStaticMarkup(createElement(IntakesHeader, {
    lastCheckedAt: new Date("2026-08-20T07:55:00.000Z").getTime(),
    onRefresh: () => undefined,
  }));
  assert.match(markup, /Intakes/);
  assert.match(markup, /records a Booked job/);
  assert.match(markup, /cancels a job/);
  assert.match(markup, /Refresh/);
  assert.match(markup, /Last checked/);
  assert.match(markup, /aria-label="Refresh intakes"/);
  const checking = renderToStaticMarkup(createElement(IntakesHeader, { refreshing: true }));
  assert.match(checking, /Checking…/);
});

test("intakes URL helpers keep booking and cancellation queues distinct", () => {
  assert.equal(INTAKES_HREF, "/intakes");
  assert.equal(parseTab(null), "booking");
  assert.equal(parseTab("cancellations"), "cancellation");
  assert.equal(parseState(null), "open");
  assert.equal(parseState("resolved"), "resolved");
  assert.equal(buildIntakesHref({ tab: "booking", state: "open" }), "/intakes");
  assert.equal(
    buildIntakesHref({ tab: "cancellation", state: "resolved", job: "JOB 9", cursor: "opaque+1" }),
    "/intakes?tab=cancellations&state=resolved&job=JOB+9&cursor=opaque%2B1",
  );
  assert.equal(intakeCaseHref("case-booking"), "/intakes?case=case-booking");
  assert.equal(
    intakeCaseHref("case-release", { tab: "cancellation", state: "resolved" }),
    "/intakes?tab=cancellations&state=resolved&case=case-release",
  );
});

test("intake queue pages ten cases at a time with next and previous", () => {
  assert.equal(INTAKE_PAGE_SIZE, 10);
  assert.deepEqual(parseCursorHistory(null), []);
  assert.deepEqual(parseCursorHistory(JSON.stringify(["", "opaque+1"])), ["", "opaque+1"]);
  assert.deepEqual(pushCursorHistory([], undefined), [""]);
  assert.deepEqual(pushCursorHistory([""], "opaque+1"), ["", "opaque+1"]);
  assert.deepEqual(popCursorHistory(["", "opaque+1"]), { cursor: "opaque+1", history: [""] });
  assert.deepEqual(popCursorHistory([""]), { cursor: undefined, history: [] });
  assert.deepEqual(popCursorHistory([]), { cursor: undefined, history: [] });
  assert.equal(
    buildIntakesHref({ tab: "booking", state: "open", cursor: "page-2", cursors: [""] }),
    `/intakes?cursor=page-2&cursors=${encodeURIComponent(JSON.stringify([""]))}`,
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const firstPage = renderToStaticMarkup(createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(IntakesDashboardView, {
      kind: "booking",
      state: "open",
      data: { items: [bookingCase], next_cursor: "page-2" },
      page: 1,
      hasNextPage: true,
    }),
  ));
  assert.match(firstPage, /Previous/);
  assert.match(firstPage, /Next/);
  assert.match(firstPage, /Page 1/);
  assert.match(firstPage, /disabled=""/);
  assert.equal(firstPage.includes("Show more"), false);

  const laterPage = renderToStaticMarkup(createElement(IntakesPagination, {
    page: 2,
    hasPrevious: true,
    hasNext: false,
  }));
  assert.match(laterPage, /Page 2/);
  assert.match(laterPage, /Previous/);
  assert.match(laterPage, /Next/);
});

test("booking intake list exposes a per-booking Granot payload accordion", () => {
  const bookingMarkup = renderIntakeList({
    items: [bookingCase, cancellationCase],
    kind: "booking",
    emptyMessage: "none",
  });
  assert.match(bookingMarkup, /Granot Booked payload/);
  assert.match(bookingMarkup, /Latest payload that created this booking intake/);
  assert.equal(bookingMarkup.includes("Synthetic Job 2"), false);

  const cancellationMarkup = renderIntakeList({
    items: [bookingCase, cancellationCase],
    kind: "cancellation",
    emptyMessage: "none",
  });
  assert.equal(cancellationMarkup.includes("Granot Booked payload"), false);
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
  assert.equal(
    creatingObservationTitle("latest_creating"),
    "Latest Granot payload that created this intake",
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

test("intake list shows pairing audit lines without implying Priority 5 still opens intakes", () => {
  const paired = {
    ...bookingCase,
    latest_action: "booked" as const,
    priority_pairing: {
      pairing: "priority_5_then_booked" as const,
      creating_booked_priority_is_5: true,
      has_preceding_priority_5: true,
      has_later_priority_5: false,
    },
  };
  const warning = {
    ...bookingCase,
    case_id: "case-booked-without-5",
    job_no: "Synthetic Job 3",
    latest_action: "booked" as const,
    priority_pairing: {
      pairing: "booked_without_priority_5" as const,
      creating_booked_priority_is_5: false,
      has_preceding_priority_5: false,
      has_later_priority_5: false,
    },
  };
  const markup = renderIntakeList({
    items: [paired, warning],
    kind: "booking",
    emptyMessage: "none",
  });
  assert.match(markup, /Priority 5 then Booked/);
  assert.match(markup, /Booked without Priority 5/);
  assert.equal(markup.includes("Granot set this lead to priority 5"), false);
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
    capabilities: { commands: true, referral: false, release_cases: false, discrepancies: false },
    ...overrides,
  };
}

function renderWorkbench(detail: GranotLifecycleCaseDetail): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(BookingIntakeWorkbench, { detail, backHref: "/intakes", backLabel: "Back to waiting intakes" }),
  ));
}

test("the booking intake reads as one story: Granot, then the customer, then the work, then the record", () => {
  const markup = renderWorkbench(bookingIntakeDetail());
  const actInOrder = [
    "Back to waiting intakes",
    "Booking intake",
    "Job Synthetic Job 1",
    "How to finish this booking",
    "What Granot sent us",
    "Who this booking is for",
    "Finish the booking",
    "What Vantage already has on this job",
    "Every update Granot sent on this job",
    "How this job got here",
  ];
  let readSoFar = -1;
  for (const act of actInOrder) {
    const at = markup.indexOf(act);
    assert.ok(at > readSoFar, `${act} is out of order in the booking intake story`);
    readSoFar = at;
  }
});

test("a booking intake that needs no customer never asks for one", () => {
  const referral = bookingIntakeDetail({
    mode: "create_referral_booking",
    candidate_search: { available: false, default_scope: "source", all_scope_warning: false },
    capabilities: { commands: true, referral: true, release_cases: false, discrepancies: false },
  });
  const markup = renderWorkbench(referral);
  assert.equal(markup.includes("Who this booking is for"), false);
  assert.match(markup, /Create Referral Booking/);
});

test("a booking intake nobody can finish yet says so and opens the record instead", () => {
  const markup = renderWorkbench(bookingIntakeDetail({
    capabilities: { commands: false, referral: false, release_cases: false, discrepancies: false },
  }));
  assert.match(markup, /Vantage is not ready to file bookings from this screen yet/);
  assert.match(markup, /Nothing is being lost/);
  assert.match(markup, /open=""/);
});

test("the reference drawers explain the job in owner words, not schema words", () => {
  const detail = bookingIntakeDetail();
  const markup = renderToStaticMarkup(createElement(IntakeReferenceDrawers, {
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
  for (const jargon of ["normalization_result", "priority_5", "observation_id", "decision_id"]) {
    assert.equal(markup.includes(jargon), false);
  }
});

test("intake surfaces never blot out the customer the owner has to call", () => {
  const listMarkup = renderIntakeList({
    items: [bookingCase],
    kind: "booking",
    emptyMessage: "none",
  });
  assert.match(listMarkup, /Synthetic Waiting Customer/);
  assert.match(listMarkup, /1 update from Granot on this job/);
  assert.equal(listMarkup.includes("•••"), false);
  assert.equal(listMarkup.includes("***"), false);
});
