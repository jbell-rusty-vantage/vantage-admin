import assert from "node:assert/strict";
import test from "node:test";
import { captureHealthProp, liveHealthOf, liveStatusOf, narrowHealth, readNewestAsOf, reportAsOf, resetNewestAsOf } from "../../components/sales-intelligence/data/live";
import { SALES_INTELLIGENCE_FALLBACK_POLL_MS, SALES_INTELLIGENCE_OFFLINE_MS } from "../../lib/query/salesIntelligence";

// The header indicator's inputs and the fallback constants (UI-0 §2.5). No DOM: the SSE reconnect and timers need a browser.

test("the header goes Offline only after the down timer runs out; live never reads as offline", () => {
  assert.equal(liveStatusOf("live", true), "live");
  assert.equal(liveStatusOf("reconnecting", false), "reconnecting");
  assert.equal(liveStatusOf("reconnecting", true), "offline");
  assert.equal(liveStatusOf("connecting", true), "offline");
  assert.equal(SALES_INTELLIGENCE_OFFLINE_MS, 30_000);
  assert.equal(SALES_INTELLIGENCE_FALLBACK_POLL_MS, 60_000);
});

test("capture health comes from the coverage read only; an unknown word is not guessed", () => {
  assert.deepEqual(liveHealthOf({ status: "attention", known_complete_through: "2026-09-21T04:00:00.000Z" }), { status: "attention", knownCompleteThrough: "2026-09-21T04:00:00.000Z" });
  assert.deepEqual(liveHealthOf(null), { status: null, knownCompleteThrough: null });
  assert.equal(narrowHealth("degraded"), null);
  assert.equal(captureHealthProp(liveHealthOf({ status: "degraded", known_complete_through: null })), null);
  assert.deepEqual(captureHealthProp(liveHealthOf({ status: "broken", known_complete_through: null })), { status: "broken", knownCompleteThrough: null });
});

test("the header shows the newest server as_of on screen and ignores older or unparseable ones", () => {
  resetNewestAsOf();
  reportAsOf("2026-09-21T04:00:00.000Z");
  reportAsOf("2026-09-21T03:00:00.000Z");
  reportAsOf("not a time");
  reportAsOf(null);
  assert.equal(readNewestAsOf(), "2026-09-21T04:00:00.000Z");
  reportAsOf("2026-09-21T05:00:00.000Z");
  assert.equal(readNewestAsOf(), "2026-09-21T05:00:00.000Z");
  resetNewestAsOf();
});
