import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { overviewSchema, type Overview } from "../../lib/api/salesIntelligence";
import { OverviewView, overviewLinks, repMedianRows } from "../../components/sales-intelligence/overview";
import { ViewerProvider, viewerFromSession, OWNER_VIEWER } from "../../components/sales-intelligence/rep/viewer";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI2-OVERVIEW (UI-2 §6, E23; UI2-A08): the rep's Overview. Only the rep's own row, next to the anonymous team median. No DOM.

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const o = copy.ui2.overview;
const noop = () => {};

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const MANIFEST = ifFixtures(() => read("S8/_seed-manifest.json"));
const repDefault = ifFixtures(() => overviewSchema.parse(read("S8/rep-overview__default.json")).data);
const otherParam = ifFixtures(() => overviewSchema.parse(read("S8/rep-overview__param-agent-other-rep.json")).data);
/** Every median null: fewer than 4 contributing reps (V-T3 M9). */
const allNull = ifFixtures(() => ({ ...repDefault, team_medians: Object.fromEntries(Object.entries(repDefault.team_medians!).map(([key, value]) => [key, key === "reps" ? value : null])) }) as Overview);
/** Every median set. */
const allSet = ifFixtures(() => ({ ...repDefault, team_medians: Object.fromEntries(Object.entries(repDefault.team_medians!).map(([key, value]) => [key, value ?? 0.25])) }) as Overview);

const view = (data: Overview | null, viewer = DANA) => decode(renderToStaticMarkup(createElement(ViewerProvider, { viewer } as Parameters<typeof ViewerProvider>[0], createElement(OverviewView, {
  data, period: { period: null, from: null, to: null }, preset: { priority: data?.filters.priority ?? [], attachment: null }, onPeriod: noop, onPreset: noop,
}) as ReactElement)));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
const otherAgents = () => Object.entries(MANIFEST.agents as Record<string, string>).filter(([, id]) => id !== DANA.agentId);
const medianCells = (html: string) => [...html.matchAll(/<td data-col="median"[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]!);
const youCells = (html: string) => [...html.matchAll(/<td data-col="you"[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]!);

function assertRepOnly(html: string) {
  for (const [name, id] of otherAgents()) {
    assert.ok(!html.includes(name), `no ${name}`);
    assert.ok(!html.includes(id), `no ${id}`);
  }
  for (const href of hrefs(html)) {
    assert.ok(!/agent_id=|unassigned=|view=(reps|coverage|numbers|messages)/.test(href), href);
  }
  assert.ok(!html.includes('data-row="unmapped"') && !html.includes('data-row="unassigned"') && !html.includes('data-card="unassigned"'), "no Unmapped / Unassigned rows");
  assert.ok(!html.includes('data-now="unassigned"'), "no Unassigned tile");
  assert.ok(!html.includes("si-ovreps__table"), "no Reps table");
}

fixtureTest("A08: the rep Overview is You | Team median for each Reps metric, with the team size and the null note", () => {
  const html = view(repDefault);
  const plain = text(html);
  for (const title of [o.nowTitle, o.healthTitle, o.title, o.spendTitle]) assert.ok(plain.includes(title), title);
  assert.ok(plain.includes(o.you) && plain.includes(o.teamMedian) && plain.includes(o.metric));
  const labels = [...html.matchAll(/<tr data-metric="[a-zA-Z]+"><th scope="row">([^<]+)<\/th>/g)].map((m) => m[1]);
  const c = copy.ui1.overview.reps.columns;
  assert.deepEqual(labels, [c.open, c.overdue, c.attempts, c.conversations, c.talk, c.attemptRate, c.bookingRate, c.spend, c.costPerBooking]);
  const me = repDefault.reps[0]!;
  assert.equal(me.agent.id, DANA.agentId);
  assert.deepEqual(youCells(html).slice(0, 2), [String(me.open_assignments.open), String(me.open_assignments.overdue)]);
  const tm = repDefault.team_medians!;
  assert.equal(medianCells(html)[0], String(tm.open));
  // attempt_conversation_rate and cost_per_booking are null in the fixture: `—` and the note.
  assert.equal(medianCells(html)[5], copy.ui1.overview.dash);
  assert.equal(medianCells(html)[8], copy.ui1.overview.dash);
  assert.ok(plain.includes(o.mediansNote));
  assert.ok(plain.includes(o.teamSize(tm.reps!)), "Team of {n} reps");
  assert.ok(html.includes('data-viewer="rep"'));
  assertRepOnly(html);
});

fixtureTest("A08: every median null (fewer than 4 contributing reps) prints `—` in each median with the note; all set, no note", () => {
  const nulls = view(allNull);
  assert.ok(medianCells(nulls).every((cell) => cell === copy.ui1.overview.dash) && medianCells(nulls).length === 9);
  assert.ok(text(nulls).includes(o.mediansNote));
  assert.ok(text(nulls).includes(o.teamSize(allNull.team_medians!.reps!)));
  assertRepOnly(nulls);
  const set = view(allSet);
  assert.ok(!text(set).includes(o.mediansNote));
  assert.ok(medianCells(set).every((cell) => cell !== copy.ui1.overview.dash));
  assert.equal(repMedianRows(allSet).mediansNote, false);
  assert.equal(repMedianRows({ ...repDefault, team_medians: null } as Overview).mediansNote, true, "no medians object at all");
  const none = repMedianRows({ ...repDefault, reps: [] } as Overview);
  assert.equal(none.noActivity, true);
  assert.ok(none.rows.every((row) => row.you === copy.ui1.overview.dash));
});

fixtureTest("A08: an `agent_id` param for another rep is ignored by the server; the page still shows only Dana", () => {
  assert.equal(otherParam.scope?.agent_id, DANA.agentId);
  assert.deepEqual(otherParam.reps.map((r) => r.agent.id), [DANA.agentId]);
  const html = view(otherParam);
  assertRepOnly(html);
  assert.deepEqual(youCells(html), youCells(view(repDefault)));
});

fixtureTest("A08: the rep's links carry no scope and open no Owner-only view; the Owner's are unchanged", () => {
  const links = overviewLinks({ priority: ["1"], attachment: null, agentId: DANA.agentId, rep: true });
  const period = { from_day: "2026-09-01", to_day: "2026-09-24" };
  const all = [links.band(2), links.needsReview(), links.unassigned(), links.liveCalls(), links.overdueNow(), links.coverage(), links.rep(DANA.agentId!), links.accounts(), links.closed("booked", period)!, links.closed("moved_to_quoted", period)!, links.flowIn(period), links.repOverdue(DANA.agentId!)];
  for (const href of all) assert.ok(!/agent_id=|unassigned=|view=(reps|coverage)/.test(href), href);
  assert.equal(links.band(2), "/sales-intelligence?view=all_outreach&band=2&priority=1");
  const owner = overviewLinks({ priority: ["1"], attachment: null, agentId: DANA.agentId });
  assert.match(owner.band(2), /agent_id=/);
  assert.equal(owner.accounts(), "/sales-intelligence?view=reps");
  // The Owner's Overview still has the Reps table and the Unassigned tile.
  const ownerHtml = view(overviewSchema.parse(read("S9/overview__default.json")).data, OWNER_VIEWER);
  assert.ok(ownerHtml.includes("si-ovreps__table") && ownerHtml.includes('data-now="unassigned"'));
  assert.ok(!ownerHtml.includes("si-ovmedians"));
});
