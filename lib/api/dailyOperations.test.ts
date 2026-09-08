import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_OPERATIONS_COMPANY_SLUGS,
  DAILY_OPERATIONS_EVENTS_PATH,
  DAILY_OPERATIONS_ORIGIN_KEYS,
  DAILY_OPERATIONS_SNAPSHOT_PATH,
  ensureSnapshotCompanies,
  ensureSnapshotOrigins,
  fetchDailyOperationsEvents,
  fetchDailyOperationsSnapshot,
  granotReceiptsToday,
  granotYesterdayByNow,
  paceVersusYesterdayByNow,
  toggleSearchParam,
  type DailyOperationsSnapshot,
} from "./dailyOperations";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

function snapshotFixture(overrides: Partial<DailyOperationsSnapshot> = {}): DailyOperationsSnapshot {
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
    hourly: {
      today: [],
      yesterday: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        leads: 0,
        bookings: 0,
        cancellations: 0,
        webhooks: hour <= 14 ? 2 : 0,
        messages: 0,
      })),
    },
    ...overrides,
  };
}

test("snapshot fetch uses the Owner proxy", async () => {
  const calls = mockFetch({ ok: true, data: snapshotFixture() });
  const result = await fetchDailyOperationsSnapshot();
  assert.equal(String(calls[0]?.input), `/api/proxy/${DAILY_OPERATIONS_SNAPSHOT_PATH}`);
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.equal(result.metrics.leads.today, 42);
});

test("events page fetch uses the Owner proxy with lane and cursor", async () => {
  const calls = mockFetch({
    ok: true,
    data: { day: "2026-09-08", timezone: "America/New_York", order: "newest_first", limit: 40, items: [], next_cursor: null },
  });
  await fetchDailyOperationsEvents({ lane: "text", cursor: "2026-09-08T12:00:00.000Z:abc", limit: 40 });
  assert.equal(
    String(calls[0]?.input),
    `/api/proxy/${DAILY_OPERATIONS_EVENTS_PATH}?lane=text&cursor=2026-09-08T12%3A00%3A00.000Z%3Aabc&limit=40`,
  );
});

test("pace uses yesterday_by_now, not full yesterday, and missing yesterday is a dash", () => {
  assert.deepEqual(paceVersusYesterdayByNow(42, 31), { delta: 11, tone: "ahead" });
  assert.deepEqual(paceVersusYesterdayByNow(10, 18), { delta: -8, tone: "behind" });
  assert.deepEqual(paceVersusYesterdayByNow(18, 18), { delta: 0, tone: "even" });
  assert.deepEqual(paceVersusYesterdayByNow(18, null), { delta: null, tone: "missing" });
});

test("origins always include WordPress form at zero and companies keep silent slugs", () => {
  const origins = ensureSnapshotOrigins({ ringcentral: 14, wordpress_form: 0 });
  assert.equal(origins.wordpress_form, 0);
  assert.deepEqual(Object.keys(origins), [...DAILY_OPERATIONS_ORIGIN_KEYS]);
  const companies = ensureSnapshotCompanies([
    { source_company: "top10_leads", form: 12, call: 5, total: 17, yesterday_total: 15 },
  ]);
  assert.equal(companies.length, DAILY_OPERATIONS_COMPANY_SLUGS.length);
  assert.equal(companies.find((row) => row.source_company === "tbm_leads")?.total, 0);
  assert.equal(companies.find((row) => row.source_company === "not_provided")?.total, 0);
  assert.equal(companies.find((row) => row.source_company === "top10_leads")?.total, 17);
});

test("Granot receipts today sums webhook classes and yesterday_by_now uses hourly 0..now", () => {
  const snapshot = snapshotFixture();
  assert.equal(granotReceiptsToday(snapshot), 183);
  assert.equal(granotYesterdayByNow(snapshot), 30);
  assert.equal(
    granotYesterdayByNow(
      snapshotFixture({
        metrics: {
          ...snapshot.metrics,
          leads: { ...snapshot.metrics.leads, yesterday_by_now: null },
        },
      }),
    ),
    null,
  );
});

test("tile and company clicks toggle lane and company search params", () => {
  const withLane = toggleSearchParam(new URLSearchParams(), "lane", "lead");
  assert.equal(withLane.get("lane"), "lead");
  const cleared = toggleSearchParam(withLane, "lane", "lead");
  assert.equal(cleared.get("lane"), null);
  const company = toggleSearchParam(new URLSearchParams("lane=lead"), "company", "top10_leads");
  assert.equal(company.get("lane"), "lead");
  assert.equal(company.get("company"), "top10_leads");
});
