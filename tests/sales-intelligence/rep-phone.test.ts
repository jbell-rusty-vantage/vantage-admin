import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, conversationsSchema, outreachReadSchema, transcriptSchema } from "../../lib/api/salesIntelligence";
import { outreachAssessmentReadSchema, runPresentationReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import { currentFindingsSchema } from "../../lib/api/salesIntelligenceAnalysis";
import { OutreachCard } from "../../components/sales-intelligence/card";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { OutreachPageFrame, outreachTabs } from "../../components/sales-intelligence/outreach";
import { AnalysisTab, TranscriptView } from "../../components/sales-intelligence/outreach/analysis";
import { TranscriptSeekContext } from "../../components/sales-intelligence/outreach/analysis/transcript";
import { JumpSelect, Sheet } from "../../components/sales-intelligence/primitives";
import { FilterSheet, outreachRegions } from "../../components/sales-intelligence/rail";
import { parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { ViewerProvider, viewerFromSession } from "../../components/sales-intelligence/rep/viewer";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI2-PHONE (UI-2 §7; UI2-A11): render hooks for the 390 px layout. The 44 px targets and the scroll width are the
// coordinator's browser pass (selectors in evidence/UI2-PHONE.md); these tests pin the markup and the CSS rules.

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const ph = copy.ui2.phone;
const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const asRep = (el: ReactElement) => createElement(ViewerProvider, { viewer: DANA } as Parameters<typeof ViewerProvider>[0], el);
const html = (el: ReactElement) => decode(renderToStaticMarkup(el));
const css = fs.readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");
const phoneBlock = css.slice(css.indexOf("/* UI-2: UI2-PHONE"));

const detail = ifFixtures(() => outreachReadSchema.parse(read("S8/rep-outreach__s-findings.json")));

fixtureTest("the analysis sub-nav has a `Jump to` select with the same sections (a rep's has no Full output)", () => {
  const o = detail.data.outreach;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(siKeys.outreach(o.id), detail);
  client.setQueryData(siKeys.assessment(o.id), outreachAssessmentReadSchema.parse(read("S8/rep-outreach-assessment__s-findings.json")));
  client.setQueryData(siKeys.analysisPresentation(o.newest_run_id!), runPresentationReadSchema.parse(read("S12/rep-run-presentation__s-findings-newest.json")));
  client.setQueryData(siKeys.findings(o.id, false), currentFindingsSchema.parse(read("S8/rep-outreach-findings__s-findings.json")));
  client.setQueryData(siKeys.conversations(o.primary_number!.id), { pages: [conversationsSchema.parse(read("S8/rep-number-conversations__s-findings.json"))], pageParams: [null] });
  const markup = html(createElement(QueryClientProvider, { client }, asRep(createElement(AnalysisTab, { outreachId: o.id, role: "rep", cardLines: false }))));
  const jump = markup.slice(markup.indexOf('class="si-jump si-analysis__jump"'), markup.indexOf("</select>"));
  assert.ok(jump.includes(`>${ph.jumpTo}</label>`));
  assert.deepEqual([...jump.matchAll(/<option value="([a-z-]+)"/g)].map((m) => m[1]), ["situation", "scores", "move-details", "findings", "conversations"]);
  assert.ok(markup.includes('class="si-subnav si-analysis__subnav"'), "the link row stays for desktop");
});

test("JumpSelect: a labelled select (44 px in CSS) whose options are the anchors", () => {
  const markup = html(createElement(JumpSelect, { items: [{ id: "a", label: "A" }, { id: "b", label: "B" }], label: ph.jumpTo, className: "x" }));
  assert.match(markup, /<div class="si-jump x"><label for="([^"]+)" class="si-jump__label">Jump to<\/label><select id="\1" class="si-input si-select si-jump__select">/);
  assert.ok(markup.includes('<option value="a" selected="">A</option><option value="b">B</option>'));
});

test("the record page's tabs carry the sticky hook", () => {
  const markup = html(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(OutreachPageFrame, { back: "/sales-intelligence", header: null, tabs: outreachTabs("x", null), active: "work" })));
  assert.ok(markup.includes('class="si-tabs si-routetabs si-outreach__tabs"'));
});

