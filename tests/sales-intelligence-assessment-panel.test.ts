import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AssessmentSection } from "../components/sales-intelligence/assessment-section";
import { FullOutputSection } from "../components/sales-intelligence/full-output";
import { parseSiPanel, SI_PANEL_TABS } from "../components/sales-intelligence/sales-intelligence-tabs";
import { salesIntelligenceKeys } from "../lib/query/salesIntelligence";
import { fullOutputReadSchema, outputChoices, outreachAssessmentReadSchema, runPresentationSchema } from "../lib/api/salesIntelligenceAssessment";
import { ASSESSMENT_DTO_FIXTURES as F } from "../lib/api/salesIntelligenceAssessment.fixtures";

const outreachId = F.outreachReady.subject.outreach_record_id;
function render(seed: (client: QueryClient) => void, element: unknown, props: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(element as never, props as never)));
  client.clear();
  return html;
}
const seedAssessment = (fixture: unknown) => (client: QueryClient) =>
  client.setQueryData([...salesIntelligenceKeys.all, "assessment", outreachId], outreachAssessmentReadSchema.parse({ data: fixture }));
const noop = () => {};
const sectionProps = { outreachId, artifactId: null, onArtifact: noop, onCite: noop, onFullOutput: noop };

test("the Assessment tab exists with the server word and parses from the URL", () => {
  assert.equal(SI_PANEL_TABS.find((tab) => tab.key === "assessment")?.label, "Assessment");
  assert.equal(parseSiPanel("assessment"), "assessment");
  assert.equal(parseSiPanel("analysis"), "analysis");
});

test("ready assessment: both scores out of 100, three labelled views, inventory, conflicts, versions and View full output", () => {
  const html = render(seedAssessment(F.outreachReady), AssessmentSection, sectionProps);
  assert.match(html, /Transaction intent<\/h5><p class="si-score__value">50 \/ 100/);
  assert.match(html, /Move likelihood<\/h5><p class="si-score__value">75 \/ 100/);
  assert.doesNotMatch(html, /\d\s*%/);
  for (const text of ["Original form submission", "Current Lead fields", "Customer said", "Sofa", "Garage not discussed", "Lead says Oct 1, call says Oct 15",
    "View full output", "Assessment version", "Stale: move date passed", "Model inventory coverage", "Source coverage", "Medium confidence"]) assert.ok(html.includes(text), text);
  assert.match(html, /<option value="[0-9a-f]+"[^>]*>[^<]*Purged/);
  assert.match(html, /data-label="Quantity">1</);
});

test("assessment-only subject without a Contact Number renders without any findings run", () => {
  const html = render(seedAssessment(F.outreachAssessmentOnly), AssessmentSection, sectionProps);
  assert.match(html, /Transaction intent<\/h5><p class="si-score__value">Unknown/);
  assert.match(html, /Move likelihood<\/h5><p class="si-score__value">50 \/ 100/);
  assert.ok(html.includes("Lead fields only, no conversation"));
});

test("Not assessed, Pending, closed and purged are distinct states, never zero", () => {
  const notAssessed = render(seedAssessment(F.outreachNotAssessed), AssessmentSection, sectionProps);
  assert.match(notAssessed, /Not assessed/);
  assert.match(notAssessed, /No Move assessment exists for this subject/);
  assert.doesNotMatch(notAssessed, /0 \/ 100|View full output/);
  const pending = render(seedAssessment(F.outreachPending), AssessmentSection, sectionProps);
  assert.match(pending, /Pending/);
  assert.match(pending, /queued or running/);
  const closed = render(seedAssessment(F.outreachClosed), AssessmentSection, sectionProps);
  assert.match(closed, /si-score__value">Not applicable/);
  assert.match(closed, /Historical score 50 \/ 100/);
  assert.match(closed, /Not applicable — closed work/);
  assert.match(closed, /<h4[^>]*>Assessment<\/h4><span class="si-badge[^"]*"><span>Not applicable<\/span>/, "the subject's closure wins over the artifact's ready status");
  const purged = render(seedAssessment(F.outreachPurged), AssessmentSection, sectionProps);
  assert.match(purged, /removed under the retention rules/);
  assert.doesNotMatch(purged, /Sofa|Original form submission/);
});

test("no Outreach record: the section says why instead of going blank", () => {
  const html = render(() => {}, AssessmentSection, { ...sectionProps, outreachId: null });
  assert.match(html, /no subject to assess/);
});

test("Full output: structured findings say the exact model object was not retained and show the accepted result in full", () => {
  const structured = runPresentationSchema.parse(F.structuredRun);
  const choices = outputChoices({ versions: [], runId: structured.run_id, runRefs: structured.full_output });
  const findings = choices.find((choice) => choice.kind === "findings")!;
  const html = render((client) => client.setQueryData([...salesIntelligenceKeys.all, "analysis-output", structured.run_id, structured.run_id],
    fullOutputReadSchema.parse({ data: F.structuredFindingsOutput })), FullOutputSection, { choices, selectedKey: findings.key, onSelect: noop });
  assert.ok(html.includes("Exact model object not retained; showing the accepted, server-expanded result."));
  assert.ok(html.includes("Accepted, server-expanded result"));
  assert.ok(html.includes("Copy output"));
  assert.ok(html.includes("Structured JSON"));
  // Readable view lists every finding in the accepted envelope.
  assert.ok(html.includes("Moving October 15") && html.includes("Rep will call back Friday"));
  assert.doesNotMatch(html, /line-clamp/);
});

test("Full output: an assessment shows the exact model output and the accepted envelope as separate representations", () => {
  const ready = outreachAssessmentReadSchema.parse({ data: F.outreachReady }).data;
  const choices = outputChoices({ versions: ready.versions });
  const html = render((client) => client.setQueryData([...salesIntelligenceKeys.all, "assessment-output", ready.current!.artifact_id],
    fullOutputReadSchema.parse({ data: F.assessmentOutput })), FullOutputSection, { choices, selectedKey: choices[0]!.key, onSelect: noop });
  assert.ok(html.includes("Exact model output") && html.includes("Accepted, server-expanded result"));
  assert.doesNotMatch(html, /not retained/);
  assert.ok(html.includes("Garage not discussed"));
  assert.ok(html.includes("Digests: prompt digest"));
});
