import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, closedHistorySchema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { OutcomeLine, durationText, nowPriorityText, wholeDays } from "../../components/sales-intelligence/card/outcome-line";
import {
  ClosedCard, ClosedHistoryView, HistoryRow, closedListEnd, historyClosedBefore, historyEndText, historyParams,
} from "../../components/sales-intelligence/desk/closed-list";
import { OutreachListView } from "../../components/sales-intelligence/desk/outreach-list";
import { attentionParamsFromDesk, closedHistoryParamsFromDesk, parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { closedHistoryQuery } from "../../components/sales-intelligence/data/requests";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI1-CLOSED: the outcome line for every `outcome.reason` in the fixtures (UI1-A14) and Closed history (UI1-A15).

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const loadList = (rel: string) => attentionSchema.parse(read(rel));
const loadHistory = (rel: string) => closedHistorySchema.parse(read(rel));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

function line(row: AttentionRow, asOf: string): { html: string; text: string } {
  const html = decode(renderToStaticMarkup(createElement(OutcomeLine, { outcome: row.outcome!, asOf, receivedAt: row.outreach?.trigger_at ?? null, returnTo: "/sales-intelligence?view=closed" })));
  return { html, text: text(html) };
}

const CLOSED_FILES = ifFixtures(() => [
  ...fs.readdirSync(path.join(CONTRACTS, "S2")).filter((f) => f.startsWith("attention-closed__") && f.endsWith(".json")).map((f) => `S2/${f}`),
  "S6/attention-closed__closed-outcome-granot-booked.json",
]);

/** The exact line for each seeded row (S2 closed partition + S6 granot_booked), by name. */
const EXPECTED: Record<string, string> = {
  "Ivan Whitfield": "Closed by you Sep 23 (11d, 1 call) · lost",
  "Omar Pham": "Closed Sep 19 (10d, 1 call) · Granot Priority 7 (CRM bad/unusable)",
  "Grace Carter": "Closed Sep 17 (11d, 1 call) · Granot Priority 8 (CRM dead opportunity)",
  "Nora Moreno": "Closed Sep 16 (2d, 1 call) · Duplicate",
  "Lena Quinn": "Closed Sep 13 (2d, 1 call) · Bad Lead",
  "Felix Whitfield": "Received Sep 3 → Booked Sep 11 (8d, 4 calls) · Open Booking",
  "Ivan Pham": "Closed Sep 10 (2d, 1 call) · No-Sync",
  "Sam Hale": "Booked Aug 29 → Cancelled Sep 2 (9d, 1 call) · Customer found a cheaper mover",
  "T3 P5 Accepted": "Closed Sep 22 (3d, 1 call) · Booked in Granot · No Vantage Booking yet",
  "T3 P5 Back To Quoted": "Closed Sep 20 (4d, 1 call) · Booked in Granot · No Vantage Booking yet · now Granot Priority 1 (Quoted)",
};

fixtureTest("A14: every outcome.reason in the Closed fixtures renders its line", () => {
  const reasons = new Set<string>();
  let rendered = 0;
  for (const rel of CLOSED_FILES) {
    const page = loadList(rel);
    for (const row of page.data.items) {
      assert.ok(row.outcome, `${rel} ${row.subject_key} has an outcome`);
      reasons.add(row.outcome.reason);
      const { html, text: t } = line(row, page.as_of);
      rendered += 1;
      assert.ok(t.length > 0 && !t.includes("undefined") && !t.includes("null"), `${rel} ${row.subject_key}: ${t}`);
      assert.ok(!/\(0d/.test(t) || wholeDays(row.outcome.time_to_close_ms) === 0);
      const expected = EXPECTED[row.outreach?.lead_display?.name ?? ""];
      if (expected) assert.equal(t, expected, `${rel} ${row.outreach?.lead_display?.name}`);
      // Every date is a <time> with the exact ET time.
      for (const match of html.matchAll(/<time dateTime="([^"]+)" title="([^"]+)" aria-label="([^"]+)"/g)) assert.equal(match[2], match[3]);
      assert.equal(html.includes("si-badge--green"), row.outcome.reason === "booked", `${row.outcome.reason}: green only for Booked`);
    }
  }
  assert.deepEqual([...reasons].sort(), ["bad_lead", "booked", "cancelled", "crm_bad_unusable", "crm_dead", "duplicate", "granot_booked", "no_sync", "owner"]);
  assert.ok(rendered >= 30, `rendered ${rendered}`);
});

fixtureTest("A14: granot_booked reads Booked in Granot · No Vantage Booking yet; the booking upgrade reads as Booked", () => {
  const page = loadList("S6/attention-closed__closed-outcome-granot-booked.json");
  for (const row of page.data.items) assert.match(line(row, page.as_of).text, /Booked in Granot · No Vantage Booking yet/);
  const accepted = page.data.items.find((r) => r.outcome!.priority?.code === "5")!;
  assert.equal(nowPriorityText(accepted.outcome!), null, "no `now` suffix while the code is still 5");
  const moved = page.data.items.find((r) => r.outcome!.priority?.code === "1")!;
  assert.equal(nowPriorityText(moved.outcome!), "now Granot Priority 1 (Quoted)");
  // E2: when the exact Booking arrives the reason becomes `booked` and the line is the Booked line.
  const upgraded = { ...accepted, outcome: { ...accepted.outcome!, reason: "booked", booking: { id: "b1", book_date: "2026-09-22T20:00:00.000Z", total_binder_amount: 4100 } } };
  const t = line(upgraded as AttentionRow, page.as_of).text;
  assert.match(t, /^Received Sep 18 → Booked Sep 22 \(3d, 1 call\) · Open Booking$/);
  const booked = loadList("S6/attention-closed__closed-outcome-booked.json");
  for (const row of booked.data.items) assert.match(line(row, booked.as_of).text, /^Received .+ → Booked .+ · Open Booking$/);
});

fixtureTest("the outcome line's parts: whole days floored, calls, null paths, Open Booking with si_return", () => {
  assert.equal(wholeDays(691_200_000), 8);
  assert.equal(wholeDays(86_399_999), 0);
  assert.equal(wholeDays(null), null);
  assert.equal(durationText({ time_to_close_ms: null, calls_total: null }), null);
  assert.equal(durationText({ time_to_close_ms: 950_418_028, calls_total: null }), "11d");
  assert.equal(durationText({ time_to_close_ms: null, calls_total: 2 }), "2 calls");
  const page = loadList("S2/attention-closed__closed-outcome-booked.json");
  const row = page.data.items[0]!;
  const { html } = line(row, page.as_of);
  assert.ok(html.includes("si_return=%2Fsales-intelligence%3Fview%3Dclosed"), "Open Booking carries si_return");
  assert.ok(html.includes('data-action="open-booking"'));
  const bare = { ...row.outcome!, time_to_close_ms: null, calls_total: null };
  assert.ok(!text(decode(renderToStaticMarkup(createElement(OutcomeLine, { outcome: bare, asOf: page.as_of, receivedAt: null })))).includes("("));
  const unknown = { ...row.outcome!, reason: "something_new", booking: null };
  assert.match(text(decode(renderToStaticMarkup(createElement(OutcomeLine, { outcome: unknown, asOf: page.as_of })))), /^Closed .+ · something new$/);
});

fixtureTest("a closed card: line 6 is the outcome line and the only action is Open", () => {
  const page = loadList("S2/attention-closed__closed.json");
  for (const row of page.data.items) {
    const html = decode(renderToStaticMarkup(createElement(ClosedCard, { row, asOf: page.as_of })));
    assert.ok(html.includes(`data-outcome="${row.outcome!.reason}"`));
    assert.ok(html.includes('data-action="open"'));
    assert.ok(!html.includes('data-action="message-rep"') && !html.includes('data-action="open-analysis"'));
    assert.ok(!/class="si-bandtag/.test(html), "no band tag on a closed card");
  }
});

fixtureTest("A15: the list ends with Older than 90 days · Load closed history only when the partition's cursor is null", () => {
  const page = loadList("S2/attention-closed__closed.json");
  assert.equal(page.data.cursor, null);
  assert.equal(closedListEnd({ cursor: page.data.cursor, pending: false, historyOpen: false }), "row");
  assert.equal(closedListEnd({ cursor: "next", pending: false, historyOpen: false }), null);
  assert.equal(closedListEnd({ cursor: null, pending: true, historyOpen: false }), null, "a waiting live update holds the end");
  assert.equal(closedListEnd({ cursor: null, pending: false, historyOpen: true }), "history");
  const html = decode(renderToStaticMarkup(createElement(OutreachListView, {
    view: "closed", rows: page.data.items, asOf: page.as_of, sort: "closed", q: null, totalItems: page.data.total_items, stale: false, hasMore: false,
    renderCard: (row) => createElement(ClosedCard, { row, asOf: page.as_of }), end: createElement(HistoryRow, { onLoad: () => {} }),
  })));
  assert.match(html, /data-layout="flat"/);
  assert.ok(decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().endsWith("Older than 90 days · Load closed history"));
  assert.equal((html.match(/data-outcome=/g) ?? []).length, page.data.items.length);
  // Empty Closed: its own sentence, and the history row still ends it.
  const empty = loadList("S2/flag-off/attention__closed.json");
  const none = text(decode(renderToStaticMarkup(createElement(OutreachListView, {
    view: "closed", rows: empty.data.items, asOf: empty.as_of, sort: "closed", q: null, totalItems: 0, stale: false, hasMore: false, end: createElement(HistoryRow, { onLoad: () => {} }),
  }))));
  assert.ok(none.includes("No closed work in this range."));
});

fixtureTest("A15: Closed history pages render with the same outcome line; the end reads the retention", () => {
  for (const rel of fs.readdirSync(path.join(CONTRACTS, "S7")).filter((f) => f.startsWith("closed-history__")).map((f) => `S7/${f}`).concat("S11/closed-history__q-name.json")) {
    const page = loadHistory(rel);
    const html = decode(renderToStaticMarkup(createElement(ClosedHistoryView, { rows: page.data.items, asOf: page.as_of, hasMore: !!page.data.cursor, retentionDays: page.data.retention.days })));
    for (const row of page.data.items) {
      assert.ok(html.includes(`data-outcome="${row.outcome!.reason}"`), `${rel} ${row.subject_key}`);
      assert.ok(text(html).includes(line(row, page.as_of).text.replace(/ · Open Booking$/, "")), `${rel}: same line`);
    }
    if (page.data.cursor) {
      assert.ok(html.includes(">Load more closed history<"), `${rel}: follows the cursor`);
      assert.ok(!html.includes("data-history-end"));
    } else {
      assert.ok(html.includes("data-history-end"), `${rel}: ends`);
      assert.ok(text(html).includes(historyEndText(page.data.retention.days)));
    }
  }
  const before = loadHistory("S7/closed-history__before-90d.json");
  assert.equal(before.data.retention.days, 730);
  const end = text(decode(renderToStaticMarkup(createElement(ClosedHistoryView, { rows: before.data.items, asOf: before.as_of, hasMore: false, retentionDays: 730 }))));
  assert.ok(end.includes("Closed Outreach is kept for 730 days"));
  assert.equal(historyEndText(null), "That's every closed record we still have.");
  // Under q the bounded scan may answer an empty page with a cursor: keep offering more, never end.
  const emptyWithCursor = text(decode(renderToStaticMarkup(createElement(ClosedHistoryView, { rows: [], asOf: before.as_of, hasMore: true, retentionDays: 730 }))));
  assert.ok(emptyWithCursor.includes("Load more closed history") && !emptyWithCursor.includes("kept for"));
});

test("A15: history takes the Closed filters, and closed_before at the 90-day edge (or an earlier closed_to)", () => {
  const state = parseDeskUrl(new URLSearchParams("view=closed&outcome=booked&outcome=granot_booked&priority=5&agent_id=a1&closed_from=2026-01-01T05:00:00.000Z&q=ivan"));
  const asOf = "2026-09-24T20:34:35.790Z";
  const hp = historyParams(closedHistoryParamsFromDesk(state), asOf, state.closed_to);
  const query = closedHistoryQuery(hp);
  assert.deepEqual(query.getAll("outcome"), ["booked", "granot_booked"]);
  assert.deepEqual(query.getAll("priority"), ["5"]);
  assert.deepEqual(query.getAll("agent_id"), ["a1"]);
  assert.equal(query.get("closed_from"), "2026-01-01T05:00:00.000Z");
  assert.equal(query.get("q"), "ivan");
  assert.equal(query.get("closed_before"), "2026-06-26T20:34:35.790Z");
  assert.equal(historyClosedBefore(asOf, "2026-03-01T05:00:00.000Z"), "2026-03-01T05:00:00.000Z");
  assert.equal(historyClosedBefore(asOf, "2026-09-01T04:00:00.000Z"), "2026-06-26T20:34:35.790Z");
  // The Closed list itself sends the closed-only params and its own sort.
  const params = attentionParamsFromDesk(state, "closed");
  assert.equal(params.sort, "lead_received");
  assert.equal(params.direction, "desc");
});
