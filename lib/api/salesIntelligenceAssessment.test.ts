import test from "node:test";
import assert from "node:assert/strict";
import {
  applicabilityText, availabilityText, confidenceText, evidenceTextLabel, focusEvidence, freshnessText, fullOutputSchema, groupObservations,
  historicalScoreText, levelText, locatorText, moveViewRows, observationText, originalViewLabel, outputChoices, outputJson, outputRepresentations,
  outreachAssessmentSchema, placeText, quantityText, runPresentationSchema, scoreText, evidenceSectionSchema, versionOption, versionScoreText,
  outreachAssessmentReadSchema, type Observation,
} from "./salesIntelligenceAssessment";
import { findingAlert, readableFindings, readableSummary, type AnalysisFinding } from "./salesIntelligenceAnalysis";
import { ASSESSMENT_DTO_FIXTURES as F } from "./salesIntelligenceAssessment.fixtures";

const noPercent = (text: string) => assert.doesNotMatch(text, /%/, text);

test("mirrors parse every server fixture shape: legacy run, structured run, outputs, evidence and each Outreach assessment state", () => {
  for (const key of ["legacyRun", "structuredRun"] as const) runPresentationSchema.parse(F[key]);
  for (const key of ["legacyOutput", "structuredFindingsOutput", "structuredSummaryOutput", "assessmentOutput", "purgedAssessmentOutput"] as const) fullOutputSchema.parse(F[key]);
  evidenceSectionSchema.parse(F.assessmentEvidence);
  for (const key of ["outreachReady", "outreachAssessmentOnly", "outreachNotAssessed", "outreachPending", "outreachClosed", "outreachPurged"] as const) outreachAssessmentSchema.parse(F[key]);
  // The Owner read wraps data with as_of and coverage; unknown wrapper keys are tolerated.
  assert.equal(outreachAssessmentReadSchema.parse({ ok: true, as_of: "2026-09-22T00:00:00Z", coverage: {}, data: F.outreachReady }).data.availability, "ready");
});

test("mirrors are lenient: older servers omit additive fields and grown enum values still parse", () => {
  const ready = structuredClone(F.outreachReady) as Record<string, unknown> & { current: Record<string, unknown> };
  delete ready.current.shadow; delete ready.current.current; delete ready.current.source_manifest; delete ready.current.conflicts;
  (ready.current as { availability: string }).availability = "some_future_state";
  const parsed = outreachAssessmentSchema.parse(ready);
  assert.equal(parsed.current?.shadow, false);
  assert.deepEqual(parsed.current?.conflicts, []);
  assert.equal(availabilityText("some_future_state"), "some future state");
});

test("scoreText: N / 100 for numbers, a real zero stays zero, server words otherwise, never a percent sign", () => {
  const current = outreachAssessmentSchema.parse(F.outreachReady).current!;
  assert.equal(scoreText(current.transaction_intent), "50 / 100");
  assert.equal(scoreText(current.move_likelihood), "75 / 100");
  assert.equal(scoreText({ score: 0, label: "0 / 100" }), "0 / 100");
  assert.equal(scoreText({ score: null, label: "Unknown" }), "Unknown");
  assert.equal(scoreText({ score: null, label: "Pending" }), "Pending");
  assert.equal(scoreText({ score: null, label: "Not assessed" }), "Not assessed");
  assert.equal(scoreText({ score: null, label: "Not applicable" }), "Not applicable");
  assert.equal(scoreText({ score: null, label: "87%" }), "Unknown", "an unexpected label never leaks a percent");
  assert.equal(scoreText(null, "not_assessed"), "Not assessed");
  assert.equal(scoreText(null, "pending"), "Pending");
  const old = outreachAssessmentSchema.parse(F.outreachAssessmentOnly).current!;
  assert.equal(scoreText(old.transaction_intent), "Unknown", "assessed Unknown is not zero");
  for (const value of [0, 25, 50, 75, 100]) noPercent(scoreText({ score: value, label: "" }));
});

