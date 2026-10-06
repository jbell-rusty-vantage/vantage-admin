import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DAILY_COPY } from "../components/daily/daily-copy";
import { FactDrawer } from "../components/daily/fact-drawer";
import {
  buildFeed,
  feedEventIds,
  feedItemEventIds,
  foldBursts,
  foldLabel,
  foldSpan,
  pairFeedEvents,
  rowSegments,
  spotlightLinks,
  spotlightMeta,
  spotlightTitle,
  type FeedFold,
  type FeedRowItem,
  type FeedSpotlight,
} from "../components/daily/feed-model";
import { FoldRow } from "../components/daily/feed-row";
import { LaneTiles, newestLaneFact } from "../components/daily/lane-tiles";
import { laneSparkBuckets, LANE_SPARK_BUCKETS } from "../components/daily/lane-math";
import { LiveFeed } from "../components/daily/live-feed";
import { KindTiersProvider } from "../components/daily/kind-tiers-context";
import {
  isMilestonePinned,
  milestoneHeadline,
  milestoneLinks,
  milestoneProgress,
  milestoneProgressText,
  milestoneRankLine,
  ordinal,
  readMilestone,
  repGoalReachedAtById,
} from "../components/daily/milestone";
import { MilestoneToast, milestoneFromSsePayload } from "../components/daily/milestone-toast";
import { MilestoneCard, SpotlightCard } from "../components/daily/spotlight-card";
import type { DailyOperationsSnapshot } from "../lib/api/dailyOperations";
import { dailyOperationsHasConfirmControl } from "../lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "../lib/api/dailyOperationsLive";
import { emptySnapshot } from "./today-fixtures";

function at(minute: number, second = 0): string {
  return `2026-10-05T18:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`;
}

function eventItem(
  overrides: Partial<DailyOperationsEventItem> & Pick<DailyOperationsEventItem, "event_id" | "lane" | "kind">,
): DailyOperationsEventItem {
  return {
    day: "2026-10-05",
    occurred_at: at(10),
    title: overrides.kind,
    source_company: "top10_leads",
    ingestion_origin: "wordpress_form",
    lead_kind: "form",
    job_no: null,
    entity_type: null,
    entity_id: null,
    parent_receipt_id: null,
    links: {},
    card: {},
    metric_touches: [],
    ...overrides,
  };
}

const text = (id: string, minute: number, second = 0) =>
  eventItem({ event_id: id, lane: "text", kind: "text.sent", occurred_at: at(minute, second) });

function ids(items: ReturnType<typeof buildFeed>): string[] {
  return items.map((item) => (item.type === "fold" ? item.key : item.event.event_id));
}

test("Everything is A and B newest first; C stays out until Show system detail; Needs you is A only", () => {
  const events = [
    eventItem({ event_id: "lead", lane: "lead", kind: "form_lead.created", occurred_at: at(11) }),
    eventItem({ event_id: "dup", lane: "lead", kind: "form_lead.duplicate", occurred_at: at(12) }),
    eventItem({ event_id: "book", lane: "booking", kind: "booking.created", occurred_at: at(9) }),
    eventItem({ event_id: "fail", lane: "text", kind: "text.failed", occurred_at: at(13) }),
  ];
  assert.deepEqual(ids(buildFeed({ events })), ["fail", "lead", "book"]);
  assert.deepEqual(ids(buildFeed({ events, showSystem: true })), ["fail", "dup", "lead", "book"]);
  assert.deepEqual(ids(buildFeed({ events, filter: "needs" })), ["fail", "book"]);
  assert.deepEqual(ids(buildFeed({ events, filter: "lead" })), ["lead"]);
  assert.deepEqual(ids(buildFeed({ events, filter: "lead", showSystem: true })), ["dup", "lead"]);
});

test("each fact appears once: a tier A fact is a card, a tier B fact is a row", () => {
  const events = [
    eventItem({ event_id: "book", lane: "booking", kind: "booking.created" }),
    eventItem({ event_id: "lead", lane: "lead", kind: "form_lead.created", occurred_at: at(9) }),
  ];
  const items = buildFeed({ events });
  assert.deepEqual(items.map((item) => item.type), ["spotlight", "row"]);
  assert.equal(new Set(feedEventIds(items)).size, 2);
});

