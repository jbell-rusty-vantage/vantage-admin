import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoredCallAnalysisView, storedOutputVersionText } from "../../components/sales-intelligence/_legacy/stored-call-analyses";
import { ASSESSMENT_DTO_FIXTURES } from "../../lib/api/salesIntelligenceAssessment.fixtures";
import { runPresentationSchema } from "../../lib/api/salesIntelligenceAssessment";
import { analysisSchema } from "../../lib/api/salesIntelligenceAnalysis";

// Running Summary tab: every stored output version (legacy envelope runs, structured runs) renders through the
// shared Summary & findings section; an older server without the presentation route falls back to the raw run.
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const section = (key: "legacyRun" | "structuredRun") => runPresentationSchema.parse(ASSESSMENT_DTO_FIXTURES[key]).summary_findings;

test("a legacy analysis run renders its six sections, assertions and version label", () => {
  const legacy = section("legacyRun");
  const html = renderToStaticMarkup(createElement(StoredCallAnalysisView, { section: legacy, fallback: null, runId: "r1", onOpenRun: () => {} }));
  const plain = text(html);
  assert.match(plain, /Call summary/);
  assert.match(plain, /Earlier analysis format/);
  for (const part of legacy.summary.sections.filter(s => s.text.trim())) assert.ok(plain.includes(part.label), `section label ${part.label}`);
  assert.match(plain, new RegExp(`Model assertions \\(${legacy.findings.length}\\)`));
  assert.match(plain, /Open full summary, assertions and evidence/);
  assert.equal(html.includes("%"), false);
});

test("a structured run renders through the same view with its own version label and extracted facts", () => {
  const structured = section("structuredRun");
  const plain = text(renderToStaticMarkup(createElement(StoredCallAnalysisView, { section: structured, fallback: null, runId: "r2", onOpenRun: () => {} })));
  assert.match(plain, /Structured analysis/);
  assert.match(plain, new RegExp(`Model assertions \\(${structured.findings.length}\\)`));
  if (structured.said_on_call.length) assert.match(plain, /extracted from the call itself/);
});

test("a purged section says so, and the raw-run fallback still shows the summary when the presentation route is absent", () => {
  const purged = { ...section("legacyRun"), availability: "purged", findings: [] };
  assert.match(text(renderToStaticMarkup(createElement(StoredCallAnalysisView, { section: purged, fallback: null, runId: "r3", onOpenRun: () => {} }))), /no longer available/);
  const fallback = analysisSchema.parse({ data: { id: "00000000000000000000000c", revision: 1, status: "completed", mode: "initial", conversation_id: "00000000000000000000000d",
    created_at: "2026-09-01T00:00:00.000Z", completed_at: "2026-09-01T00:05:00.000Z", current: true, editable: false, output_digest: null, suggestion_output_digest: null,
    model_version: "openai/gpt-5-mini", prompt_version: "sales_intelligence_analyze_v1", original_evidence_available: false, contact_number_id: "00000000000000000000000e",
    outreach: null, output: { schema_version: "csi-envelope-v1", summary: { overview: "Customer asked about a two-bedroom move.", customer_wanted: "A quote", money_and_dates: "", outcome: "", commitments: "", discrepancies: "", finding_keys: [] },
      findings: [], next_step_suggestion: null, owner_instruction_assessments: [] },
    findings: [{ id: "00000000000000000000000f", revision: 1, assertion: { key: "f1", kind: "intent", claim: "Customer wants a quote" }, review_state: "unreviewed", validation: {}, effects: [] }],
    actions: [], instructions: [], instructions_complete: true, history: [] } }).data;
  const plain = text(renderToStaticMarkup(createElement(StoredCallAnalysisView, { section: null, fallback, runId: "r4", onOpenRun: () => {} })));
  assert.match(plain, /Customer asked about a two-bedroom move/);
  assert.match(plain, /Customer wanted/);
  assert.match(plain, /Model assertions \(1\)/);
  assert.match(plain, /prompt sales_intelligence_analyze_v1/);
});

test("version labels name the stored format without inventing a version", () => {
  assert.equal(storedOutputVersionText({ kind: "legacy_run", prompt_version: "sales_intelligence_analyze_v2", version: "csi-envelope-v1" }), "Earlier analysis format · prompt sales_intelligence_analyze_v2 · schema csi-envelope-v1");
  assert.equal(storedOutputVersionText({ kind: "structured_run", prompt_version: null, version: null }), "Structured analysis");
});
