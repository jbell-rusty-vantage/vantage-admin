import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outreachReadSchema } from "../../lib/api/salesIntelligence";
import { outreachAssessmentReadSchema, runPresentationReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import { analysisSchema } from "../../lib/api/salesIntelligenceAnalysis";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import {
  Advanced, AnalysisTab, AnalysisTabSkeleton, FromTheCalls, NextStep, Scores, Situation, SuggestedStepView, leadCostText, timelineEventHref,
} from "../../components/sales-intelligence/outreach/analysis";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { AnalysisSection, SCORE_SAMPLES } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/analysis";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-TOP: the analysis frame, Situation, Scores, the next-step strip and Advanced, rendered from the contract
// fixtures (UI1-A22, A42 render side). No DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const outreachRead = (rel: string) => outreachReadSchema.parse(read(rel));
const assessmentRead = (rel: string) => outreachAssessmentReadSchema.parse(read(rel));
const presentationRead = (rel: string) => runPresentationReadSchema.parse(read(rel));
const runRead = (rel: string) => analysisSchema.parse(read(rel));

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ");
const render = (el: ReactElement) => renderToStaticMarkup(el);

// ── Situation (§11.1, UI-1 §5.2) ─────────────────────────────────────────────────────────────────────────────

fixtureTest("Situation: the card lines, the latest-analysis label and overview, the official line with Granot Priority", () => {
  const { data, as_of } = outreachRead("S1/outreach__s-findings.json");
  const html = render(createElement(Situation, { outreach: data.outreach, asOf: as_of }));
  const t = text(html);
  assert.ok(html.includes('data-lines="1-4,6-7"'));
  assert.ok(t.includes("Latest analysis, Sep 22 · 3 conversations"), t);
  assert.ok(html.includes(`aria-label="Latest analysis, ${formatExactFull(data.outreach.latest_summary!.completed_at)} · 3 conversations"`));
  assert.ok(t.includes("Priya is moving a two bedroom apartment"));
  assert.ok(t.includes("Official: Open Lead · Granot Priority 1 (Quoted)"), t);
  assert.ok(t.includes("Next: Call Friday about the estimate"), "line 6 from the card");
  assert.ok(!t.includes("%"));
});

fixtureTest("Situation: one conversation reads `From the conversation on {date}`; no analysis at all prints the sentence", () => {
  const purged = outreachRead("S1/outreach__s-audio-purged.json");
  assert.ok(text(render(createElement(Situation, { outreach: purged.data.outreach, asOf: purged.as_of, cardLines: false }))).includes("From the conversation on Sep 12"));
  const none = outreachRead("S1/outreach__s-number-only.json");
  const html = render(createElement(Situation, { outreach: none.data.outreach, asOf: none.as_of }));
  assert.ok(text(html).includes("No analysis has run on this Number yet."));
  assert.ok(!text(html).includes("Official:"), "official: null → no line");
  assert.ok(!text(html).includes("Lead cost"), "lead_cost: null → nothing");
});

fixtureTest("Situation: Lead cost with its basis (A22); a Booked record links Open Booking", () => {
  const cases: [string, string][] = [
    ["S6/outreach__t3-spend-rate.json", "Lead cost $40"],
    ["S6/outreach__t3-spend-legacy.json", "Lead cost $35 (legacy price)"],
    ["S6/outreach__t3-spend-missing-rate.json", "Lead cost $0 (unpriced)"],
    ["S6/outreach__t3-spend-duplicate-zero.json", "Lead cost $0"],
  ];
  for (const [rel, expected] of cases) {
    const { data, as_of } = outreachRead(rel);
    const t = text(render(createElement(Situation, { outreach: data.outreach, asOf: as_of, cardLines: false })));
    assert.ok(t.includes(`Official: Open Lead · ${expected}`), `${rel}: ${t}`);
  }
  assert.equal(leadCostText(null), null);
  const booked = outreachRead("S1/outreach__s-closed-booked.json");
  const html = render(createElement(Situation, { outreach: booked.data.outreach, asOf: booked.as_of, cardLines: false }));
  assert.ok(text(html).includes("Official: Booked · Open Booking"));
  assert.ok(decode(html).includes("href=\"/bookings?record=6ab448710705ca95222b49e4&"), "Open Booking points at the official Booking");
});

fixtureTest("Situation: `Records disputed on a call ({n})` with View evidence and Show in timeline", () => {
  const { data, as_of } = outreachRead("S1/outreach__s-findings.json");
  const pres = presentationRead("S3/run-presentation__s-findings-run3.json");
  const items = pres.data.summary_findings.story_discrepancies;
  const html = render(createElement(Situation, { outreach: data.outreach, asOf: as_of, discrepancies: items, cardLines: false }));
  const t = text(html);
  assert.ok(t.includes("Records disputed on a call (1)"));
  assert.ok(t.includes("Customer says the confirmation text never arrived."));
  assert.ok(t.includes("View evidence (2)"));
  assert.ok(decode(html).includes(`href="${timelineEventHref(data.outreach.id, "lead_message_sent:6ab448740705ca95222b4b14")}"`));
  const empty = render(createElement(Situation, { outreach: data.outreach, asOf: as_of, discrepancies: [], cardLines: false }));
  assert.ok(!text(empty).includes("Records disputed"), "empty list → omitted");
});

// ── Scores (§11.2) ───────────────────────────────────────────────────────────────────────────────────────────

fixtureTest("Scores: two cards, `{n} / 100 · {Level}`, confidence, conditions, evidence, the freshness sentence and the note once", () => {
  const { data, as_of } = assessmentRead("S3/outreach-assessment__s-conflict-move.json");
  const html = render(createElement(Scores, { assessment: data, asOf: as_of! }));
  const t = text(html);
  assert.ok(t.includes("Transaction intent50 / 100 · Active"), t);
  assert.ok(t.includes("Move likelihood75 / 100 · Strong"));
  assert.equal((t.match(/Confidence medium/g) ?? []).length, 2);
  assert.ok(t.includes("RATIONALE-MARKER: active from the cited evidence."));
  assert.ok(t.includes("ConditionsAwaiting a written quote"));
  assert.equal((t.match(/View evidence \(1\)/g) ?? []).length, 2);
  const published = data.current!.published_at!;
  assert.ok(html.includes(`aria-label="Assessed ${formatExactFull(published)}"`));
  assert.ok(t.includes("· covers 2 conversations through"));
  assert.ok(t.includes("· 1 newer call not yet assessed"));
  assert.equal((t.match(/Scores are ordinal evidence assessments out of 100/g) ?? []).length, 1);
  assert.ok(!t.includes("%"));
});

fixtureTest("Scores: stale, lead_only, not_applicable (scores still show) and the availability explanations", () => {
  const stale = assessmentRead("S3/outreach-assessment__s-conflict-other.json");
  const staleText = text(render(createElement(Scores, { assessment: stale.data, asOf: stale.as_of! })));
  assert.ok(staleText.includes("Stale: the move date has passed."));
  assert.ok(!staleText.includes("newer call"), "k = 0 → clause omitted");

  const leadOnly = assessmentRead("S3/outreach-assessment__s-lead-only.json");
  const lo = text(render(createElement(Scores, { assessment: leadOnly.data, asOf: leadOnly.as_of! })));
  assert.ok(lo.includes("from the Lead on file only; no conversation was available."), lo);
  assert.ok(!lo.includes("covers"));

  const na = assessmentRead("S3/outreach-assessment__s-not-applicable.json");
  const naText = text(render(createElement(Scores, { assessment: na.data, asOf: na.as_of!, priorityLabel: "CRM bad/unusable" })));
  assert.ok(naText.includes("Not applicable: Granot marks this Lead CRM bad/unusable."));
  assert.ok(naText.includes("50 / 100"), "the scores still show");

  const pending = assessmentRead("S3/outreach-assessment__s-assessment-pending.json");
  assert.ok(text(render(createElement(Scores, { assessment: pending.data, asOf: pending.as_of! }))).includes("A Move assessment is queued or running."));
  const closed = assessmentRead("S3/outreach-assessment__s-closed-booked.json");
  assert.ok(text(render(createElement(Scores, { assessment: closed.data, asOf: closed.as_of! }))).includes("This work is closed or has a terminal CRM disposition"));
  const notAssessed = assessmentRead("S3/outreach-assessment__s-number-only.json");
  assert.ok(text(render(createElement(Scores, { assessment: notAssessed.data, asOf: notAssessed.as_of! }))).includes("No Move assessment exists for this subject"));
});

// ── Next step (§11.3) ────────────────────────────────────────────────────────────────────────────────────────

fixtureTest("Next step: three columns — recorded, the applied suggestion, and `From the calls`", () => {
  const { data, as_of } = outreachRead("S1/outreach__s-findings.json");
  const assessment = assessmentRead("S3/outreach-assessment__s-findings.json").data;
  const suggestion = presentationRead("S3/run-presentation__s-findings-run3.json").data.summary_findings.suggested_next_step;
  const html = render(createElement(NextStep, { outreach: data.outreach, asOf: as_of, suggestion, engagement: assessment.current!.engagement, artifactId: assessment.current!.artifact_id }));
  const t = text(html);
  for (const title of ["Next step (recorded)", "Suggested next step (not applied)", "From the calls"]) assert.ok(t.includes(title), title);
  assert.ok(t.includes("Call Friday about the estimate"));
  assert.ok(html.includes(`aria-label="Due ${formatExactFull("2026-09-25T00:45:04.094Z")}"`));
  assert.ok(t.includes("Send estimate · Send the revised written estimate before the Friday call"));
  assert.ok(t.includes("Why: The customer is waiting on the estimate"));
  assert.ok(html.includes(`aria-label="Applied ${formatExactFull(suggestion!.applied_at!)}"`));
  assert.ok(html.includes(`aria-label="→ follow-up due ${formatExactFull(suggestion!.followup_due_at!)}"`));
  assert.ok(!t.includes(">Apply<") && !html.includes(">Apply</button>"), "applied → no Apply button");
  assert.ok(t.includes("Worked, no next step agreed"));
});

fixtureTest("Next step: `Apply` for an open suggestion only with onApply; `No suggestion`; `No next step set`; `Not assessed`", () => {
  const open = presentationRead("S3/run-presentation__s-suggestion-open-run2.json");
  const asOf = open.as_of!;
  const suggestion = open.data.summary_findings.suggested_next_step;
  assert.ok(render(createElement(SuggestedStepView, { suggestion, asOf, onApply: () => {} })).includes(">Apply</button>"));
  assert.ok(!render(createElement(SuggestedStepView, { suggestion, asOf })).includes(">Apply</button>"), "a rep (no onApply) sees no Apply");
  assert.ok(text(render(createElement(SuggestedStepView, { suggestion: null, asOf }))).includes("No suggestion"));
  const purged = outreachRead("S1/outreach__s-audio-purged.json");
  const html = render(createElement(NextStep, { outreach: purged.data.outreach, asOf: purged.as_of, suggestion: null, engagement: null, artifactId: null }));
  assert.ok(text(html).includes("No next step set"));
  assert.ok(text(html).includes("Not assessed"));
});

fixtureTest("From the calls: promised callbacks, next steps, `→ follow-up created`, and `Not applied ({n})` with the server reasons", () => {
  const assessment = assessmentRead("S3/outreach-assessment__s-engagement.json").data;
  const html = render(createElement(FromTheCalls, { engagement: assessment.current!.engagement, artifactId: assessment.current!.artifact_id }));
  const t = text(html);
  assert.ok(t.includes("Worked, next step agreed"));
  assert.ok(t.includes("Promised callbacks (3)"));
  assert.ok(t.includes("Rep · I'll call you Thursday morning with the estimate · Fri Sep 25, morning · Pending"), t);
  assert.ok(t.includes("Customer · I'll call back after I talk to my wife · Pending"));
  assert.ok(t.includes("Next steps (3)"));
  assert.ok(t.includes("Send estimate · Email the written estimate · Sun Sep 27 · Planned"));
  assert.equal((t.match(/→ follow-up created/g) ?? []).length, 2);
  assert.ok(t.includes("Not applied (4)"));
  assert.ok(t.includes("Confirm the inventory list · An open follow-up of this kind exists"));
});

// ── Advanced (UX27, A42 render side) ─────────────────────────────────────────────────────────────────────────

fixtureTest("Advanced: the paid sentence, Re-analyze (original disabled with its reason), Earlier requests, Confirm analysis", () => {
  const run = runRead("S3/analysis-run__s-findings-run3.json").data;
  const html = render(createElement(Advanced, { run, asOf: "2026-09-23T21:46:55.728Z", onCommand: () => {} }));
  const t = text(html);
  assert.ok(t.includes("This starts a paid analysis."));
  const button = (label: string) => html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";
  assert.ok(button("Re-analyze original evidence").includes(' disabled=""'), "original evidence gone → disabled");
  assert.ok(t.includes("The original evidence is no longer stored."));
  assert.ok(button("Re-analyze current context") && !button("Re-analyze current context").includes(' disabled=""'));
  assert.ok(t.includes("Include my corrections"));
  assert.ok(t.includes("Earlier requestsNo earlier requests."));
  assert.ok(html.includes(">Confirm analysis</button>"), "editable → Confirm analysis");
  assert.ok(text(render(createElement(Advanced, { run: null, asOf: "2026-09-23T21:46:55.728Z" }))).includes("No analysis has run on this Number yet."));
});

// ── The frame (§11, §11.9, UX15) ─────────────────────────────────────────────────────────────────────────────

function seeded(): { client: QueryClient; outreachId: string } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const outreach = outreachRead("S1/outreach__s-findings.json");
  const id = outreach.data.outreach.id;
  const runId = outreach.data.outreach.newest_run_id!;
  client.setQueryData(siKeys.outreach(id), outreach);
  client.setQueryData(siKeys.assessment(id), assessmentRead("S3/outreach-assessment__s-findings.json"));
  client.setQueryData(siKeys.analysisPresentation(runId), presentationRead("S3/run-presentation__s-findings-run3.json"));
  client.setQueryData(siKeys.analysisRun(runId), runRead("S3/analysis-run__s-findings-run3.json"));
  return { client, outreachId: id };
}
const tab = (props: Parameters<typeof AnalysisTab>[0]) => {
  const { client } = seeded();
  return render(createElement(QueryClientProvider, { client }, createElement(AnalysisTab, props)));
};

