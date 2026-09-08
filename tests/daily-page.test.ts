import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CategoryPanels } from "../components/daily/category-panels";
import { CompaniesTable } from "../components/daily/companies-table";
import { DAILY_COPY } from "../components/daily/daily-copy";
import { OriginsPanel } from "../components/daily/origins-panel";
import { visibleDashboardNav } from "../components/layout/dashboard-nav";
import { EMPTY_DAILY_OPERATIONS_SESSION_DELTAS } from "../lib/api/dailyOperationsLive";
import { HeadlineTiles } from "../components/daily/headline-tiles";
import type { DailyOperationsSnapshot } from "../lib/api/dailyOperations";
import { dailyOperationsHasConfirmControl } from "../lib/api/dailyOperationsBoard";

const emptySnapshot: DailyOperationsSnapshot = {
  timezone: "America/New_York",
  today: "2026-09-08",
  yesterday: "2026-09-07",
  generated_at: "2026-09-08T18:14:00.000Z",
  redis: { configured: false, mode: "stream" },
  metrics: {
    leads: {
      today: 0,
      yesterday: null,
      yesterday_by_now: null,
      form: 0,
      call: 0,
      duplicate_form: 0,
      duplicate_call: 0,
    },
    bookings: { today: 0, yesterday: null, yesterday_by_now: null },
    cancellations: { today: 0, yesterday: null, yesterday_by_now: null },
    texts: {
      today: 0,
      yesterday: null,
      yesterday_by_now: null,
      deferred: 0,
      held_now: 0,
      skipped: 0,
      failed: 0,
    },
    webhooks: {
      lead_created: { today: 0, yesterday: null },
      priority_updated: { today: 0, yesterday: null },
      booking_status_changed: { today: 0, yesterday: null },
      booked: { today: 0, yesterday: null },
      release: { today: 0, yesterday: null },
    },
    intakes: { opened_today: 0, still_open: 0 },
    exceptions: { zip_missing: 0, crm_failed: 0, dead_letter: 0, adoption_conflict: 0 },
  },
  origins: {
    granot_lead_created: 0,
    ringcentral: 0,
    wordpress_form: 0,
    best_relocation_sheet: 0,
    vantage_admin: 0,
  },
  companies: [],
  hourly: { today: [], yesterday: [] },
};

test("Owner nav places Daily Operations second; Admin cannot see it", () => {
  const owner = visibleDashboardNav("owner");
  const admin = visibleDashboardNav("admin");
  assert.equal(owner[1]?.label, "Daily Operations");
  assert.equal(owner[1]?.href, "/daily");
  assert.equal(owner[1]?.ownerOnly, true);
  assert.equal(admin.some((item) => item.href === "/daily"), false);
});

test("empty snapshot still shows WordPress form at 0 and silent Source Company rows", () => {
  const origins = renderToStaticMarkup(createElement(OriginsPanel, { origins: emptySnapshot.origins }));
  assert.match(origins, /WordPress form/);
  assert.match(origins, />0</);
  const companies = renderToStaticMarkup(
    createElement(CompaniesTable, {
      companies: emptySnapshot.companies,
      selectedCompany: null,
      onSelectCompany: () => undefined,
    }),
  );
  assert.match(companies, /TBM Leads/);
  assert.match(companies, /Top 10 Forms/);
  assert.match(companies, /not provided/);
  assert.match(companies, /main site/);
  const tiles = renderToStaticMarkup(
    createElement(HeadlineTiles, {
      snapshot: emptySnapshot,
      sessionDeltas: EMPTY_DAILY_OPERATIONS_SESSION_DELTAS,
      flashedTiles: [],
      lane: null,
      onSelectLane: () => undefined,
    }),
  );
  assert.match(tiles, new RegExp(DAILY_COPY.tiles.leads));
  assert.match(tiles, /Waiting for you/);
  assert.match(tiles, /—/);
  const panels = renderToStaticMarkup(
    createElement(CategoryPanels, {
      events: [],
      snapshot: emptySnapshot,
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
  assert.match(panels, new RegExp(DAILY_COPY.panelsEmpty));
  assert.match(panels, new RegExp(DAILY_COPY.exceptionsEmpty));
  assert.match(panels, /data-panel="lead"/);
  assert.match(panels, /data-panel="exception"/);
  assert.doesNotMatch(panels, /data-panel="sheet_sync"/);
  assert.equal(dailyOperationsHasConfirmControl(panels), false);
});
