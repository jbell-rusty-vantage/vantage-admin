import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conversationsSchema, outreachReadSchema, reviewItemsSchema } from "../../lib/api/salesIntelligence";
import { outreachAssessmentReadSchema, runPresentationReadSchema } from "../../lib/api/salesIntelligenceAssessment";
import { analysisSchema, currentFindingsSchema } from "../../lib/api/salesIntelligenceAnalysis";
import { salesIntelligenceKeys } from "../../lib/query/salesIntelligence";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { AnalysisTab, AnalysisTabSkeleton, ViewEvidence, reviewItemHref } from "../../components/sales-intelligence/outreach/analysis";
import { OutreachPage } from "../../components/sales-intelligence/outreach";
import { ReviewItems } from "../../components/sales-intelligence/review-items";
import { targetEventId } from "../../components/sales-intelligence/timeline/timeline";
import { hashTarget } from "../../components/sales-intelligence/outreach/land-on-hash";
import { AnalysisSection } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/analysis";
import { AnalysisFindingsSection } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/analysis-findings";

// UI1-ANALYSIS-WIRE: the joined Analysis tab (TOP + MOVE + FIND + CONV) rendered whole from a primed query cache, the
// Outreach page mounting it, one `View evidence` path, unique ids when the kit renders twice, and the deep-link targets.
// No DOM (ADMIN-REBUILD trap 7): the scroll / highlight behaviour itself is for the browser pass.

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
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ");
const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
const duplicates = (list: string[]) => [...new Set(list.filter((id, i) => list.indexOf(id) !== i))];

const detail = outreachReadSchema.parse(read("S1/outreach__s-findings.json"));
const OUTREACH_ID = detail.data.outreach.id;
const RUN_ID = detail.data.outreach.newest_run_id!;
const NUMBER_ID = detail.data.outreach.primary_number!.id;

/** Every read the joined tab makes for the s-findings record. */
function primed(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(siKeys.outreach(OUTREACH_ID), detail);
  client.setQueryData(siKeys.assessment(OUTREACH_ID), outreachAssessmentReadSchema.parse(read("S3/outreach-assessment__s-findings.json")));
  client.setQueryData(siKeys.analysisPresentation(RUN_ID), runPresentationReadSchema.parse(read("S3/run-presentation__s-findings-run3.json")));
  client.setQueryData(siKeys.analysisRun(RUN_ID), analysisSchema.parse(read("S3/analysis-run__s-findings-run3.json")));
  client.setQueryData(siKeys.findings(OUTREACH_ID, false), currentFindingsSchema.parse(read("S3/outreach-findings__s-findings.json")));
  client.setQueryData(siKeys.findings(OUTREACH_ID, true), currentFindingsSchema.parse(read("S3/outreach-findings__s-findings-include-superseded.json")));
  client.setQueryData(siKeys.conversations(NUMBER_ID), { pages: [conversationsSchema.parse(read("S4/number-conversations__s-findings.json"))], pageParams: [null] });
  return client;
}
const render = (el: ReactElement, client = primed()) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, el));
const tab = (props: Partial<Parameters<typeof AnalysisTab>[0]> = {}) => render(createElement(AnalysisTab, { outreachId: OUTREACH_ID, role: "owner", cardLines: false, ...props }));

const SIX = ["situation", "scores", "move-details", "findings", "conversations", "full-output"];

