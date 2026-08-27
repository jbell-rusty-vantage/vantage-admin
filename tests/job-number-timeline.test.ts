import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JobTimelineDashboardView } from "../components/job-number-timeline/job-timeline-dashboard";
import { JobTimelineHeader } from "../components/job-number-timeline/job-timeline-header";
import { OwnerTimeline } from "../components/job-number-timeline/owner-timeline";
import type { JobTimelinePage } from "../lib/api/jobNumberTimeline";

const page: JobTimelinePage = {
  normalized_job_no: "5562924",
  job_no_snapshot: "P5562924",
  proof_shape: "wordpress_born",
  source: {
    source_company_id: "company-1",
    source_company_label: "Moving Place",
    source_granularity_id: "gran-1",
    source_granularity_label: "Moving Place web",
  },
  coverage: {
    lead: "resolved",
    lead_message: "present",
    job_number_at_create: false,
    booking_intake: "open",
    cancellation_intake: "absent",
    official_booking: true,
    official_cancellation: false,
    sheet_sync: "synced",
  },
  current: {
    lead_ref: { model: "FormLead", id: "lead-1" },
    ingestion_origin: "wordpress_form",
    booking_id: "booking-1",
  },
  events: [
    {
      id: "e1",
      kind: "lead_created",
      event_at: "2026-08-01T10:00:00.000Z",
      clock_field: "entity_change.applied_at",
      type_priority: 10,
      coverage: "command_backed",
      headline: "Lead created (wordpress_form)",
      data: { ingestion_origin: "wordpress_form", command_name: "createFormLead", lead_model: "FormLead" },
    },
    {
      id: "e2",
      kind: "lead_message",
      event_at: "2026-08-01T10:01:00.000Z",
      clock_field: "lead_message.delivered_at",
      type_priority: 20,
      coverage: "command_backed",
      headline: "Text delivered (welcome)",
      data: { origin: "public_form", purpose: "welcome", status: "delivered" },
    },
    {
      id: "e3",
      kind: "job_number_acquired",
      event_at: "2026-08-01T12:00:00.000Z",
      clock_field: "entity_change.applied_at",
      type_priority: 30,
      coverage: "command_backed",
      headline: "Job Number acquired",
      data: { acquired_at_create: false },
    },
  ],
};

test("not_found is an honest empty search, not a loaded Job with no events", () => {
  const markup = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "not_found", normalized_job_no: "5562924" },
      searched: true,
      loading: false,
    }),
  );
  assert.match(markup, /No Job matches that number/);
  assert.doesNotMatch(markup, /Job Number timeline/);
  assert.doesNotMatch(markup, /Lead created/);
});

test("blank search does not render a timeline", () => {
  const markup = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: undefined,
      searched: false,
      loading: false,
    }),
  );
  assert.match(markup, /Type a Job Number and search/);
  assert.doesNotMatch(markup, /Lead created/);
});

test("owner timeline renders locked headlines and kind marks, never contact", () => {
  const markup = renderToStaticMarkup(createElement(OwnerTimeline, { events: page.events }));
  assert.match(markup, /Lead created \(wordpress_form\)/);
  assert.match(markup, /Text delivered \(welcome\)/);
  assert.match(markup, /Job Number acquired/);
  assert.match(markup, />Create</);
  assert.match(markup, />Text</);
  assert.doesNotMatch(markup, /555-555/);
  assert.doesNotMatch(markup, /sms body/i);
});

test("header keeps the Job Number and proof shape in owner words", () => {
  const markup = renderToStaticMarkup(createElement(JobTimelineHeader, { page }));
  assert.match(markup, /P5562924/);
  assert.match(markup, /WordPress-born/);
  assert.match(markup, /Moving Place/);
  assert.match(markup, /Lead/);
  assert.match(markup, /Text/);
});

test("owner renderer is not the forensic JobTimeline", async () => {
  const source = await import("../components/job-number-timeline/owner-timeline");
  assert.equal("JobTimeline" in source, false);
  assert.equal(typeof source.OwnerTimeline, "function");
});
