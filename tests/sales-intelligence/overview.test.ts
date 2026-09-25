import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SalesIntelligenceError, overviewSchema, type Overview } from "../../lib/api/salesIntelligence";
import {
  OverviewView, OverviewSkeleton, isFeatureOff, keptLine, nextSort, overviewLinks, periodLabel, periodPatch, returnedLine, sortReps, sourceLine, speedLine,
  type OverviewPeriodState,
} from "../../components/sales-intelligence/overview";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI1-OVERVIEW: the Overview rendered from every S9 overview fixture (UI1-A16–A19), the flag-off empties, and the
// period picker's split default. No DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const load = (rel: string): Overview => overviewSchema.parse(readJson(rel)).data;

const FILES = ifFixtures(() => fs.readdirSync(path.join(CONTRACTS, "S9")).filter((f) => /^overview__.+\.json$/.test(f)).sort());
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const o = copy.ui1.overview;
const noop = () => {};

/** The URL each fixture was captured with: the split default has no `period`; the others name theirs. */
function urlPeriod(file: string, data: Overview): OverviewPeriodState {
  if (file === "overview__default.json" || file === "overview__owner-one-rep-scope.json") return { period: null, from: null, to: null };
  const a = data.periods.activity;
  return a.key === "custom" ? { period: "custom", from: a.from_day, to: a.to_day } : { period: a.key, from: null, to: null };
}
function render(file: string, attachment: "lead" | "none" | null = null) {
  const data = load(`S9/${file}`);
  const html = renderToStaticMarkup(createElement(OverviewView, {
    data, period: urlPeriod(file, data), preset: { priority: data.filters.priority ?? [], attachment }, onPeriod: noop, onPreset: noop,
  }));
  return { data, html, plain: text(html) };
}
/** `href` of the first element carrying `attr`. */
function hrefOf(html: string, attr: string): string | null {
  const at = html.indexOf(attr);
  if (at < 0) return null;
  const open = html.lastIndexOf("<", at);
  const tag = html.slice(open, html.indexOf(">", at) + 1);
  const m = /href="([^"]*)"/.exec(tag);
  return m ? decode(m[1]) : null;
}
/** The rendered count inside the element carrying `attr`. */
function tileCount(html: string, attr: string): string | null {
  const at = html.indexOf(attr);
  if (at < 0) return null;
  const m = /class="si-ovtile__count">([^<]*)</.exec(html.slice(at));
  return m ? decode(m[1]) : null;
}
const presetQuery = (priority: readonly string[]) => priority.map((p) => `&priority=${encodeURIComponent(p)}`).join("");

fixtureTest("every S9 overview fixture parses and renders the four blocks in order", () => {
  assert.ok(FILES.length >= 9, `found ${FILES.join(", ")}`);
  for (const file of FILES) {
    const { html, plain } = render(file);
    let last = -1;
    for (const title of [o.now.title, o.desk.title, o.reps.title, o.spend.title]) {
      const at = html.indexOf(`>${title}</h2>`);
      assert.ok(at > last, `${file}: ${title} missing or out of order`);
      last = at;
    }
    assert.ok(plain.includes(o.period.note), `${file}: Priority note`);
  }
});

fixtureTest("A16: each band tile shows now.bands[n] and links to Needs Attention band=n with the same preset", () => {
  for (const file of FILES) {
    const { data, html } = render(file);
    const priority = data.filters.priority ?? [];
    const agent = data.scope?.agent_id ? `&agent_id=${data.scope.agent_id}` : "";
    for (let band = 1; band <= 7; band += 1) {
      const expected = `/sales-intelligence?view=attention&band=${band}${agent}${presetQuery(priority)}`;
      assert.equal(hrefOf(html, `data-band="${band}"`), expected, `${file} band ${band} href`);
      assert.equal(tileCount(html, `data-band="${band}"`), String(data.now.bands[String(band)]), `${file} band ${band} count`);
    }
  }
  // Same snapshot, no preset: the Needs Attention list's rows per band equal the Overview tiles (C8).
  const attention = readJson("S9/attention__default.json").data;
  const overview = load("S9/overview__default.json");
  assert.equal(attention.snapshot_id, overview.snapshot_id);
  assert.equal(attention.items.length, attention.total_items, "the fixture holds the whole list");
  const rows: Record<string, number> = {};
  for (const item of attention.items) {
    const band = item.derived.attention_band;
    if (band != null) rows[band] = (rows[band] ?? 0) + 1;
  }
  for (let band = 1; band <= 7; band += 1) assert.equal(overview.now.bands[String(band)], rows[band] ?? 0, `band ${band}: list ${rows[band] ?? 0}`);
});

