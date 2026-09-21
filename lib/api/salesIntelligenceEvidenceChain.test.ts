import test from "node:test";
import assert from "node:assert/strict";
import {
  assertionEvidence,
  assertionFacts,
  citedSnapshotIds,
  effectKindLabel,
  effectVerdict,
  findingValidation,
  reanalysisBody,
  requestsForFinding,
  requestsForRun,
  reviewVerdict,
  runStatusText,
  validationReadouts,
  validationVerdict,
} from "./salesIntelligenceAnalysis";
import { evidenceChainCopy } from "../../components/sales-intelligence/evidence-chain-copy";

const verified = /verified|checked and|passed|found/i;

test("locator_status not_run never reads as verified", () => {
  const rows = validationReadouts({ schema_ok: true, source_snapshots_valid: true, locator_status: "not_run", entailment_check: "not_run" });
  const quote = rows.find((row) => row.label === evidenceChainCopy.claim.checksLabel.locator)!;
  assert.equal(quote.text, "The quote was not machine-checked.");
  assert.equal(quote.tone, "amber");
  assert.equal(verified.test(quote.text), false);
  const support = rows.find((row) => row.label === evidenceChainCopy.claim.checksLabel.support)!;
  assert.equal(support.text, "Whether the evidence supports the claim was not machine-checked.");
  assert.equal(support.tone, "amber");
  const verdict = validationVerdict({ schema_ok: true, source_snapshots_valid: true, locator_status: "not_run", entailment_check: "not_run" });
  assert.equal(verdict.text, evidenceChainCopy.claim.headline.unchecked);
  assert.equal(verdict.tone, "amber");
  assert.notEqual(verdict.text, evidenceChainCopy.claim.headline.checked);
});

test("missing or unreadable validation reads as not checked, never as a pass", () => {
  assert.deepEqual(findingValidation(undefined), { schema_ok: false, source_snapshots_valid: false, locator_status: "not_run", entailment_check: "not_run" });
  assert.deepEqual(findingValidation("nonsense"), { schema_ok: false, source_snapshots_valid: false, locator_status: "not_run", entailment_check: "not_run" });
  const verdict = validationVerdict(null);
  assert.equal(verdict.text, evidenceChainCopy.claim.headline.problem);
  assert.equal(verdict.tone, "red");
  const unknownLocator = validationReadouts({ schema_ok: true, source_snapshots_valid: true, locator_status: "made_up", entailment_check: "pass" });
  assert.equal(unknownLocator[2].text, evidenceChainCopy.claim.locator.unknown);
  assert.equal(unknownLocator[2].tone, "amber");
});

test("a located quote and a passing support check read as checked", () => {
  const rows = validationReadouts({ schema_ok: true, source_snapshots_valid: true, locator_status: "located", entailment_check: "pass" });
  assert.deepEqual(rows.map((row) => row.tone), ["green", "green", "green", "green"]);
  assert.equal(validationVerdict({ schema_ok: true, source_snapshots_valid: true, locator_status: "located", entailment_check: "pass" }).text, evidenceChainCopy.claim.headline.checked);
  const failed = validationVerdict({ schema_ok: true, source_snapshots_valid: false, locator_status: "unlocated", entailment_check: "fail" });
  assert.equal(failed.text, evidenceChainCopy.claim.headline.problem);
  assert.equal(failed.important, true);
});

test("effect outcomes read in plain English and blocked cases are flagged important", () => {
  assert.equal(effectVerdict("applied", null).text, "Applied to your work.");
  assert.equal(effectVerdict("applied", null).important, false);
  assert.equal(effectVerdict("no_change", null).text, "Nothing changed. Your work already read this way.");
  assert.equal(effectVerdict("no_change", null).important, false);
  for (const status of ["blocked_owner", "blocked_identity", "blocked_closed", "blocked_restriction", "needs_review"]) {
    const verdict = effectVerdict(status, null);
    assert.equal(verdict.important, true, `${status} must be important`);
    assert.equal(verdict.tone, "red", `${status} must read as a problem`);
    assert.notEqual(verdict.text, evidenceChainCopy.effect.status.unknown);
  }
  assert.equal(effectVerdict("blocked_owner", "owner_precedence").text, "Blocked. Your own correction wins. Reason recorded: owner_precedence");
  assert.equal(effectVerdict("stale", null).tone, "amber");
  assert.equal(effectVerdict("stale", null).important, true);
  const unknown = effectVerdict("something_new", null);
  assert.equal(unknown.text, evidenceChainCopy.effect.status.unknown);
  assert.equal(unknown.important, false);
  assert.equal(effectKindLabel("create_followup"), "Added a follow-up");
  assert.equal(effectKindLabel("brand_new_kind"), "brand new kind");
});

