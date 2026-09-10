import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DAILY_COPY,
  DAILY_QUIET_PRIORITIES_STORAGE_KEY,
  dailyOperationsHeldTextTitle,
  dailyOperationsTextsHeader,
  dailyOperationsZipChip,
  formatDailyOperationsRelative,
} from "../../components/daily/daily-copy";
import { CategoryPanels } from "../../components/daily/category-panels";
import { DailyOperationsEventCard } from "../../components/daily/event-card";
import { compareDailyOperationsEventsNewestFirst, EMPTY_DAILY_OPERATIONS_SESSION_DELTAS } from "./dailyOperationsLive";
import type { DailyOperationsEventItem } from "./dailyOperationsLive";
import type { DailyOperationsSnapshot } from "./dailyOperations";
import {
  applyQuietPriorities,
  countRecentDailyOperationsEvents,
  DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS,
  DAILY_OPERATIONS_ARRIVALS_LIMIT,
  DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT,
  DAILY_OPERATIONS_PANEL_FOCUSED_LIMIT,
  dailyOperationsAttentionChips,
  dailyOperationsCardDetails,
  dailyOperationsEventLinks,
  dailyOperationsEventTitle,
  dailyOperationsHasConfirmControl,
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  earlierDailyOperationsCursor,
  eventsForDailyOperationsArrivals,
  eventsForDailyOperationsPanel,
  newlyArrivedDailyOperationsEventIds,
  scheduleArrivalHighlightClear,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
  fanOutDailyOperationsEvents,
  filterDailyOperationsEventsByCompany,
  lanesNeedingBackfill,
  leadDeskHref,
  newestDailyOperationsEventAt,
  pairGranotEvents,
  panelVisibleLimit,
  panelsForDailyOperationsView,
  readPreferenceFlag,
  resolveDailyOperationsOpenHref,
  visibleDailyOperationsPanels,
  writePreferenceFlag,
  zipMissChips,
} from "./dailyOperationsBoard";