fixtureTest("A17: every number with a list behind it links to that filtered list, carrying the preset", () => {
  for (const file of FILES) {
    const { data, html } = render(file, "lead");
    const priority = data.filters.priority ?? [];
    const p = presetQuery(priority);
    const agent = data.scope?.agent_id ? `&agent_id=${data.scope.agent_id}` : "";
    assert.equal(hrefOf(html, 'data-now="needs_review"'), `/sales-intelligence?view=attention${agent}${p}&needs_review=true&attachment=lead`, `${file} needs review`);
    assert.equal(hrefOf(html, 'data-now="unassigned"'), `/sales-intelligence?view=all_outreach${p}&unassigned=true&attachment=lead`, `${file} unassigned`);
    assert.equal(hrefOf(html, 'data-now="live_calls"'), `/sales-intelligence?view=all_outreach&sort=last_call${agent}${p}&attachment=lead`, `${file} live calls`);
    assert.ok(html.includes('href="/sales-intelligence?view=coverage"'), `${file} capture → Coverage`);
    assert.equal(tileCount(html, 'data-now="needs_review"'), String(data.now.needs_review));
    assert.equal(tileCount(html, 'data-now="unassigned"'), String(data.now.unassigned));
    assert.equal(tileCount(html, 'data-now="live_calls"'), String(data.now.live_calls));
    for (const rep of data.reps) {
      assert.equal(hrefOf(html, `data-rep-link="${rep.agent.id}"`), `/sales-intelligence?view=all_outreach&agent_id=${rep.agent.id}${p}&attachment=lead`, `${file} rep ${rep.agent.name}`);
    }
    if (data.unmapped) assert.equal(hrefOf(html, 'data-rep-link="unmapped"'), "/sales-intelligence?view=reps", `${file} unmapped → RingCentral Accounts`);
    else assert.ok(!html.includes('data-row="unmapped"'), `${file} unmapped: null hides the row`);
    if (data.unassigned) assert.equal(hrefOf(html, 'data-rep-link="unassigned"'), `/sales-intelligence?view=all_outreach${p}&unassigned=true&attachment=lead`);
    else assert.ok(!html.includes('data-row="unassigned"'), `${file} unassigned: null hides the row`);
    const overdue = data.desk.callbacks_kept.overdue_now;
    const overdueHref = hrefOf(html, 'data-desk="overdue_now"');
    const inner = html.slice(html.indexOf('data-desk="overdue_now"'), html.indexOf('data-desk="overdue_now"') + 400);
    if (overdue > 0) assert.ok(inner.includes(`href="/sales-intelligence?view=attention&amp;band=1${agent.replace(/&/g, "&amp;")}${p.replace(/&/g, "&amp;")}`), `${file} overdue now → Band 1`);
    else assert.equal(overdueHref, null);
    const { from_day, to_day } = data.periods.activity;
    assert.ok(decode(html).includes("outcome=granot_booked"), `${file} Booked in Granot → Closed`);
    assert.ok(decode(html).includes(`&closed_from=${from_day}&closed_to=${to_day}`), `${file} closed links carry the activity period`);
  }
  const links = overviewLinks({ priority: ["0", "not_set"], attachment: null });
  assert.equal(links.closed("crm_bad_dead", { from_day: "2026-09-18", to_day: "2026-09-24" }),
    "/sales-intelligence?view=closed&priority=0&priority=not_set&outcome=crm_dead&outcome=crm_bad_unusable&closed_from=2026-09-18&closed_to=2026-09-24");
  // FIX-UI1 (m5): Moved to Quoted, Flow In and the rep table's Open/Overdue cells link to their lists.
  const period = { from_day: "2026-09-18", to_day: "2026-09-24" };
  const q = (href: string | null) => new URL(href!, "http://x").searchParams;
  const quoted = q(links.closed("moved_to_quoted", period));
  assert.equal(quoted.get("view"), "all_outreach");
  assert.deepEqual(quoted.getAll("priority"), ["1"]);
  assert.equal(quoted.get("received_from"), "2026-09-18");
  assert.equal(quoted.get("received_to"), "2026-09-24");
  const flowIn = q(links.flowIn(period));
  assert.equal(flowIn.get("view"), "all_outreach");
  assert.deepEqual(flowIn.getAll("priority"), ["0", "not_set"]);
  assert.equal(flowIn.get("received_from"), "2026-09-18");
  assert.equal(flowIn.get("received_to"), "2026-09-24");
  const overdue = q(links.repOverdue("a1"));
  assert.equal(overdue.get("view"), "all_outreach");
  assert.deepEqual(overdue.getAll("agent_id"), ["a1"]);
  assert.deepEqual(overdue.getAll("band"), ["1"]);
});

