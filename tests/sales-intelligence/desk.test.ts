import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SalesIntelligenceError, attentionSchema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { ViewTabs, viewTabs } from "../../components/sales-intelligence/desk/view-tabs";
import { OutreachListView, groupByBand, sortLineFor, LIST_HEADING_ID } from "../../components/sales-intelligence/desk/outreach-list";
import { MetricsStripView, metricTiles } from "../../components/sales-intelligence/desk/metrics-strip";
import { ListControls, sortOptions, sortPatch } from "../../components/sales-intelligence/desk/list-controls";
import { ActiveChips } from "../../components/sales-intelligence/desk/active-chips";
import { PageHeaderView, isShortPhone, searchAction } from "../../components/sales-intelligence/desk/page-header";
import { legacyDeepLinkRedirect } from "../../components/sales-intelligence/desk/legacy-deep-links";
import { NO_DEGRADE, applyDegrade, degradeNotices, nextDegrade } from "../../components/sales-intelligence/desk/degrade";
import { attentionParamsFromDesk, deskUrlUpdate, parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { attentionQuery } from "../../components/sales-intelligence/data/requests";
import { RECEIVED_WINDOWS, CLOSED_WINDOWS, activeFilterChips, outreachRegions, windowFrom } from "../../components/sales-intelligence/rail";
import { BANDS } from "../../components/sales-intelligence/sales-intelligence-copy";

// UI1-DESK: the desk rendered from the contract fixtures (UI1-A08–A11, A38 degrade). No DOM (ADMIN-REBUILD trap 7).

const WORKSPACE_CONTRACTS = "sales-intelligence-ui-ux-workspace/contracts";
function contractsDir(): string {
  const repo = path.resolve(__dirname, "../..");
  const tried = [process.env.SI_CONTRACTS_DIR, path.resolve(repo, "..", WORKSPACE_CONTRACTS)].filter((v): v is string => !!v);
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(repo, ".git"), "utf8"))?.[1]?.trim();
    if (gitdir) tried.push(path.resolve(gitdir, "..", "..", "..", "..", WORKSPACE_CONTRACTS));
  } catch { /* a normal checkout */ }
  const dir = tried.find((candidate) => fs.existsSync(path.join(candidate, "S1")));
  assert.ok(dir, `contracts not found; tried ${tried.join(", ")}`);
  return dir;
}
const CONTRACTS = contractsDir();
const load = (rel: string) => attentionSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8")));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => decode(renderToStaticMarkup(el));

function listHtml(rel: string, over: Partial<Parameters<typeof OutreachListView>[0]> = {}) {
  const page = load(rel);
  const view = (page.data.view ?? "all_outreach") as "attention" | "all_outreach";
  return html(createElement(OutreachListView, {
    view, rows: page.data.items, asOf: page.as_of, sort: page.data.sort ?? "attention", q: null,
    totalItems: page.data.total_items, stale: page.data.stale ?? false, hasMore: !!page.data.cursor, ...over,
  }));
}

test("A08: the view bar has seven link tabs in order, Overview first and default, no Numbers or Messages", () => {
  const tabs = viewTabs("");
  assert.deepEqual(tabs.map((t) => t.label), ["Overview", "Needs Attention", "All Outreach", "Closed", "RingCentral Accounts", "Coverage", "Guide"]);
  assert.equal(tabs[0]!.href, "/sales-intelligence");
  assert.equal(tabs[1]!.href, "/sales-intelligence?view=attention");
  const markup = html(createElement(ViewTabs, { active: "overview", query: "" }));
  assert.ok(!/Numbers|Messages/.test(markup), "no Numbers or Messages tab");
  assert.match(markup, /aria-current="page" href="\/sales-intelligence">/);
  assert.equal(parseDeskUrl(new URLSearchParams("")).view, "overview");
  assert.equal(parseDeskUrl(new URLSearchParams("view=bogus")).view, "overview");
  // A view link keeps the preset and filters, drops the dialog and the cursor.
  const kept = new URLSearchParams(viewTabs("view=attention&priority=1&band=2&outreach=o1&cursor=abc")[2]!.href.split("?")[1]);
  assert.equal(kept.get("view"), "all_outreach");
  assert.deepEqual(kept.getAll("priority"), ["1"]);
  assert.deepEqual(kept.getAll("band"), ["2"]);
  assert.equal(kept.get("outreach"), null);
  assert.equal(kept.get("cursor"), null);
});