test("review state and run status read as Owner sentences", () => {
  assert.equal(reviewVerdict("unreviewed").text, evidenceChainCopy.decision.unreviewed);
  assert.equal(reviewVerdict("confirmed").text, "Confirmed by you");
  assert.equal(reviewVerdict("corrected").important, true);
  assert.equal(reviewVerdict("retracted").tone, "red");
  assert.equal(reviewVerdict("retracted").important, true);
  assert.equal(runStatusText("queued"), "Waiting to start.");
  assert.equal(runStatusText("dead_letter"), "Stopped after repeated failures. That is not a customer outcome.");
  assert.equal(runStatusText("invented"), evidenceChainCopy.run.status.unknown);
});

test("reanalysis body fences the run and only carries focus_finding_id when scoped", () => {
  const plain = reanalysisBody({ runId: "run-1", runRevision: 7, mode: "original_evidence", ownerCorrectionIds: ["i-1"], reason: "Missed the callback promise." });
  assert.deepEqual(plain, {
    command: "reanalyze",
    expected_revision: 7,
    mode: "original_evidence",
    source_run_id: "run-1",
    owner_correction_ids: ["i-1"],
    reason: "Missed the callback promise.",
  });
  assert.equal("focus_finding_id" in plain, false);
  const scoped = reanalysisBody({ runId: "run-1", runRevision: 7, mode: "current_context", ownerCorrectionIds: [], reason: "Look at this claim again.", focusFindingId: "finding-9" });
  assert.equal(scoped.focus_finding_id, "finding-9");
  assert.equal(scoped.expected_revision, 7, "the run revision fences a reanalysis, never a finding revision");
  assert.equal(scoped.source_run_id, "run-1");
  assert.equal("focus_finding_id" in reanalysisBody({ runId: "r", runRevision: 1, mode: "current_context", ownerCorrectionIds: [], reason: "x", focusFindingId: null }), false);
});

test("assertion references are read defensively and grouped by snapshot", () => {
  const assertion = {
    key: "k1",
    kind: "promised_callback",
    claim: "The rep said they would call back Monday.",
    basis: "said_on_call",
    actor: "rep",
    action_status: "promised",
    clarity: "uncertain",
    confidence: 0.4,
    evidence: [
      { source: "transcript", snapshot_id: "snap-1", conversation_id: "conv-1", transcript_version: "v2", segment_ids: [4, 5], quote: "I will call you Monday" },
      { source: "vantage_record", snapshot_id: "snap-2", record_type: "followup", record_id: "f-1", field_paths: ["status", "due_at"] },
      { source: "mystery", snapshot_id: "snap-1" },
      "not an object",
    ],
  };
  const refs = assertionEvidence(assertion);
  assert.equal(refs.length, 4);
  assert.equal(refs[0].source, "transcript");
  assert.equal(refs[0].segment_count, 2);
  assert.equal(refs[0].quote, "I will call you Monday");
  assert.equal(refs[1].source, "vantage_record");
  assert.deepEqual(refs[1].field_paths, ["status", "due_at"]);
  assert.equal(refs[2].source, "other");
  assert.equal(refs[3].snapshot_id, null);
  assert.deepEqual(citedSnapshotIds(assertion), ["snap-1", "snap-2"]);
  assert.deepEqual(assertionEvidence({ key: "k", kind: "intent", claim: "c" }), []);
  const facts = assertionFacts(assertion);
  assert.deepEqual(facts, { basis: "said_on_call", actor: "rep", actionStatus: "promised", clarity: "uncertain", confidence: "0.4" });
  assert.deepEqual(assertionFacts({}), { basis: null, actor: null, actionStatus: null, clarity: null, confidence: null });
});

test("reanalysis requests split between the run and one assertion", () => {
  const requests = [
    { id: "j1", run_id: "run-1", mode: "current_context", status: "queued", reason: null, created_at: "2026-09-20T12:00:00.000Z" },
    { id: "j2", run_id: "run-1", mode: "original_evidence", status: "completed", reason: null, created_at: "2026-09-20T13:00:00.000Z", focus_finding_id: "finding-9" },
  ];
  assert.deepEqual(requestsForFinding(requests, "finding-9").map((row) => row.id), ["j2"]);
  assert.deepEqual(requestsForFinding(requests, "finding-other"), []);
  assert.deepEqual(requestsForRun(requests).map((row) => row.id), ["j1"]);
});