fixtureTest("A18: the split default label with the two default periods; choosing a period sets both", () => {
  const split = render("overview__default.json");
  assert.equal(split.data.periods.activity.key, "today");
  assert.equal(split.data.periods.spend.key, "last_7_days");
  assert.equal(periodLabel(split.data.periods), "Today · spend and outcomes: last 7 days");
  assert.ok(split.html.includes('<option value="" selected="">Today · spend and outcomes: last 7 days</option>'), "the split label is the selected option");
  for (const file of ["overview__today.json", "overview__last-7-days.json", "overview__custom.json", "overview__preset-new.json"]) {
    const { data, html } = render(file);
    assert.equal(data.periods.activity.key, data.periods.spend.key, `${file}: one period for both`);
    assert.ok(!html.includes('<option value=""'), `${file}: no split option once a period is chosen`);
    assert.ok(html.includes(`<option value="${data.periods.activity.key}" selected="">`), `${file}: the chosen period is selected`);
  }
  const custom = render("overview__custom.json").html;
  assert.ok(custom.includes('value="2026-09-21"') && custom.includes('value="2026-09-24"'), "Custom shows its ET days");
  assert.deepEqual(periodPatch("last_30_days"), { period: "last_30_days", from: null, to: null });
  assert.deepEqual(periodPatch("custom", { from: "2026-09-01", to: "2026-09-10" }), { period: "custom", from: "2026-09-01", to: "2026-09-10" });
  assert.deepEqual(periodPatch(""), { period: null, from: null, to: null });
  for (const key of ["today", "yesterday", "last_7_days", "this_week", "last_30_days", "this_month", "custom"]) assert.ok(split.html.includes(`<option value="${key}">`), `option ${key}`);
});

fixtureTest("A19: null metrics print —, the unpriced warning shows above 0, and the Updated time is exact", () => {
  const dash = o.dash;
  const today = render("overview__today.json");
  assert.equal(speedLine(today.data.desk.speed_to_lead), dash, "speed to lead median null");
  assert.equal(returnedLine(today.data.desk.missed_calls_returned), dash, "no missed-call episodes");
  for (const rep of today.data.reps) {
    assert.equal(rep.outcomes.booking_rate, null);
    assert.equal(rep.cost_per_booking, null);
  }
  const row = today.html.slice(today.html.indexOf('data-agent="'), today.html.indexOf("</tr>", today.html.indexOf('data-agent="')));
  assert.ok(row.includes(`data-col="bookingRate"><span data-rate="null">${dash}</span>`), "no bookings: booking rate —");
  assert.ok(row.includes(`data-cpb="null">${dash}</span>`), "no bookings: cost per booking —");
  const custom = render("overview__custom.json");
  assert.ok(custom.plain.includes(`${o.desk.missedReturned} ${dash}`), "Missed calls returned —");
  assert.ok(custom.plain.includes("Band 1: 0 in · 0 out · median — in band · 5 without a known start"), "time in band null → —");
  assert.equal(keptLine(custom.data.desk.callbacks_kept), "1 of 10 kept · 1 missed · 0 not yet due");
  assert.ok(custom.plain.includes("8 overdue now"));
  assert.ok(!custom.plain.includes(o.reps.unpriced("1")), "no unpriced Leads, no warning");

  const withUnpriced = render("overview__default.json");
  const tina = withUnpriced.data.reps.find((r) => r.spend.unpriced_leads > 0);
  assert.ok(tina, "the default fixture has a rep with an unpriced Lead");
  assert.ok(withUnpriced.html.includes(`data-unpriced="${tina.spend.unpriced_leads}"`));
  assert.ok(withUnpriced.plain.includes(o.reps.unpriced(String(tina.spend.unpriced_leads))));
  assert.ok(withUnpriced.html.includes("si-ovspend__split has-unpriced"), "the total's split flags unpriced Leads");
  const mixed = withUnpriced.data.spend.by_source.find((s) => s.unit_cpl == null)!;
  assert.equal(sourceLine(mixed), `${mixed.source} · ${mixed.leads} Leads · $${mixed.spend} (mixed rates)`);
  assert.ok(withUnpriced.plain.includes(sourceLine(mixed)));
  const priced = custom.data.spend.by_source.find((s) => s.source === "TBM Form")!;
  assert.equal(sourceLine(priced), "TBM Form · 1 × $40 = $40");

  const exact = formatExactFull(custom.data.as_of);
  assert.ok(custom.html.includes(`title="${exact}"`) && custom.html.includes(`aria-label="${o.updated} ${exact}"`), "Updated {as_of} carries the exact ET time");
});