test("an unknown kind is a row with a neutral tone, never a crash", () => {
  const items = buildFeed({ events: [eventItem({ event_id: "x", lane: "mystery", kind: "mystery.thing" })] });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.type, "row");
});

test("Quiet priorities moves priority updates to counted; a viewer tier override moves any kind", () => {
  const events = [
    eventItem({ event_id: "p", lane: "granot", kind: "granot.priority_updated" }),
    text("t", 5),
  ];
  assert.deepEqual(ids(buildFeed({ events })), ["p", "t"]);
  assert.deepEqual(ids(buildFeed({ events, quietPriorities: true })), ["t"]);
  assert.deepEqual(ids(buildFeed({ events, overrides: { "text.sent": "C" } })), ["p"]);
  assert.deepEqual(ids(buildFeed({ events, overrides: { "text.sent": "A" }, filter: "needs" })), ["t"]);
});

test("the Source Company filter applies", () => {
  const events = [
    eventItem({ event_id: "a", lane: "lead", kind: "form_lead.created", source_company: "top10_leads" }),
    eventItem({ event_id: "b", lane: "lead", kind: "form_lead.created", source_company: "tbm_leads" }),
  ];
  assert.deepEqual(ids(buildFeed({ events, company: "tbm_leads" })), ["b"]);
});

test("Booked pairs with the Intake of the same job into one Spotlight", () => {
  const events = [
    eventItem({
      event_id: "booked",
      lane: "granot",
      kind: "granot.booked",
      job_no: "5562365",
      occurred_at: at(41),
      card: { customer_name: "Steve D." },
      links: { lead_id: "l1", lead_model: "FormLead" },
    }),
    eventItem({
      event_id: "intake",
      lane: "intake",
      kind: "intake.opened",
      job_no: "5562365",
      occurred_at: at(41, 5),
      links: { intake_case_id: "case-1" },
    }),
    eventItem({ event_id: "other-intake", lane: "intake", kind: "intake.opened", job_no: "999", occurred_at: at(40) }),
  ];
  const items = buildFeed({ events });
  const spotlight = items.find((item): item is FeedSpotlight => item.type === "spotlight");
  assert.ok(spotlight);
  assert.equal(spotlight.event.event_id, "booked");
  assert.deepEqual(spotlight.absorbed.map((event) => event.event_id), ["intake"]);
  assert.equal(spotlightTitle(spotlight), "Booked in Granot · Steve D.");
  assert.equal(spotlightMeta(spotlight), "Top 10 Forms · Job 5562365");
  assert.deepEqual(items.map((item) => item.key), ["booked", "other-intake"]);
  assert.deepEqual(feedItemEventIds(spotlight), ["booked", "intake"]);
  const links = spotlightLinks(spotlight);
  assert.equal(links.length, 2);
  assert.equal(links[0]?.label, DAILY_COPY.feed.finishBooking);
  assert.match(links[0]?.href ?? "", /^\/intakes\?case=case-1/);
});

test("a paired Intake stands alone when its Booked is filtered out of the view", () => {
  const events = [
    eventItem({ event_id: "booked", lane: "granot", kind: "granot.booked", job_no: "77", occurred_at: at(41) }),
    eventItem({ event_id: "intake", lane: "intake", kind: "intake.opened", job_no: "77", occurred_at: at(41, 5) }),
  ];
  assert.deepEqual(ids(buildFeed({ events, filter: "intake" })), ["intake"]);
  assert.deepEqual(ids(buildFeed({ events, filter: "granot" })), ["booked"]);
});