test("the rail's Filters button opens a bottom sheet with Clear all (off with no filters) and Show results", () => {
  const empty = parseDeskUrl(new URLSearchParams("view=all_outreach"), "rep");
  const none = html(createElement(FilterSheet, { regions: outreachRegions("all_outreach"), value: empty, onChange: () => {}, reps: [], asOf: null, alwaysShown: true }));
  assert.ok(none.includes('data-sheet="bottom"') && none.includes(`>${ph.filtersTitle}</h2>`));
  assert.match(none, /<button type="button" class="[^"]*" data-action="clear-all" disabled="">Clear all<\/button>/);
  assert.ok(none.includes(`data-action="show-results">${ph.showResults}</button>`));
  assert.match(none, /<\/svg>Filters<\/button>/, "`Filters` with nothing selected");
  const two = parseDeskUrl(new URLSearchParams("view=all_outreach&band=2&has_recording=true"), "rep");
  const some = html(createElement(FilterSheet, { regions: outreachRegions("all_outreach"), value: two, onChange: () => {}, reps: [], asOf: null, alwaysShown: true }));
  assert.match(some, /<\/svg>Filters \(2\)<\/button>/);
  assert.doesNotMatch(some, /data-action="clear-all" disabled=""/);
});

test("Sheet: full-screen and bottom variants, a labelled dialog with a 44 px close; inline for the gallery", () => {
  const full = html(createElement(Sheet, { open: false, onClose: () => {}, title: "T", variant: "full", footer: "foot" }, "body"));
  assert.match(full, /^<dialog class="si-root si-sheet si-sheet--full" aria-labelledby="([^"]+)" data-sheet="full"><div class="si-sheet__frame"><header class="si-sheet__head"><h2 id="\1"/);
  assert.ok(full.includes('class="si-btn si-btn--ghost si-iconbtn--hit si-sheet__close" aria-label="Close"'));
  assert.ok(full.includes('<footer class="si-sheet__foot">foot</footer>'));
  const inline = html(createElement(Sheet, { open: true, onClose: () => {}, title: "T", variant: "bottom", inline: true }, "b"));
  assert.ok(inline.startsWith('<div role="dialog"') && inline.includes("si-sheet is-inline si-sheet--bottom"));
});

fixtureTest("the rep card's two actions carry the full-width hook", () => {
  const a = attentionSchema.parse(read("S8/rep-attention__all-outreach.json"));
  const markup = html(asRep(createElement(OutreachCard, { row: a.data.items[0]!, asOf: a.as_of, layout: "flat", view: "all_outreach" })));
  assert.equal((markup.match(/si-card__repaction/g) ?? []).length, 2);
});

fixtureTest("transcript segments become 44 px buttons that play the recording from their offset, only with a player", () => {
  const d = transcriptSchema.parse(read("S8/rep-conversation-transcript__s-findings-c1.json")).data;
  const props = { conversationId: d.conversation_id, segments: d.segments, available: d.available, missingRanges: d.completeness.missing_ranges, hasMore: false };
  const timed = d.segments.filter((s) => s.start_ms != null);
  assert.ok(timed.length > 0);
  const withPlayer = html(createElement(TranscriptSeekContext.Provider, { value: () => {} }, createElement(TranscriptView, props)));
  assert.equal((withPlayer.match(/class="si-transcript__seek si-hit"/g) ?? []).length, timed.length);
  assert.ok(withPlayer.includes(`data-seek-ms="${timed[0]!.start_ms}"`));
  assert.ok(withPlayer.includes('aria-label="Play the recording from '));
  const without = html(createElement(TranscriptView, props));
  assert.ok(!without.includes("si-transcript__seek"));
});

test("CSS (UI2-PHONE): full-screen sheet ≤ 480 px, bottom sheet and one-row preset bar ≤ 767 px, sticky tabs, Jump to", () => {
  assert.ok(phoneBlock.length > 0);
  const media480 = phoneBlock.slice(phoneBlock.indexOf("@media (max-width: 480px)"));
  assert.match(media480, /\.si-sheet--full:not\(\.is-inline\) \{ width: 100vw; height: 100dvh;/);
  const media767 = phoneBlock.slice(phoneBlock.indexOf("@media (max-width: 767px)"));
  assert.match(media767, /\.si-sheet--bottom:not\(\.is-inline\) \{ width: 100vw;[^}]*margin: auto 0 0;/);
  assert.match(media767, /\.si-presetbar \{ flex-wrap: nowrap; overflow-x: auto;/);
  assert.match(media767, /\.si-outreach__tabs \{ position: sticky; top: 0;/);
  assert.match(media767, /\.si-analysis__subnav \{ display: none; \}/);
  assert.match(media767, /\.si-jump\.si-analysis__jump \{ display: flex;/);
  assert.match(phoneBlock, /\.si-jump \{ display: none;/);
  assert.match(phoneBlock, /\.si-sheet \.si-check \{ min-height: var\(--si-hit\); \}/);
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(css.slice(css.indexOf("/* UI-2: UI2-SCOPE"))), "tokens only in the UI-2 blocks");
});