fixtureTest("rates print as whole percentages with their counts; no score-like value prints %", () => {
  for (const file of FILES) {
    const { html, plain } = render(file);
    const percents = plain.match(/\d+%/g) ?? [];
    assert.equal((plain.match(/%/g) ?? []).length, percents.length, `${file}: every % follows a whole number`);
    assert.equal(percents.length, (html.match(/data-rate="value"/g) ?? []).length, `${file}: % only in rate cells`);
    assert.ok(!/\/ 100/.test(plain), `${file}: no score on the Overview`);
  }
  const { html } = render("overview__custom.json");
  assert.ok(html.includes('aria-label="38%, 10 of 26"'), "Dana: attempt → conversation 38% (10 of 26)");
  assert.ok(html.includes('aria-label="0%, 0 of 2"'), "Dana: booking rate 0% (0 of 2)");
  assert.ok(text(html).includes("includes 1 calls recovered by a capture repair"), "recovered_calls footnote");
  assert.ok(text(html).includes("102 · 103"), "Unmapped rep lists its extensions");
});

fixtureTest("the reps table sorts with aria-sort and 44 px header buttons; rows expand to by_source", () => {
  const data = load("S9/overview__custom.json");
  const byTalk = sortReps(data.reps, { column: "talk", direction: "desc" }).map((r) => r.interactions.talk_minutes);
  assert.deepEqual(byTalk, [...byTalk].sort((a, b) => b - a));
  const byRate = sortReps(data.reps, { column: "attemptRate", direction: "asc" });
  assert.equal(byRate.at(-1)!.interactions.attempt_conversation_rate, null, "null sorts last");
  assert.deepEqual(nextSort(null, "spend"), { column: "spend", direction: "desc" });
  assert.deepEqual(nextSort({ column: "spend", direction: "desc" }, "spend"), { column: "spend", direction: "asc" });
  assert.deepEqual(nextSort(null, "rep"), { column: "rep", direction: "asc" });
  const { html } = render("overview__custom.json");
  assert.equal((html.match(/aria-sort="none"/g) ?? []).length, 10);
  assert.equal((html.match(/class="si-ovreps__sort"/g) ?? []).length, 10);
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(text(html).includes("TBM Form · 1 × $40 = $40"), "by_source in the expansion");
  assert.ok(html.includes('class="si-ovreps__cards"') && (html.match(/data-card="rep"/g) ?? []).length === data.reps.length, "390 px: one stacked card per rep");
});

fixtureTest("flag off: FEATURE_DISABLED renders the empties (— everywhere, no links, no reps)", () => {
  const raw = readJson("S9/flag-off/overview__feature-off.json");
  const error = new SalesIntelligenceError(raw.body.code, raw.status, raw.body.request_id);
  assert.equal(isFeatureOff(error), true);
  assert.equal(isFeatureOff(new SalesIntelligenceError("READ_FAILED", 500)), false);
  const html = renderToStaticMarkup(createElement(OverviewView, { data: null, period: { period: null, from: null, to: null }, preset: { priority: [], attachment: null }, onPeriod: noop, onPreset: noop }));
  const plain = text(html);
  assert.ok(plain.includes(`${o.updated} ${o.dash}`));
  assert.ok(plain.includes(o.reps.empty));
  assert.ok(plain.includes(o.now.captureUnknown));
  for (let band = 1; band <= 7; band += 1) assert.equal(tileCount(html, `data-band="${band}"`), o.dash);
  assert.ok(!html.includes('href="/sales-intelligence?'), "no links without data");
  assert.ok(plain.includes(`${o.spend.title} ${o.dash}`));
  assert.ok(plain.includes("Today · spend and outcomes: last 7 days"), "the picker still reads the default");
});

test("skeletons render in the blocks' shape", () => {
  const html = renderToStaticMarkup(createElement(OverviewSkeleton));
  for (const block of ["si-ovnow", "si-ovdesk", "si-ovreps", "si-ovspend"]) assert.ok(html.includes(`si-ovblock ${block} is-skeleton`), block);
  assert.equal((html.match(/si-ovnow__bands/g) ?? []).length, 1);
});

test("no legacy import in the overview folder", () => {
  const dir = path.join(process.cwd(), "components/sales-intelligence/overview");
  for (const file of fs.readdirSync(dir)) assert.ok(!/_legacy/.test(fs.readFileSync(path.join(dir, file), "utf8")), file);
});
