import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOverviewView } from "../components/dashboard/home-overview";
import { NeedsYouBand, openIntakePreviewFilters } from "../components/dashboard/needs-you";
import { OVERVIEW_INTAKE_PREVIEW_LIMIT, overviewCopy } from "../components/dashboard/overview-copy";
import {
  intakeActionLabel,
  intakeMoreWaitingLabel,
  intakeQueueLabel,
  intakeStatusLabel,
  intakeWaitingEmptyMessage,
} from "../components/intakes/intake-copy";
import type { OverviewReportResponse } from "../lib/api/admin";
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
  customer_label: "Synthetic Waiting Customer",
  latest_action: "booked",
  evidence_count: 1,
  case_revision: 1,
  evidence_revision: 1,
  deterministic_booking: { present: false },
  opened_at: "2026-08-18T10:00:00.000Z",
  last_evidence_at: "2026-08-18T11:00:00.000Z",
};

const productionOverview: OverviewReportResponse = {
  database_scope: "production",
  generated_at: "2026-09-01T12:00:00.000Z",
  all_time: {
    totals: {
      total_deposit_amount: 1_200_000,
      total_binder_amount: 1_000_000,
      bookings: 842,
      active_bookings: 700,
      total_leads: 18_410,
      cancellations: 196,
      booking_rate: 0.045,
      cancellation_rate: 0.23,
    },
    lead_cost: { total: 50_000, by_source_company: [] },
    top_agents: [{ agent_name: "All-Time Agent", bookings: 100, total_deposit_amount: 200_000 }],
  },
  last_7_days: {
    period: { from: "2026-08-25T00:00:00.000Z", to: "2026-09-01T12:00:00.000Z" },
    totals: {
      total_deposit_amount: 14_208,
      total_binder_amount: 12_000,
      bookings: 9,
      active_bookings: 7,
      total_leads: 68,
      booking_rate: 0.265,
      cancellation_rate: 0.222,
      cancelled_bookings: 2,
    },
    by_source_company: [],
    lead_cost: { total: 1_840, by_source_company: [] },
    top_agents: [{ agent_name: "Patrick", bookings: 5, total_deposit_amount: 7_994 }],
  },
};

function renderOverview(
  props: Partial<Parameters<typeof HomeOverviewView>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(HomeOverviewView, {
      role: "owner",
      scope: "production",
      overview: productionOverview,
      ...props,
    }),
  );
}

test("waiting band stays visible when no booking intakes are open", () => {
  const markup = renderToStaticMarkup(
    createElement(NeedsYouBand, {
      booking: { items: [], next_cursor: null },
    }),
  );
  assert.match(markup, new RegExp(intakeStatusLabel("open")));
  assert.match(markup, new RegExp(intakeQueueLabel("booking")));
  assert.match(markup, new RegExp(intakeWaitingEmptyMessage("booking")));
  assert.doesNotMatch(markup, new RegExp(intakeQueueLabel("cancellation")));
  assert.doesNotMatch(markup, new RegExp(intakeWaitingEmptyMessage("cancellation")));
  assert.doesNotMatch(markup, /Press Refresh/);
});

test("waiting band lists open booking intakes and links to the intake workbench", () => {
  const markup = renderToStaticMarkup(
    createElement(NeedsYouBand, {
      booking: { items: [bookingCase], next_cursor: null },
      now: Date.parse("2026-08-18T15:00:00.000Z"),
    }),
  );
  assert.match(markup, /Synthetic Job 1/);
  assert.match(markup, /Synthetic Waiting Customer/);
  assert.match(markup, /href="\/intakes\?case=case-booking"/);
  assert.match(markup, new RegExp(intakeActionLabel("booking")));
  assert.doesNotMatch(markup, /tab=cancellations/);
  assert.doesNotMatch(markup, /Review cancellation/);
});

test("waiting band offers the intakes list when more open booking cases exist", () => {
  const markup = renderToStaticMarkup(
    createElement(NeedsYouBand, {
      booking: { items: [bookingCase], next_cursor: "opaque-cursor" },
    }),
  );
  assert.match(markup, new RegExp(intakeMoreWaitingLabel("booking")));
  assert.doesNotMatch(markup, new RegExp(intakeMoreWaitingLabel("cancellation")));
});