test("closed work reads Not applicable; the historical number is only offered as history", () => {
  const closed = outreachAssessmentSchema.parse(F.outreachClosed).current!;
  assert.equal(scoreText(closed.transaction_intent), "Not applicable");
  assert.equal(historicalScoreText(closed.transaction_intent), "Historical score 50 / 100, kept for review only");
  assert.equal(historicalScoreText(outreachAssessmentSchema.parse(F.outreachReady).current!.transaction_intent), null);
  assert.equal(applicabilityText("closed"), "Not applicable — closed work");
  assert.equal(applicabilityText("not_applicable"), "Not applicable — terminal CRM disposition");
});

test("level, confidence, freshness and view labels are words for server values", () => {
  const current = outreachAssessmentSchema.parse(F.outreachReady).current!;
  assert.equal(levelText(current.move_likelihood.level), "Strong");
  assert.equal(levelText(null), "Unknown");
  assert.equal(confidenceText("medium"), "Medium confidence");
  assert.equal(confidenceText(null), "Confidence not stated");
  assert.equal(freshnessText(current.move_likelihood), "Stale: move date passed");
  assert.equal(freshnessText({ stale: false, stale_reason: null }), "Current");
  assert.equal(originalViewLabel(current.views.original_ingestion), "Original form submission");
  assert.equal(originalViewLabel({ label: "legacy_baseline" }), "Legacy baseline");
  assert.equal(originalViewLabel({ label: null }), "Unknown origin");
  assert.equal(originalViewLabel(null), "Unknown origin");
});

test("move views keep original, current and customer statements apart", () => {
  const current = outreachAssessmentSchema.parse(F.outreachReady).current!;
  const original = moveViewRows(current.views.original_ingestion), canonical = moveViewRows(current.views.canonical_current);
  assert.equal(original.find(row => row.label === "Move date")?.value, "2026-10-01");
  assert.equal(canonical.find(row => row.label === "Move date")?.value, "2026-10-15");
  assert.equal(canonical.find(row => row.label === "Pickup")?.value, "Austin, TX 78701");
  assert.equal(canonical.find(row => row.label === "Cubic feet")?.value, "Unknown");
  assert.deepEqual(moveViewRows(null), []);
  assert.equal(placeText({ city: null, state: "TX", zip: null }), "TX", "state-only precision is kept");
  assert.equal(placeText({ city: null, state: null, zip: null }), "Unknown");
});

test("observations group by field in reading order and read as plain text", () => {
  const obs = (field: string, value: Record<string, unknown>, status = "stated"): Observation => ({ field, value: value as Observation["value"], status, evidence: [] });
  const groups = groupObservations([
    obs("money", { basis: "budget", amount: { min: 2000, max: 2000 }, currency: "USD", text: "about two grand" }),
    obs("move_date", { raw_text: "the fifteenth", date: "2026-10-15", end_date: null, applies_to: "pickup", flexibility: "fixed", precision: "exact" }),
    obs("pickup_location", { line: null, city: "Austin", state: "TX", zip: null, precision: "city" }),
    obs("move_date", { raw_text: "sometime in spring", date: null, end_date: null, applies_to: "unspecified", flexibility: "unknown", precision: "unresolved" }, "conditional"),
    obs("future_field", { anything: 1 }),
  ]);
  assert.deepEqual(groups.map(group => group.label), ["Pickup", "Move date", "Budget and prices", "future field"]);
  assert.equal(groups[1]!.items.length, 2);
  assert.equal(observationText(groups[0]!.items[0]!), "Austin, TX (city precision)");
  assert.equal(observationText(groups[1]!.items[0]!), "2026-10-15 — “the fifteenth” · pickup · fixed · exact precision");
  assert.match(observationText(groups[1]!.items[1]!), /^Date not resolved — “sometime in spring”/);
  assert.equal(observationText(groups[2]!.items[0]!), "budget · USD 2000 · “about two grand”");
  const fromServer = outreachAssessmentSchema.parse(F.outreachReady).current!.views.customer_stated;
  assert.equal(groupObservations(fromServer)[0]!.label, "Move date");
});

