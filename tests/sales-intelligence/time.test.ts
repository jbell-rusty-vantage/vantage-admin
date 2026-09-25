import assert from "node:assert/strict";
import test from "node:test";
import {
  etDateKey,
  formatCountdown,
  formatDate,
  formatDayCount,
  formatDayHeader,
  formatDuration,
  formatExact,
  formatExactFull,
  formatRelative,
  formatTimeOnly,
} from "../../components/sales-intelligence/lib/time";

// UI1-TIME: final spec §3.3 wording, table-driven. Every case passes `asOf` explicitly; nothing reads the clock.
const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;
const AS_OF = "2026-09-20T19:10:00.000Z"; // Sep 20, 2026, 3:10 PM ET (EDT)
const minus = (ms: number, from = AS_OF) => new Date(Date.parse(from) - ms).toISOString();
const plus = (ms: number, from = AS_OF) => new Date(Date.parse(from) + ms).toISOString();

test("formatRelative: every §3.3 threshold boundary, past", () => {
  const cases: [string, number, string][] = [
    ["0s", 0, "just now"],
    ["59s", 59 * S, "just now"],
    ["60s", 60 * S, "1m ago"],
    ["40m", 40 * M, "40m ago"],
    ["59m59s", 59 * M + 59 * S, "59m ago"],
    ["60m", 60 * M, "1h ago"],
    ["2h", 2 * H, "2h ago"],
    ["47h59m", 47 * H + 59 * M, "47h ago"],
    ["48h", 48 * H, "2d ago"],
    ["3d", 3 * D, "3d ago"],
    ["6d23h59m", 6 * D + 23 * H + 59 * M, "6d ago"],
    ["7d", 7 * D, "Sep 13"],
    ["8d", 8 * D, "Sep 12"],
  ];
  for (const [name, ms, want] of cases) assert.equal(formatRelative(minus(ms), AS_OF), want, name);
});

test("formatRelative: future times read `in …` with the same thresholds", () => {
  const cases: [string, number, string][] = [
    ["59s", 59 * S, "just now"],
    ["60s", 60 * S, "in 1m"],
    ["59m", 59 * M, "in 59m"],
    ["60m", 60 * M, "in 1h"],
    ["47h", 47 * H, "in 47h"],
    ["48h", 48 * H, "in 2d"],
    ["6d", 6 * D, "in 6d"],
    ["7d", 7 * D, "Sep 27"],
  ];
  for (const [name, ms, want] of cases) assert.equal(formatRelative(plus(ms), AS_OF), want, name);
});

test("formatRelative: another ET year prints the year; the ET year decides, not the UTC year", () => {
  // asOf Jan 5 2026 ET, t Dec 20 2025 ET.
  assert.equal(formatRelative("2025-12-20T17:00:00.000Z", "2026-01-05T17:00:00.000Z"), "Dec 20, 2025");
  // asOf is 2026 in UTC but Dec 31, 2025, 10 PM in ET: same ET year as t, so no year.
  assert.equal(formatRelative("2025-12-20T12:00:00.000Z", "2026-01-01T03:00:00.000Z"), "Dec 20");
  // Across New Year inside 48 h still reads hours.
  assert.equal(formatRelative("2025-12-31T23:00:00.000Z", "2026-01-01T05:30:00.000Z"), "6h ago");
});

test("formatExact / formatExactFull / formatTimeOnly", () => {
  assert.equal(formatExact(AS_OF, AS_OF), "Sep 20, 3:10 PM ET");
  assert.equal(formatExact("2025-09-20T19:10:00.000Z", AS_OF), "Sep 20, 2025, 3:10 PM ET");
  assert.equal(formatExact(AS_OF, AS_OF, { year: "always" }), "Sep 20, 2026, 3:10 PM ET");
  assert.equal(formatExact("2025-09-20T19:10:00.000Z", AS_OF, { year: "never" }), "Sep 20, 3:10 PM ET");
  assert.equal(formatExactFull(AS_OF), "Sep 20, 2026, 3:10 PM ET");
  assert.equal(formatTimeOnly(AS_OF), "3:10 PM ET");
  assert.equal(formatTimeOnly("2026-09-21T04:05:00.000Z"), "12:05 AM ET");
  assert.equal(formatTimeOnly("2026-09-20T16:00:00.000Z"), "12:00 PM ET");
  // Year boundary: asOf Jan 1 2026 00:30 ET; t Dec 31 2025 6 PM ET.
  assert.equal(formatExact("2025-12-31T23:00:00.000Z", "2026-01-01T05:30:00.000Z"), "Dec 31, 2025, 6:00 PM ET");
  // UTC year 2026 but ET year 2025 on both sides: no year.
  assert.equal(formatExact("2026-01-01T04:00:00.000Z", "2026-01-01T03:00:00.000Z"), "Dec 31, 11:00 PM ET");
  // Winter time is still ET (EST, UTC-5).
  assert.equal(formatExact("2026-01-15T20:10:00.000Z", AS_OF), "Jan 15, 3:10 PM ET");
});

