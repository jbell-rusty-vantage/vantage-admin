import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GRANOT_LIFECYCLE_COPY,
  GRANOT_LIFECYCLE_HREF,
  GRANOT_LIFECYCLE_RECEIPTS_HREF,
} from "../components/granot-lifecycle/granot-lifecycle-copy";
import { GranotLifecycleSubnavLinks } from "../components/granot-lifecycle/granot-lifecycle-subnav";
import {
  GRANOT_WEBHOOK_RECEIPT_FILTER_KEYS,
  GranotWebhookReceiptsFilterBar,
  GranotWebhookReceiptsList,
  GranotWebhookReceiptsView,
  buildGranotWebhookReceiptHref,
  labelForBookingAction,
  labelForRouteEventClass,
  parseGranotWebhookReceiptUrlFilters,
  shouldShowBookingActionFilter,
} from "../components/granot-lifecycle/receipt-search";
import { buildJobTimelineHref } from "../lib/api/jobNumberTimeline";
import type { GranotWebhookReceiptListItem } from "../lib/api/granotLifecycle";

const bookedRow: GranotWebhookReceiptListItem = {
  receipt_id: "64aaaaaaaaaaaaaaaaaaaaaa",
  captured_at: "2026-08-28T15:02:00.000Z",
  route_event_class: "booking_status_changed",
  booking_action: "booked",
  processing_state: "completed",
  observation_id: "65aaaaaaaaaaaaaaaaaaaaaa",
  decision_outcome: "linked",
  ref_no: "DT_synthetic",
  job_no: "P5562401",
  contact: {
    display_name: "A***",
    phone: "***0100",
    email: "a***@example.invalid",
  },
  source_company: { id: "src-1", owner_label: "Synthetic Source" },
  intake_case_id: "66aaaaaaaaaaaaaaaaaaaaaa",
};

const identityOnlyRow: GranotWebhookReceiptListItem = {
  ...bookedRow,
  receipt_id: "64bbbbbbbbbbbbbbbbbbbbbb",
  route_event_class: "lead_created",
  booking_action: null,
  job_no: null,
  intake_case_id: null,
  source_company: null,
  decision_outcome: null,
  processing_state: "pending",
};

function ariaCurrentCount(markup: string): number {
  return (markup.match(/aria-current="page"/g) ?? []).length;
}

function linkHasCurrent(markup: string, href: string): boolean {
  const match = markup.match(new RegExp(`<a[^>]*href="${href}"[^>]*>|<a[^>]*aria-current="page"[^>]*href="${href}"[^>]*>`));
  return Boolean(match?.[0]?.includes('aria-current="page"'));
}

test("Receipts and Health subnav never highlight both", () => {
  const receiptsIndex = renderToStaticMarkup(
    createElement(GranotLifecycleSubnavLinks, { pathname: GRANOT_LIFECYCLE_HREF }),
  );
  const receiptsPath = renderToStaticMarkup(
    createElement(GranotLifecycleSubnavLinks, { pathname: GRANOT_LIFECYCLE_RECEIPTS_HREF }),
  );
  const receiptsNested = renderToStaticMarkup(
    createElement(GranotLifecycleSubnavLinks, { pathname: `${GRANOT_LIFECYCLE_RECEIPTS_HREF}/extra` }),
  );
  const health = renderToStaticMarkup(
    createElement(GranotLifecycleSubnavLinks, { pathname: "/granot-lifecycle/health" }),
  );
  const healthNested = renderToStaticMarkup(
    createElement(GranotLifecycleSubnavLinks, { pathname: "/granot-lifecycle/health/extra" }),
  );

  for (const markup of [receiptsIndex, receiptsPath, receiptsNested]) {
    assert.equal(ariaCurrentCount(markup), 1);
    assert.equal(linkHasCurrent(markup, "/granot-lifecycle/receipts"), true);
    assert.equal(linkHasCurrent(markup, "/granot-lifecycle/health"), false);
  }

  for (const markup of [health, healthNested]) {
    assert.equal(ariaCurrentCount(markup), 1);
    assert.equal(linkHasCurrent(markup, "/granot-lifecycle/health"), true);
    assert.equal(linkHasCurrent(markup, "/granot-lifecycle/receipts"), false);
  }
});