test("AnalysisTab (Owner): the six anchors, real Findings and Conversations, and View evidence, all from the cache", () => {
  const html = tab();
  const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
  assert.deepEqual([...nav.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1]), SIX, "sub-nav anchors");
  for (const id of SIX) assert.ok(html.includes(`<section id="${id}"`), `section #${id}`);
  assert.ok(!html.includes("data-slot-pending"), "no placeholder sentence");
  assert.ok(!html.includes('aria-busy="true"'), "every region rendered from the cache, no skeleton");

  const findings = html.slice(html.indexOf('<section id="findings"'), html.indexOf('<section id="conversations"'));
  assert.ok((findings.match(/data-finding="/g) ?? []).length >= 1, "at least one finding block");
  assert.ok(findings.includes('id="si-finding-'), "finding anchors");
  assert.ok(text(findings).includes("Work result:"), "work results");
  assert.ok(findings.includes('data-action="look_again"'), "Owner: Look again under More");
  assert.ok(decode(findings).includes(`href="${reviewItemHref(OUTREACH_ID, "6ab448740705ca95222b4b6b")}"`), "relation → Work tab review item");
  assert.ok(reviewItemHref(OUTREACH_ID, "x").endsWith("?tab=work#review-item-x"));

  const conversations = html.slice(html.indexOf('<section id="conversations"'), html.indexOf('<section id="full-output"'));
  assert.ok((conversations.match(/<article id="si-conversation-/g) ?? []).length >= 1, "at least one conversation card");

  // One `View evidence` component across the kit: FIND's toggle, in Scores / next step / Move details too.
  assert.ok((html.match(/class="si-evidence__toggle/g) ?? []).length >= 2, "View evidence toggles");
  const scores = html.slice(html.indexOf('<section id="scores"'), html.indexOf('id="next-step"'));
  assert.ok(scores.includes("si-evidence__toggle") && text(scores).includes("View evidence ("), "Scores use the FIND toggle");
  assert.ok(!html.includes("si-cite__list") && !html.includes("si-cite__btn"), "the old fallback list is gone");
  assert.deepEqual(duplicates(ids(html)), [], "ids are unique");
});

test("AnalysisTab (rep): no Look again, no review-item links, no Full output; Findings and Conversations still render", () => {
  const html = tab({ role: "rep" });
  assert.ok(!html.includes('data-action="look_again"'));
  assert.ok(!html.includes("#review-item-"));
  assert.ok(!html.includes('id="full-output"'));
  assert.ok(html.includes("data-finding=") && html.includes('<article id="si-conversation-'));
});

test("idPrefix: two copies of the kit on one page share no id, and each sub-nav points at its own copy", () => {
  const client = primed();
  const html = render(
    createElement("div", null,
      createElement(AnalysisTab, { outreachId: OUTREACH_ID, role: "owner", cardLines: false }),
      createElement(AnalysisTab, { outreachId: OUTREACH_ID, role: "owner", cardLines: false, idPrefix: "p390-" })),
    client,
  );
  assert.deepEqual(duplicates(ids(html)), [], "no duplicate ids");
  assert.ok(html.includes('href="#p390-scores"') && html.includes('<section id="p390-scores"'));
  assert.ok(html.includes('href="#scores"') && html.includes('<section id="scores"'), "the route copy keeps the bare anchors");
  assert.ok(html.includes('id="p390-si-finding-') && html.includes('id="p390-si-conversation-'));
});

test("ViewEvidence: a count toggle with its context, or the empty / should-cite sentence; nothing is read until opened", () => {
  const client = new QueryClient();
  const closed = render(createElement(ViewEvidence, { target: { source: "run", runId: RUN_ID, ids: ["a", "b"], label: "Customer says X" } }), client);
  assert.ok(closed.includes('aria-label="View evidence (2): Customer says X"'));
  assert.ok(closed.includes("hidden") && !closed.includes("si-evidence__list"), "closed: no body, no read");
  assert.equal(client.getQueryCache().getAll().length, 0, "no query started while closed");
  assert.ok(text(render(createElement(ViewEvidence, { target: null }), client)).includes("No evidence cited"));
  assert.ok(text(render(createElement(ViewEvidence, { target: null, shouldCite: true }), client)).includes("This score should cite evidence and does not."));
});

test("OutreachPage mounts the joined Analysis tab (not the placeholder) with the header's lines left out of Situation", () => {
  const html = render(createElement(OutreachPage, { id: OUTREACH_ID, tab: "analysis", run: null }));
  assert.ok(html.includes('class="si-analysis"') && html.includes('data-region="outreach-analysis"'));
  assert.ok(!text(html).includes("The analysis sections are still being built."));
  const situation = html.slice(html.indexOf('<section id="situation"'), html.indexOf('<section id="scores"'));
  assert.ok(!situation.includes('data-lines="1-4,6-7"'), "cardLines={false}");
  assert.ok(html.includes("data-finding=") && html.includes('<article id="si-conversation-'));
});

test("AnalysisTabSkeleton uses the Findings and Conversations skeletons", () => {
  const html = renderToStaticMarkup(createElement(AnalysisTabSkeleton));
  assert.ok(html.includes("si-findings is-skeleton") && html.includes("si-convs is-skeleton"));
});

test("Work tab review items carry `id=\"review-item-{id}\"` (the target of a finding relation's link)", () => {
  const client = new QueryClient();
  const subjectKey = "number:n1";
  const page = reviewItemsSchema.parse({ data: { items: [{ id: "r1", revision: 1, subject_key: subjectKey, cause_kind: "identity", state: "open", opened_at: "2026-09-20T12:00:00.000Z", resolution_reason: null, evidence_refs: [], allowed_actions: [] }], cursor: null } });
  client.setQueryData([...salesIntelligenceKeys.all, "reviews", subjectKey], { pages: [page], pageParams: [null] });
  const html = render(createElement(ReviewItems, { subjectKey }), client);
  assert.ok(html.includes('<article id="review-item-r1">'));
});

test("deep-link readers are safe without a window (server render, tests)", () => {
  assert.equal(targetEventId(), null);
  assert.equal(hashTarget(), null);
});

test("gallery: the joined tab renders from the fixtures, wide and in the 390 px frame, with no duplicate ids", () => {
  const html = renderToStaticMarkup(createElement(AnalysisSection));
  const joined = html.slice(html.indexOf('data-analysis-sample="joined-tab"'));
  assert.ok(joined.includes('<section id="gallery-tab-findings"') && joined.includes('<section id="gallery-tab-390-conversations"'));
  assert.ok(joined.includes("data-finding=") && joined.includes('id="gallery-tab-si-conversation-'));
  assert.deepEqual(duplicates(ids(html)), [], "analysis gallery ids unique");
  const both = html + renderToStaticMarkup(createElement(AnalysisFindingsSection));
  assert.deepEqual(duplicates(ids(both)), [], "analysis + analysis-findings sections share no id");
});
