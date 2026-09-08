import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrivalsStream } from "../components/daily/arrivals-stream";
import { DAILY_COPY } from "../components/daily/daily-copy";
import { dailyOperationsHasConfirmControl } from "../lib/api/dailyOperationsBoard";
import type { DailyOperationsEventItem } from "../lib/api/dailyOperationsLive";

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

test("Arrivals empty state is one quiet line", () => {
  const markup = renderToStaticMarkup(
    createElement(ArrivalsStream, {
      events: [],
      company: null,
      quietPriorities: false,
    }),
  );
  assert.match(markup, /data-band="arrivals"/);
  assert.match(markup, new RegExp(DAILY_COPY.arrivals));
  assert.match(markup, new RegExp(DAILY_COPY.arrivalsEmpty));
  assert.doesNotMatch(markup, /min-h-/);
  assert.doesNotMatch(markup, /h-96/);
  assert.doesNotMatch(markup, /Live facts/);
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
});

test("Arrivals strip renders newest cards across lanes without Confirm", () => {
  const markup = renderToStaticMarkup(
    createElement(ArrivalsStream, {
      events: [
        eventItem({
          event_id: "c1",
          lane: "cancellation",
          kind: "cancellation.created",
          title: "Cancellation written",
          occurred_at: "2026-09-08T18:14:00.000Z",
        }),
        eventItem({
          event_id: "l1",
          lane: "lead",
          kind: "form_lead.created",
          title: "Form Lead created",
          occurred_at: "2026-09-08T18:13:00.000Z",
        }),
      ],
      company: null,
      quietPriorities: false,
    }),
  );
  assert.match(markup, /data-band="arrivals"/);
  assert.match(markup, /Cancellation written/);
  assert.match(markup, /Form Lead created/);
  assert.doesNotMatch(markup, new RegExp(DAILY_COPY.arrivalsEmpty));
  assert.equal(dailyOperationsHasConfirmControl(markup), false);
});

test("daily-shell keeps one Daily Operations EventSource; Arrivals constructs none", () => {
  const shell = readFileSync(path.join(process.cwd(), "components/daily/daily-shell.tsx"), "utf8");
  const arrivals = readFileSync(path.join(process.cwd(), "components/daily/arrivals-stream.tsx"), "utf8");
  const eventSources = shell.match(/new EventSource/g) ?? [];
  assert.equal(eventSources.length, 1);
  assert.match(shell, /new EventSource\(DAILY_OPERATIONS_LIVE_PATH\)/);
  assert.match(shell, /<ArrivalsStream/);
  assert.match(shell, /hydrated=\{eventsHydrated\}/);
  assert.match(shell, /queryKeys\.dailyOperations\.events\("all"\)/);
  assert.match(shell, /fetchDailyOperationsEvents\(\{ limit: 80 \}\)/);
  assert.match(shell, /<CategoryPanels/);
  assert.ok(shell.indexOf("<ArrivalsStream") < shell.indexOf("<CategoryPanels"));
  assert.doesNotMatch(arrivals, /EventSource/);
  assert.doesNotMatch(
    shell.slice(shell.indexOf("const eventsQuery"), shell.indexOf("useEffect(() => {", shell.indexOf("const eventsQuery"))),
    /lane: focusedLane/,
  );
});
