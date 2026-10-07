import assert from "node:assert/strict";
import test from "node:test";
import { monthlyRows, reviewsFreshness, starGlyphs, starRows } from "./reviews";
import { textToBookedSummary } from "./text-to-booked";
import { definitionFor, PRIMARY_SCORECARDS } from "./scorecards";

test("starRows always lists 5★ to 1★ with shares of each column", () => {
  const rows = starRows([
    { stars: 1, all_time: 1, period: 0, comparison: 0 },
    { stars: 5, all_time: 3, period: 2, comparison: 1 },
  ]);
  assert.deepEqual(rows.map((row) => row.stars), [5, 4, 3, 2, 1]);
  assert.equal(rows[0]?.allTimeShare, 0.75);
  assert.equal(rows[0]?.periodShare, 1);
  assert.equal(rows[4]?.periodShare, 0);
});

test("monthlyRows sorts by month with labels", () => {
  assert.deepEqual(monthlyRows([{ month: "2026-02", count: 2, average_rating: 4.5 }, { month: "2025-12", count: 1, average_rating: null }]).map((row) => [row.label, row.average]), [
    ["Dec 2025", null],
    ["Feb 2026", 4.5],
  ]);
});

test("reviewsFreshness says when BBB was last read and flags staleness", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const fresh = reviewsFreshness("2026-10-01T15:00:00Z", false, now);
  assert.equal(fresh.label, "Last refreshed from BBB: Oct 1, 2026");
  assert.equal(fresh.stale, false);
  assert.equal(fresh.days, 4);
  assert.equal(reviewsFreshness("2026-07-09T21:13:43.801Z", true, now).stale, true);
  assert.equal(reviewsFreshness(null, false, now).label, "Never refreshed from BBB");
  assert.equal(reviewsFreshness("2026-10-01T15:00:00Z", false, Number.NaN).days, null);
});

test("starGlyphs rounds to whole stars", () => {
  assert.equal(starGlyphs(4.6), "★★★★★");
  assert.equal(starGlyphs(3.2), "★★★☆☆");
  assert.equal(starGlyphs(null), "☆☆☆☆☆");
});

test("textToBookedSummary splits the overall row from origins", () => {
  const summary = textToBookedSummary({
    items: [
      { origin: "all", label: "All", texted_leads: 10, booked_leads: 2, booking_rate: 0.2 },
      { origin: "granot_lead_created", label: "Granot lead created", texted_leads: 3, booked_leads: 1 },
      { origin: "public_form", label: "Public form", texted_leads: 7, booked_leads: 1 },
      { origin: "empty", texted_leads: 0, booked_leads: 0 },
    ],
  });
  assert.equal(summary.overall?.rate, 0.2);
  assert.deepEqual(summary.origins.map((row) => row.key), ["public_form", "granot_lead_created"]);
  assert.deepEqual(textToBookedSummary(null), { overall: null, origins: [] });
});

test("definitionFor prefers the server definition", () => {
  const leads = PRIMARY_SCORECARDS[0]!;
  assert.equal(definitionFor(leads, { lead: "From the server." }), "From the server.");
  assert.equal(definitionFor(leads, {}), leads.fallback);
});
