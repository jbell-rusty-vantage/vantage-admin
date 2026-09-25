import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FilterRail, FilterSheet, activeFilterChips, clearAll, closedRegions, customRange, etDayStartIso, matchWindow, outreachRegions,
  rangeDates, windowFrom, RECEIVED_WINDOWS, CLOSED_WINDOWS, type RailPatch, type RailValue,
} from "../../components/sales-intelligence/rail";
import { attentionParamsFromDesk, deskUrlUpdate, parseDeskUrl } from "../../components/sales-intelligence/data/url-state";
import { attentionQuery } from "../../components/sales-intelligence/data/requests";

// UI1-RAIL: the rail's regions, chips and params (UI1-A13). No DOM (ADMIN-REBUILD trap 7).

const AS_OF = "2026-09-24T20:32:56.744Z"; // S7/attention__default.json
const REPS = [{ id: "agent-a", name: "Dana Reyes" }, { id: "agent-b", name: "Alex Kim" }];
const empty = (): RailValue => parseDeskUrl(new URLSearchParams());
const value = (query: string): RailValue => parseDeskUrl(new URLSearchParams(query));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

test("five regions on the outreach rail, three on the closed rail, each remembered per desk", () => {
  for (const view of ["attention", "all_outreach"] as const) {
    const regions = outreachRegions(view);
    assert.deepEqual(regions.map((r) => r.title), ["Band", "Status", "Rep", "Analysis", "Time"]);
    assert.deepEqual(regions.map((r) => r.storageId), ["band", "status", "rep", "analysis", "time"].map((id) => `si.rail.${view}.${id}`));
    // No Lead attachment / Priority here (UX7, UX24).
    assert.ok(!regions.some((r) => r.params.some((p) => (p as string) === "priority" || (p as string) === "attachment")));
  }
  const closed = closedRegions();
  assert.deepEqual(closed.map((r) => r.title), ["Outcome", "Rep", "Closed"]);
  assert.deepEqual(closed.map((r) => r.storageId), ["si.rail.closed.outcome", "si.rail.closed.rep", "si.rail.closed.closed_time"]);
});

test("the rail renders each region as an open disclosure with the §7.3 controls", () => {
  const html = decode(renderToStaticMarkup(createElement(FilterRail, { regions: outreachRegions("attention"), value: empty(), onChange: () => {}, reps: REPS, asOf: AS_OF })));
  assert.ok(html.startsWith('<aside class="si-rail is-responsive" aria-label="Filters"'));
  assert.equal((html.match(/class="si-disclosure is-open si-rail__region"/g) ?? []).length, 5);
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 5);
  for (let n = 1; n <= 7; n += 1) assert.ok(html.includes(`data-rail-option="band:${n}"`), `band ${n}`);
  assert.ok(html.includes("Band 1 · Promised callbacks overdue") && html.includes("Needs review"));
  for (const label of ["Unworked", "Open", "Waiting on customer", "Identity review"]) assert.ok(html.includes(`>${label}<`), label);
  assert.ok(!html.includes("Rep replied"), "no Rep replied chip until UI-4");
  assert.ok(html.includes(">Any rep<") && html.includes(">Dana Reyes<") && html.includes(">Unassigned<"));
  for (const label of ["Has recording", "Has assessment", "Newer call since assessment", "Transaction intent at least", "Move likelihood at least"]) assert.ok(html.includes(label), label);
  for (const n of [25, 50, 75]) assert.ok(html.includes(`data-rail-option="ti_min:${n}"`) && html.includes(`data-rail-option="ml_min:${n}"`));
  for (const label of ["Lead received", "Last 24h", "Last 7d", "Last 30d", "Custom range", "Move date", "Within 7d", "Within 30d", "Already passed"]) assert.ok(html.includes(label), label);

  const closed = decode(renderToStaticMarkup(createElement(FilterRail, { regions: closedRegions(), value: empty(), onChange: () => {}, reps: REPS, asOf: AS_OF })));
  for (const label of ["Booked", "Booked in Granot", "Cancelled", "Bad Lead", "Duplicate", "No-Sync", "CRM dead", "CRM bad/unusable", "Closed by you", "Closed in", "Last 90d"]) assert.ok(closed.includes(`>${label}<`), label);
  assert.ok(!closed.includes('data-rail-region="band"'));
});