test("A09: Needs Attention in Attention order is grouped under band headers; no band header without rows", () => {
  const page = load("S1/attention__default.json");
  const markup = listHtml("S1/attention__default.json");
  assert.match(markup, /data-layout="grouped"/);
  const groups = groupByBand(page.data.items);
  const bands = groups.filter((g) => g.band != null).map((g) => g.band);
  assert.deepEqual(bands, [2, 5, 6]);
  for (const group of groups.filter((g) => g.band != null)) {
    assert.ok(markup.includes(`data-band="${group.band}"`), `band ${group.band} section`);
    assert.ok(markup.includes(BANDS[group.band as keyof typeof BANDS]), `band ${group.band} name`);
    assert.ok(markup.includes(`aria-label="${group.rows.length} record${group.rows.length === 1 ? "" : "s"}"`), `band ${group.band} count`);
  }
  for (const missing of [1, 3, 4, 7]) assert.ok(!markup.includes(`data-band="${missing}"`), `no header for band ${missing}`);
  // The Number-review row (band null) sits in its own Needs review group.
  assert.ok(groups.some((g) => g.review));
  // Grouped cards carry no band tag on line 1.
  assert.ok(!/class="si-bandtag( is-none)?"/.test(markup), "no band tags on cards when grouped");
  assert.ok(!markup.includes("data-sortline"), "no sort line under Attention order");
  assert.ok(markup.includes(`id="${LIST_HEADING_ID}"`));
  assert.ok(markup.includes(`${page.data.total_items} results`));
});

test("A09: All Outreach under Lead received is flat with band tags and no sort line", () => {
  const markup = listHtml("S1/attention__all-outreach.json", { sort: "lead_received" });
  assert.match(markup, /data-layout="flat"/);
  assert.ok(!markup.includes("si-bandhead"), "no band headers");
  assert.ok(markup.includes("si-bandtag"), "band tag on line 1");
  assert.ok(!markup.includes("data-sortline"));
});

test("A09: any other sort is flat with the sort line (value or the null label)", () => {
  const page = load("S2/attention__sort-last-call.json");
  const markup = listHtml("S2/attention__sort-last-call.json");
  assert.match(markup, /data-layout="flat"/);
  const lines = markup.match(/data-sortline/g) ?? [];
  assert.equal(lines.length, page.data.items.filter((r) => r.outreach).length);
  assert.ok(text(markup).includes("Last call: "));
  const withNull = page.data.items.find((r) => r.outreach && r.sort_keys?.last_call == null);
  if (withNull) assert.equal(sortLineFor(withNull, "last_call", page.as_of)!.value, null);
  assert.equal(sortLineFor(page.data.items[0]!, "attention", page.as_of), null);
  assert.equal(sortLineFor(page.data.items[0]!, "lead_received", page.as_of), null);
  // Scores print `{n} / 100`, never `%`.
  const ti = load("S2/attention__sort-transaction-intent.json");
  const scored = ti.data.items.find((r) => r.sort_keys?.transaction_intent != null)!;
  assert.match(sortLineFor(scored, "transaction_intent", ti.as_of)!.value!, /^\d+ \/ 100/);
  assert.equal(sortLineFor(scored, "interactions", ti.as_of)!.label, "Interactions");
});