test("a Form Lead followed by its Granot lead is one row with an in-Granot suffix", () => {
  const events = [
    eventItem({ event_id: "form", lane: "lead", kind: "form_lead.created", job_no: "5563723", occurred_at: at(36), card: { customer_name: "Maria G." } }),
    eventItem({ event_id: "granot", lane: "granot", kind: "granot.lead_created", job_no: "5563723", occurred_at: at(37) }),
    eventItem({ event_id: "later-granot", lane: "granot", kind: "granot.lead_created", job_no: "5563723", occurred_at: at(59) }),
    eventItem({ event_id: "unrelated", lane: "granot", kind: "granot.lead_created", job_no: "1", occurred_at: at(38) }),
  ];
  const pairing = pairFeedEvents(events);
  assert.equal(pairing.hostOf.get("granot"), "form");
  assert.equal(pairing.hostOf.has("later-granot"), false, "outside the 15 minute window");
  assert.equal(pairing.suffixOf.get("form"), DAILY_COPY.feed.inGranot);
  const items = buildFeed({ events });
  const row = items.find((item): item is FeedRowItem => item.type === "row" && item.event.event_id === "form");
  assert.equal(row?.suffix, DAILY_COPY.feed.inGranot);
  assert.deepEqual(items.map((item) => item.key).sort(), ["form", "later-granot", "unrelated"]);
});

test("a Lead pairs with its Granot lead by lead id when the job number is missing", () => {
  const events = [
    eventItem({ event_id: "form", lane: "lead", kind: "form_lead.created", occurred_at: at(1), links: { lead_id: "L1", lead_model: "FormLead" } }),
    eventItem({ event_id: "granot", lane: "granot", kind: "granot.lead_created", occurred_at: at(2), links: { lead_id: "L1" } }),
  ];
  assert.deepEqual(ids(buildFeed({ events })), ["form"]);
});

test("a Granot receipt row says its outcome as a suffix; the outcome itself is counted", () => {
  const events = [
    eventItem({ event_id: "receipt", lane: "granot", kind: "granot.lead_created", occurred_at: at(5), links: { receipt_id: "r1" } }),
    eventItem({ event_id: "linked", lane: "granot", kind: "granot.linked", occurred_at: at(5, 2), parent_receipt_id: "r1" }),
  ];
  const items = buildFeed({ events });
  assert.deepEqual(ids(items), ["receipt"]);
  assert.equal((items[0] as FeedRowItem).suffix, DAILY_COPY.feed.linkedToLead);
  assert.deepEqual(ids(buildFeed({ events, showSystem: true })).sort(), ["linked", "receipt"]);
});

test("three or more tier B rows of one kind within three minutes fold into one row", () => {
  const events = [text("t1", 31), text("t2", 31, 30), text("t3", 32), text("t4", 33), text("t5", 34)];
  const items = buildFeed({ events });
  assert.equal(items.length, 1);
  const fold = items[0] as FeedFold;
  assert.equal(fold.type, "fold");
  assert.equal(fold.rows.length, 5);
  assert.equal(fold.rows[0]?.event.event_id, "t5", "newest first");
  assert.equal(fold.key, "fold:t1", "keyed by the oldest fact, so newer facts joining do not reset it");
  assert.equal(foldLabel("text.sent", 5), "5 texts sent");
  assert.match(foldSpan(fold), /^\d{1,2}:\d{2} [AP]M–\d{1,2}:\d{2} [AP]M$/);
  assert.equal(foldLabel("mystery.thing", 4), "4 × mystery thing");
});

test("fewer than three, or too far apart, or different kinds, do not fold", () => {
  assert.equal(buildFeed({ events: [text("a", 31), text("b", 32)] }).every((item) => item.type === "row"), true);
  assert.equal(buildFeed({ events: [text("a", 10), text("b", 20), text("c", 30)] }).every((item) => item.type === "row"), true);
  const mixed = [text("a", 31), eventItem({ event_id: "b", lane: "lead", kind: "form_lead.created", occurred_at: at(32) }), text("c", 33)];
  assert.equal(buildFeed({ events: mixed }).every((item) => item.type === "row"), true);
  // A burst of four with a straggler 10 minutes later: the fold keeps the burst, the straggler is a row.
  const items = buildFeed({ events: [text("a", 31), text("b", 32), text("c", 33), text("d", 44)] });
  assert.deepEqual(items.map((item) => item.type), ["row", "fold"]);
});

test("a spotlight kind is never folded, and a burst's newer fact joins the same fold key", () => {
  const failed = [1, 2, 3].map((n) => eventItem({ event_id: `f${n}`, lane: "text", kind: "text.failed", occurred_at: at(n) }));
  assert.deepEqual(buildFeed({ events: failed }).map((item) => item.type), ["spotlight", "spotlight", "spotlight"]);
  const before = foldBursts(
    buildFeed({ events: [text("a", 31), text("b", 32), text("c", 33)] }).flatMap((item) =>
      item.type === "fold" ? item.rows : item.type === "row" ? [item] : [],
    ),
  );
  const after = buildFeed({ events: [text("a", 31), text("b", 32), text("c", 33), text("d", 33, 30)] });
  assert.equal((before[0] as FeedFold).key, (after[0] as FeedFold).key);
});

