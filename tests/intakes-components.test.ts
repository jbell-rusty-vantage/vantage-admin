import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  INTAKES_HREF,
  intakeActionLabel,
  intakeCaseHref,
  intakeCaseHowToFinish,
  intakeEmptyMessage,
  intakeKindFromCase,
  intakeKindLabel,
  intakeNextStep,
  intakeStatusLabel,
  intakeWhatVantageHas,
  intakeWhyHere,
  isAllowedIntakeReturn,
} from "../components/intakes/intake-copy";
import { IntakeList } from "../components/intakes/intake-list";
import {
  IntakesDashboardView,
  IntakesHeader,
  buildIntakesHref,
  parseState,
  parseTab,
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
  assert.equal(intakeWhyHere("priority_5"), "Granot set this lead to priority 5 (booked)");
  assert.equal(intakeWhyHere("booked"), "Granot recorded a booking");
  assert.equal(intakeWhyHere("release"), "Granot recorded a cancellation");
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
  assert.match(intakeNextStep(bookingCase), /official binder, deposit, agents, and merchant/);
  assert.match(
    intakeCaseHowToFinish({
      kind: "booking",
      mode: "create_missing_booking",
      state: "open",
      commandsAvailable: true,
    })?.body ?? "",
    /Operations Registry catalog/,
  );
  assert.match(intakeEmptyMessage("booking", "open"), /priority 5/);
  assert.match(intakeEmptyMessage("cancellation", "open"), /cancels a job/);
  assert.equal(isAllowedIntakeReturn("/intakes"), true);
  assert.equal(isAllowedIntakeReturn("/intakes?tab=cancellations"), true);
  assert.equal(isAllowedIntakeReturn("/ingestion/granot/lifecycle"), false);
});

test("intake list uses owner language and keeps booking and cancellation rows distinct", () => {
  const bookingMarkup = renderToStaticMarkup(createElement(IntakeList, {
    items: [bookingCase, cancellationCase],
    kind: "booking",
    emptyMessage: "none",
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  }));
  assert.match(bookingMarkup, /Synthetic Job 1/);
  assert.match(bookingMarkup, /Granot set this lead to priority 5 \(booked\)/);
  assert.match(bookingMarkup, /No official Vantage booking yet/);
  assert.match(bookingMarkup, /Waiting for you/);
  assert.match(bookingMarkup, /Finish booking/);
  assert.match(bookingMarkup, /choose a lead and enter official binder/);
  assert.match(bookingMarkup, /href="\/intakes\?case=case-booking"/);
  assert.equal(bookingMarkup.includes("Synthetic Job 2"), false);
  assert.equal(bookingMarkup.includes("release #"), false);

  const cancellationMarkup = renderToStaticMarkup(createElement(IntakeList, {
    items: [bookingCase, cancellationCase],
    kind: "cancellation",
    emptyMessage: "none",
    now: new Date("2026-08-18T12:00:00.000Z").getTime(),
  }));
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
  assert.match(markup, /priority 5/);
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
