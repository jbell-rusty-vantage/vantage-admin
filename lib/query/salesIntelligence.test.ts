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
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["attachment"]))), ["attachment-pair", "attachments", "number", "numbers"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["number"]))), ["coverage", "number", "numbers", "timeline"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["restriction"]))), ["number"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["rep"]))), ["reps", "timeline"]);
  assert.deepEqual(segments(salesIntelligenceInvalidationKeys(change(["nudge"]))), ["reps"]);
  // Every mapped topic stays inside the Sales Intelligence tree and narrower than the whole tree.
  for (const [topic, keys] of Object.entries(salesIntelligenceTopicKeys)) {
    assert.ok(keys.length, topic);
    for (const key of keys) {
      assert.equal(key[0], salesIntelligenceKeys.all[0], topic);
      assert.equal(key.length, 2, topic);
    }
  }
});

test("only the retained Numbers and RingCentral Accounts topics are narrowed", () => {
  assert.deepEqual(Object.keys(salesIntelligenceTopicKeys).sort(), ["attachment", "nudge", "number", "rep", "restriction"]);
  // A retired topic (an older server still publishing it) is not narrowed: it resyncs the whole tree.
  for (const topic of ["outreach", "analysis", "attention", "review"]) {
    assert.deepEqual(salesIntelligenceInvalidationKeys(change([topic])), [[...salesIntelligenceKeys.all]], topic);
  }
});

test("two topics in one frame merge without repeating a key", () => {
  const keys = salesIntelligenceInvalidationKeys(change(["attachment", "number"]));
  assert.deepEqual(segments(keys), ["attachment-pair", "attachments", "coverage", "number", "numbers", "timeline"]);
  assert.equal(new Set(keys.map((key) => key.join("/"))).size, keys.length);
});

test("anything we cannot narrow honestly resyncs the whole tree", () => {
  const whole = [[...salesIntelligenceKeys.all]];
  // A server that grows a topic, or an unmapped collection, must not silently skip a refetch.
  assert.deepEqual(salesIntelligenceInvalidationKeys(change(["other"])), whole);
  assert.deepEqual(salesIntelligenceInvalidationKeys(change(["number", "a_topic_from_a_newer_server"])), whole);
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
  publishSalesIntelligencePulse(["number", "attachment", "number"], "2026-09-21T04:00:00.000Z");
  assert.deepEqual(readSalesIntelligencePulse(), { topics: ["attachment", "number"], at: "2026-09-21T04:00:00.000Z" });
  assert.equal(notified, 1);
  t.mock.timers.tick(SALES_INTELLIGENCE_PULSE_MS - 1);
  assert.deepEqual(readSalesIntelligencePulse().topics, ["attachment", "number"]);
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
  publishSalesIntelligencePulse(["rep"], "2026-09-21T04:00:30.000Z");
  assert.equal(notified, 4);
});
