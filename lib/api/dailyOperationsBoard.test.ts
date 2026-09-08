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
} from "../../components/daily/daily-copy";
import { CategoryPanels } from "../../components/daily/category-panels";
import { DailyOperationsEventCard } from "../../components/daily/event-card";
import { compareDailyOperationsEventsNewestFirst, EMPTY_DAILY_OPERATIONS_SESSION_DELTAS } from "./dailyOperationsLive";
import type { DailyOperationsEventItem } from "./dailyOperationsLive";
import type { DailyOperationsSnapshot } from "./dailyOperations";
import {
  applyQuietPriorities,
  DAILY_OPERATIONS_ARRIVAL_HIGHLIGHT_MS,
  DAILY_OPERATIONS_ARRIVALS_LIMIT,
  dailyOperationsEventLinks,
  dailyOperationsEventTitle,
  dailyOperationsHasConfirmControl,
  dailyOperationsPanelCount,
  dailyOperationsPanelEmptyCopy,
  eventsForDailyOperationsArrivals,
  eventsForDailyOperationsPanel,
  newlyArrivedDailyOperationsEventIds,
  scheduleArrivalHighlightClear,
  schedulePerIdArrivalHighlightClear,
  seedOrArriveDailyOperationsEventIds,
  fanOutDailyOperationsEvents,
  filterDailyOperationsEventsByCompany,
  leadDeskHref,
  pairGranotEvents,
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