test("A09: both lists offer the nine sorts; Closed three; direction words; score sorts show Fresh assessments only", () => {
  assert.equal(sortOptions("attention").length, 9);
  assert.deepEqual(sortOptions("attention").map((o) => o.key), sortOptions("all_outreach").map((o) => o.key));
  assert.deepEqual(sortOptions("closed").map((o) => o.words.label), ["Closed", "Lead received", "Time to close"]);
  const noop = () => {};
  const received = html(createElement(ListControls, { view: "all_outreach", sort: "lead_received", direction: "desc", freshness: null, onChange: noop }));
  assert.ok(received.includes(">Newest first<"));
  assert.ok(!received.includes("Fresh assessments only"));
  const attention = html(createElement(ListControls, { view: "attention", sort: "attention", direction: "asc", freshness: null, onChange: noop }));
  assert.ok(!attention.includes("si-desk__direction"), "Attention order has no direction");
  const score = html(createElement(ListControls, { view: "attention", sort: "transaction_intent", direction: "desc", freshness: "fresh", onChange: noop }));
  assert.ok(score.includes("Fresh assessments only") && score.includes("checked"));
  assert.ok(score.includes(">Highest<"));
  // A new sort drops the direction (reset to the sort's default) and the cursor; the default sort is written as none.
  const next = deskUrlUpdate("view=all_outreach&sort=last_call&direction=asc&cursor=abc", sortPatch("all_outreach", "move_likelihood"));
  assert.equal(next.get("sort"), "move_likelihood");
  assert.equal(next.get("direction"), null);
  assert.equal(next.get("cursor"), null);
  assert.equal(sortPatch("all_outreach", "lead_received").sort, null);
  assert.equal(sortPatch("attention", "attention").sort, null);
});

test("A10: five metric tiles from data.metrics with As of; each applies its filter", () => {
  const page = load("S6/attention__all-outreach.json");
  const markup = html(createElement(MetricsStripView, { metrics: page.data.metrics!, asOf: page.as_of, onApply: () => {} }));
  const m = page.data.metrics!;
  for (const [tile, value] of [["leads7d", m.leads_received_7d], ["notCalled", m.not_called_yet], ["overdue", m.callbacks_overdue], ["awaiting", m.awaiting_assessment], ["booked7d", m.booked_7d]] as const) {
    const at = markup.indexOf(`data-tile="${tile}"`);
    assert.ok(at >= 0, tile);
    assert.ok(text(markup.slice(at, markup.indexOf("</button>", at))).includes(String(value)), `${tile} value`);
  }
  assert.ok(markup.includes("median 5d"));
  assert.match(text(markup), /As of Sep 24, 6:58 PM ET/);
  assert.equal((markup.match(/<button/g) ?? []).length, 5);

  const tiles = metricTiles(page.data.metrics, page.as_of);
  const by = Object.fromEntries(tiles.map((t) => [t.id, t.patch]));
  assert.deepEqual(by.leads7d, { view: "all_outreach", received_from: windowFrom(page.as_of, RECEIVED_WINDOWS["7d"]), received_to: null });
  assert.equal(by.leads7d!.received_from, "2026-09-17T22:58:37.661Z");
  assert.deepEqual(by.notCalled, { band: ["2"] });
  assert.deepEqual(by.overdue, { band: ["1"] });
  assert.deepEqual(by.awaiting, { newer_call: true });
  assert.deepEqual(by.booked7d, { view: "closed", priority: [], outcome: ["booked"], closed_from: windowFrom(page.as_of, CLOSED_WINDOWS["7d"]), closed_to: null });
  // The tile's filter shows as a chip (A10): Band 2 after `Not called yet`.
  const state = parseDeskUrl(deskUrlUpdate("view=attention&priority=1", by.notCalled!));
  const chips = activeFilterChips(state, outreachRegions("attention"), [], { asOf: page.as_of });
  assert.deepEqual(chips.map((c) => c.label), ["Band 2 · " + BANDS[2]]);
  const received = parseDeskUrl(deskUrlUpdate("view=attention", by.leads7d!));
  assert.equal(received.view, "all_outreach");
  assert.deepEqual(activeFilterChips(received, outreachRegions("all_outreach"), [], { asOf: page.as_of }).map((c) => c.label), ["Lead received last 7d"]);
  // `median` is absent when the server has no booking in 7 days.
  const s1 = load("S1/attention__all-outreach.json");
  assert.ok(!html(createElement(MetricsStripView, { metrics: s1.data.metrics!, asOf: s1.as_of })).includes("median"));
});

test("A10: metrics absent (flag-off snapshot) → every tile — with Not available in this snapshot", () => {
  for (const rel of ["S2/flag-off/attention__default.json", "S2/flag-off/attention__all-outreach.json"]) {
    const page = load(rel);
    assert.equal(page.data.metrics, undefined, rel);
    const markup = html(createElement(MetricsStripView, { metrics: page.data.metrics ?? null, asOf: page.as_of, onApply: () => {} }));
    assert.equal((markup.match(/<span class="si-metrics__value">—<\/span>/g) ?? []).length, 5, rel);
    assert.equal((markup.match(/title="Not available in this snapshot"/g) ?? []).length, 5);
    assert.ok(text(markup).includes("Not available in this snapshot"), "visible, not hover-only");
    assert.ok(!markup.includes("<button"), "no tile applies a filter without numbers");
  }
});