test("inventory quantity: unknown is Unknown, never one; ranges and bounds read plainly", () => {
  assert.equal(quantityText({ min: null, max: null }), "Unknown");
  assert.equal(quantityText({ min: 1, max: 1 }), "1");
  assert.equal(quantityText({ min: 2, max: 3 }), "2–3");
  assert.equal(quantityText({ min: 4, max: null }), "At least 4");
  assert.equal(quantityText({ min: null, max: 6 }), "Up to 6");
});

test("evidence: summary citations are summary text, only transcript quotes are quotes, focus keeps order and reports missing ids", () => {
  const section = evidenceSectionSchema.parse(F.assessmentEvidence);
  const e1 = section.items.find(item => item.id === "e1")!;
  assert.equal(evidenceTextLabel(e1), "Summary text");
  assert.equal(evidenceTextLabel(section.items.find(item => item.id === "e5")!), "Summary text");
  assert.equal(evidenceTextLabel(section.items.find(item => item.id === "e3")!), "Finding claim");
  const run = runPresentationSchema.parse(F.legacyRun);
  assert.equal(evidenceTextLabel(run.evidence.items[0]!), "Transcript quote kept by the analysis");
  assert.match(locatorText(e1.source), /^Captured conversation summary · said_on_call\.0/);
  assert.match(locatorText(section.items.find(item => item.id === "e2")!.source), /^FormLead .* · current · move_date$/);
  assert.match(locatorText(run.evidence.items[0]!.source), /^Call transcript · 2 lines/);
  const focused = focusEvidence(section.items, ["e4", "e1", "nope"]);
  assert.deepEqual(focused.items.map(item => item.id), ["e1", "e4"], "server order, not click order");
  assert.deepEqual(focused.missing, ["nope"]);
  assert.equal(focusEvidence(section.items, null).items.length, section.items.length);
});

test("versions: each option names its own time, status, schema, both scores and current/shadow without a percent", () => {
  const data = outreachAssessmentSchema.parse(F.outreachReady);
  const options = data.versions.map(version => versionOption(version, value => value ?? "unknown time"));
  assert.match(options[0]!.label, /^2026-09-20T12:00:00.000Z · Assessed · schema move-assessment-v1 · Transaction intent 50 \/ 100 · Move likelihood 75 \/ 100 · Current$/);
  assert.match(options[1]!.label, /Transaction intent Unknown · Move likelihood 50 \/ 100$/);
  assert.match(options[2]!.label, /Purged .*Transaction intent Unavailable · Move likelihood Unavailable/);
  options.forEach(option => noPercent(option.label));
  assert.equal(versionScoreText(null, "pending"), "Pending");
  assert.equal(versionOption({ ...data.versions[0]!, current: false, shadow: true }, () => "t").label.endsWith("Shadow"), true);
});

