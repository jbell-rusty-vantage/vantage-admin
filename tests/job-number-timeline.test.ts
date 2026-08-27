import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttentionPanel } from "../components/job-number-timeline/attention-panel";
import { DensityFilter } from "../components/job-number-timeline/density-filter";
import { JobTimelineDashboardView } from "../components/job-number-timeline/job-timeline-dashboard";
import { JobTimelineHeader } from "../components/job-number-timeline/job-timeline-header";
import { OwnerTimeline } from "../components/job-number-timeline/owner-timeline";
import { ProofBoundaries } from "../components/job-number-timeline/proof-boundaries";
import { StageStrip } from "../components/job-number-timeline/stage-strip";
import { buildSpineItems, eventVisibleInDensity } from "../components/job-number-timeline/v2";
import {
  GOOGLE_LIMITATION_LABEL,
  WORDPRESS_LIMITATION_LABEL,
  v1Page,
  v2Page,
  v2PageWithAttention,
} from "./job-timeline-fixtures";

const page = v1Page;

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

test("invalid_job_number and filtered_out copy still hold", () => {
  const invalid = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "invalid_job_number", normalized_job_no: null },
      searched: true,
      loading: false,
    }),
  );
  assert.match(invalid, /That Job Number cannot be searched/);
  const filtered = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: {
        status: "filtered_out",
        normalized_job_no: "5562924",
        scopes: [{ kind: "lead", source_granularity_id: "g1", source_granularity_label: "Site A" }],
      },
      searched: true,
      loading: false,
    }),
  );
  assert.match(filtered, /This Job is outside the requested Source Granularity/);
  assert.match(filtered, /Site A/);
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

test("v1 fixture remains renderable during client migration", () => {
  const markup = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v1Page },
      searched: true,
      loading: false,
    }),
  );
  assert.match(markup, /P5562924/);
  assert.match(markup, /Lead created \(wordpress_form\)/);
  assert.match(markup, /Text delivered \(welcome\)/);
  assert.match(markup, /Job Number acquired/);
  assert.match(markup, /aria-label="Coverage"/);
  assert.doesNotMatch(markup, /schema_version/);
  assert.doesNotMatch(markup, /What we know/);
  assert.doesNotMatch(markup, /View evidence/);
  assert.doesNotMatch(markup, /Needs attention/);
  assert.doesNotMatch(markup, /555-555/);
  assert.doesNotMatch(markup, /\{&quot;/);
});

test("v2 default render uses stage assessments and hides coverage chips", () => {
  const markup = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "lifecycle",
      onViewChange() {},
    }),
  );
  assert.match(markup, /Cancelled/);
  assert.match(markup, /Lead recorded/);
  assert.match(markup, /Google not verified/);
  assert.match(markup, /aria-label="What we know"/);
  assert.doesNotMatch(markup, /aria-label="Coverage"/);
  assert.doesNotMatch(markup, /Booking absent/);
  assert.doesNotMatch(markup, /Cancellation absent/);
  assert.doesNotMatch(markup, /Sheet verified/i);
});

test("attention panel is absent when attention is empty", () => {
  const empty = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "lifecycle",
      onViewChange() {},
    }),
  );
  assert.doesNotMatch(empty, /Needs attention/);
  assert.doesNotMatch(empty, /aria-label="Attention"/);

  const present = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2PageWithAttention },
      searched: true,
      loading: false,
      view: "lifecycle",
      onViewChange() {},
    }),
  );
  assert.match(present, /Needs attention/);
  assert.match(present, /PROCESSING_EVIDENCE_GAP/);
  assert.match(present, /A claimed applied Decision lacks its required EntityChange/);
});

test("proof boundaries stay collapsed and quote server limitation labels", () => {
  const markup = renderToStaticMarkup(createElement(ProofBoundaries, { limitations: v2Page.limitations }));
  assert.match(markup, /<details/);
  assert.match(markup, /Proof boundaries/);
  assert.match(markup, /GOOGLE_DESTINATION_UNVERIFIED/);
  assert.ok(markup.includes(GOOGLE_LIMITATION_LABEL));
  assert.match(markup, /WORDPRESS_RECEIPT_UNAVAILABLE/);
  assert.ok(markup.includes(WORDPRESS_LIMITATION_LABEL));
  assert.doesNotMatch(markup, /Sheet verified/i);
});

test("density filters hide rows only and keep header counts stable", () => {
  const header = renderToStaticMarkup(createElement(JobTimelineHeader, { page: v2Page }));
  assert.match(header, /Events<\/dt><dd>9<\/dd>/);
  assert.match(header, /aria-label="Attention count: 0"/);
  assert.match(header, /Cancelled/);

  const lifecycle = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "lifecycle",
      onViewChange() {},
    }),
  );
  const customer = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "customer",
      onViewChange() {},
    }),
  );
  const system = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "system",
      onViewChange() {},
    }),
  );

  assert.match(lifecycle, /Cancelled/);
  assert.match(customer, /Cancelled/);
  assert.match(system, /Cancelled/);
  assert.match(lifecycle, />9</);
  assert.match(customer, />9</);
  assert.match(system, />9</);
  assert.match(customer, /Official Booking recorded/);
  assert.match(customer, /Official Cancellation recorded/);
  assert.doesNotMatch(customer, /Granot priority_updated/);
  assert.match(system, /Granot priority_updated/);
  assert.doesNotMatch(system, /Official Booking recorded/);
  assert.doesNotMatch(system, /Official Cancellation recorded/);
  assert.doesNotMatch(lifecycle, /Needs attention/);
});