function eventItem(
  overrides: Partial<DailyOperationsEventItem> & Pick<DailyOperationsEventItem, "event_id" | "lane" | "kind">,
): DailyOperationsEventItem {
  return {
    day: "2026-09-08",
    occurred_at: "2026-09-08T18:14:00.000Z",
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

function snapshotFixture(): DailyOperationsSnapshot {
  return {
    timezone: "America/New_York",
    today: "2026-09-08",
    yesterday: "2026-09-07",
    generated_at: "2026-09-08T18:14:00.000Z",
    redis: { configured: false, mode: "stream" },
    metrics: {
      leads: {
        today: 42,
        yesterday: 38,
        yesterday_by_now: 31,
        form: 28,
        call: 14,
        duplicate_form: 3,
        duplicate_call: 1,
      },
      bookings: { today: 6, yesterday: 5, yesterday_by_now: 4 },
      cancellations: { today: 1, yesterday: 0, yesterday_by_now: 0 },
      texts: {
        today: 19,
        yesterday: 22,
        yesterday_by_now: 18,
        deferred: 4,
        held_now: 3,
        skipped: 4,
        failed: 1,
      },
      webhooks: {
        lead_created: { today: 55, yesterday: 49 },
        priority_updated: { today: 120, yesterday: 101 },
        booking_status_changed: { today: 8, yesterday: 7 },
        booked: { today: 5, yesterday: 4 },
        release: { today: 3, yesterday: 3 },
      },
      intakes: { opened_today: 3, still_open: 2 },
      exceptions: { zip_missing: 2, crm_failed: 0, dead_letter: 0, adoption_conflict: 0 },
      sheet_sync: { completed: 4, failed: 1 },
    },
    origins: {
      granot_lead_created: 20,
      ringcentral: 14,
      wordpress_form: 0,
      best_relocation_sheet: 6,
      vantage_admin: 2,
    },
    companies: [],
    hourly: { today: [], yesterday: [] },
  };
}

test("fan-out by lane keeps a Cancellation visible when Granot is flooded", () => {
  const events = [
    ...Array.from({ length: 12 }, (_, index) =>
      eventItem({
        event_id: `p${index}`,
        lane: "granot",
        kind: "granot.priority_updated",
        occurred_at: `2026-09-08T18:${String(index).padStart(2, "0")}:00.000Z`,
      }),
    ),
    eventItem({
      event_id: "c1",
      lane: "cancellation",
      kind: "cancellation.created",
      title: "Cancellation written",
      occurred_at: "2026-09-08T17:00:00.000Z",
    }),
  ];
  const byLane = fanOutDailyOperationsEvents(events);
  assert.equal(byLane.cancellation.length, 1);
  assert.equal(byLane.cancellation[0]?.event_id, "c1");
  assert.equal(byLane.granot.length, 12);
  const panels = renderToStaticMarkup(
    createElement(CategoryPanels, {
      events,
      snapshot: snapshotFixture(),
      sessionDeltas: EMPTY_DAILY_OPERATIONS_SESSION_DELTAS,
      lane: null,
      company: null,
      quietPriorities: false,
      sheetSyncOptIn: false,
      onSelectLane: () => undefined,
      onToggleQuietPriorities: () => undefined,
      onToggleSheetSync: () => undefined,
    }),
  );
  assert.match(panels, /Cancellation written/);
  assert.match(panels, /data-panel-scroll/);
  assert.match(panels, /data-panel="lead"/);
  assert.match(panels, /data-panel="text"/);
  assert.match(panels, /data-panel="exception"/);
  assert.doesNotMatch(panels, /data-panel="sheet_sync"/);
  assert.equal(dailyOperationsHasConfirmControl(panels), false);
});

test("Quiet priorities hides priority cards only; Granot counts stay the same", () => {
  const events = [
    eventItem({ event_id: "g1", lane: "granot", kind: "granot.lead_created" }),
    eventItem({ event_id: "g2", lane: "granot", kind: "granot.priority_updated" }),
    eventItem({ event_id: "g3", lane: "granot", kind: "granot.minted", parent_receipt_id: "r1" }),
  ];
  const quiet = applyQuietPriorities(events, true);
  assert.deepEqual(
    quiet.map((row) => row.kind),
    ["granot.lead_created", "granot.minted"],
  );
  const snapshot = snapshotFixture();
  assert.equal(dailyOperationsPanelCount(snapshot, "granot"), 183);
  const visible = eventsForDailyOperationsPanel({
    events,
    lane: "granot",
    quietPriorities: true,
  });
  assert.equal(
    visible.some((row) => row.kind === "granot.priority_updated"),
    false,
  );
  assert.equal(visible.some((row) => row.kind === "granot.lead_created"), true);
});

test("company filter keeps only that Source Company and uses filtered empty copy", () => {
  const events = [
    eventItem({ event_id: "a", lane: "lead", kind: "form_lead.created", source_company: "top10_leads" }),
    eventItem({ event_id: "b", lane: "lead", kind: "form_lead.created", source_company: "tbm_leads" }),
  ];
  const filtered = filterDailyOperationsEventsByCompany(events, "top10_leads");
  assert.deepEqual(
    filtered.map((row) => row.event_id),
    ["a"],
  );
  assert.equal(
    dailyOperationsPanelEmptyCopy({ lane: "lead", company: "top10_leads" }),
    "No Leads for Top 10 Forms today.",
  );
  assert.equal(dailyOperationsPanelEmptyCopy({ lane: "exception" }), DAILY_COPY.exceptionsEmpty);
  assert.equal(dailyOperationsPanelEmptyCopy({ lane: "text" }), DAILY_COPY.panelsEmpty);
  assert.equal(dailyOperationsPanelEmptyCopy({ lane: "exception", todayCount: 1 }), DAILY_COPY.countWithoutCards);
  assert.equal(dailyOperationsPanelEmptyCopy({ lane: "cancellation", todayCount: 1 }), DAILY_COPY.countWithoutCards);
});

test("held text card title formats send_at and does not hardcode 8:00 AM", () => {
  const sendAt = "2026-09-08T17:45:00.000Z";
  const event = eventItem({
    event_id: "t1",
    lane: "text",
    kind: "text.deferred",
    card: { text: { status: "accepted", deferred: true, send_at: sendAt } },
    links: { lead_id: "lead1", lead_model: "FormLead" },
  });
  const title = dailyOperationsEventTitle(event);
  assert.equal(title, dailyOperationsHeldTextTitle(sendAt));
  assert.match(title, /Text held until/);
  assert.doesNotMatch(title, /8:00 AM/);
  const markup = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event }));
  assert.match(markup, /Text held until/);
  assert.match(markup, /form-leads\?record=lead1/);
  assert.match(markup, /panel=message/);
  const header = dailyOperationsTextsHeader({ sent: 19, heldNow: 3, failed: 1 });
  assert.equal(header, "19 sent · 3 held until 8:00 AM · 1 failed");
});