test("a milestone is pinned for 30 minutes, then settles in time order", () => {
  const goal = eventItem({
    event_id: "goal",
    lane: "outreach",
    kind: "outreach.rep_goal_met",
    occurred_at: at(0),
    card: { agent_id: "a1", agent_name: "Jamie Park", actual: 100, goal: 100, rank: 2 } as never,
  });
  const newer = [eventItem({ event_id: "book", lane: "booking", kind: "booking.created", occurred_at: at(20) })];
  const nowInside = Date.parse(at(25));
  const pinned = buildFeed({ events: [goal, ...newer], nowMs: nowInside });
  assert.deepEqual(ids(pinned), ["goal", "book"]);
  assert.equal(pinned[0]?.type, "milestone");
  assert.equal((pinned[0] as { pinned: boolean }).pinned, true);
  const settled = buildFeed({ events: [goal, ...newer], nowMs: Date.parse(at(0)) + 31 * 60_000 });
  assert.deepEqual(ids(settled), ["book", "goal"]);
  assert.equal((settled[1] as { pinned: boolean }).pinned, false);
  // No browser clock (the server render): nothing pinned, no hydration mismatch.
  assert.equal((buildFeed({ events: [goal] })[0] as { pinned: boolean }).pinned, false);
  assert.equal(isMilestonePinned(goal, undefined), false);
  assert.equal(isMilestonePinned(goal, nowInside), true);
  assert.equal(isMilestonePinned(newer[0]!, nowInside), false);
  // Needs you keeps the milestone.
  assert.deepEqual(ids(buildFeed({ events: [goal, ...newer], filter: "needs", nowMs: nowInside })), ["goal", "book"]);
});

test("rows say who, what, source and route; unknown pieces are left out", () => {
  const full = eventItem({
    event_id: "r",
    lane: "lead",
    kind: "form_lead.created",
    card: { customer_name: "Maria G.", move: { pickup_state: "NJ", delivery_state: "FL" } },
  });
  assert.deepEqual(rowSegments(full), ["Maria G.", "Form Lead created", "Top 10 Forms", "NJ → FL"]);
  const bare = eventItem({ event_id: "r2", lane: "granot", kind: "granot.lead_created", job_no: "5563723", source_company: null });
  assert.deepEqual(rowSegments(bare), ["Job 5563723", "Granot lead created"]);
  const unknownState = eventItem({ event_id: "r3", lane: "lead", kind: "form_lead.created", source_company: null, card: { move: { pickup_state: "NJ", delivery_state: "not_found" } } });
  assert.deepEqual(rowSegments(unknownState), ["Form Lead created"]);
});

test("a Spotlight carries at most two links, action then record", () => {
  const event = eventItem({
    event_id: "x",
    lane: "exception",
    kind: "exception.dead_letter",
    job_no: "55",
    links: { lead_id: "L1", lead_model: "FormLead", booking_id: "B1" },
  });
  const links = spotlightLinks({ type: "spotlight", key: "x", event, absorbed: [] });
  assert.equal(links.length, 2);
  assert.equal(links[0]?.label, DAILY_COPY.openGranotLifecycleHealth);
  const zip = eventItem({ event_id: "z", lane: "exception", kind: "exception.zip_missing" });
  const zipLinks = spotlightLinks({ type: "spotlight", key: "z", event: zip, absorbed: [] });
  assert.equal(zipLinks[0]?.label, DAILY_COPY.feed.openException);
  assert.match(zipLinks[0]?.href ?? "", /view=lanes&lane=exception/);
  const noLinks = eventItem({ event_id: "n", lane: "text", kind: "text.failed" });
  assert.equal(spotlightLinks({ type: "spotlight", key: "n", event: noLinks, absorbed: [] }).length, 0);
});

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

