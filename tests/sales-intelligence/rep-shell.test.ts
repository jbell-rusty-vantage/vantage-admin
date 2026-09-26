import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ViewTabs, viewTabs } from "../../components/sales-intelligence/desk/view-tabs";
import { railRegionsFor as regionsFor } from "../../components/sales-intelligence/rail";
import { attentionParamsFromDesk, deskUrlUpdate, parseDeskUrl, serializeDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { attentionQuery } from "../../components/sales-intelligence/data/requests";
import { OutreachNotFound } from "../../components/sales-intelligence/outreach/page-states";
import { RepGuide } from "../../components/sales-intelligence/rep/rep-guide";
import { ViewerProvider, viewerFromSession, OWNER_VIEWER } from "../../components/sales-intelligence/rep/viewer";
import { LiveIndicatorDetails } from "../../components/sales-intelligence/primitives/live-indicator";

// UI2-SHELL (UI-2 §1–§2; UI2-A01–A03): the rep's routing, view bar, rail regions, not-available page and Guide. No DOM.

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const html = (el: ReactElement) => decode(renderToStaticMarkup(el));
const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const asRep = (el: ReactElement) => createElement(ViewerProvider, { viewer: DANA } as Parameters<typeof ViewerProvider>[0], el);
/** Every Owner-only destination a rep page must never link to (A03, A04; SERVER-STATE "Rep shell" note). */
const OWNER_ONLY_HREF = /href="[^"]*(view=(reps|coverage|numbers|messages)|\/legacy|\/analysis-runs\/|\/assessments\/|\/findings|#full-output|\/operations-registry|agent_id=|unassigned=)/;

test("viewerFromSession: a rep carries its Agent; anything else is the Owner", () => {
  assert.deepEqual(DANA, { role: "rep", agentId: "6ab5ab0d72ee2eb383d940a7", agentName: null });
  assert.deepEqual(viewerFromSession({ role: "owner" }), OWNER_VIEWER);
  assert.deepEqual(viewerFromSession({ role: "admin", agent_id: "x" }), OWNER_VIEWER);
});

test("A01: a rep lands on My work (no view) and its bar is My work · All my Outreach · Closed · Overview · Guide", () => {
  assert.equal(parseDeskUrl(new URLSearchParams(""), "rep").view, "attention");
  const tabs = viewTabs("", "rep");
  assert.deepEqual(tabs.map((t) => t.label), ["My work", "All my Outreach", "Closed", "Overview", "Guide"]);
  assert.deepEqual(tabs.map((t) => t.href), [
    "/sales-intelligence",
    "/sales-intelligence?view=all_outreach",
    "/sales-intelligence?view=closed",
    "/sales-intelligence?view=overview",
    "/sales-intelligence?view=guide",
  ]);
  // The Owner is unchanged: Overview is the default, and `view=attention` opens All Outreach (UX-C1) for the Owner only.
  assert.equal(parseDeskUrl(new URLSearchParams("")).view, "overview");
  assert.equal(parseDeskUrl(new URLSearchParams("view=attention")).view, "all_outreach");
  assert.equal(parseDeskUrl(new URLSearchParams("view=attention"), "rep").view, "attention");
});

test("A03: no Numbers, Messages, Accounts or Coverage tab for a rep; those views read as My work", () => {
  const markup = html(createElement(ViewTabs, { active: "attention", query: "", role: "rep" }));
  assert.ok(!/Numbers|Messages|RingCentral Accounts|Coverage|Needs Attention/.test(markup), markup);
  for (const view of ["reps", "coverage", "numbers", "messages", "bogus"]) {
    assert.equal(parseDeskUrl(new URLSearchParams(`view=${view}`), "rep").view, "attention", view);
  }
});

test("UI-2 §1: a rep's page never sends agent_id or unassigned, even when the address carries them", () => {
  const state = parseDeskUrl(new URLSearchParams("view=all_outreach&agent_id=6ab5ab0d72ee2eb383d940a8&unassigned=true&band=2"), "rep");
  assert.deepEqual(state.agent_id, []);
  assert.equal(state.unassigned, false);
  const query = attentionQuery(attentionParamsFromDesk(state, "all_outreach")).toString();
  assert.ok(!/agent_id|unassigned/.test(query), query);
  assert.match(query, /band=2/);
  const next = deskUrlUpdate("view=closed&agent_id=x&unassigned=true", { agent_id: ["y"], unassigned: true, band: ["1"] }, "rep");
  assert.equal(next.has("agent_id"), false);
  assert.equal(next.has("unassigned"), false);
  assert.ok(!/agent_id|unassigned/.test(serializeDeskUrl({ ...state, agent_id: ["z"], unassigned: true }, "rep").toString()));
  // A view link keeps the shared selection and writes My work as no view.
  assert.equal(deskUrlUpdate("view=closed&priority=1", { view: "attention" }, "rep").toString(), "priority=1");
});

test("UI-2 §3: a rep's rail has no Rep region (Band · Status · Analysis · Time; Outcome · Time closed)", () => {
  assert.deepEqual(regionsFor("attention", true).map((r) => r.id), ["band", "status", "analysis", "time"]);
  assert.deepEqual(regionsFor("all_outreach", true).map((r) => r.id), ["band", "status", "analysis", "time"]);
  assert.deepEqual(regionsFor("closed", true).map((r) => r.id), ["outcome", "closed_time"]);
  assert.deepEqual(regionsFor("attention").map((r) => r.id), ["band", "status", "rep", "analysis", "time"]);
});

test("A02: the rep's not-available page (out of scope or missing: the same 404) links back to My work", () => {
  const rep = html(asRep(createElement(OutreachNotFound, { back: "/sales-intelligence?view=all_outreach" })));
  assert.match(rep, /This record isn't available\./);
  assert.match(rep, /It isn't in your work, or it doesn't exist\./);
  assert.match(rep, /href="\/sales-intelligence">.*Back to My work/);
  const owner = html(createElement(OutreachNotFound, { back: "/sales-intelligence?view=all_outreach" }));
  assert.match(owner, /This Outreach doesn't exist or was removed\./);
});

test("A03: the rep Guide explains the views, bands and follow-ups, and links nowhere Owner-only", () => {
  const markup = html(createElement(RepGuide, { topic: null }));
  for (const words of ["My work", "All my Outreach", "Your follow-ups", "The Owner sees your changes", "Messages from the Owner", "Band 1", "60 days"]) {
    assert.ok(markup.includes(words) || markup.includes(words.replace("Band 1", "1 · ")), words);
  }
  assert.doesNotMatch(markup, OWNER_ONLY_HREF);
});

test("A03: the live indicator's tooltip drops the Coverage link when the page passes none (a rep)", () => {
  assert.doesNotMatch(html(createElement(LiveIndicatorDetails, { health: null, asOf: "2026-09-25T21:39:58.722Z", coverageHref: null })), /view=coverage/);
  assert.match(html(createElement(LiveIndicatorDetails, { health: null, asOf: "2026-09-25T21:39:58.722Z", coverageHref: "/sales-intelligence?view=coverage" })), /view=coverage/);
});

test("UI2: the Owner's `by you` words read as the Owner's to a rep", async () => {
  const { outcomeWord } = await import("../../components/sales-intelligence/card/outcome-line");
  const { workResultText } = await import("../../components/sales-intelligence/outreach/analysis/findings");
  const { activeFilterChips, closedRegions } = await import("../../components/sales-intelligence/rail");
  assert.equal(outcomeWord("owner"), "Closed by you");
  assert.equal(outcomeWord("owner", true), "Closed by the Owner");
  assert.equal(workResultText({ work_result: "retracted", work_result_detail: null } as never, true), "Retracted by the Owner");
  assert.equal(workResultText({ work_result: "retracted", work_result_detail: null } as never), "Retracted by you");
  const value = parseDeskUrl(new URLSearchParams("view=closed&outcome=owner"), "rep");
  assert.equal(activeFilterChips(value, closedRegions(), [], { rep: true })[0]?.label, "Closed by the Owner");
});

test("gate: a rep's My work opens in Attention order; every other view and the Owner keep Lead received", async () => {
  const { effectiveSort } = await import("../../components/sales-intelligence/data/url-state");
  assert.equal(effectiveSort("attention", null, "rep").sort, "attention");
  assert.equal(attentionParamsFromDesk(parseDeskUrl(new URLSearchParams(""), "rep"), "attention", "rep").sort, "attention");
  assert.equal(effectiveSort("all_outreach", null, "rep").sort, "lead_received");
  assert.equal(effectiveSort("attention", null).sort, "lead_received");
  assert.equal(effectiveSort("attention", "last_call", "rep").sort, "last_call");
});

test("gate: the Overview's preset bar hides the Lead toggle and states the limitation", async () => {
  const { PresetBar } = await import("../../components/sales-intelligence/desk/preset-bar");
  const hidden = html(createElement(PresetBar, { counts: null, view: "overview", value: { priority: [], attachment: null }, onChange: () => {}, hideLead: true }));
  assert.doesNotMatch(hidden, /data-lead-btn/);
  const shown = html(createElement(PresetBar, { counts: null, view: "all_outreach", value: { priority: [], attachment: null }, onChange: () => {} }));
  assert.match(shown, /data-lead-btn/);
});

test("V-UI2 fixes: the Owner's actor reads `Owner` to a rep; a follow-up another rep promised says so", async () => {
  const { actorText } = await import("../../components/sales-intelligence/timeline/event-row");
  const { repFollowupAccess } = await import("../../components/sales-intelligence/rep/followup-actions");
  const item = { actor: { kind: "owner", name: null } } as never;
  assert.equal(actorText(item), "You");
  assert.equal(actorText(item, true), "Owner");
  const f = { status: "open", assignment: { agent: null }, promised_by: { id: "6ab5ab0d72ee2eb383d940a8", name: "Marcus Bell" }, allowed_actions: [] } as never;
  assert.equal(repFollowupAccess(f, DANA).readOnly, "Marcus Bell promised this one. Ask the Owner to change it.");
});
