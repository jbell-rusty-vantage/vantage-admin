import assert from "node:assert/strict";
import test from "node:test";
import { formatRelative, newYorkDayKey, parseInstant } from "../components/ui/crm/format";

test("parseInstant reads epoch milliseconds as well as ISO strings and Dates (2026-10-06 production fix)", () => {
  const ms = Date.parse("2026-10-06T15:40:00.000Z");
  assert.equal(parseInstant(ms)?.toISOString(), "2026-10-06T15:40:00.000Z");
  assert.equal(parseInstant("2026-10-06T15:40:00.000Z")?.toISOString(), "2026-10-06T15:40:00.000Z");
  assert.equal(parseInstant(new Date(ms))?.getTime(), ms);
  assert.equal(parseInstant(null), null);
  assert.equal(parseInstant("garbage"), null);
  // The Granot updates start page derives today from the clock; an empty key crashed the page before this fix.
  assert.match(newYorkDayKey(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(newYorkDayKey(ms), "2026-10-06");
  assert.equal(newYorkDayKey(new Date(ms)), "2026-10-06");
  assert.equal(formatRelative(ms, new Date(ms)), "11:40 AM");
});