test("LiveFeed: chips, the empty line, and no Confirm control", () => {
  const empty = render(createElement(LiveFeed, { events: [], onOpenFact: () => undefined }));
  assert.match(empty, /data-band="feed"/);
  assert.match(empty, /data-daily-feed/);
  assert.match(empty, new RegExp(`>${DAILY_COPY.feed.needsYou}<`));
  assert.match(empty, new RegExp(`>${DAILY_COPY.feed.everything}<`));
  for (const lane of ["Leads", "Texts", "Granot", "Intakes", "Bookings", "Cancellations", "Exceptions"]) {
    assert.match(empty, new RegExp(lane));
  }
  assert.doesNotMatch(empty, /Sheet Sync/);
  assert.match(empty, new RegExp(DAILY_COPY.feed.empty));
  assert.doesNotMatch(empty, /data-event-list/);
  assert.equal(dailyOperationsHasConfirmControl(empty), false);
});

test("LiveFeed: a Spotlight card, a row and a fold render in one list; cards carry no detail grid", () => {
  const events = [
    eventItem({
      event_id: "booked",
      lane: "granot",
      kind: "granot.booked",
      job_no: "5562365",
      occurred_at: at(41),
      card: { customer_name: "Steve D.", move: { pickup_zip: "08540", delivery_zip: "33101" } },
    }),
    eventItem({ event_id: "lead", lane: "lead", kind: "form_lead.created", occurred_at: at(38), card: { customer_name: "Maria G." } }),
    text("t1", 31),
    text("t2", 32),
    text("t3", 33),
  ];
  const markup = render(createElement(LiveFeed, { events, onOpenFact: () => undefined }));
  assert.match(markup, /data-feed-card="spotlight"/);
  assert.match(markup, /Granot Booked · Steve D\./);
  assert.match(markup, /data-feed-row="row"[^>]*data-event-id="lead"|data-event-id="lead"[^>]*data-feed-row="row"/);
  assert.match(markup, /data-feed-row="fold"[^>]*data-fold-count="3"/);
  assert.match(markup, /3 texts sent/);
  assert.match(markup, /data-tone="gold"/);
  assert.match(markup, /Job 5562365/);
  assert.doesNotMatch(markup, /<dl/);
  assert.doesNotMatch(markup, /ZIP/);
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
});