test("selected values render checked, and a window is recognised from the stored instant and as_of", () => {
  const from = windowFrom(AS_OF, RECEIVED_WINDOWS["7d"])!;
  const v = value(`band=1&band=3&needs_review=true&state=open&agent_id=agent-b&has_recording=true&ti_min=50&received_from=${encodeURIComponent(from)}&move_date_passed=true`);
  const html = renderToStaticMarkup(createElement(FilterRail, { regions: outreachRegions("all_outreach"), value: v, onChange: () => {}, reps: REPS, asOf: AS_OF }));
  const checked = (opt: string) => {
    const at = html.indexOf(`data-rail-option="${opt}"`);
    return html.slice(at, html.indexOf("</label>", at)).includes('checked=""');
  };
  for (const opt of ["band:1", "band:3", "needs_review", "state:open", "has_recording", "ti_min:50", "ml_min:any", "received:7d", "move:passed"]) assert.ok(checked(opt), opt);
  for (const opt of ["band:2", "state:unworked", "ti_min:any", "received:any", "received:custom", "move:any"]) assert.ok(!checked(opt), opt);
  assert.match(html, /<option value="agent-b" selected="">Alex Kim<\/option>/);
  // An hour after as_of the same filter still reads "last 7d"; a day later it is a fixed range.
  assert.equal(matchWindow(from, null, "2026-09-24T21:32:56.744Z", RECEIVED_WINDOWS), "7d");
  assert.equal(matchWindow(from, null, "2026-09-26T20:32:56.744Z", RECEIVED_WINDOWS), "custom");
  assert.equal(matchWindow(null, null, AS_OF, RECEIVED_WINDOWS), null);
});

test("activeFilterChips: labels from copy, one chip per value, remove() applies the removing patch", () => {
  const from = windowFrom(AS_OF, RECEIVED_WINDOWS["24h"])!;
  const v = value(`band=1&band=7&needs_review=true&state=waiting_on_customer&agent_id=agent-a&has_assessment=true&newer_call=true&ti_min=25&ml_min=75&received_from=${encodeURIComponent(from)}&move_date_within=30&outcome=booked`);
  const patches: RailPatch[] = [];
  const chips = activeFilterChips(v, outreachRegions("attention"), REPS, { asOf: AS_OF, onChange: (p) => patches.push(p) });
  assert.deepEqual(chips.map((c) => c.label), [
    "Band 1 · Promised callbacks overdue", "Band 7 · Going cold", "Needs review", "Waiting on customer", "Rep: Dana Reyes",
    "Has assessment", "Newer call since assessment", "Transaction intent at least 25", "Move likelihood at least 75",
    "Lead received last 24h", "Move date within 30d",
  ]);
  // `outcome` is a Closed param: no chip on an outreach desk.
  assert.ok(!chips.some((c) => c.key.startsWith("outcome")));
  chips[0].remove();
  assert.deepEqual(patches[0], { band: ["7"] });
  assert.deepEqual(chips.find((c) => c.key === "received")!.patch, { received_from: null, received_to: null });
  // Removing through the URL helper drops exactly that value and the cursor.
  const url = deskUrlUpdate(`view=attention&band=1&band=7&cursor=abc`, chips[0].patch);
  assert.equal(url.toString(), "view=attention&band=7");

  const unknown = activeFilterChips(value("unassigned=true&agent_id=gone"), outreachRegions("attention"), REPS);
  assert.deepEqual(unknown.map((c) => c.label), ["Rep: Unknown rep", "Unassigned"]);

  const closed = activeFilterChips(
    value(`outcome=granot_booked&outcome=owner&agent_id=agent-b&closed_from=${encodeURIComponent(windowFrom(AS_OF, CLOSED_WINDOWS["90d"])!)}&band=2`),
    closedRegions(), REPS, { asOf: AS_OF },
  );
  assert.deepEqual(closed.map((c) => c.label), ["Booked in Granot", "Closed by you", "Rep: Alex Kim", "Closed last 90d"]);

  const range = customRange("2026-09-01", "2026-09-07");
  const custom = activeFilterChips(value(`received_from=${range.from}&received_to=${range.to}`), outreachRegions("all_outreach"), REPS, { asOf: AS_OF });
  assert.deepEqual(custom.map((c) => c.label), ["Lead received Sep 1 – Sep 7"]);
  assert.deepEqual(activeFilterChips(empty(), outreachRegions("attention"), REPS), []);
});