test("open intake preview uses the intakes list contract with a desk-sized page", () => {
  assert.deepEqual(openIntakePreviewFilters("booking"), {
    kind: "booking",
    state: "open",
    sort: "last_evidence_at",
    order: "desc",
    limit: OVERVIEW_INTAKE_PREVIEW_LIMIT,
  });
  assert.equal(OVERVIEW_INTAKE_PREVIEW_LIMIT, 3);
});

test("owner overview is a desk: waiting work, this week, then all time", () => {
  const markup = renderOverview({
    bookingQueue: { items: [bookingCase], next_cursor: null },
  });

  const waitingAt = markup.indexOf(intakeStatusLabel("open"));
  const thisWeekAt = markup.indexOf(overviewCopy.thisWeek);
  const allTimeAt = markup.indexOf(overviewCopy.allTime);
  const startAt = markup.indexOf(overviewCopy.startARecord);

  assert.notEqual(waitingAt, -1);
  assert.ok(waitingAt < thisWeekAt);
  assert.ok(thisWeekAt < startAt);
  assert.ok(startAt < allTimeAt);
  assert.match(markup, /Patrick/);
  assert.match(markup, /\$14,208/);
  assert.match(markup, /href="\/analytics"/);
  assert.match(markup, /href="\/bookings\/new"/);
  assert.match(markup, /href="\/cancellations\/new"/);
});

test("overview no longer launches shipped tabs or reprints Analytics tables", () => {
  const markup = renderOverview();

  assert.doesNotMatch(markup, /Jump To/);
  assert.doesNotMatch(markup, /Lead Conversations/);
  assert.doesNotMatch(markup, /Job timeline/);
  assert.doesNotMatch(markup, /Granot Automation/);
  assert.doesNotMatch(markup, /Lead Cost by Source/);
  assert.doesNotMatch(markup, /Sales by Source Company/);
  assert.doesNotMatch(markup, /Top Sales by Agent/);
  assert.doesNotMatch(markup, />All-Time Agent</);
});

test("admin overview omits the waiting band and still starts a record", () => {
  const markup = renderOverview({
    role: "admin",
    bookingQueue: { items: [bookingCase], next_cursor: null },
  });

  assert.doesNotMatch(markup, new RegExp(intakeStatusLabel("open")));
  assert.doesNotMatch(markup, /Synthetic Job 1/);
  assert.match(markup, new RegExp(overviewCopy.thisWeek));
  assert.match(markup, new RegExp(overviewCopy.startARecord));
  assert.match(markup, /href="\/bookings\/new"/);
});

test("historical overview keeps all time and create actions without a this-week pulse", () => {
  const markup = renderOverview({
    scope: "historical",
    overview: { ...productionOverview, database_scope: "historical", last_7_days: null },
  });

  assert.doesNotMatch(markup, new RegExp(overviewCopy.thisWeek));
  assert.doesNotMatch(markup, /Patrick/);
  assert.match(markup, new RegExp(overviewCopy.allTime));
  assert.match(markup, new RegExp(overviewCopy.startARecord));
  assert.match(markup, /\$1,200,000/);
});

test("production overview keeps this week visible while metrics load", () => {
  const markup = renderOverview({ overview: undefined, overviewLoading: true });
  const thisWeekAt = markup.indexOf(overviewCopy.thisWeek);
  const allTimeAt = markup.indexOf(overviewCopy.allTime);
  assert.notEqual(thisWeekAt, -1);
  assert.ok(thisWeekAt < allTimeAt);
  assert.match(markup, new RegExp(overviewCopy.startARecord));
});

test("combined overview hides this week even if leftover last-7-days data is present", () => {
  const markup = renderOverview({
    scope: "combined",
    overview: { ...productionOverview, database_scope: "combined" },
  });

  assert.doesNotMatch(markup, new RegExp(overviewCopy.thisWeek));
  assert.doesNotMatch(markup, /Patrick/);
  assert.match(markup, new RegExp(overviewCopy.allTime));
  assert.match(markup, new RegExp(overviewCopy.startARecord));
});
