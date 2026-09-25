import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, conversationsSchema, outreachReadSchema, timelineV2Schema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { outreachAssessmentReadSchema, runPresentationReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import { currentFindingsSchema } from "../../lib/api/salesIntelligenceAnalysis";
import { OutreachCard, whoText } from "../../components/sales-intelligence/card";
import { OutcomeLine } from "../../components/sales-intelligence/card/outcome-line";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { RailRegions, railRegionsFor } from "../../components/sales-intelligence/rail";
import { OutreachPage, RecordHeaderView, headerChips, headerRow } from "../../components/sales-intelligence/outreach";
import { EvidenceList, type EvidenceView } from "../../components/sales-intelligence/outreach/analysis";
import { PreviewBody } from "../../components/sales-intelligence/preview-dialog";
import { ViewerProvider, viewerFromSession, OWNER_VIEWER } from "../../components/sales-intelligence/rep/viewer";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI2-SCOPE (UI-2 §3; UI2-A04, A05): UI-1's regions under a rep viewer. Rendered from the `contracts/S8/rep-*` fixtures
// (captured as Dana Reyes) with a primed query cache; no DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

const DANA_ID = "6ab5ab0d72ee2eb383d940a7";
const DANA = viewerFromSession({ role: "rep", agent_id: DANA_ID });
/** Every Owner-only destination a rep page must never link to (A03, A04; SERVER-STATE "Rep shell" note). */
const OWNER_ONLY_HREF =
  /href="[^"]*(view=(reps|coverage|numbers|messages)|\/legacy|\/analysis-runs\/|\/assessments\/|\/conversations\/[^"]*\/findings|#full-output|\/operations-registry|agent_id=|unassigned=|database_scope=|\/observational|\/entities)/;
/** The reads a rep is refused (TEAM-UI2 §10.3): none may be requested from a rep page. */
const OWNER_ONLY_READ = /\/coverage|\/reps\b|\/numbers\/[^/?]+(\?|$)|\/nudges|\/attachments|\/review-items|\/analysis-runs\/[^/?]+(\?|$)|\/analysis-runs\/[^/?]+\/(evidence|output)|\/assessments\/[^/?]+(\?|$|\/output)|\/outreach\/by-lead\//;
/** Query-key segments of those reads (the cache records a query even when it never fetches on the server). */
const OWNER_ONLY_SEGMENT = new Set(["coverage", "reps", "nudge-destinations", "nudges", "number", "attachments", "reviews", "review-items", "analysis-run", "analysis-evidence", "analysis-output", "assessment-artifact", "assessment-output", "outreach-by-lead"]);

const detail = ifFixtures(() => outreachReadSchema.parse(read("S8/rep-outreach__s-findings.json")));
const ID = ifFixtures(() => detail.data.outreach.id);
const RUN_ID = ifFixtures(() => detail.data.outreach.newest_run_id!);
const NUMBER_ID = ifFixtures(() => detail.data.outreach.primary_number!.id);

/** The rep's reads for S-findings, including the run presentation a rep reads since S12-REPREADS (CF12, `full_output: []`). */
function primed(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(siKeys.outreach(ID), detail);
  client.setQueryData(siKeys.assessment(ID), outreachAssessmentReadSchema.parse(read("S8/rep-outreach-assessment__s-findings.json")));
  client.setQueryData(siKeys.analysisPresentation(RUN_ID), runPresentationReadSchema.parse(read("S12/rep-run-presentation__s-findings-newest.json")));
  client.setQueryData(siKeys.findings(ID, false), currentFindingsSchema.parse(read("S8/rep-outreach-findings__s-findings.json")));
  client.setQueryData(siKeys.findings(ID, true), currentFindingsSchema.parse(read("S8/rep-outreach-findings__s-findings-include-superseded.json")));
  client.setQueryData(siKeys.conversations(NUMBER_ID), { pages: [conversationsSchema.parse(read("S8/rep-number-conversations__s-findings.json"))], pageParams: [null] });
  client.setQueryData(siKeys.timeline("outreach", ID, []), { pages: [timelineV2Schema.parse(read("S8/rep-outreach-timeline__s-findings.json"))], pageParams: [null] });
  return client;
}

// Every request a render starts (a suspended read without cached data calls `fetch`); none may be Owner-only.
const requested: string[] = [];
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    requested.push(String(input instanceof Request ? input.url : input));
    return new Promise<Response>(() => {});
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

const asViewer = (viewer: typeof DANA, el: ReactElement) => createElement(ViewerProvider, { viewer } as Parameters<typeof ViewerProvider>[0], el);
function renderAs(viewer: typeof DANA, el: ReactElement, client = primed()) {
  return { html: decode(renderToStaticMarkup(createElement(QueryClientProvider, { client }, asViewer(viewer, el)))), client };
}
const page = (tab: string, viewer = DANA) => renderAs(viewer, createElement(OutreachPage, { id: ID, tab, run: null }));
/** Queries that would fetch (enabled) and whose key is an Owner-only read. */
function ownerOnlyQueries(client: QueryClient): string[] {
  return client.getQueryCache().getAll()
    .filter((q) => (q.options as { enabled?: unknown }).enabled !== false && OWNER_ONLY_SEGMENT.has(String(q.queryKey[1])))
    .map((q) => JSON.stringify(q.queryKey));
}
const sections = (html: string) => [...html.matchAll(/data-section="([a-z-]+)"/g)].map((m) => m[1]!);
const OWNER_CONTROLS = [
  'data-command=', 'data-action="message-rep"', 'data-action="confirm_finding"', 'data-action="correct_finding"', 'data-action="retract_finding"',
  'data-action="look_again"', 'data-action="attach-lead"', 'data-action="review-lead"', 'class="si-related"', 'data-section="full-output"',
  'data-section="advanced"', 'id="full-output"',
];

fixtureTest("A04 Analysis tab (rep): every section the Owner's has except Full output and Advanced; no Owner control, href or read", () => {
  requested.length = 0;
  const rep = page("analysis");
  const repRequests = requested.filter((url) => OWNER_ONLY_READ.test(url));
  const owner = page("analysis", OWNER_VIEWER);
  const expected = sections(owner.html).filter((id) => id !== "full-output" && id !== "advanced");
  assert.deepEqual(sections(rep.html), expected);
  for (const id of ["situation", "scores", "next-step", "move-details", "findings", "conversations"]) assert.ok(expected.includes(id), id);
  for (const control of OWNER_CONTROLS) assert.ok(!rep.html.includes(control), control);
  assert.ok(!/>\s*Apply\s*</.test(rep.html), "no Apply on the suggestion");
  const nav = rep.html.slice(rep.html.indexOf('class="si-subnav'), rep.html.indexOf("</nav>", rep.html.indexOf('class="si-subnav')));
  assert.ok(!nav.includes("#full-output"), "the sub-nav has no Full output");
  // Findings keep their inline evidence and the changes block; Conversations keep transcript and audio.
  assert.ok(rep.html.includes("data-finding=") && rep.html.includes('<article id="si-conversation-'));
  assert.ok(text(rep.html).includes(copy.ui2.scope.back), "Back, not Back to Outreach Intelligence");
  assert.ok(!text(rep.html).includes(copy.ui1.outreach.back));
  assert.doesNotMatch(rep.html, OWNER_ONLY_HREF);
  assert.deepEqual(ownerOnlyQueries(rep.client), []);
  assert.deepEqual(repRequests, []);
  // The observation works: the Owner's page does start Owner-only reads (Message rep availability, capture health).
  assert.ok(ownerOnlyQueries(owner.client).length > 0, "the Owner render registers its Owner-only reads");
});

fixtureTest("A04 Work tab (rep): the follow-ups only; no corrections, review items, restrictions, attachments or Message rep", () => {
  requested.length = 0;
  const rep = page("work");
  assert.ok(rep.html.includes('data-region="work-followups"') && rep.html.includes('data-viewer="rep"'));
  for (const region of ["work-corrections", "work-review", "work-restrictions", "work-attachments", "work-messages"]) {
    assert.ok(!rep.html.includes(`data-region="${region}"`), region);
  }
  for (const control of OWNER_CONTROLS) assert.ok(!rep.html.includes(control), control);
  assert.ok(!rep.html.includes("cancel_followup"), "no Owner follow-up command");
  assert.doesNotMatch(rep.html, OWNER_ONLY_HREF);
  assert.deepEqual(ownerOnlyQueries(rep.client), []);
  assert.deepEqual(requested.filter((url) => OWNER_ONLY_READ.test(url)), []);
  // The Owner's Work tab is unchanged.
  requested.length = 0;
  const owner = page("work", OWNER_VIEWER);
  for (const region of ["work-corrections", "work-review", "work-restrictions", "work-attachments", "work-messages"]) {
    assert.ok(owner.html.includes(`data-region="${region}"`), `Owner ${region}`);
  }
});

fixtureTest("A04 Timeline tab (rep): the same timeline, with the rep header; no Owner-only href or read", () => {
  requested.length = 0;
  const rep = page("timeline");
  assert.ok(rep.html.includes('data-region="timeline-outreach"'));
  assert.ok(rep.html.includes("si-timeline__row"));
  for (const control of OWNER_CONTROLS) assert.ok(!rep.html.includes(control), control);
  assert.doesNotMatch(rep.html, OWNER_ONLY_HREF);
  assert.deepEqual(ownerOnlyQueries(rep.client), []);
  assert.deepEqual(requested.filter((url) => OWNER_ONLY_READ.test(url)), []);
});

fixtureTest("A04 record header (rep): blocker chip `Don't call` with no date, provenance, receiver agent; no commands, links or Lead progress controls", () => {
  const o = detail.data.outreach;
  const blocked = { ...o, derived: { ...o.derived, call_blockers: ["restriction"] } };
  const view = (viewer: typeof DANA) => renderAs(viewer, createElement(RecordHeaderView, { outreach: blocked, asOf: detail.as_of, returnTo: "/x", onCommand: () => {}, onMessageRep: () => {}, messageRepDisabledReason: null })).html;
  const rep = view(DANA);
  const chip = rep.slice(rep.indexOf('data-chip="blocker-restriction"'), rep.indexOf("</span></span>", rep.indexOf('data-chip="blocker-restriction"')));
  assert.ok(text(chip).includes(copy.ui2.scope.dontCallNoDate) && !text(chip).includes("until"), "Don't call, no date");
  assert.ok(!rep.includes(copy.ui1.chip.blocker.restrictionTip), "no `open the record` tip");
  assert.ok(rep.includes('class="si-provenance"'));
  for (const control of OWNER_CONTROLS) assert.ok(!rep.includes(control), control);
  assert.doesNotMatch(rep, OWNER_ONLY_HREF);
  // headerChips: a rep never gets the review chip, and the restriction chip never reads a date.
  const row = { ...headerRow(blocked), filter_keys: { needs_review: true } } as AttentionRow;
  const chips = headerChips(row, detail.as_of, { until: "2026-10-01T12:00:00.000Z" }, true, { rep: true });
  assert.deepEqual(chips.map((c) => c.id), ["blocker-restriction"]);
  assert.equal(chips[0]!.label, copy.ui2.scope.dontCallNoDate);
  // The Owner keeps commands, Message rep and the related records.
  const owner = view(OWNER_VIEWER);
  assert.ok(owner.includes('data-command="message_rep"') && owner.includes('class="si-related"'));
});

const attention = ifFixtures(() => attentionSchema.parse(read("S8/rep-attention__all-outreach.json")));
const rowById = (id: string) => attention.data.items.find((r) => r.outreach?.id === id)!;

fixtureTest("A05 line 7 for a rep: Yours (assigned wins over a promise) · Promised by you · Assigned to {name} · Unassigned", () => {
  const assigned = rowById("6ab5ab1872ee2eb383d94893"); // assigned Dana, promised by Marcus
  const promised = rowById("6ab5ab1972ee2eb383d948b1"); // assigned Marcus, promised by Dana
  const unassigned = rowById("6ab5ab1072ee2eb383d941fd"); // no agent, promised by Marcus
  const other = { ...promised, outreach: { ...promised.outreach!, next_action: promised.outreach!.next_action ? { ...promised.outreach!.next_action, promised_by: null } : null } } as AttentionRow;
  assert.equal(whoText(assigned.outreach!, DANA), "Yours");
  assert.equal(whoText(promised.outreach!, DANA), "Promised by you");
  assert.equal(whoText(other.outreach!, DANA), "Assigned to Marcus Bell");
  assert.equal(whoText(unassigned.outreach!, DANA), "Unassigned");
  // The Owner's text is unchanged.
  assert.equal(whoText(assigned.outreach!), "Promised by Marcus Bell");
  assert.equal(whoText(promised.outreach!, OWNER_VIEWER), "Promised by Dana Reyes");
  // The rendered card reads the viewer from the context.
  const card = (row: AttentionRow) => renderAs(DANA, createElement(OutreachCard, { row, asOf: attention.as_of, layout: "flat", view: "all_outreach" })).html;
  const seg = (html: string) => text(html.slice(html.indexOf('data-seg="who"'), html.indexOf("</span>", html.indexOf('data-seg="who"'))).replace(/^[^>]*>/, ""));
  assert.equal(seg(card(assigned)).trim(), "Yours");
  assert.equal(seg(card(promised)).trim(), "Promised by you");
  assert.equal(seg(card(other)).trim(), "Assigned to Marcus Bell");
});

fixtureTest("A04 card (rep): Open (Work tab) and Open analysis, no Message rep, no Apply, no Owner-only href; closed keeps Open", () => {
  for (const row of attention.data.items) {
    const html = renderAs(DANA, createElement(OutreachCard, { row, asOf: attention.as_of, layout: "flat", view: "all_outreach", onMessageRep: () => {}, onApplySuggestion: () => {} })).html;
    if (!row.outreach) continue;
    assert.ok(html.includes(`data-action="open" data-viewer="rep" href="/sales-intelligence/outreach/${row.outreach.id}?tab=work"`), "Open → Work tab");
    assert.ok(html.includes(`data-action="open-analysis" data-viewer="rep" href="/sales-intelligence/outreach/${row.outreach.id}"`), "Open analysis");
    assert.ok(!html.includes('data-action="message-rep"') && !html.includes("si-card__apply"));
    assert.doesNotMatch(html, OWNER_ONLY_HREF);
  }
  const closed = renderAs(DANA, createElement(OutreachCard, { row: attention.data.items[0]!, asOf: attention.as_of, layout: "flat", view: "closed" })).html;
  assert.ok(closed.includes('data-action="open"') && !closed.includes('data-action="open-analysis"'));
  // The Owner's card is unchanged.
  const owner = renderAs(OWNER_VIEWER, createElement(OutreachCard, { row: attention.data.items[0]!, asOf: attention.as_of, layout: "flat", view: "all_outreach", onMessageRep: () => {} })).html;
  assert.ok(owner.includes('data-action="message-rep"') && !owner.includes("?tab=work"));
});

fixtureTest("A04 side dialog (rep): line 7 is the rep's, no Apply, no Owner-only href", () => {
  const row = rowById("6ab5ab1972ee2eb383d948b1");
  const html = renderAs(DANA, createElement(PreviewBody, { row, asOf: attention.as_of, onApplySuggestion: () => {} })).html;
  assert.ok(text(html).includes("Promised by you"));
  assert.ok(!/>\s*Apply\s*</.test(html));
  assert.doesNotMatch(html, OWNER_ONLY_HREF);
});

fixtureTest("A04 closed outcome line (rep): the Booked line has no official Booking link", () => {
  const closedRead = attentionSchema.parse(read("S8/rep-attention__closed.json"));
  const withOutcome = closedRead.data.items.filter((r) => r.outcome);
  for (const row of withOutcome) {
    const html = renderAs(DANA, createElement(OutcomeLine, { outcome: row.outcome!, asOf: closedRead.as_of, receivedAt: row.outreach?.trigger_at ?? null, returnTo: "/sales-intelligence?view=closed" })).html;
    assert.ok(!html.includes('data-action="open-booking"'));
    assert.doesNotMatch(html, OWNER_ONLY_HREF);
  }
  const booked = { reason: "booked", closed_at: "2026-09-20T12:00:00.000Z", booking: { id: "b1", book_date: "2026-09-20T12:00:00.000Z" } } as never;
  assert.ok(!renderAs(DANA, createElement(OutcomeLine, { outcome: booked, asOf: "2026-09-24T12:00:00.000Z" })).html.includes("open-booking"));
  assert.ok(renderAs(OWNER_VIEWER, createElement(OutcomeLine, { outcome: booked, asOf: "2026-09-24T12:00:00.000Z" })).html.includes("open-booking"));
});

fixtureTest("UI-2 §3: a rep's rail (and its sheet) ends with `Your records only` where the Owner has the Rep region", () => {
  const regions = railRegionsFor("all_outreach", true);
  const value = parseDeskUrl(new URLSearchParams("view=all_outreach"), "rep");
  const rep = renderAs(DANA, createElement(RailRegions, { regions, value, onChange: () => {}, reps: [], asOf: null })).html;
  assert.ok(rep.includes(`data-rail-note="rep">${copy.ui2.scope.noRailRep}</p>`));
  const owner = renderAs(OWNER_VIEWER, createElement(RailRegions, { regions: railRegionsFor("all_outreach"), value, onChange: () => {}, reps: [], asOf: null })).html;
  assert.ok(!owner.includes("data-rail-note"));
});

fixtureTest("UX15 (CF12): evidence whose `open.kind` is `analysis_evidence` prints inline for a rep, with no link or read of the Owner-only run evidence", () => {
  const presentation = runPresentationReadSchema.parse(read("S12/rep-run-presentation__s-findings-newest.json"));
  const findings = currentFindingsSchema.parse(read("S8/rep-outreach-findings__s-findings.json"));
  type Item = EvidenceView & { open?: { kind: string } | null };
  const served = [...(presentation.data.evidence.items as Item[]), ...findings.data.items.flatMap((f) => f.evidence as unknown as Item[])];
  const pointed = served.filter((item) => item.open?.kind === "analysis_evidence");
  assert.ok(pointed.length > 0, "the fixtures carry analysis_evidence locators");
  requested.length = 0;
  const { html, client } = renderAs(DANA, createElement(EvidenceList, { items: pointed, asOf: detail.as_of }));
  for (const item of pointed) assert.ok(html.includes(`data-evidence="${item.id}"`), item.id);
  assert.ok(!html.includes("href="), "no link in the inline evidence");
  assert.deepEqual(ownerOnlyQueries(client), []);
  assert.deepEqual(requested, []);
  // The rep's whole Analysis tab serves the findings' evidence eagerly: still no run-evidence link or read.
  const rendered = page("analysis");
  assert.ok(!/analysis-runs\/[^"]*\/evidence/.test(rendered.html));
  assert.deepEqual(ownerOnlyQueries(rendered.client), []);
  assert.deepEqual(requested.filter((url) => OWNER_ONLY_READ.test(url)), []);
});

fixtureTest("UX15 (CF12): the rep's assessment evidence (S12) renders inline without an Owner-only href; an out-of-scope run is a 404", () => {
  const evidence = read("S12/rep-assessment-evidence__s-findings.json");
  const items = evidence.data.items as EvidenceView[];
  assert.ok(items.length > 0);
  const { html } = renderAs(DANA, createElement(EvidenceList, { items, asOf: evidence.as_of ?? detail.as_of }));
  assert.doesNotMatch(html, OWNER_ONLY_HREF);
  assert.equal(read("S12/rep-run-presentation-out-of-scope__s-suggestion-open.json").status, 404);
});