test("formatDuration: compact rule, about, negative and NaN", () => {
  const cases: [number, string][] = [
    [0, "0m"],
    [59 * S, "0m"],
    [40 * M, "40m"],
    [59 * M + 59 * S, "59m"],
    [H, "1h"],
    [2 * H + 15 * M, "2h 15m"],
    [23 * H + 59 * M, "23h 59m"],
    [D, "1d"],
    [D + 3 * H + 20 * M, "1d 3h"],
    [12 * D, "12d"],
    [-5 * M, "0m"],
    [Number.NaN, "Time unknown"],
    [Number.POSITIVE_INFINITY, "Time unknown"],
  ];
  for (const [ms, want] of cases) assert.equal(formatDuration(ms), want, String(ms));
  assert.equal(formatDuration(2 * H, { about: true }), "about 2h");
  assert.equal(formatDuration(3 * D + 4 * H, { about: true }), "about 3d 4h");
  assert.equal(formatDuration(Number.NaN, { about: true }), "Time unknown");
});

test("formatCountdown: in / overdue / now / unknown", () => {
  const cases: [string, string, { kind: string; text: string }][] = [
    ["in 2h", plus(2 * H), { kind: "in", text: "in 2h" }],
    ["in 12d", plus(12 * D), { kind: "in", text: "in 12d" }],
    ["overdue 40m", minus(40 * M), { kind: "overdue", text: "overdue 40m" }],
    ["overdue 1d 2h", minus(D + 2 * H), { kind: "overdue", text: "overdue 1d 2h" }],
    ["30s ahead", plus(30 * S), { kind: "now", text: "now" }],
    ["30s behind", minus(30 * S), { kind: "now", text: "now" }],
    ["60s ahead", plus(60 * S), { kind: "in", text: "in 1m" }],
    ["unparseable", "not a time", { kind: "unknown", text: "Time unknown" }],
  ];
  for (const [name, t, want] of cases) assert.deepEqual(formatCountdown(t, AS_OF), want, name);
});

test("DST: durations across the change count real elapsed time", () => {
  // Spring forward, Sunday Mar 8 2026: 1:30 AM EST -> 3:30 AM EDT is one real hour.
  const before = "2026-03-08T06:30:00.000Z";
  const after = "2026-03-08T07:30:00.000Z";
  assert.equal(formatExact(before, after), "Mar 8, 1:30 AM ET");
  assert.equal(formatExact(after, after), "Mar 8, 3:30 AM ET");
  assert.equal(formatRelative(before, after), "1h ago");
  assert.equal(formatCountdown(after, before).text, "in 1h");
  assert.equal(formatDuration(Date.parse(after) - Date.parse(before)), "1h");
  // Fall back, Sunday Nov 1 2026: 1:30 AM EDT -> 1:30 AM EST is one real hour at the same wall time.
  const first = "2026-11-01T05:30:00.000Z";
  const second = "2026-11-01T06:30:00.000Z";
  assert.equal(formatExact(first, second), "Nov 1, 1:30 AM ET");
  assert.equal(formatExact(second, second), "Nov 1, 1:30 AM ET");
  assert.equal(formatRelative(first, second), "1h ago");
  assert.equal(formatCountdown(first, second).text, "overdue 1h");
});

test("DST: day counts count calendar days in ET", () => {
  // Mar 7 noon EST to Mar 9: two calendar days, though only 47 real hours to Mar 9 noon EDT.
  assert.deepEqual(formatDayCount("2026-03-09", "2026-03-07T17:00:00.000Z"), { days: 2, text: "in 2d" });
  // One minute before midnight ET on Mar 7 vs midnight ET.
  assert.deepEqual(formatDayCount("2026-03-08", "2026-03-08T04:59:00.000Z"), { days: 1, text: "in 1d" });
  assert.deepEqual(formatDayCount("2026-03-08", "2026-03-08T05:00:00.000Z"), { days: 0, text: "today" });
  // Oct 31 EDT to Nov 2 EST across fall back (a 25-hour day).
  assert.deepEqual(formatDayCount("2026-11-02", "2026-10-31T16:00:00.000Z"), { days: 2, text: "in 2d" });
  assert.deepEqual(formatDayCount("2026-10-31", "2026-11-02T04:59:00.000Z"), { days: -1, text: "1d ago" });
});