test("full output: choices cover assessment versions and the selected run; representations never merge", () => {
  const data = outreachAssessmentSchema.parse(F.outreachReady), structured = runPresentationSchema.parse(F.structuredRun);
  const choices = outputChoices({ versions: data.versions, runId: structured.run_id, runRefs: structured.full_output });
  assert.deepEqual(choices.map(choice => choice.kind), ["move_assessment", "move_assessment", "move_assessment", "conversation_summary", "findings"]);
  assert.equal(choices[2]!.available, false, "a purged version is listed but labelled unavailable");
  assert.deepEqual(choices[4]!.source, { type: "run", run_id: structured.run_id, output_id: structured.run_id });
  assert.deepEqual(outputChoices({ versions: [], runId: null, runRefs: structured.full_output }), [], "no run selected, no run outputs");

  const findings = outputRepresentations(fullOutputSchema.parse(F.structuredFindingsOutput));
  assert.deepEqual(findings.items.map(item => item.key), ["accepted"]);
  assert.equal(findings.note, "Exact model object not retained; showing the accepted, server-expanded result.");
  const assessment = outputRepresentations(fullOutputSchema.parse(F.assessmentOutput));
  assert.deepEqual(assessment.items.map(item => item.key), ["model_output", "accepted"]);
  assert.equal(assessment.note, null);
  assert.deepEqual(outputRepresentations(fullOutputSchema.parse(F.purgedAssessmentOutput)).items, []);
  const legacy = outputRepresentations(fullOutputSchema.parse(F.legacyOutput));
  assert.deepEqual(legacy.items.map(item => item.key), ["model_output"]);
  // Copy output copies the complete retained object, arrays included.
  const text = outputJson(assessment.items[0]!.value);
  assert.deepEqual(JSON.parse(text), F.assessmentOutput.model_output);
});

test("readable Summary & findings: the presentation DTO is the source; the run detail is read as recorded only as a fallback", () => {
  const legacy = runPresentationSchema.parse(F.legacyRun), structured = runPresentationSchema.parse(F.structuredRun);
  const label = (key: string) => `L:${key}`;
  assert.equal(readableSummary(legacy.summary_findings.summary, null, label)?.sections[0]?.label, "Overview");
  assert.match(readableSummary(structured.summary_findings.summary, null, label)!.sections[0]!.text, /^Structured:/, "one component for both versions");
  const fallback = readableSummary(null, { summary: { overview: "Hello", outcome: "Callback", ignored: "x" }, next_step_suggestion: null }, label)!;
  assert.deepEqual(fallback.sections.map(section => section.label), ["L:overview", "L:outcome"]);
  assert.equal(readableSummary(null, null, label), null);

  const detail = [{ id: legacy.summary_findings.findings[0]!.id, revision: 1, review_state: "retracted", validation: {}, effects: [],
    assertion: { key: "f1", kind: "move_fact", claim: "Moving October 15" } }] as unknown as AnalysisFinding[];
  const joined = readableFindings(legacy.summary_findings.findings, detail);
  assert.equal(joined.length, 2);
  assert.equal(joined[0]!.detail?.id, joined[0]!.id, "commands attach to the stored finding");
  assert.equal(joined[0]!.reviewState, "retracted", "the fresher run detail review state wins");
  assert.equal(joined[1]!.detail, null);
  assert.equal(joined[0]!.evidenceIds.length, 1);
  assert.equal(findingAlert(joined[0]!)?.tone, "red", "a retraction stays visible without opening the chain");
  const blocked = readableFindings([{ ...legacy.summary_findings.findings[1]!, effects: [{ kind: "create_followup", status: "blocked_owner", reason: null, target_id: null }] }], null);
  assert.equal(findingAlert(blocked[0]!)?.important, true);
  assert.deepEqual(readableFindings(null, detail).map(finding => finding.claim), ["Moving October 15"]);
});

test("a legacy run detail without processing_reason still opens (it used to fail the whole panel)", async () => {
  const { analysisSchema } = await import("./salesIntelligenceAnalysis");
  const run = { id: "r", revision: 1, status: "completed", mode: "initial", conversation_id: "c", created_at: "2026-09-13T15:00:00Z", completed_at: "2026-09-13T15:00:00Z",
    current: true, editable: false, output_digest: null, suggestion_output_digest: null, model_version: "m", prompt_version: "p", original_evidence_available: false,
    contact_number_id: "n", outreach: null, output: { summary: { overview: "o" }, next_step_suggestion: null }, findings: [], actions: [], instructions: [],
    instructions_complete: true, history: [] };
  const parsed = analysisSchema.parse({ data: run });
  assert.equal(parsed.data.processing_reason, null);
});