fixtureTest("AnalysisTab (Owner): the sticky sub-nav in the fixed order, every region filled from the cache, Advanced last", () => {
  const { outreachId } = seeded();
  const html = tab({ outreachId, role: "owner", renderFindings: (ctx) => createElement("p", { "data-slot": "findings", "data-run": ctx.runId, "data-number": ctx.numberId }) });
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.deepEqual([...nav.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1]), ["situation", "scores", "move-details", "findings", "conversations", "full-output"]);
  const order = ["situation", "scores", "next-step", "move-details", "findings", "conversations", "full-output", "advanced"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `section order ${order}`);
  const t = text(html);
  assert.ok(t.includes("Latest analysis, Sep 22 · 3 conversations"));
  assert.ok(t.includes("Records disputed on a call (1)"));
  assert.ok(t.includes("Suggested next step (not applied)"));
  assert.ok(html.includes('data-slot="findings" data-run="6ab448740705ca95222b4b5f" data-number="6ab448740705ca95222b4b0c"'), "slot context from the detail");
  assert.ok(html.includes('id="conversations"') && !html.includes("data-slot-pending"), "no renderConversations → CONV's section (UI1-ANALYSIS-WIRE), never a placeholder");
  assert.ok(t.includes("This starts a paid analysis."));
  assert.ok(html.includes('class="si-analysis"'));
});