test("custom ranges are ET days sent as ISO instants, half-open, across DST", () => {
  assert.equal(etDayStartIso("2026-09-01"), "2026-09-01T04:00:00.000Z"); // EDT
  assert.equal(etDayStartIso("2026-12-01"), "2026-12-01T05:00:00.000Z"); // EST
  assert.equal(etDayStartIso("2026-11-01"), "2026-11-01T04:00:00.000Z"); // DST ends that morning
  assert.equal(etDayStartIso("2026-03-08"), "2026-03-08T05:00:00.000Z"); // DST starts that morning
  assert.equal(etDayStartIso("2026-02-30"), null);
  assert.equal(etDayStartIso("09/01/2026"), null);
  assert.deepEqual(customRange("2026-09-01", "2026-09-07"), { from: "2026-09-01T04:00:00.000Z", to: "2026-09-08T04:00:00.000Z" });
  assert.deepEqual(customRange("2026-12-31", "2026-12-31"), { from: "2026-12-31T05:00:00.000Z", to: "2027-01-01T05:00:00.000Z" });
  assert.deepEqual(customRange("", "2026-11-01"), { from: null, to: "2026-11-02T05:00:00.000Z" });
  assert.deepEqual(rangeDates("2026-09-01T04:00:00.000Z", "2026-09-08T04:00:00.000Z"), { from: "2026-09-01", to: "2026-09-07" });
  assert.equal(windowFrom(AS_OF, RECEIVED_WINDOWS["7d"]), "2026-09-17T20:32:56.744Z");
  assert.equal(windowFrom("not a time", 1), null);
});

test("params serialise as repeated values (never band[]), closed-only params only on Closed", () => {
  let url = deskUrlUpdate("view=attention", { band: ["1", "2"], state: ["open", "unworked"], agent_id: ["agent-a"], needs_review: true });
  url = deskUrlUpdate(url, { ti_min: 50, move_date_within: 7, received_from: "2026-09-17T20:32:56.744Z" });
  const q = attentionQuery(attentionParamsFromDesk(parseDeskUrl(url), "attention")).toString();
  assert.match(q, /band=1&band=2/);
  assert.match(q, /state=open&state=unworked/);
  assert.match(q, /agent_id=agent-a/);
  assert.match(q, /needs_review=true/);
  assert.match(q, /ti_min=50/);
  assert.match(q, /move_date_within=7/);
  assert.match(q, /received_from=2026-09-17T20%3A32%3A56.744Z/);
  assert.doesNotMatch(q, /%5B%5D|\[\]/);

  const closedUrl = deskUrlUpdate("view=closed", { outcome: ["booked", "granot_booked"], closed_from: "2026-09-17T20:32:56.744Z", unassigned: true });
  const cq = attentionQuery(attentionParamsFromDesk(parseDeskUrl(closedUrl), "closed")).toString();
  assert.match(cq, /outcome=booked&outcome=granot_booked/);
  assert.match(cq, /closed_from=/);
  assert.match(cq, /unassigned=true/);
  const aq = attentionQuery(attentionParamsFromDesk(parseDeskUrl(closedUrl), "attention")).toString();
  assert.doesNotMatch(aq, /outcome=|closed_from=/);

  // Clear filters resets exactly the rail's params.
  const cleared = deskUrlUpdate(url, clearAll(outreachRegions("attention")));
  assert.equal(cleared.toString(), "view=attention");
});

test("390 px: the Filters ({n}) button with sliders-horizontal opens the same regions in a sheet; skeleton", () => {
  const v = value("band=2&state=open&has_recording=true");
  const html = decode(renderToStaticMarkup(createElement(FilterSheet, { regions: outreachRegions("attention"), value: v, onChange: () => {}, reps: REPS, asOf: AS_OF, alwaysShown: true })));
  assert.ok(html.includes('class="si-railsheet is-static"'));
  assert.match(html, /aria-haspopup="dialog" aria-expanded="false"><svg[^>]*lucide-sliders-horizontal[^>]*>.*?<\/svg>Filters \(3\)<\/button>/);
  // UI2-PHONE (UI-2 §7): the sheet is the shared bottom sheet, with `Clear all` and `Show results`.
  assert.ok(html.includes('<dialog class="si-root si-sheet si-sheet--bottom si-railsheet__sheet"'));
  assert.ok(html.includes('data-action="clear-all"') && html.includes(">Clear all<") && html.includes('data-action="show-results"') && html.includes(">Show results<"));
  assert.equal((html.match(/si-rail__region"/g) ?? []).length, 5);
  const skeleton = renderToStaticMarkup(createElement(FilterRail.Skeleton));
  assert.equal((skeleton.match(/si-rail__skregion/g) ?? []).length, 5);
  assert.ok(skeleton.includes('aria-hidden="true"'));
});

test("CSS: the rail is sticky, capped to the viewport, scrolls inside, 44 px controls", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");
  const block = css.slice(css.indexOf("/* UI-1: RAIL"));
  const rule = block.slice(block.indexOf(".si-rail {"), block.indexOf("}", block.indexOf(".si-rail {")));
  for (const decl of ["position: sticky", "max-height: calc(var(--si-scroll-h, 100dvh)", "overflow-y: auto"]) assert.ok(rule.includes(decl), decl);
  assert.match(block, /\.si-rail__check \{ min-height: var\(--si-hit\); \}/);
});