test("URL parse and serialize keep only spec filter keys", () => {
  const parsed = parseGranotWebhookReceiptUrlFilters(new URLSearchParams(
    "ref_no=DT_1&job_no=P5562401&name=Ada&phone=2125550100&email=ada%40example.invalid&source_company_id=src-1&route_event_class=booking_status_changed&booking_action=release&captured_from=2026-08-01T00%3A00%3A00.000Z&captured_to=2026-08-28T23%3A59%3A59.999Z&processing_state=completed&cursor=opaque%2Bcursor&limit=50&ignored=drop-me",
  ));
  assert.deepEqual(parsed, {
    ref_no: "DT_1",
    job_no: "P5562401",
    name: "Ada",
    phone: "2125550100",
    email: "ada@example.invalid",
    source_company_id: "src-1",
    route_event_class: "booking_status_changed",
    booking_action: "release",
    captured_from: "2026-08-01T00:00:00.000Z",
    captured_to: "2026-08-28T23:59:59.999Z",
    processing_state: "completed",
    cursor: "opaque+cursor",
    limit: 50,
  });
  assert.equal("ignored" in parsed, false);

  const href = buildGranotWebhookReceiptHref("/granot-lifecycle/receipts", parsed);
  const serialized = new URL(href, "https://admin.test");
  assert.deepEqual(
    [...serialized.searchParams.keys()].sort(),
    [...GRANOT_WEBHOOK_RECEIPT_FILTER_KEYS].sort(),
  );
  assert.equal(serialized.searchParams.get("booking_action"), "release");
  assert.equal(serialized.searchParams.has("ignored"), false);
});

test("booking_action is dropped when event type cannot carry a Booking Action", () => {
  const parsed = parseGranotWebhookReceiptUrlFilters(new URLSearchParams(
    "route_event_class=lead_created&booking_action=booked",
  ));
  assert.equal(parsed.route_event_class, "lead_created");
  assert.equal(parsed.booking_action, undefined);

  const href = buildGranotWebhookReceiptHref("/granot-lifecycle", {
    route_event_class: "priority_updated",
    booking_action: "release",
  });
  assert.doesNotMatch(href, /booking_action=/);
  assert.match(href, /route_event_class=priority_updated/);
});

test("Booked or Release control appears when event type is Booking status changed or unset", () => {
  assert.equal(shouldShowBookingActionFilter(undefined), true);
  assert.equal(shouldShowBookingActionFilter(""), true);
  assert.equal(shouldShowBookingActionFilter("booking_status_changed"), true);
  assert.equal(shouldShowBookingActionFilter("lead_created"), false);
  assert.equal(shouldShowBookingActionFilter("priority_updated"), false);

  const unsetMarkup = renderToStaticMarkup(createElement(GranotWebhookReceiptsFilterBar, {
    filters: {},
    sourceCompanies: [{ id: "src-1", owner_label: "Synthetic Source" }],
    onSubmit: () => undefined,
  }));
  const bookedMarkup = renderToStaticMarkup(createElement(GranotWebhookReceiptsFilterBar, {
    filters: { route_event_class: "booking_status_changed" },
    sourceCompanies: [],
    onSubmit: () => undefined,
  }));
  const leadMarkup = renderToStaticMarkup(createElement(GranotWebhookReceiptsFilterBar, {
    filters: { route_event_class: "lead_created" },
    sourceCompanies: [],
    onSubmit: () => undefined,
  }));
  const priorityMarkup = renderToStaticMarkup(createElement(GranotWebhookReceiptsFilterBar, {
    filters: { route_event_class: "priority_updated" },
    sourceCompanies: [],
    onSubmit: () => undefined,
  }));

  assert.match(unsetMarkup, /id="receipts-booking-action"/);
  assert.match(bookedMarkup, /id="receipts-booking-action"/);
  assert.doesNotMatch(leadMarkup, /id="receipts-booking-action"/);
  assert.doesNotMatch(priorityMarkup, /id="receipts-booking-action"/);
  assert.match(unsetMarkup, />Synthetic Source</);
  assert.doesNotMatch(unsetMarkup, /type="text"[^>]*id="receipts-source-company"/);
});