fixtureTest("AnalysisTab (rep): no Full output, no Advanced, no Apply; the readable sections stay", () => {
  const { outreachId } = seeded();
  const html = tab({ outreachId, role: "rep" });
  assert.ok(!html.includes('href="#full-output"') && !html.includes('id="full-output"'));
  assert.ok(!html.includes('id="advanced"') && !text(html).includes("This starts a paid analysis."));
  assert.ok(!html.includes(">Apply</button>"));
  for (const id of ["situation", "scores", "move-details", "findings", "conversations"]) assert.ok(html.includes(`id="${id}"`), id);
});

test("AnalysisTabSkeleton: the six section titles (five for a rep), no reads", () => {
  const owner = text(render(createElement(AnalysisTabSkeleton)));
  for (const title of ["Situation", "Scores", "Move details", "Findings", "Conversations", "Full output"]) assert.ok(owner.includes(title), title);
  const rep = render(createElement(AnalysisTabSkeleton, { role: "rep" }));
  assert.ok(!rep.includes('id="full-output"'));
  assert.ok(rep.includes('aria-busy="true"'));
});

test("gallery: the Analysis kit section renders every Scores state, the next step, Move details and Advanced from the fixtures", () => {
  const html = render(createElement(AnalysisSection));
  assert.ok(html.includes('<section id="analysis"'));
  for (const sample of SCORE_SAMPLES) assert.ok(html.includes(`data-score-sample="${sample.id}"`), sample.id);
  for (const id of ["situation", "scores", "next-step", "move", "advanced", "tab-skeleton"]) assert.ok(html.includes(`data-analysis-sample="${id}"`), id);
  const t = text(html);
  assert.ok(t.includes("Details disagree: Delivery city changed from Charlotte to Raleigh between calls."));
  assert.ok(t.includes("Lead cost $35 (legacy price)"));
  assert.ok(t.includes("This starts a paid analysis."));
  assert.ok(!t.includes("%"));
});