test("formatDayCount: move date wording pieces", () => {
  assert.deepEqual(formatDayCount("2026-10-02", AS_OF), { days: 12, text: "in 12d" });
  assert.deepEqual(formatDayCount("2026-09-20", AS_OF), { days: 0, text: "today" });
  assert.deepEqual(formatDayCount("2026-09-08", AS_OF), { days: -12, text: "12d ago" });
  // The asOf ET date, not the UTC date: 11 PM ET Sep 20 is Sep 21 in UTC.
  assert.deepEqual(formatDayCount("2026-09-21", "2026-09-21T03:00:00.000Z"), { days: 1, text: "in 1d" });
  // A midnight-UTC ISO string is read as the date written.
  assert.deepEqual(formatDayCount("2026-10-02T00:00:00.000Z", AS_OF), { days: 12, text: "in 12d" });
  // Year boundary.
  assert.deepEqual(formatDayCount("2026-01-01", "2025-12-31T23:00:00.000Z"), { days: 1, text: "in 1d" });
  const bad = formatDayCount("soon", AS_OF);
  assert.ok(Number.isNaN(bad.days));
  assert.equal(bad.text, "Time unknown");
  assert.equal(formatDayCount("2026-02-30", AS_OF).text, "Time unknown");
});

test("formatDate", () => {
  assert.equal(formatDate("2026-10-15", AS_OF), "Oct 15");
  assert.equal(formatDate("2027-01-04", AS_OF), "Jan 4, 2027");
  assert.equal(formatDate("2026-10-15"), "Oct 15, 2026");
  assert.equal(formatDate("2026-10-15T00:00:00.000Z", AS_OF), "Oct 15");
  // asOf ET year 2025 (UTC 2026): a 2026 date prints its year.
  assert.equal(formatDate("2026-01-02", "2026-01-01T03:00:00.000Z"), "Jan 2, 2026");
  assert.equal(formatDate("", AS_OF), "Time unknown");
});

test("formatDayHeader: Today / Yesterday across midnight ET, then weekday", () => {
  const asOf = "2026-09-22T04:30:00.000Z"; // Tue Sep 22, 12:30 AM ET
  assert.equal(formatDayHeader("2026-09-22T04:10:00.000Z", asOf), "Today"); // 12:10 AM ET
  assert.equal(formatDayHeader("2026-09-22T03:50:00.000Z", asOf), "Yesterday"); // Sep 21 11:50 PM ET, 40 minutes earlier
  assert.equal(formatDayHeader("2026-09-21T03:50:00.000Z", asOf), "Sun Sep 20"); // Sep 20 11:50 PM ET
  assert.equal(formatDayHeader("2025-09-22T16:00:00.000Z", asOf), "Mon Sep 22, 2025");
  // A UTC-today event that is still yesterday in ET.
  assert.equal(formatDayHeader("2026-09-22T01:00:00.000Z", "2026-09-22T14:00:00.000Z"), "Yesterday");
  // Fall back day: 12:30 AM EDT and 11:30 PM EST are the same ET day, 24 real hours apart.
  assert.equal(formatDayHeader("2026-11-01T04:30:00.000Z", "2026-11-02T04:30:00.000Z"), "Today");
  assert.equal(formatDayHeader("2026-10-31T23:30:00.000Z", "2026-11-02T04:30:00.000Z"), "Yesterday");
  // New Year in ET.
  assert.equal(formatDayHeader("2025-12-31T23:00:00.000Z", "2026-01-01T05:30:00.000Z"), "Yesterday");
  assert.equal(formatDayHeader("nope", asOf), "Time unknown");
});

test("etDateKey groups by the ET day", () => {
  assert.equal(etDateKey(AS_OF), "2026-09-20");
  assert.equal(etDateKey("2026-09-21T03:59:00.000Z"), "2026-09-20");
  assert.equal(etDateKey("2026-09-21T04:00:00.000Z"), "2026-09-21");
  assert.equal(etDateKey("2026-01-01T04:59:00.000Z"), "2025-12-31");
  assert.equal(etDateKey("2026-01-01T05:00:00.000Z"), "2026-01-01");
  assert.equal(etDateKey(""), "");
});

test("unparseable input never throws and prints the null wording", () => {
  for (const bad of ["", "not a time"]) {
    assert.equal(formatRelative(bad, AS_OF), "Time unknown");
    assert.equal(formatRelative(AS_OF, bad), "Time unknown");
    assert.equal(formatExact(bad, AS_OF), "Time unknown");
    assert.equal(formatExactFull(bad), "Time unknown");
    assert.equal(formatTimeOnly(bad), "Time unknown");
  }
});