test("zip-miss chip stays on the Lead card and the Lead stays in the Leads panel", () => {
  const lead = eventItem({
    event_id: "l1",
    lane: "lead",
    kind: "form_lead.created",
    links: { lead_id: "lead1", lead_model: "FormLead" },
    card: {
      customer_name: "Maria Chen",
      phone_last4: "4192",
      zip_miss: { pickup: true, delivery: false },
      move: { pickup_zip: "33101", pickup_state: "not_found" },
    },
  });
  const exception = eventItem({
    event_id: "e1",
    lane: "exception",
    kind: "exception.zip_missing",
    links: { lead_id: "lead1", lead_model: "FormLead" },
    card: {
      zip_miss: { pickup: true, delivery: false },
      move: { pickup_zip: "33101" },
    },
  });
  assert.deepEqual(zipMissChips(lead), [dailyOperationsZipChip("33101")]);
  const leads = eventsForDailyOperationsPanel({ events: [lead, exception], lane: "lead" });
  assert.equal(leads.some((row) => row.event_id === "l1"), true);
  const leadCard = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event: lead }));
  assert.match(leadCard, /ZIP 33101 · state not found/);
  assert.match(leadCard, /••4192/);
  assert.match(leadCard, /form-leads\?record=lead1/);
  const exceptionCard = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event: exception }));
  assert.match(exceptionCard, /ZIP did not produce a state/);
  const exceptionPanel = eventsForDailyOperationsPanel({ events: [lead, exception], lane: "exception" });
  assert.deepEqual(
    exceptionPanel.map((row) => row.event_id),
    ["e1"],
  );
});

test("Exceptions panel shows a zip-miss Lead when the Exception fact is not in memory", () => {
  const lead = eventItem({
    event_id: "l1",
    lane: "lead",
    kind: "form_lead.created",
    links: { lead_id: "lead1", lead_model: "FormLead" },
    card: {
      customer_name: "Maria Chen",
      zip_miss: { pickup: true, delivery: false },
      move: { pickup_zip: "33101", pickup_state: "not_found" },
    },
  });
  const uncovered = eventsForDailyOperationsPanel({ events: [lead], lane: "exception" });
  assert.equal(uncovered.length, 1);
  assert.equal(uncovered[0]?.event_id, "l1");
  const otherLead = eventItem({
    event_id: "l2",
    lane: "lead",
    kind: "form_lead.created",
    links: { lead_id: "lead2", lead_model: "FormLead" },
  });
  assert.equal(eventsForDailyOperationsPanel({ events: [otherLead], lane: "exception" }).length, 0);
  const snapshot = snapshotFixture();
  const markup = renderToStaticMarkup(
    createElement(CategoryPanels, {
      events: [lead],
      snapshot,
      sessionDeltas: EMPTY_DAILY_OPERATIONS_SESSION_DELTAS,
      lane: "exception",
      company: null,
      quietPriorities: false,
      sheetSyncOptIn: false,
      onSelectLane: () => undefined,
    }),
  );
  assert.match(markup, /data-panel="exception"/);
  assert.match(markup, /Maria Chen/);
  assert.match(markup, /data-panel-scroll/);
  assert.doesNotMatch(markup, new RegExp(DAILY_COPY.exceptionsEmpty));
  assert.doesNotMatch(markup, new RegExp(DAILY_COPY.countWithoutCards));
});

test("card links use existing desks and never open Confirm on /daily", () => {
  const booked = eventItem({
    event_id: "g-book",
    lane: "granot",
    kind: "granot.booked",
    job_no: "5562924",
    links: { receipt_id: "r1", intake_case_id: "case1" },
  });
  const hrefs = dailyOperationsEventLinks(booked);
  assert.equal(
    hrefs.some((link) => link.href === "/live-events" && link.label === DAILY_COPY.openInLiveEvents),
    true,
  );
  assert.equal(
    hrefs.some((link) => link.href === "/intakes?case=case1"),
    true,
  );
  assert.equal(
    hrefs.some((link) => link.href === "/job-timeline?job=5562924"),
    true,
  );
  assert.equal(leadDeskHref({ leadId: "abc", leadModel: "CallLead" }), "/call-leads?record=abc");
  assert.equal(
    leadDeskHref({ leadId: "dup", leadModel: "FormLead", duplicate: true }),
    "/duplicate-form-leads?record=dup",
  );
  assert.equal(resolveDailyOperationsOpenHref("lead:abc"), "/form-leads?record=abc");
  const markup = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event: booked }));
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
  assert.doesNotMatch(markup, /Confirm Granot/);
});

test("Granot pairing shows the receipt before minted or linked or observed", () => {
  const minted = eventItem({
    event_id: "m1",
    lane: "granot",
    kind: "granot.minted",
    parent_receipt_id: "r1",
    occurred_at: "2026-09-08T18:16:00.000Z",
  });
  const receipt = eventItem({
    event_id: "r-event",
    lane: "granot",
    kind: "granot.lead_created",
    occurred_at: "2026-09-08T18:15:00.000Z",
    links: { receipt_id: "r1" },
  });
  const paired = pairGranotEvents([minted, receipt]);
  assert.deepEqual(
    paired.map((row) => row.kind),
    ["granot.lead_created", "granot.minted"],
  );
  // A pending match on the same receipt is receipt-shaped too; the outcome
  // hangs under the receipt once, never twice (duplicate React keys).
  const pending = eventItem({
    event_id: "p1",
    lane: "granot",
    kind: "granot.pending_match",
    occurred_at: "2026-09-08T18:15:30.000Z",
    links: { receipt_id: "r1" },
  });
  const withPending = pairGranotEvents([minted, pending, receipt]);
  assert.deepEqual(
    withPending.map((row) => row.event_id),
    ["p1", "m1", "r-event"],
  );
  assert.equal(new Set(withPending.map((row) => row.event_id)).size, withPending.length);
});

