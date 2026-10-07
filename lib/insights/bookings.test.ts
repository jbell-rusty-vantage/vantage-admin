import assert from "node:assert/strict";
import test from "node:test";
import { medianSentence, mixGroups, rankedReasons, timeToBookShares } from "./bookings";

test("mixGroups builds two 100 % bars with comparison shares", () => {
  const groups = mixGroups(
    [
      { key: "with_lead", label: "From a paid lead", count: 6, comparison_count: 4 },
      { key: "referral", label: "Referral", count: 2, comparison_count: 0 },
      { key: "no_lead", label: "No lead", count: 2, comparison_count: 4 },
      { key: "local", label: "Local", count: 0, comparison_count: 0 },
      { key: "long_distance", label: "Long distance", count: 0, comparison_count: 0 },
    ],
    true,
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.parts.map((part) => [part.key, part.share, part.comparisonShare]), [
    ["with_lead", 0.6, 0.5],
    ["referral", 0.2, 0],
    ["no_lead", 0.2, 0.5],
  ]);
  assert.equal(mixGroups([{ key: "local", label: "Local", count: 1, comparison_count: 1 }], false)[0]?.parts[0]?.comparisonShare, null);
});

test("timeToBookShares and medianSentence", () => {
  const ttb = {
    median_days: 1,
    comparison_median_days: 2,
    measured: 4,
    buckets: [
      { key: "same_day", label: "Same day", count: 3, comparison_count: 1 },
      { key: "d1_3", label: "1–3 days", count: 1, comparison_count: 1 },
    ],
  };
  assert.deepEqual(timeToBookShares(ttb, true).map((bucket) => [bucket.share, bucket.comparisonShare]), [
    [0.75, 0.5],
    [0.25, 0.5],
  ]);
  assert.equal(medianSentence(ttb, true), "Half of the bookings came within 1 day of the lead arriving (before: 2 days).");
  assert.equal(medianSentence({ ...ttb, comparison_median_days: 1 }, true), "Half of the bookings came within 1 day of the lead arriving, the same as before.");
  assert.equal(medianSentence({ ...ttb, median_days: null }, true), "Not enough bookings with a lead to measure.");
});

test("rankedReasons sorts and drops empty reasons", () => {
  const out = rankedReasons([
    { key: "a", label: "Price", count: 1, comparison_count: 3 },
    { key: "b", label: "Date", count: 4, comparison_count: 0 },
    { key: "c", label: "None", count: 0, comparison_count: 0 },
  ]);
  assert.deepEqual(out.map((reason) => [reason.key, reason.share]), [
    ["b", 1],
    ["a", 0.25],
  ]);
});