test("LiveFeed: a settled milestone is a starred row; a tier override changes what shows", () => {
  const goal = eventItem({ event_id: "goal", lane: "outreach", kind: "outreach.rep_goal_met", occurred_at: at(0), card: { agent_name: "Jamie Park" } as never });
  const markup = render(createElement(LiveFeed, { events: [goal], onOpenFact: () => undefined }));
  assert.match(markup, /data-feed-row="row"/);
  assert.match(markup, /Jamie Park hit today&#x27;s call goal/);
  assert.match(markup, /★/);
  const demoted = render(
    createElement(KindTiersProvider, { overrides: { "outreach.rep_goal_met": "C" } }, createElement(LiveFeed, { events: [goal], onOpenFact: () => undefined })),
  );
  assert.doesNotMatch(demoted, /data-event-id="goal"/);
});

test("SpotlightCard: icon circle, one title line, one meta line, at most two link buttons", () => {
  const event = eventItem({
    event_id: "c1",
    lane: "cancellation",
    kind: "cancellation.created",
    job_no: "5561111",
    card: { customer_name: "Pat Q." },
    links: { cancellation_id: "c-1", lead_id: "l-1", lead_model: "FormLead" },
  });
  const markup = render(createElement(SpotlightCard, { item: { type: "spotlight", key: "c1", event, absorbed: [] }, onOpen: () => undefined }));
  assert.match(markup, /crm-badge/);
  assert.equal((markup.match(/<a /g) ?? []).length, 2);
  assert.match(markup, /Cancellation written · Pat Q\./);
  assert.match(markup, /Copy job # 5561111/);
  assert.doesNotMatch(markup, /crm-badge--gold/);
});

test("SpotlightCard: a Booking is the gold moment", () => {
  const event = eventItem({ event_id: "b1", lane: "booking", kind: "booking.created", links: { booking_id: "b-1" } });
  const markup = render(createElement(SpotlightCard, { item: { type: "spotlight", key: "b1", event, absorbed: [] }, onOpen: () => undefined }));
  assert.match(markup, /crm-badge--gold/);
  assert.match(markup, /data-tone="gold"/);
});

test("FoldRow starts closed and lists nothing until opened; its label and span read in words", () => {
  const items = buildFeed({ events: [text("t1", 31), text("t2", 32), text("t3", 33)] });
  const fold = items[0] as FeedFold;
  const markup = render(createElement(FoldRow, { fold, highlightedIds: new Set<string>(), onOpen: () => undefined }));
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /3 texts sent/);
  assert.doesNotMatch(markup, /dboard-fold__children/);
});

const lanesFixture = ["lead", "text", "granot", "intake", "booking", "cancellation", "exception"] as const;

test("LaneTiles: seven tiles with count, newest fact and Open", () => {
  const snapshot: DailyOperationsSnapshot = {
    ...emptySnapshot,
    metrics: {
      ...emptySnapshot.metrics,
      leads: { today: 41, yesterday: 50, yesterday_by_now: 36, form: 29, call: 12, duplicate_form: 0, duplicate_call: 0 },
      texts: { ...emptySnapshot.metrics.texts, today: 38, failed: 2 },
    },
    hourly: {
      today: [{ hour: 14, leads: 9, bookings: 0, cancellations: 0, webhooks: 0, messages: 4 }],
      yesterday: [],
    },
  };
  const events = [
    eventItem({ event_id: "l", lane: "lead", kind: "form_lead.created", occurred_at: at(38), card: { customer_name: "Maria G." } }),
    eventItem({ event_id: "dup", lane: "lead", kind: "form_lead.duplicate", occurred_at: at(50) }),
  ];
  const markup = render(
    createElement(LaneTiles, { lanes: lanesFixture, events, snapshot, nowHour: 14, onOpenLane: () => undefined }),
  );
  assert.equal((markup.match(/data-lane-tile="/g) ?? []).length, 7);
  assert.match(markup, /data-lane-tile="exception"/);
  assert.match(markup, /Maria G\./, "the newest fact skips counted bookkeeping");
  assert.doesNotMatch(markup, /Duplicate Form Lead/);
  assert.match(markup, /\+14%/);
  assert.match(markup, /2 failed/);
  assert.match(markup, /Nothing yet today/);
  assert.equal((markup.match(/data-lane-spark/g) ?? []).length, 7);
  assert.equal((markup.match(/Open ›/g) ?? []).length, 7);
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
});

test("LaneTiles: a Spotlight fact flashes its tile; a row fact does not", () => {
  const events = [
    eventItem({ event_id: "c", lane: "cancellation", kind: "cancellation.created" }),
    eventItem({ event_id: "l", lane: "lead", kind: "form_lead.created" }),
  ];
  const markup = render(
    createElement(LaneTiles, {
      lanes: lanesFixture,
      events,
      snapshot: emptySnapshot,
      highlights: { highlightedIds: new Set(["c", "l"]), justNowIds: new Set<string>() },
      onOpenLane: () => undefined,
    }),
  );
  assert.match(markup, /data-lane-tile="cancellation"[^>]*data-flash="true"/);
  assert.doesNotMatch(markup, /data-lane-tile="lead"[^>]*data-flash="true"/);
});

test("newestLaneFact prefers the newest non-bookkeeping fact and falls back to any", () => {
  const events = [
    eventItem({ event_id: "old", lane: "lead", kind: "form_lead.created", occurred_at: at(1) }),
    eventItem({ event_id: "dup", lane: "lead", kind: "form_lead.duplicate", occurred_at: at(2) }),
  ];
  assert.equal(newestLaneFact(events, "lead")?.event_id, "old");
  assert.equal(newestLaneFact([events[1]!], "lead")?.event_id, "dup");
  assert.equal(newestLaneFact(events, "text"), null);
});

test("laneSparkBuckets: twelve Florida hours ending now, hourly where it exists, Events where it does not", () => {
  const snapshot: DailyOperationsSnapshot = {
    ...emptySnapshot,
    hourly: {
      today: [
        { hour: 14, leads: 9, bookings: 1, cancellations: 0, webhooks: 3, messages: 4 },
        { hour: 2, leads: 2, bookings: 0, cancellations: 0, webhooks: 0, messages: 0 },
        { hour: 9, leads: 5, bookings: 0, cancellations: 0, webhooks: 0, messages: 0 },
      ],
      yesterday: [],
    },
  };
  const leads = laneSparkBuckets({ snapshot, events: [], lane: "lead", nowHour: 14 });
  assert.equal(leads.length, LANE_SPARK_BUCKETS);
  assert.equal(leads[11], 9);
  assert.equal(leads[11 - 5], 5);
  assert.equal(leads.reduce((a, b) => a + b, 0), 14, "hour 2 is outside the window");
  const early = laneSparkBuckets({ snapshot, events: [], lane: "lead", nowHour: 2 });
  assert.equal(early.length, 12);
  assert.equal(early.slice(0, 9).every((value) => value === 0), true, "hours before midnight are zero");
  const events = [
    eventItem({ event_id: "e1", lane: "exception", kind: "exception.zip_missing", occurred_at: "2026-10-05T18:10:00.000Z" }),
    eventItem({ event_id: "e2", lane: "exception", kind: "exception.crm_failed", occurred_at: "2026-10-05T18:50:00.000Z" }),
  ];
  const exception = laneSparkBuckets({ snapshot, events, lane: "exception", nowHour: 14 });
  assert.equal(exception[11], 2, "18:xx UTC is 14:xx in New York in October");
});

test("FactDrawer shows what the old card showed: details, chips and every link", () => {
  const event = eventItem({
    event_id: "z",
    lane: "exception",
    kind: "exception.zip_missing",
    job_no: "5561111",
    links: { lead_id: "l-1", lead_model: "FormLead" },
    card: {
      customer_name: "Maria G.",
      zip_miss: { pickup: true, delivery: false },
      move: { pickup_zip: "33101", pickup_state: "not_found", delivery_zip: "30301", delivery_state: "GA" },
    },
  });
  const markup = render(createElement(FactDrawer, { events: [event], onClose: () => undefined }));
  assert.match(markup, /crm-drawer/);
  assert.match(markup, /data-fact-drawer/);
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /<dl/);
  assert.match(markup, /33101 · state not found/);
  assert.match(markup, /Open lead/);
  assert.match(markup, /Open list/);
  assert.match(markup, /Open Job Timeline/);
});

test("milestones: read defensively, say the numbers, link to the Desk", () => {
  const rep = eventItem({
    event_id: "g1",
    lane: "outreach",
    kind: "outreach.rep_goal_met",
    occurred_at: at(41),
    card: { agent_id: "a 1", agent_name: "Jamie Park", actual: 100, goal: "100", reached_at: at(40), rank: 2 } as never,
  });
  const fact = readMilestone(rep)!;
  assert.equal(fact.scope, "rep");
  assert.equal(fact.actual, 100);
  assert.equal(fact.goal, 100);
  assert.equal(fact.reachedAt, at(40));
  assert.equal(milestoneHeadline(fact), "Jamie Park hit today's call goal");
  assert.equal(milestoneProgressText(fact), "100 / 100 calls");
  assert.equal(milestoneRankLine(fact), "2nd rep at goal today");
  assert.equal(milestoneProgress(fact), 1);
  assert.deepEqual(milestoneLinks(fact), [
    { label: "View queue", href: "/outreach-desk?view=my&agent=a%201" },
    { label: "Team", href: "/outreach-desk?view=team" },
  ]);
  const team = readMilestone(
    eventItem({
      event_id: "g2",
      lane: "outreach",
      kind: "outreach.team_goal_met",
      card: { team_actual: 400, team_goal: 400, reps_at_goal: 3, reps_on_roster: 4 } as never,
    }),
  )!;
  assert.equal(team.scope, "team");
  assert.equal(milestoneHeadline(team), "Team goal reached");
  assert.equal(milestoneProgressText(team), "400 / 400 outbound calls");
  assert.deepEqual(milestoneLinks(team), [{ label: "Team", href: "/outreach-desk?view=team" }]);
  // Nothing on the payload: still a card, no numbers, no crash, the fact's own time.
  const bare = readMilestone(eventItem({ event_id: "g3", lane: "outreach", kind: "outreach.rep_goal_met", occurred_at: at(5) }))!;
  assert.equal(bare.reachedAt, at(5));
  assert.equal(milestoneProgressText(bare), null);
  assert.equal(milestoneRankLine(bare), null);
  assert.equal(milestoneProgress(bare), 1);
  assert.deepEqual(milestoneLinks(bare), [{ label: "Team", href: "/outreach-desk?view=team" }]);
  assert.equal(readMilestone(eventItem({ event_id: "x", lane: "lead", kind: "form_lead.created" })), null);
  // The server may send its own rank words.
  const worded = readMilestone(eventItem({ event_id: "g4", lane: "outreach", kind: "outreach.rep_goal_met", card: { rank: "First at goal today" } as never }))!;
  assert.equal(milestoneRankLine(worded), "First at goal today");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
});

test("repGoalReachedAtById keeps the newest reached time per rep and ignores other kinds", () => {
  const marks = repGoalReachedAtById([
    eventItem({ event_id: "g1", lane: "outreach", kind: "outreach.rep_goal_met", card: { agent_id: "a1", reached_at: at(10) } as never }),
    eventItem({ event_id: "g2", lane: "outreach", kind: "outreach.rep_goal_met", card: { agent_id: "a1", reached_at: at(30) } as never }),
    eventItem({ event_id: "g3", lane: "outreach", kind: "outreach.team_goal_met", card: { agent_id: "a2", reached_at: at(31) } as never }),
    eventItem({ event_id: "g4", lane: "outreach", kind: "outreach.rep_goal_met" }),
  ]);
  assert.deepEqual([...marks.entries()], [["a1", at(30)]]);
});

test("MilestoneCard: gold, avatar, a full green track, the rank and the two Desk links", () => {
  const event = eventItem({
    event_id: "g1",
    lane: "outreach",
    kind: "outreach.rep_goal_met",
    card: { agent_id: "a1", agent_name: "Jamie Park", actual: 100, goal: 100, rank: 2 } as never,
  });
  const markup = render(createElement(MilestoneCard, { event, onOpen: () => undefined }));
  assert.match(markup, /data-feed-card="milestone"/);
  assert.match(markup, /data-tone="gold"/);
  assert.match(markup, /crm-avatar/);
  assert.match(markup, /crm-track__fill--done/);
  assert.match(markup, /aria-valuenow="100"/);
  assert.match(markup, /100 \/ 100 calls/);
  assert.match(markup, /2nd rep at goal today/);
  assert.match(markup, /href="\/outreach-desk\?view=my&amp;agent=a1"[^>]*>View queue</);
  assert.match(markup, /href="\/outreach-desk\?view=team"[^>]*>Team</);
  assert.equal(render(createElement(MilestoneCard, { event: eventItem({ event_id: "n", lane: "lead", kind: "form_lead.created" }), onOpen: () => undefined })), "");
});

test("the milestone toast reads only milestone events off the stream and renders without confetti", () => {
  const payload = JSON.stringify({
    event_id: "g1",
    kind: "outreach.rep_goal_met",
    occurred_at: at(41),
    card: { agent_id: "a1", agent_name: "Jamie Park", actual: 100, goal: 100 },
  });
  const fact = milestoneFromSsePayload(payload)!;
  assert.equal(fact.eventId, "g1");
  assert.equal(fact.agentName, "Jamie Park");
  assert.equal(milestoneFromSsePayload(JSON.stringify({ event_id: "x", kind: "form_lead.created" })), null);
  assert.equal(milestoneFromSsePayload(JSON.stringify({ kind: "outreach.rep_goal_met" })), null, "no id, no toast");
  assert.equal(milestoneFromSsePayload("not json"), null);
  assert.equal(milestoneFromSsePayload("null"), null);
  const markup = render(createElement(MilestoneToast, { fact, onDismiss: () => undefined }));
  assert.match(markup, /data-milestone-toast="g1"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /Jamie Park hit today&#x27;s call goal/);
  assert.match(markup, /dboard-burst/);
  assert.match(markup, /View queue/);
  assert.match(markup, /@media \(prefers-reduced-motion: no-preference\)/, "every animation sits behind no-preference");
  assert.doesNotMatch(markup, /confetti/i);
});