test("Owner labels are used instead of raw event and action enums", () => {
  assert.equal(labelForRouteEventClass("lead_created"), GRANOT_LIFECYCLE_COPY.eventTypeLeadCreated);
  assert.equal(labelForRouteEventClass("priority_updated"), GRANOT_LIFECYCLE_COPY.eventTypePriorityUpdated);
  assert.equal(
    labelForRouteEventClass("booking_status_changed"),
    GRANOT_LIFECYCLE_COPY.eventTypeBookingStatusChanged,
  );
  assert.equal(labelForBookingAction("booked"), GRANOT_LIFECYCLE_COPY.bookingActionBooked);
  assert.equal(labelForBookingAction("release"), GRANOT_LIFECYCLE_COPY.bookingActionRelease);

  const markup = renderToStaticMarkup(createElement(GranotWebhookReceiptsList, { items: [bookedRow] }));
  assert.match(markup, /Lead created|Priority updated|Booking status changed/);
  assert.match(markup, /Booking status changed/);
  assert.match(markup, />Booked</);
  assert.doesNotMatch(markup, />booking_status_changed</);
  assert.doesNotMatch(markup, />booked</);
});

test("Open Job Timeline and Open Intake render only when ids exist", () => {
  const withIds = renderToStaticMarkup(createElement(GranotWebhookReceiptsList, { items: [bookedRow] }));
  assert.match(withIds, new RegExp(GRANOT_LIFECYCLE_COPY.openJobTimeline));
  assert.match(withIds, new RegExp(GRANOT_LIFECYCLE_COPY.openIntake));
  assert.match(withIds, new RegExp(buildJobTimelineHref({ job: "P5562401" }).replace("?", "\\?")));
  assert.match(withIds, /\/intakes\?case=66aaaaaaaaaaaaaaaaaaaaaa/);

  const withoutIds = renderToStaticMarkup(
    createElement(GranotWebhookReceiptsList, { items: [identityOnlyRow] }),
  );
  assert.doesNotMatch(withoutIds, new RegExp(GRANOT_LIFECYCLE_COPY.openJobTimeline));
  assert.doesNotMatch(withoutIds, new RegExp(GRANOT_LIFECYCLE_COPY.openIntake));
  assert.doesNotMatch(withoutIds, /\/job-timeline/);
  assert.doesNotMatch(withoutIds, /\/intakes\?case=/);
});

test("empty copy comes from the copy module", () => {
  assert.equal(GRANOT_LIFECYCLE_COPY.empty, "No matching Granot webhook receipts.");
  const markup = renderToStaticMarkup(createElement(GranotWebhookReceiptsView, {
    filters: {},
    data: { items: [], next_cursor: null },
  }));
  assert.match(markup, /No matching Granot webhook receipts\./);
  assert.match(
    readFileSync(path.join(process.cwd(), "components/granot-lifecycle/granot-lifecycle-copy.ts"), "utf8"),
    /No matching Granot webhook receipts\./,
  );
});

test("a sample row never prints raw route_event_class, booking_action, or granot_statement", () => {
  const markup = renderToStaticMarkup(createElement(GranotWebhookReceiptsList, { items: [bookedRow] }));
  assert.match(markup, /A\*\*\*/);
  assert.match(markup, /\*\*\*0100/);
  assert.match(markup, /Synthetic Source/);
  assert.match(markup, /DT_synthetic/);
  assert.match(markup, /P5562401/);
  assert.doesNotMatch(markup, /route_event_class/);
  assert.doesNotMatch(markup, /booking_action/);
  assert.doesNotMatch(markup, /granot_statement/);
  assert.doesNotMatch(markup, /booking_status_changed/);
  assert.doesNotMatch(markup, />booked</);

  const source = readFileSync(
    path.join(process.cwd(), "components/granot-lifecycle/receipt-search.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /granot_statement/);
});