test("activity groups retain every event when expanded", () => {
  const items = buildSpineItems(v2Page.events, v2Page.activities, { cluster: true });
  const cluster = items.find((item) => item.type === "cluster");
  assert.ok(cluster && cluster.type === "cluster");
  assert.deepEqual(cluster.children.map((event) => event.id), ["e4", "e5", "e6"]);

  const markup = renderToStaticMarkup(
    createElement(OwnerTimeline, {
      events: v2Page.events,
      activities: v2Page.activities,
      view: "lifecycle",
    }),
  );
  assert.match(markup, /Granot priority_updated/);
  assert.match(markup, /3 steps/);
  assert.match(markup, /Decision applied \/ lead_synchronized/);
  assert.match(markup, /Lead updated \(synchronizeLeadFromGranot: granot_priority\)/);
  assert.match(markup, /View evidence/);
});

test("official Booking and official Cancellation remain independently visible", () => {
  const items = buildSpineItems(v2Page.events, v2Page.activities, { cluster: true });
  const official = items.filter(
    (item) => item.type === "event" && (item.event.kind === "official_booking" || item.event.kind === "official_cancellation"),
  );
  assert.equal(official.length, 2);
  assert.equal(items.some((item) => item.type === "cluster" && item.children.some((event) => event.kind.startsWith("official_"))), false);

  const markup = renderToStaticMarkup(
    createElement(OwnerTimeline, {
      events: v2Page.events,
      activities: v2Page.activities,
      view: "lifecycle",
    }),
  );
  assert.match(markup, /Official Booking recorded/);
  assert.match(markup, /Official Cancellation recorded/);
});

test("stage strip renders server labels only", () => {
  const markup = renderToStaticMarkup(createElement(StageStrip, { assessments: v2Page.stage_assessments }));
  assert.match(markup, /Lead recorded/);
  assert.match(markup, /Text delivered/);
  assert.match(markup, /Booked/);
  assert.match(markup, /Cancelled/);
  assert.match(markup, /Google not verified/);
  assert.doesNotMatch(markup, /Booking absent/);
});

test("density filter is keyboard-reachable radio group", () => {
  const markup = renderToStaticMarkup(
    createElement(DensityFilter, { view: "lifecycle", onViewChange() {} }),
  );
  assert.match(markup, /role="radiogroup"/);
  assert.match(markup, /Lifecycle story/);
  assert.match(markup, /All evidence/);
  assert.match(markup, /Attention only/);
  assert.match(markup, /Customer lifecycle/);
  assert.match(markup, /System processing/);
  assert.match(markup, /aria-checked="true"/);
});

test("attention-only density uses server event ids and stages", () => {
  assert.equal(
    eventVisibleInDensity(v2PageWithAttention.events[4], "attention", v2PageWithAttention.attention, v2PageWithAttention.stage_assessments),
    true,
  );
  assert.equal(
    eventVisibleInDensity(v2PageWithAttention.events[0], "attention", v2PageWithAttention.attention, v2PageWithAttention.stage_assessments),
    false,
  );
});

test("v2 render never dumps raw JSON or contact", () => {
  const markup = renderToStaticMarkup(
    createElement(JobTimelineDashboardView, {
      result: { status: "ok", page: v2Page },
      searched: true,
      loading: false,
      view: "all",
      onViewChange() {},
    }),
  );
  assert.doesNotMatch(markup, /555-555/);
  assert.doesNotMatch(markup, /sms body/i);
  assert.doesNotMatch(markup, /spreadsheet_id/);
  assert.doesNotMatch(markup, /\{&quot;kind&quot;/);
});

test("empty attention component renders nothing", () => {
  const markup = renderToStaticMarkup(createElement(AttentionPanel, { items: [] }));
  assert.equal(markup, "");
});

test("v2 page exposes screen-reader names on outcome, attention, and evidence", () => {
  const header = renderToStaticMarkup(createElement(JobTimelineHeader, { page: v2Page }));
  assert.match(header, /aria-label="Current outcome: Cancelled"/);
  assert.match(header, /aria-label="Attention count: 0"/);
  assert.match(header, /aria-label="Lead recorded \(complete\)"/);
  assert.match(header, /aria-label="Google not verified \(unverifiable\)"/);

  const attention = renderToStaticMarkup(
    createElement(AttentionPanel, { items: v2PageWithAttention.attention }),
  );
  assert.match(attention, /aria-label="Attention, 1 item"/);

  const timeline = renderToStaticMarkup(
    createElement(OwnerTimeline, {
      events: v2Page.events,
      activities: v2Page.activities,
      view: "lifecycle",
    }),
  );
  assert.match(timeline, /aria-label="View evidence for Lead created \(wordpress_form\)"/);
  assert.match(timeline, /aria-label="View evidence for Official Booking recorded"/);

  const proof = renderToStaticMarkup(createElement(ProofBoundaries, { limitations: v2Page.limitations }));
  assert.match(proof, /aria-label="Proof boundaries"/);
});

test("density radios stay tabbable without roving tabindex", () => {
  const markup = renderToStaticMarkup(
    createElement(DensityFilter, { view: "lifecycle", onViewChange() {} }),
  );
  assert.match(markup, /role="radiogroup"/);
  assert.match(markup, /aria-label="Timeline density"/);
  assert.equal((markup.match(/role="radio"/g) ?? []).length, 5);
  assert.doesNotMatch(markup, /tabIndex=\{-1\}/);
  assert.doesNotMatch(markup, /tabindex="-1"/);
});
