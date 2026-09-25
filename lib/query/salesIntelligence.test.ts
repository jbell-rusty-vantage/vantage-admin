import assert from "node:assert/strict";
import test, { mock } from "node:test";
import {
  publishSalesIntelligencePulse,
  readSalesIntelligencePulse,
  salesIntelligenceInvalidationKeys,
  salesIntelligenceKeys,
  salesIntelligenceTopicKeys,
  subscribeSalesIntelligencePulse,
  SALES_INTELLIGENCE_PULSE_MS,
} from "./salesIntelligence";

const change = (topics: string[]) => ({ version: 2, reason: "change", topics, as_of: "2026-09-21T04:00:00.000Z" });
const segments = (keys: readonly (readonly string[])[]) => keys.map((key) => key[1] ?? "*").sort();

test("a change frame invalidates only the query keys its topics can change", () => {
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["attention"]))), ["attention", "closed-history", "overview"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["rep"]))), ["nudge-destinations", "reps"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["outreach"]))), [
    "assessment", "closed-history", "number", "outreach", "outreach-by-lead", "overview", "timeline",
  ]);
  // Every mapped topic stays inside the Sales Intelligence tree and narrower than the whole tree.
  for (const [topic, keys] of Object.entries(salesIntelligenceTopicKeys)) {
    assert.ok(keys.length, topic);
    for (const key of keys) {
      assert.equal(key[0], salesIntelligenceKeys.all[0], topic);
      assert.equal(key.length, 2, topic);
    }
  }
});

test("two topics in one frame merge without repeating a key", () => {
  const keys = salesIntelligenceInvalidationKeys(change(["analysis", "outreach"]));
  assert.deepEqual(segments(keys), [
    "analysis-evidence", "analysis-evidence-content", "analysis-output", "analysis-presentation", "analysis-run", "analysis-runs",
    "assessment", "assessment-artifact", "assessment-evidence", "assessment-output", "closed-history", "conversations", "coverage", "findings",
    "number", "outreach", "outreach-by-lead", "overview", "timeline", "transcript",
  ]);
  assert.equal(new Set(keys.map((key) => key.join("/"))).size, keys.length);
});

test("record writes do not restart the published attention list", () => {
  for (const topic of ["outreach", "attachment", "number", "review", "restriction", "analysis", "rep", "nudge"]) {
    assert.equal(segments(salesIntelligenceInvalidationKeys(change([topic]))).includes("attention"), false, topic);
  }
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["attention"]))), ["attention", "closed-history", "overview"]);
});

test("anything we cannot narrow honestly resyncs the whole tree", () => {
  const whole = [[...salesIntelligenceKeys.all]];
  // A server that grows a topic, or an unmapped collection, must not silently skip a refetch.
  assert.deepEqual(salesIntelligenceInvalidationKeys(change(["other"])), whole);
  assert.deepEqual(salesIntelligenceInvalidationKeys(change(["outreach", "a_topic_from_a_newer_server"])), whole);
  // A reconnect resyncs everything: the drop itself is the gap.
  assert.deepEqual(salesIntelligenceInvalidationKeys({ version: 2, reason: "reconnect", topics: [] }), whole);
  assert.deepEqual(salesIntelligenceInvalidationKeys({ version: 2, reason: "connect", topics: [] }), whole);
  assert.deepEqual(salesIntelligenceInvalidationKeys({ version: 2, reason: "clock", topics: [] }), whole);
  // A version 1 server still says only "refetch: all".
  const v1 = { version: 1, reason: "change", refetch: "all" };
  assert.deepEqual(salesIntelligenceInvalidationKeys(v1), whole);
  assert.deepEqual(salesIntelligenceInvalidationKeys({}), whole);
});

test("the pulse reports the last change and settles back on its own", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => mock.timers.reset());
  let notified = 0;
  const unsubscribe = subscribeSalesIntelligencePulse(() => { notified += 1; });
  publishSalesIntelligencePulse(["outreach", "attention", "outreach"], "2026-09-21T04:00:00.000Z");
  assert.deepEqual(readSalesIntelligencePulse(), { topics: ["attention", "outreach"], at: "2026-09-21T04:00:00.000Z" });
  assert.equal(notified, 1);
  t.mock.timers.tick(SALES_INTELLIGENCE_PULSE_MS - 1);
  assert.deepEqual(readSalesIntelligencePulse().topics, ["attention", "outreach"]);
  t.mock.timers.tick(1);
  assert.deepEqual(readSalesIntelligencePulse(), { topics: [], at: "2026-09-21T04:00:00.000Z" });
  assert.equal(notified, 2);
  // A later change restarts the window rather than decaying on the first one's timer.
  publishSalesIntelligencePulse(["number"], "2026-09-21T04:00:10.000Z");
  t.mock.timers.tick(SALES_INTELLIGENCE_PULSE_MS - 1);
  assert.deepEqual(readSalesIntelligencePulse(), { topics: ["number"], at: "2026-09-21T04:00:10.000Z" });
  t.mock.timers.tick(1);
  assert.deepEqual(readSalesIntelligencePulse(), { topics: [], at: "2026-09-21T04:00:10.000Z" });
  // A clock frame carries no topics, so it never produces a pulse.
  publishSalesIntelligencePulse([], "2026-09-21T04:00:20.000Z");
  assert.deepEqual(readSalesIntelligencePulse(), { topics: [], at: "2026-09-21T04:00:10.000Z" });
  unsubscribe();
  publishSalesIntelligencePulse(["review"], "2026-09-21T04:00:30.000Z");
  assert.equal(notified, 4);
});