test("the stale banner shows when data.stale, with the exact time as a <time> element", () => {
  const page = load("S1/attention__all-outreach.json");
  assert.ok(!listHtml("S1/attention__all-outreach.json").includes("data-stale"));
  const markup = listHtml("S1/attention__all-outreach.json", { stale: true });
  assert.ok(text(markup).includes("Showing the last successful list from Sep 23, 5:46 PM ET . Refresh is delayed; open a record to check its current status before acting."));
  assert.ok(markup.includes(`<time dateTime="${page.as_of}" title="Sep 23, 2026, 5:46 PM ET" aria-label="Sep 23, 2026, 5:46 PM ET"`));
});

test("A11: keyset paging: Load more on a cursor; any control change clears the cursor; the empty sentences", () => {
  const withCursor = listHtml("S2/attention__page-1.json");
  assert.ok(withCursor.includes(">Load more<"));
  assert.ok(!listHtml("S1/attention__default.json").includes(">Load more<"));
  const failed = listHtml("S2/attention__page-1.json", { loadMoreFailed: true });
  assert.ok(failed.includes("Couldn't load more. What's shown is still current."));
  for (const patch of [{ band: ["1"] }, { sort: "last_call" }, { q: "lopez" }, { priority: ["1"] }, { view: "closed" as const }, { freshness: "fresh" as const }]) {
    assert.equal(deskUrlUpdate("view=attention&cursor=abc", patch).get("cursor"), null, JSON.stringify(patch));
  }
  const empty = (view: "attention" | "all_outreach", q: string | null) =>
    text(html(createElement(OutreachListView, { view, rows: [] as AttentionRow[], asOf: "2026-09-23T21:46:37.661Z", sort: "attention", q, totalItems: 0, stale: false, hasMore: false })));
  assert.ok(empty("attention", null).includes("Nothing needs a next step in the history we can see."));
  assert.ok(empty("all_outreach", null).includes("No active Outreach matches these filters."));
  assert.ok(empty("all_outreach", "zz").includes('Nothing matches "zz".'));
  assert.ok(empty("all_outreach", "zz").includes('0 results for "zz"'));
});

test("A38: search — the hint rule, the submit rule, q sent on the three lists", () => {
  for (const short of ["1", "12", "028", " 404 ", "(40", "+1"]) assert.equal(isShortPhone(short), true, short);
  for (const long of ["1028", "404-555", "lopez", "a1", "", "5590028"]) assert.equal(isShortPhone(long), false, long);
  assert.deepEqual(searchAction("028"), { kind: "hint" });
  assert.deepEqual(searchAction("  "), { kind: "clear" });
  assert.deepEqual(searchAction(" Lopez "), { kind: "search", q: "Lopez" });
  const hinted = html(createElement(PageHeaderView, { value: "12", onChange: () => {}, onSubmit: () => {} }));
  assert.ok(hinted.includes('placeholder="Search name, Job number or phone"'));
  assert.ok(hinted.includes("Enter at least 4 digits to search by phone"));
  assert.ok(!html(createElement(PageHeaderView, { value: "1028", onChange: () => {}, onSubmit: () => {} })).includes("Enter at least 4 digits"));
  for (const view of ["attention", "all_outreach", "closed"] as const) {
    const state = parseDeskUrl(new URLSearchParams(`view=${view}&q=lopez`));
    assert.equal(attentionQuery(attentionParamsFromDesk(state, view)).get("q"), "lopez");
  }
  // Submitting from another view opens All Outreach with q.
  assert.equal(parseDeskUrl(deskUrlUpdate("view=coverage", { view: "all_outreach", q: "1028" })).view, "all_outreach");
  // The S11 search fixtures render as lists.
  const q = load("S11/attention__q-name.json");
  const markup = text(html(createElement(OutreachListView, { view: "all_outreach", rows: q.data.items, asOf: q.as_of, sort: "lead_received", q: "lopez", totalItems: q.data.total_items, stale: false, hasMore: false })));
  assert.ok(markup.includes(`${q.data.total_items} results for "lopez"`));
});

