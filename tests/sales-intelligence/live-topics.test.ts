import assert from "node:assert/strict";
import test from "node:test";
import { salesIntelligenceInvalidationKeys, salesIntelligenceKeys, salesIntelligenceTopicKeys } from "../../lib/query/salesIntelligence";
import { siKeys, type SiKeyBuilder } from "../../components/sales-intelligence/data/query-keys";
import { assessmentQueryKey } from "../../components/sales-intelligence/data/use-assessment";

/*
 * ADMIN-REBUILD trap 1 / UI-0 §2.5: a query key whose segment no live topic reaches never refreshes on a
 * change frame (only on reconnect). Every builder in data/query-keys.ts is listed here — the Record type
 * makes a new builder without a sample a type error — and each must be reachable from at least one topic.
 */
const SAMPLES: Record<SiKeyBuilder, () => readonly unknown[]> = {
  attention: () => siKeys.attention({ view: "attention", priority: ["0", "not_set"] }),
  overview: () => siKeys.overview({ period: "today" }),
  closedHistory: () => siKeys.closedHistory({ outcome: ["booked"] }),
  outreach: () => siKeys.outreach("o1"),
  outreachByLead: () => siKeys.outreachByLead("FormLead", "l1"),
  timeline: () => siKeys.timeline("outreach", "o1", ["call"]),
  assessment: () => siKeys.assessment("o1"),
  assessmentArtifact: () => siKeys.assessmentArtifact("a1"),
  assessmentEvidence: () => siKeys.assessmentEvidence("a1"),
  assessmentOutput: () => siKeys.assessmentOutput("a1"),
  findings: () => siKeys.findings("o1", true),
  analysisRun: () => siKeys.analysisRun("r1"),
  analysisPresentation: () => siKeys.analysisPresentation("r1"),
  analysisEvidence: () => siKeys.analysisEvidence("r1"),
  analysisOutput: () => siKeys.analysisOutput("r1", "out1"),
  conversations: () => siKeys.conversations("n1"),
  transcript: () => siKeys.transcript("c1", 2),
  nudges: () => siKeys.nudges("o1"),
  nudgeDestinations: () => siKeys.nudgeDestinations(null),
  reps: () => siKeys.reps("limit=100"),
  coverage: () => siKeys.coverage(),
};
// Keys the kept hooks build by hand (`_legacy/` imports them); they follow the same rule.
const KEPT: Record<string, () => readonly unknown[]> = {
  assessmentQueryKey: () => assessmentQueryKey("o1"),
  useRunEvidence: () => [...salesIntelligenceKeys.all, "analysis-evidence", "r1", null],
};

const reachingTopics = (segment: unknown) =>
  Object.entries(salesIntelligenceTopicKeys).filter(([, prefixes]) => prefixes.some((prefix) => prefix[1] === segment)).map(([topic]) => topic);

test("every query-key builder starts with the Sales Intelligence root and a segment some live topic reaches", () => {
  const unreachable: string[] = [];
  for (const [name, build] of Object.entries({ ...SAMPLES, ...KEPT })) {
    const key = build();
    assert.equal(key[0], salesIntelligenceKeys.all[0], `${name} must start with salesIntelligenceKeys.all`);
    assert.equal(typeof key[1], "string", `${name} must have a segment`);
    if (!reachingTopics(key[1]).length) unreachable.push(`${name} → "${String(key[1])}"`);
  }
  assert.deepEqual(unreachable, [], `No live topic reaches: ${unreachable.join(", ")}. Add the segment to salesIntelligenceTopicKeys in the same change.`);
});

test("the UI-1 reads refresh on the topics UI1-DATA mapped", () => {
  const expected: Record<string, string[]> = {
    overview: ["attention", "outreach"],
    "closed-history": ["attention", "outreach"],
    findings: ["analysis", "review"],
    conversations: ["analysis", "number"],
    transcript: ["analysis", "number"],
  };
  for (const [segment, topics] of Object.entries(expected)) assert.deepEqual(reachingTopics(segment).sort(), topics, segment);
});

test("UI1-LIVE: the header and composer reads (nudges, overview, coverage) are reached by their topics", () => {
  const expected: Record<string, string[]> = {
    nudges: ["nudge"],
    "nudge-destinations": ["rep"],
    reps: ["rep"],
    overview: ["attention", "outreach"],
    coverage: ["analysis", "number"],
  };
  for (const [segment, topics] of Object.entries(expected)) assert.deepEqual(reachingTopics(segment).sort(), topics, segment);
  // A nudge frame refreshes the Work tab's history and the detail read that carries `nudges.items`.
  const nudge = salesIntelligenceInvalidationKeys({ version: 2, reason: "change", topics: ["nudge"] });
  for (const key of [siKeys.nudges("o1"), siKeys.outreach("o1")]) {
    assert.ok(nudge.some((prefix) => prefix.every((part, index) => key[index] === part)), `nudge reaches ${String(key[1])}`);
  }
});

test("a change frame's invalidation prefix matches the built keys (prefix match, not equality)", () => {
  const frame = { version: 2, reason: "change", topics: ["analysis"] };
  const prefixes = salesIntelligenceInvalidationKeys(frame);
  const key = siKeys.transcript("c1", 0);
  assert.ok(prefixes.some((prefix) => prefix.every((part, index) => key[index] === part)), "an analysis change reaches a transcript key");
  // The attention list is still never restarted by a record write (lib/query test keeps the full rule).
  assert.equal(salesIntelligenceInvalidationKeys({ version: 2, reason: "change", topics: ["outreach"] }).some((prefix) => prefix[1] === "attention"), false);
});

test("keys are stable for equal requests and differ when a filter differs", () => {
  assert.deepEqual(siKeys.attention({ view: "attention", priority: ["0"] }), siKeys.attention({ view: "attention", priority: ["0"] }));
  assert.notDeepEqual(siKeys.attention({ view: "attention", priority: ["0"] }), siKeys.attention({ view: "attention", priority: ["1"] }));
  assert.deepEqual(siKeys.timeline("number", "n1", ["call", "band_changed"]), siKeys.timeline("number", "n1", ["band_changed", "call"]));
});
