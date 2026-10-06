import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DAILY_COPY } from "../components/daily/daily-copy";
import { DailyOperationsEventsOverlay } from "../components/daily/events-overlay";
import { LanesView } from "../components/daily/lanes-view";
import { LiveFeed } from "../components/daily/live-feed";
import { dailyOperationsHasConfirmControl } from "../lib/api/dailyOperationsBoard";
import { EMPTY_DAILY_OPERATIONS_SESSION_DELTAS, type DailyOperationsEventItem } from "../lib/api/dailyOperationsLive";
import { emptySnapshot } from "./today-fixtures";

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

test("the live feed's empty state is one quiet line", () => {
  const markup = renderToStaticMarkup(createElement(LiveFeed, { events: [], onOpenFact: () => undefined }));
  assert.match(markup, /data-band="feed"/);
  assert.match(markup, new RegExp(DAILY_COPY.feed.title));
  assert.match(markup, new RegExp(DAILY_COPY.feed.empty));
  assert.doesNotMatch(markup, /data-event-list/);
  assert.doesNotMatch(markup, /Live facts/);
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
});

test("the live feed renders the newest facts across lanes without Confirm", () => {
  const markup = renderToStaticMarkup(
    createElement(LiveFeed, {
      events: [
        eventItem({ event_id: "c1", lane: "cancellation", kind: "cancellation.created", title: "Cancellation written", occurred_at: "2026-09-08T18:14:00.000Z" }),
        eventItem({ event_id: "l1", lane: "lead", kind: "form_lead.created", title: "Form Lead created", occurred_at: "2026-09-08T18:13:00.000Z" }),
      ],
      company: null,
      quietPriorities: false,
      onOpenFact: () => undefined,
    }),
  );
  assert.match(markup, /data-band="feed"/);
  assert.match(markup, /Cancellation written/);
  assert.match(markup, /Form Lead created/);
  assert.match(markup, /data-feed-scroll/);
  assert.match(markup, /data-event-list/);
  assert.doesNotMatch(markup, new RegExp(DAILY_COPY.feed.empty));
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
  assert.ok(markup.indexOf("Cancellation written") < markup.indexOf("Form Lead created"), "newest first");
});

test("Lanes: a row is one line; the full detail opens in place, not in the row", () => {
  const event = eventItem({
    event_id: "z",
    lane: "lead",
    kind: "form_lead.created",
    job_no: "5561111",
    card: { customer_name: "Maria Chen", move: { pickup_zip: "33101", pickup_state: "FL", delivery_zip: "30301", delivery_state: "GA" } },
  });
  const markup = renderToStaticMarkup(
    createElement(LanesView, {
      events: [event],
      snapshot: emptySnapshot,
      sessionDeltas: EMPTY_DAILY_OPERATIONS_SESSION_DELTAS,
      lane: "lead",
      company: null,
      quietPriorities: false,
      sheetSyncOptIn: false,
      onSelectLane: () => undefined,
    }),
  );
  assert.match(markup, /data-ops-view="lanes"/);
  assert.match(markup, /data-feed-row="row"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /Maria Chen/);
  assert.match(markup, /FL → GA/);
  assert.doesNotMatch(markup, /data-lane-detail/);
  assert.doesNotMatch(markup, /<dl/);
});

test("the full-list overlay is one column of rows with no layout switch, and a row opens the drawer", () => {
  const markup = renderToStaticMarkup(
    createElement(DailyOperationsEventsOverlay, {
      scope: "lead",
      events: [eventItem({ event_id: "a", lane: "lead", kind: "form_lead.created", card: { customer_name: "Maria Chen" } })],
      todayCount: 1,
      highlights: { highlightedIds: new Set<string>(), justNowIds: new Set<string>() },
      liveState: "live",
      onOpenFact: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.match(markup, /data-daily-overlay="lead"/);
  assert.match(markup, /data-feed-row="row"/);
  assert.match(markup, /Maria Chen/);
  assert.doesNotMatch(markup, /radiogroup/);
  assert.doesNotMatch(markup, new RegExp(`>${DAILY_COPY.layoutGrid}<`));
  assert.doesNotMatch(markup, /<article/);
});

test("daily-shell keeps one Daily Operations EventSource; the feed and the lanes construct none", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const shell = read("components/daily/daily-shell.tsx");
  const feed = read("components/daily/live-feed.tsx");
  const lanes = read("components/daily/lanes-view.tsx");
  const tiles = read("components/daily/lane-tiles.tsx");
  const eventSources = shell.match(/new EventSource/g) ?? [];
  assert.equal(eventSources.length, 1);
  assert.match(shell, /new EventSource\(DAILY_OPERATIONS_LIVE_PATH\)/);
  assert.match(shell, /<LiveFeed/);
  assert.match(shell, /<LaneTiles/);
  assert.match(shell, /<LanesView/);
  assert.match(shell, /<FactDrawer/);
  assert.match(shell, /queryKeys\.dailyOperations\.events\("all"\)/);
  assert.match(shell, /fetchDailyOperationsEvents\(\{ limit: 80 \}\)/);
  assert.match(shell, /parseDailyOperationsView\(searchParams\.get\("view"\), lane\)/);
  assert.ok(shell.indexOf("<LaneTiles") < shell.indexOf("<LiveFeed"), "tiles then the feed on the Board");
  for (const source of [feed, lanes, tiles]) {
    assert.doesNotMatch(source, /EventSource/);
  }
  assert.doesNotMatch(
    shell.slice(shell.indexOf("const eventsQuery"), shell.indexOf("useEffect(() => {", shell.indexOf("const eventsQuery"))),
    /lane: focusedLane/,
  );
});

test("the milestone toast owns its own EventSource, listens to events only, and closes on unmount", () => {
  const toast = readFileSync(path.join(process.cwd(), "components/daily/milestone-toast.tsx"), "utf8");
  assert.equal((toast.match(/new EventSource/g) ?? []).length, 1);
  assert.match(toast, /new EventSource\(DAILY_OPERATIONS_LIVE_PATH\)/);
  assert.equal((toast.match(/addEventListener\("event"/g) ?? []).length, 1);
  assert.doesNotMatch(toast, /addEventListener\("(snapshot|metrics|heartbeat)"/);
  assert.match(toast, /source\?\.close\(\)/);
  assert.match(toast, /sessionStorage/);
});