test("400 on q drops q and says so; 400 on a sort falls back to the default and says so; other errors don't", () => {
  const state = parseDeskUrl(new URLSearchParams("view=all_outreach&sort=interactions&q=lopez"));
  const requested = attentionParamsFromDesk(state, "all_outreach");
  const bad = new SalesIntelligenceError("INVALID_INPUT", 400);
  const one = nextDegrade(bad, requested, NO_DEGRADE);
  assert.equal(one.qOff, true);
  const afterQ = applyDegrade(requested, one);
  assert.equal(afterQ.q, null);
  assert.equal(afterQ.sort, "interactions");
  const two = nextDegrade(bad, afterQ, one);
  assert.deepEqual(two.badSorts, ["interactions"]);
  const afterSort = applyDegrade(requested, two);
  assert.equal(afterSort.sort, "lead_received");
  assert.equal(afterSort.direction, "desc");
  assert.deepEqual(degradeNotices(requested, two), { search: true, sort: true });
  // At the default with no q, a 400 is a real error: nothing changes.
  assert.equal(nextDegrade(bad, afterSort, two), two);
  assert.equal(nextDegrade(new SalesIntelligenceError("READ_FAILED", 500), requested, NO_DEGRADE), NO_DEGRADE);
  assert.equal(nextDegrade(null, requested, NO_DEGRADE), NO_DEGRADE);
  // Another sort is still tried.
  const other = attentionParamsFromDesk(parseDeskUrl(new URLSearchParams("view=all_outreach&sort=last_call")), "all_outreach");
  assert.equal(applyDegrade(other, two).sort, "last_call");
});

test("the active filter chips have 44 px remove buttons and Clear filters", () => {
  const state = parseDeskUrl(new URLSearchParams("view=attention&band=1&newer_call=true"));
  const chips = activeFilterChips(state, outreachRegions("attention"), [], {});
  const markup = html(createElement(ActiveChips, { chips, onClearAll: () => {} }));
  assert.ok(markup.includes('aria-label="Remove filter: Newer call since assessment"'));
  assert.ok(markup.includes(">Clear filters<"));
  assert.equal(html(createElement(ActiveChips, { chips: [], onClearAll: () => {} })), "");
});

test("trap 5: legacyDeepLinkRedirect", () => {
  assert.equal(legacyDeepLinkRedirect(new URLSearchParams("view=attention&outreach=o1&panel=assessment")), "/sales-intelligence/outreach/o1#scores");
  assert.equal(legacyDeepLinkRedirect(new URLSearchParams("outreach=o1&panel=analysis&analysis_run=r9")), "/sales-intelligence/outreach/o1?run=r9#full-output");
  assert.equal(legacyDeepLinkRedirect({ outreach: "o1", panel: "analysis" }), "/sales-intelligence/outreach/o1#full-output");
  assert.equal(legacyDeepLinkRedirect({ outreach: "o1", panel: "activity" }), "/sales-intelligence/outreach/o1?tab=timeline");
  assert.equal(legacyDeepLinkRedirect({ outreach: "o1", panel: "work" }), "/sales-intelligence/outreach/o1?tab=work");
  assert.equal(legacyDeepLinkRedirect({ outreach: "o1", panel: "summary" }), "/sales-intelligence/outreach/o1");
  assert.equal(legacyDeepLinkRedirect({ outreach: ["o1", "o2"], panel: "assessment", si_return: "/sales-intelligence?view=closed" }),
    "/sales-intelligence/outreach/o1?si_return=%2Fsales-intelligence%3Fview%3Dclosed#scores");
  assert.equal(legacyDeepLinkRedirect({ outreach: "o1", panel: "assessment", si_return: "https://evil.example" }), "/sales-intelligence/outreach/o1#scores");
  // No outreach → null (a Lead-only link resolves in the browser); outreach without panel → the desk's side dialog.
  assert.equal(legacyDeepLinkRedirect(new URLSearchParams("view=attention&lead=l1&lead_model=FormLead&panel=assessment")), null);
  assert.equal(legacyDeepLinkRedirect(new URLSearchParams("view=attention&outreach=o1")), null);
  assert.equal(legacyDeepLinkRedirect({}), null);
});
