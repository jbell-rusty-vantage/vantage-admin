import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  CreatingObservationView,
} from "../components/intakes/creating-observation-accordion";
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
import { PriorityPairingSection } from "../components/intakes/creating-observation-accordion";
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
import type { GranotLifecycleCaseListItem } from "../lib/api/granotLifecycle";

const bookingCase: GranotLifecycleCaseListItem = {
  case_id: "case-booking",
  kind: "booking",
  state: "open",
  mode: "create_missing_booking",
  sequence_number: 1,
  normalized_job_no: "SYNTHETIC JOB 1",
  job_no: "Synthetic Job 1",
  source: { id: "source-1", label: "Synthetic Source" },
  masked_contact_label: "A*** · ***1111",
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

test("creating observation accordion shows the Booked statement and normalized observation", () => {
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
  const markup = renderToStaticMarkup(createElement(CreatingObservationView, {
    data: {
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
        identity: { job_no_raw: "Synthetic Job 1" },
        contact: {},
        move: {},
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
    },
  }));
  assert.match(markup, /Priority pairing/);
  assert.match(markup, /Priority 5 then Booked/);
  assert.match(markup, /observation-priority/);
  assert.match(markup, /Granot statement/);
  assert.match(markup, /Normalized Granot Observation/);
  assert.match(markup, /&quot;event_type&quot;: &quot;Booked&quot;/);
  assert.match(markup, /observation-booked/);
});

test("creating observation pairing section warns for Booked without Priority 5", () => {
  const markup = renderToStaticMarkup(createElement(PriorityPairingSection, {
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
  assert.match(markup, /Priority pairing/);
  assert.match(markup, /Booked without Priority 5/);
  assert.match(markup, /invalid or missing/);
  assert.match(markup, /Open job timeline/);
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