test("Sheet Sync stays hidden until opt-in or lane=sheet_sync", () => {
  assert.deepEqual(visibleDailyOperationsPanels({ lane: null, sheetSyncOptIn: false }), [
    "lead",
    "text",
    "granot",
    "intake",
    "booking",
    "cancellation",
    "exception",
  ]);
  assert.equal(
    visibleDailyOperationsPanels({ lane: "sheet_sync", sheetSyncOptIn: false }).includes("sheet_sync"),
    true,
  );
  const storage: Storage = {
    length: 0,
    clear() {},
    key() {
      return null;
    },
    getItem() {
      return "1";
    },
    setItem() {},
    removeItem() {},
  };
  assert.equal(readPreferenceFlag(storage, DAILY_QUIET_PRIORITIES_STORAGE_KEY), true);
  const memory = new Map<string, string>();
  writePreferenceFlag(
    {
      setItem(key, value) {
        memory.set(key, value);
      },
      removeItem(key) {
        memory.delete(key);
      },
    },
    DAILY_QUIET_PRIORITIES_STORAGE_KEY,
    true,
  );
  assert.equal(memory.get(DAILY_QUIET_PRIORITIES_STORAGE_KEY), "1");
});

test("Arrivals newest-20 is cross-lane so a Cancellation survives a Granot flood", () => {
  const granot = Array.from({ length: 25 }, (_, index) =>
    eventItem({
      event_id: `g${index}`,
      lane: "granot",
      kind: "granot.lead_created",
      occurred_at: `2026-09-08T18:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );
  const cancellation = eventItem({
    event_id: "c-arrivals",
    lane: "cancellation",
    kind: "cancellation.created",
    title: "Cancellation written",
    occurred_at: "2026-09-08T18:10:30.000Z",
  });
  const events = [...granot, cancellation];
  const arrivals = eventsForDailyOperationsArrivals({ events });
  assert.equal(DAILY_OPERATIONS_ARRIVALS_LIMIT, 20);
  assert.equal(arrivals.length, 20);
  assert.equal(
    arrivals.some((row) => row.event_id === "c-arrivals"),
    true,
  );
  const naiveGranotOnly = events
    .filter((row) => row.lane === "granot")
    .sort(compareDailyOperationsEventsNewestFirst)
    .slice(0, 20);
  assert.equal(naiveGranotOnly.length, 20);
  assert.equal(
    naiveGranotOnly.some((row) => row.event_id === "c-arrivals"),
    false,
  );
});

test("Arrivals Quiet hides priority cards only and does not change panel counts", () => {
  const events = [
    eventItem({ event_id: "g1", lane: "granot", kind: "granot.lead_created" }),
    eventItem({ event_id: "g2", lane: "granot", kind: "granot.priority_updated" }),
    eventItem({ event_id: "c1", lane: "cancellation", kind: "cancellation.created" }),
  ];
  const arrivals = eventsForDailyOperationsArrivals({ events, quietPriorities: true });
  assert.deepEqual(
    arrivals.map((row) => row.kind),
    ["granot.lead_created", "cancellation.created"],
  );
  const snapshot = snapshotFixture();
  assert.equal(dailyOperationsPanelCount(snapshot, "granot"), 183);
  assert.equal(dailyOperationsPanelCount(snapshot, "cancellation"), 1);
});

test("Arrivals applies company and ignores a focused lane", () => {
  const events = [
    eventItem({
      event_id: "a",
      lane: "lead",
      kind: "form_lead.created",
      source_company: "top10_leads",
      occurred_at: "2026-09-08T18:14:00.000Z",
    }),
    eventItem({
      event_id: "b",
      lane: "cancellation",
      kind: "cancellation.created",
      source_company: "tbm_leads",
      occurred_at: "2026-09-08T18:13:00.000Z",
    }),
    eventItem({
      event_id: "c",
      lane: "lead",
      kind: "form_lead.created",
      source_company: "top10_leads",
      occurred_at: "2026-09-08T18:12:00.000Z",
    }),
  ];
  const companySlice = eventsForDailyOperationsArrivals({ events, company: "top10_leads" });
  assert.deepEqual(
    companySlice.map((row) => row.event_id),
    ["a", "c"],
  );
  const focusedSame = eventsForDailyOperationsArrivals({
    events,
    company: "top10_leads",
    lane: "lead",
  });
  assert.deepEqual(
    focusedSame.map((row) => row.event_id),
    companySlice.map((row) => row.event_id),
  );
  const focusedLead = eventsForDailyOperationsArrivals({ events, lane: "lead" });
  assert.deepEqual(
    focusedLead.map((row) => row.event_id),
    ["a", "b", "c"],
  );
});

test("newly arrived event_ids are those missing from the previous Arrivals slice", () => {
  assert.deepEqual(newlyArrivedDailyOperationsEventIds(["a", "b"], ["c", "a", "b"]), ["c"]);
  assert.deepEqual(newlyArrivedDailyOperationsEventIds([], ["a", "b"]), ["a", "b"]);
  assert.deepEqual(newlyArrivedDailyOperationsEventIds(["a", "b"], ["a", "b"]), []);
});

test("after seed, only a new raw event_id arrives", () => {
  const result = seedOrArriveDailyOperationsEventIds(new Set(["old"]), ["new", "old"], {
    hydrated: true,
    seeded: true,
  });
  assert.deepEqual(result.arrived, ["new"]);
  assert.equal(result.seen.has("old"), true);
  assert.equal(result.seen.has("new"), true);
  assert.equal(result.seeded, true);
});

test("empty then hydrate does not highlight the snapshot", () => {
  const waiting = seedOrArriveDailyOperationsEventIds(new Set(), [], {
    hydrated: false,
    seeded: false,
  });
  assert.deepEqual(waiting.arrived, []);
  assert.equal(waiting.seen.size, 0);
  assert.equal(waiting.seeded, false);

  const hydrated = seedOrArriveDailyOperationsEventIds(waiting.seen, ["a", "b"], {
    hydrated: true,
    seeded: false,
  });
  assert.deepEqual(hydrated.arrived, []);
  assert.equal(hydrated.seen.has("a"), true);
  assert.equal(hydrated.seen.has("b"), true);
  assert.equal(hydrated.seeded, true);
});

test("empty hydrated day then the first live fact arrives", () => {
  const ready = seedOrArriveDailyOperationsEventIds(new Set(), [], {
    hydrated: true,
    seeded: false,
  });
  assert.deepEqual(ready.arrived, []);
  assert.equal(ready.seeded, true);
  assert.equal(ready.seen.size, 0);

  const live = seedOrArriveDailyOperationsEventIds(ready.seen, ["new"], {
    hydrated: true,
    seeded: ready.seeded,
  });
  assert.deepEqual(live.arrived, ["new"]);
});

test("company or Quiet filter change is not an insert when raw board ids are unchanged", () => {
  const seen = new Set(["a", "b", "c"]);
  const filteredAway = ["a", "c"];
  const filteredBack = ["a", "b", "c"];
  assert.deepEqual(newlyArrivedDailyOperationsEventIds(["a", "b", "c"], filteredAway), []);
  assert.deepEqual(newlyArrivedDailyOperationsEventIds(filteredAway, filteredBack), ["b"]);
  const rawUnchanged = seedOrArriveDailyOperationsEventIds(seen, ["a", "b", "c"], {
    hydrated: true,
    seeded: true,
  });
  assert.deepEqual(rawUnchanged.arrived, []);
});

test("Arrivals insert highlight applies to a new event_id and clears after 1.5s", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const event = eventItem({
      event_id: "new-1",
      lane: "lead",
      kind: "form_lead.created",
      title: "Form Lead created",
    });
    const highlighted = renderToStaticMarkup(
      createElement(DailyOperationsEventCard, { event, highlight: true, justNow: true }),
    );
    const settled = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event }));
    assert.match(highlighted, /data-just-arrived="true"/);
    assert.match(highlighted, /daily-arrival-highlight/);
    assert.match(highlighted, /bg-amber-50/);
    assert.match(highlighted, /Just now/);
    assert.doesNotMatch(settled, /data-just-arrived/);
    assert.doesNotMatch(settled, /daily-arrival-highlight/);
    assert.doesNotMatch(settled, /Just now/);
    assert.equal(DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS, 1500);

    const arrived = newlyArrivedDailyOperationsEventIds(["old"], ["new-1", "old"]);
    assert.deepEqual(arrived, ["new-1"]);
    let cleared: readonly string[] = [];
    scheduleArrivalHighlightClear(arrived, (expired) => {
      cleared = expired;
    });
    assert.deepEqual(cleared, []);
    mock.timers.tick(1499);
    assert.deepEqual(cleared, []);
    mock.timers.tick(1);
    assert.deepEqual(cleared, ["new-1"]);
  } finally {
    mock.timers.reset();
  }
});

test("card details expose every stored fact with a label; nothing hides behind a click", () => {
  const event = eventItem({
    event_id: "full",
    lane: "granot",
    kind: "granot.booked",
    job_no: "5562924",
    entity_type: "GranotWebhookReceipt",
    ingestion_origin: "granot_lead_created",
    lead_kind: null,
    links: { receipt_id: "receipt-0123456789", lead_id: "lead1", lead_model: "CallLead" },
    card: {
      customer_name: "Maria Chen",
      phone_last4: "4192",
      move: {
        pickup_zip: "33101",
        pickup_state: "FL",
        delivery_zip: "10001",
        delivery_state: "NY",
        move_type: "long_distance",
      },
      granot: { route_event_class: "booking_status_changed", booking_action: "booked", decision: "attach_exact_job" },
      booking_kind: "exact_job",
    },
  });
  const details = dailyOperationsCardDetails(event);
  const byLabel = new Map(details.map((row) => [row.label, row.value]));
  assert.equal(byLabel.get(DAILY_COPY.factLabels.route), "33101 · FL → 10001 · NY");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.moveType), DAILY_COPY.factLabels.longDistance);
  assert.equal(byLabel.get(DAILY_COPY.factLabels.job), "5562924");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.granotClass), "booking status changed");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.granotAction), "Booked");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.granotDecision), "attach exact job");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.bookingKind), "exact job");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.receipt), "…456789");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.entity), "Granot Webhook Receipt");
  const markup = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event }));
  for (const row of details) {
    assert.ok(markup.includes(row.value), `card shows ${row.label}`);
  }
  assert.match(markup, /Maria Chen · ••4192/);
  assert.match(markup, /Granot lead created/);
  assert.match(markup, /data-tone="/);
  // `Open list` goes to the desk list, not the same record URL as `Open lead`.
  const links = dailyOperationsEventLinks(event);
  const openLead = links.find((link) => link.label === DAILY_COPY.openLead);
  const openList = links.find((link) => link.label === DAILY_COPY.openList);
  assert.equal(openLead?.href, "/call-leads?record=lead1");
  assert.equal(openList?.href, "/call-leads");
});

test("attention chips flag zip miss, held, skipped, failed, duplicate", () => {
  const held = eventItem({
    event_id: "h",
    lane: "text",
    kind: "text.deferred",
    card: { text: { deferred: true, send_at: "2026-09-08T17:45:00.000Z" } },
  });
  assert.deepEqual(
    dailyOperationsAttentionChips(held).map((chip) => chip.value),
    [DAILY_COPY.heldChip],
  );
  const failed = eventItem({ event_id: "f", lane: "text", kind: "text.failed" });
  assert.equal(dailyOperationsAttentionChips(failed)[0]?.tone, "alert");
  const dup = eventItem({ event_id: "d", lane: "lead", kind: "form_lead.duplicate" });
  assert.equal(dailyOperationsAttentionChips(dup).some((chip) => chip.value === "duplicate"), true);
  const zip = eventItem({
    event_id: "z",
    lane: "lead",
    kind: "form_lead.created",
    card: { zip_miss: { pickup: true, delivery: false }, move: { pickup_zip: "33101" } },
  });
  assert.deepEqual(
    dailyOperationsAttentionChips(zip).map((chip) => chip.value),
    [dailyOperationsZipChip("33101")],
  );
});

test("relative stamps read Just now, seconds, minutes, hours and never go negative", () => {
  const now = Date.parse("2026-09-08T18:14:00.000Z");
  assert.equal(formatDailyOperationsRelative("2026-09-08T18:13:55.000Z", now), DAILY_COPY.justNow);
  assert.equal(formatDailyOperationsRelative("2026-09-08T18:14:05.000Z", now), DAILY_COPY.justNow);
  assert.equal(formatDailyOperationsRelative("2026-09-08T18:13:30.000Z", now), "30s ago");
  assert.equal(formatDailyOperationsRelative("2026-09-08T18:02:00.000Z", now), "12m ago");
  assert.equal(formatDailyOperationsRelative("2026-09-08T15:14:00.000Z", now), "3h ago");
  const event = eventItem({ event_id: "rel", lane: "lead", kind: "form_lead.created" });
  const markup = renderToStaticMarkup(createElement(DailyOperationsEventCard, { event, nowMs: now + 90_000 }));
  assert.match(markup, /1m ago/);
  assert.match(markup, /dateTime="2026-09-08T18:14:00.000Z"/);
});

test("visible limit grows in the solo view and on Show all", () => {
  assert.equal(panelVisibleLimit({ focused: false, showAll: false, total: 60 }), DAILY_OPERATIONS_PANEL_DEFAULT_LIMIT);
  assert.equal(panelVisibleLimit({ focused: true, showAll: false, total: 60 }), DAILY_OPERATIONS_PANEL_FOCUSED_LIMIT);
  assert.equal(panelVisibleLimit({ focused: false, showAll: true, total: 60 }), 60);
});

test("panel view: a lane in the URL is a solo view; anything else is every panel", () => {
  const all = panelsForDailyOperationsView({ lane: null, sheetSyncOptIn: false });
  assert.equal(all.solo, null);
  assert.deepEqual(all.visible, all.tabs);
  assert.equal(all.tabs.includes("sheet_sync"), false);
  const solo = panelsForDailyOperationsView({ lane: "granot", sheetSyncOptIn: false });
  assert.equal(solo.solo, "granot");
  assert.deepEqual(solo.visible, ["granot"]);
  assert.deepEqual(solo.tabs, all.tabs);
  // Sheet Sync is a tab only after opt-in; the URL alone does not make it solo.
  const hidden = panelsForDailyOperationsView({ lane: "sheet_sync", sheetSyncOptIn: false });
  assert.equal(hidden.solo, "sheet_sync");
  assert.deepEqual(hidden.visible, ["sheet_sync"]);
  const optedIn = panelsForDailyOperationsView({ lane: "sheet_sync", sheetSyncOptIn: true });
  assert.equal(optedIn.solo, "sheet_sync");
  assert.equal(optedIn.tabs.includes("sheet_sync"), true);
  // A tile lane that has no panel (form_call) shows every panel.
  const noPanel = panelsForDailyOperationsView({ lane: "form_call", sheetSyncOptIn: false });
  assert.equal(noPanel.solo, null);
  assert.deepEqual(noPanel.visible, noPanel.tabs);
});

test("a panel with a count but no in-memory facts is backfilled once from its own lane", () => {
  const snapshot = snapshotFixture(); // leads 42, bookings 6, cancellations 1, texts 19, intakes 3, granot 183
  // Eight Granot facts fill that panel's slots, so only the starved lanes are asked.
  const granotOnly = Array.from({ length: 8 }, (_, index) =>
    eventItem({ event_id: `g${index}`, lane: "granot", kind: "granot.priority_updated" }),
  );
  const panels = visibleDailyOperationsPanels({ lane: null, sheetSyncOptIn: true });
  const needed = lanesNeedingBackfill({ snapshot, events: granotOnly, panels, attempted: new Set() });
  assert.deepEqual([...needed].sort(), ["booking", "cancellation", "exception", "intake", "lead", "sheet_sync", "text"]);
  // Exceptions backfill like every other starved lane; Sheet Sync does once opted in; an attempted lane is not asked again.
  assert.equal(needed.includes("exception"), true);
  assert.equal(
    lanesNeedingBackfill({
      snapshot,
      events: granotOnly,
      panels: visibleDailyOperationsPanels({ lane: null, sheetSyncOptIn: false }),
      attempted: new Set(),
    }).includes("sheet_sync"),
    false,
  );
  // One Lead in memory against a count of 42 still starves the panel (8 slots): backfill.
  const afterLead = lanesNeedingBackfill({
    snapshot,
    events: [...granotOnly, eventItem({ event_id: "l1", lane: "lead", kind: "form_lead.created" })],
    panels,
    attempted: new Set(["booking", "sheet_sync"]),
  });
  assert.deepEqual([...afterLead].sort(), ["cancellation", "exception", "intake", "lead", "text"]);
  // Eight Leads fill the default slots; the one Cancellation of the day is all of them.
  const filled = lanesNeedingBackfill({
    snapshot,
    events: [
      ...granotOnly,
      ...Array.from({ length: 8 }, (_, index) =>
        eventItem({ event_id: `l${index}`, lane: "lead", kind: "form_lead.created" }),
      ),
      eventItem({ event_id: "c1", lane: "cancellation", kind: "cancellation.created" }),
    ],
    panels,
    attempted: new Set(["booking", "sheet_sync"]),
  });
  assert.deepEqual([...filled].sort(), ["exception", "intake", "text"]);
  const exceptionFilled = lanesNeedingBackfill({
    snapshot,
    events: [
      ...granotOnly,
      eventItem({ event_id: "e1", lane: "exception", kind: "exception.zip_missing" }),
      eventItem({ event_id: "e2", lane: "exception", kind: "exception.zip_missing" }),
    ],
    panels,
    attempted: new Set(),
  });
  assert.equal(exceptionFilled.includes("exception"), false);
  // A zero count wants nothing; no snapshot wants nothing.
  const quiet = { ...snapshot, metrics: { ...snapshot.metrics, cancellations: { today: 0, yesterday: 0, yesterday_by_now: 0 } } };
  assert.equal(lanesNeedingBackfill({ snapshot: quiet, events: granotOnly, panels, attempted: new Set() }).includes("cancellation"), false);
  assert.deepEqual(lanesNeedingBackfill({ snapshot: null, events: [], panels, attempted: new Set() }), []);
});

test("Sheet Sync panel counts drained jobs and its cards show the job, trigger, attempts and error", () => {
  const snapshot = snapshotFixture();
  assert.equal(dailyOperationsPanelCount(snapshot, "sheet_sync"), 5);
  const event = eventItem({
    event_id: "s1",
    lane: "sheet_sync",
    kind: "sheet_sync.failed",
    source_company: null,
    ingestion_origin: null,
    lead_kind: null,
    entity_type: "SheetSyncJob",
    entity_id: "job1",
    links: { booking_id: "b1" },
    card: {
      sheet_sync: {
        resource: "booking_chain",
        operation: "booked_lead.create",
        attempts: 2,
        error: "Google Sheets 429",
      },
    },
  });
  const details = dailyOperationsCardDetails(event);
  const byLabel = new Map(details.map((row) => [row.label, row]));
  assert.equal(byLabel.get(DAILY_COPY.factLabels.sheetSyncResource)?.value, "booking chain");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.sheetSyncOperation)?.value, "booked lead.create");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.sheetSyncAttempts)?.value, "2");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.sheetSyncError)?.value, "Google Sheets 429");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.sheetSyncError)?.tone, "alert");
  assert.equal(byLabel.get(DAILY_COPY.factLabels.entity)?.value, "Sheet Sync Job");
  assert.ok(dailyOperationsAttentionChips(event).some((chip) => chip.value === DAILY_COPY.failed));
  const completed = dailyOperationsCardDetails(
    eventItem({
      event_id: "s2",
      lane: "sheet_sync",
      kind: "sheet_sync.completed",
      card: { sheet_sync: { resource: "source_lead", operation: "form_lead.create" } },
    }),
  );
  assert.equal(completed.some((row) => row.label === DAILY_COPY.factLabels.sheetSyncError), false);
});

test("Load earlier pages from the oldest fact of the lane being read, not the whole board", () => {
  const events = [
    eventItem({ event_id: "g-new", lane: "granot", kind: "granot.priority_updated", occurred_at: "2026-09-08T18:13:00.000Z" }),
    eventItem({ event_id: "l-old", lane: "lead", kind: "form_lead.created", occurred_at: "2026-09-08T12:00:00.000Z" }),
    eventItem({ event_id: "g-old", lane: "granot", kind: "granot.priority_updated", occurred_at: "2026-09-08T15:00:00.000Z" }),
  ];
  assert.equal(earlierDailyOperationsCursor(events, null), "2026-09-08T12:00:00.000Z:l-old");
  assert.equal(earlierDailyOperationsCursor(events, "granot"), "2026-09-08T15:00:00.000Z:g-old");
  assert.equal(earlierDailyOperationsCursor(events, "booking"), null);
  assert.equal(earlierDailyOperationsCursor([], null), null);
});

test("the full-stream overlay reads every in-memory fact; the Arrivals band keeps its slice", () => {
  const events = Array.from({ length: 30 }, (_, index) =>
    eventItem({
      event_id: `e${index}`,
      lane: "lead",
      kind: "form_lead.created",
      occurred_at: `2026-09-08T17:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );
  assert.equal(eventsForDailyOperationsArrivals({ events }).length, DAILY_OPERATIONS_ARRIVALS_LIMIT);
  assert.equal(eventsForDailyOperationsArrivals({ events, limit: null }).length, 30);
  assert.equal(eventsForDailyOperationsArrivals({ events, limit: null })[0]?.event_id, "e29");
  assert.equal(eventsForDailyOperationsArrivals({ events, limit: 5 }).length, 5);
});

test("Arrivals pulse counts facts in the window and finds the newest stamp", () => {
  const now = Date.parse("2026-09-08T18:14:00.000Z");
  const events = [
    eventItem({ event_id: "a", lane: "lead", kind: "form_lead.created", occurred_at: "2026-09-08T18:13:00.000Z" }),
    eventItem({ event_id: "b", lane: "lead", kind: "form_lead.created", occurred_at: "2026-09-08T18:00:00.000Z" }),
    eventItem({ event_id: "c", lane: "lead", kind: "form_lead.created", occurred_at: "2026-09-08T17:00:00.000Z" }),
  ];
  assert.equal(countRecentDailyOperationsEvents(events, now, 15 * 60_000), 2);
  assert.equal(countRecentDailyOperationsEvents([], now, 15 * 60_000), 0);
  assert.equal(newestDailyOperationsEventAt(events), "2026-09-08T18:13:00.000Z");
  assert.equal(newestDailyOperationsEventAt([]), null);
});

test("a second insert does not cancel the first event_id 1.5s highlight clear", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const highlighted = new Set<string>(["first"]);
    const onClear = (expired: readonly string[]) => {
      for (const id of expired) {
        highlighted.delete(id);
      }
    };
    schedulePerIdArrivalHighlightClear(timers, ["first"], onClear);
    mock.timers.tick(500);
    highlighted.add("second");
    schedulePerIdArrivalHighlightClear(timers, ["second"], onClear);
    mock.timers.tick(1000);
    assert.equal(highlighted.has("first"), false);
    assert.equal(highlighted.has("second"), true);
    mock.timers.tick(500);
    assert.equal(highlighted.has("second"), false);
  } finally {
    mock.timers.reset();
  }
});
