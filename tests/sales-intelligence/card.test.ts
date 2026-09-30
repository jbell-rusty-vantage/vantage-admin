import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { OutreachCard, identityText, metricTiles, reasonPhrase, reasonSegment, type CardOutreach, type OutreachCardProps } from "../../components/sales-intelligence/card";
import { formatDate, formatDuration, formatExactFull, formatRelative } from "../../components/sales-intelligence/lib/time";
import { legacyNumberHref } from "../../components/sales-intelligence/lib/legacy-links";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-CARD: the card rendered from the contract fixtures (UI1-A01–A07). No DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";

type Page = { asOf: string; rows: AttentionRow[] };
const pages = new Map<string, Page>();
function page(rel: string): Page {
  let hit = pages.get(rel);
  if (!hit) {
    const parsed = attentionSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8")));
    hit = { asOf: parsed.as_of, rows: parsed.data.items };
    pages.set(rel, hit);
  }
  return hit;
}
function rowBy(rel: string, pick: (row: AttentionRow) => boolean): { row: AttentionRow; asOf: string } {
  const p = page(rel);
  const row = p.rows.find(pick);
  assert.ok(row, `no matching row in ${rel}`);
  return { row, asOf: p.asOf };
}
const byName = (name: string) => (row: AttentionRow) => row.outreach?.lead_display?.name === name;
const bySubject = (key: string) => (row: AttentionRow) => row.subject_key === key;

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ");

function render(row: AttentionRow, asOf: string, props: Partial<OutreachCardProps> = {}): string {
  return renderToStaticMarkup(createElement(OutreachCard, { row, asOf, layout: "grouped", view: "all_outreach", ...props }));
}
/** The seven `<li>` slots, as HTML. */
function lines(html: string): string[] {
  const out = [...html.matchAll(/<li class="si-cardshell__line si-cardshell__line--(\d)[^"]*">([\s\S]*?)<\/li>(?=<li class="si-cardshell__line|<\/ol>)/g)].map((m) => m[2]!);
  assert.equal(out.length, 7, "seven line slots");
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

fixtureTest("every row in every attention fixture renders seven lines without throwing, in every layout and view", () => {
  const files = walk(CONTRACTS).filter((f) => /[\\/]attention(-closed)?__[^\\/]+\.json$/.test(f));
  assert.ok(files.length >= 60, `found ${files.length} attention fixtures`);
  let rendered = 0;
  const skipped: string[] = [];
  for (const file of files) {
    const parsed = attentionSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    if (!parsed.success) {
      skipped.push(path.relative(CONTRACTS, file));
      continue;
    }
    for (const row of parsed.data.data.items) {
      for (const layout of ["grouped", "flat"] as const) {
        const view = row.outreach?.state === "closed" ? "closed" : "all_outreach";
        const html = render(row, parsed.data.as_of, { layout, view, onNavigate: () => {}, onMessageRep: () => {}, onApplySuggestion: () => {} });
        lines(html);
        assert.ok(!text(html).includes("undefined") && !text(html).includes("NaN"), `${row.subject_key} prints undefined/NaN`);
        rendered += 1;
      }
    }
  }
  console.log(`card renders: ${rendered} (rows × 2 layouts) from ${files.length - skipped.length} fixtures; skipped ${skipped.length}: ${skipped.join(", ") || "none"}`);
  assert.ok(rendered > 1000);
});

/** The activity footer's stats (slot 6) as `{label} {value}`, without the exact ET time printed under the value. */
function stats(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = html.split(/ data-stat="/).slice(1);
  for (const part of parts) {
    const id = part.slice(0, part.indexOf('"'));
    const body = part.slice(part.indexOf(">") + 1).split('<span class="si-card__facts si-card__counts">')[0]!;
    out[id] = text(body.replace(/<span class="si-card__statexact">[^<]*<\/span>/g, "").replace(/<span class="si-card__stat[^"]*"$/, "")).replace(/\s+/g, " ").trim();
  }
  return out;
}
const STAT_ORDER = ["received", "last-conversation", "last-call"];
/** The footer's counts line (`3 calls / 0 conversations / …`). */
const counts = (html: string) => text(/<span class="si-card__facts si-card__counts">([\s\S]*?)<\/span>(?=<\/span>)/.exec(html)?.[1] ?? "");

fixtureTest("the Move / Estimate panel shows canonical move size, volume, estimate and Granot date provenance", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", (item) => !!item.outreach && item.subject.kind === "lead");
  const outreach = row.outreach!;
  const enriched: AttentionRow = { ...row, outreach: { ...outreach, facts: { ...outreach.facts!, move: { date: "2026-10-29", date_source: "granot", pickup: { city: "Chicago", state: "IL", zip: null }, delivery: { city: "Raleigh", state: "NC", zip: null }, size: "2 Bedroom", volume_ft3: 600, service_type: null, estimate: { display: "$4,200", observed_at: "2026-09-23T12:50:25Z" }, granot_observed_at: "2026-09-23T12:50:25Z" } } } };
  const html = render(enriched, asOf);
  const moveLine = lines(html)[2]!;
  assert.ok(moveLine.includes("2 Bedroom") && moveLine.includes("600 ft³") && moveLine.includes("$4,200"));
  assert.ok(text(moveLine).includes("Chicago, IL") && text(moveLine).includes("Raleigh, NC"));
  assert.ok(moveLine.includes("From Granot report") && moveLine.includes("Granot estimate · seen"));
  assert.equal(metricTiles(enriched.outreach!, asOf)[5]?.exact, formatDate("2026-10-29", asOf), "the record header's move tile uses the canonical date");
  const missing: AttentionRow = { ...enriched, outreach: { ...enriched.outreach!, facts: { ...enriched.outreach!.facts!, move: { ...enriched.outreach!.facts!.move!, estimate: null } } } };
  assert.ok(text(lines(render(missing, asOf))[2]!).includes("No Granot estimate yet"));
});

fixtureTest("A01: a Number-only subject prints its specific nulls and an unknown move", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", bySubject("number:6ab448710705ca95222b49be"));
  const html = render(row, asOf);
  const l = lines(html).map(text);
  assert.ok(l[1]!.includes("(305) 555-1001 · No Lead attached"), l[1]);
  assert.ok(l[1]!.includes("Previous version"));
  assert.ok(decode(html).includes(`href="${legacyNumberHref("6ab448710705ca95222b49be")}"`), "identity links to the legacy Number");
  assert.ok(l[2]!.includes("Move date unknown") && l[2]!.includes("Route unknown"));
  const t = stats(lines(html)[3]!);
  assert.deepEqual(Object.keys(t), STAT_ORDER);
  assert.equal(t.received, "Received Not a Lead");
  assert.equal(t["last-conversation"], "Last conversation None");
  assert.match(t["last-call"]!, /^Last call \d/);
  assert.equal(counts(lines(html)[3]!), "3 calls / 0 conversations / 0 recordings analyzed");
  assert.ok(l[5]!.startsWith("Transaction intent Not assessedMove likelihood Not assessed"), l[5]);
  assert.ok(l[4]!.startsWith("NextNo next step set"), l[4]);
  assert.ok(l[4]!.includes("No rep to message"), "Message rep stays in the panel, disabled with its reason");
  assert.ok(l[6]!.startsWith("Nobody owns this work"), l[6]);
  assert.ok(!l[6]!.includes("recordings analyzed"), "recordings are counted in the footer, not repeated on the secondary line");
  assert.ok(l[0]!.includes("Unassigned") && html.includes("si-repavatar is-unassigned"), "unassigned avatar");
});

fixtureTest("A01 (nulls): no Number, no conversation, no call, unknown score", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Maria Klein"));
  const html = render(row, asOf);
  const l = lines(html).map(text);
  const t = stats(lines(html)[3]!);
  assert.equal(counts(lines(html)[3]!), "No Number on file", "no Number: the counts say why");
  assert.equal(t["last-conversation"], "Last conversation None");
  assert.equal(t["last-call"], "Last call None");
  assert.ok(l[5]!.includes("Transaction intent Unknown"), l[5]);
});

fixtureTest("A02: `Received 4d ago` prints the exact ET time under it, from as_of", () => {
  const { row, asOf } = rowBy("S5c/attention__all-outreach.json", byName("Alicia Reyes"));
  const t = row.outreach!.trigger_at!;
  assert.equal(formatRelative(t, asOf), "4d ago");
  const exact = formatExactFull(t);
  assert.equal(exact, "Sep 20, 2026, 2:38 PM ET");
  const html = render(row, asOf);
  assert.ok(
    html.includes(`<span class="si-card__stat" data-stat="received"><span class="si-card__statlabel">Received</span> <time class="si-card__statvalue" dateTime="${t}">4d ago</time> <span class="si-card__statexact">${exact}</span></span>`),
    "received: label first, relative value, the exact time visible (never hover-only)",
  );
  assert.equal(stats(lines(html)[3]!).received, "Received 4d ago");
});

fixtureTest("activity stats in the fixed order on every card; the move pill counts down, and turns amber only on the server's move_date_passed", () => {
  const { rows, asOf } = page("S1/attention__all-outreach.json");
  const pill = (html: string) => /<span class="si-card__pill( is-amber)?">([^<]*)<\/span>/.exec(lines(html)[2]!);
  for (const row of rows) {
    if (!row.outreach) continue;
    const html = render(row, asOf);
    assert.deepEqual(Object.keys(stats(lines(html)[3]!)), STAT_ORDER, row.subject_key);
    const f = row.outreach.facts;
    const p = pill(html);
    if (!f?.route?.move_date) {
      assert.equal(p, null, row.subject_key);
      assert.ok(text(lines(html)[2]!).includes("Move date unknown"), row.subject_key);
    } else if (f.move_date_passed) {
      assert.equal(p?.[2], "Move passed", row.subject_key);
      assert.equal(p?.[1], " is-amber", "passed is amber");
    } else assert.match(p?.[2] ?? "", /^Move (in \d+d|today)$/, row.subject_key);
  }
  const passed = rowBy("S1/attention__all-outreach.json", byName("Hannah Duarte"));
  assert.equal(passed.row.outreach!.facts!.move_date_passed, true);
  assert.equal(pill(render(passed.row, passed.asOf))?.[2], "Move passed");
  const notPassed = { ...passed.row, outreach: { ...passed.row.outreach!, facts: { ...passed.row.outreach!.facts!, move_date_passed: false } } } as AttentionRow;
  assert.ok(!/si-card__pill is-amber/.test(render(notPassed, passed.asOf)), "no amber pill without the server boolean");
});

fixtureTest("A03: Details disagree and Newer call since assessment appear exactly when the server booleans are true", () => {
  let both = 0;
  for (const rel of ["S1/attention__all-outreach.json", "S5c/attention__all-outreach.json", "AC/attention__all-outreach.json", "S6/attention__all-outreach.json", "S2/attention__all-outreach.json"]) {
    const { rows, asOf } = page(rel);
    for (const row of rows) {
      const l1 = text(lines(render(row, asOf))[0]!);
      assert.equal(l1.includes("Details disagree"), !!row.outreach?.facts?.details_disagree, `${rel} ${row.subject_key} details`);
      assert.equal(l1.includes("Newer call since assessment"), !!row.outreach?.facts?.newer_call_since_assessment, `${rel} ${row.subject_key} newer`);
      assert.equal(l1.includes("Needs review"), !!row.filter_keys?.needs_review, `${rel} ${row.subject_key} needs review`);
      if (row.outreach?.facts?.details_disagree && row.outreach.facts.newer_call_since_assessment) both += 1;
    }
  }
  assert.ok(both > 0, "a fixture row has both amber chips");
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Nora Hale"));
  const html = render(row, asOf);
  assert.ok(/data-chip="details-disagree"><span class="si-badge si-chip si-badge--amber"/.test(html));
  assert.ok(/data-chip="newer-call">[\s\S]*?si-badge--amber/.test(html));
  assert.ok(text(html).includes("The scores cover conversations through "), "newer-call tooltip text");
});

fixtureTest("A04: no `%` in any card", () => {
  for (const rel of ["S1/attention__all-outreach.json", "S5c/attention__all-outreach.json", "AC/attention__all-outreach.json", "S6/attention__all-outreach.json", "S2/attention__sort-transaction-intent.json", "S2/attention__sort-move-likelihood.json"]) {
    const { rows, asOf } = page(rel);
    for (const row of rows) assert.ok(!render(row, asOf, { layout: "flat" }).includes("%"), `${rel} ${row.subject_key}`);
  }
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Ivan Sato"));
  const l5 = text(lines(render(row, asOf))[5]!);
  assert.ok(l5.startsWith("Transaction intent 75 / 100StrongMove likelihood "), l5);
  assert.ok(l5.includes("Ordinal evidence assessment out of 100. Not a percentage or a booking probability."));
});

fixtureTest("A04 (stale): the stale reason is a tooltip sentence on the score line, never a chip", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Hannah Duarte"));
  const l = lines(render(row, asOf));
  assert.ok(text(l[5]!).includes("Assessment stale: move date passed"));
  assert.ok(!text(l[0]!).includes("stale"));
  assert.ok(text(l[2]!).includes("(passed)"), "row C marks the passed date");
});

fixtureTest("A05: an uncertain Priority 5 reads `Granot Priority 5 (Booked in Granot) · No Vantage Booking yet` on line 7", () => {
  const { row, asOf } = rowBy("S6/attention__all-outreach.json", byName("T3 P5 Uncertain"));
  const html = render(row, asOf);
  const l = lines(html).map(text);
  assert.ok(l[6]!.includes("Granot Priority 5 (Booked in Granot) · No Vantage Booking yet"), l[6]);
  assert.ok(l[0]!.includes("Disposition review"), "disposition_review call blocker chip");
  assert.ok(/data-chip="blocker-disposition_review">[\s\S]*?si-badge--amber[\s\S]*?lucide-phone-off/.test(html));
  assert.ok(l[0]!.includes("Needs review"));
  assert.ok(!l[0]!.includes("Review first") && !l[0]!.includes("Review only"));
});

fixtureTest("A06: live chip precedence (live_call over call_progress; Owner calling alone)", () => {
  const live = rowBy("S5c/attention__all-outreach.json", byName("T3 Pending Finalization"));
  const lc = live.row.outreach!.live_call!;
  const minutes = formatDuration(Date.parse(live.asOf) - Date.parse(lc.started_at));
  const l1 = text(lines(render(live.row, live.asOf))[0]!);
  assert.ok(l1.includes(`On the call · ${lc.rep.text} · ${minutes}`), l1);
  assert.ok(!l1.includes("Owner calling"));

  const both = rowBy("S5c/attention__all-outreach.json", byName("T3 Live Caller"));
  assert.equal(both.row.outreach!.call_progress?.state, "in_progress");
  assert.ok(both.row.outreach!.live_call);
  const bothHtml = render(both.row, both.asOf);
  assert.ok(text(lines(bothHtml)[0]!).includes("On the call · "));
  assert.ok(!text(bothHtml).includes("Owner calling"), "with both, only On the call");
  assert.ok(bothHtml.includes("si-cardshell is-live"), "live card style");
  assert.ok(/data-chip="live"><span class="si-badge si-chip si-chip--live"><span class="si-livedot is-pulse"/.test(bothHtml));

  // No fixture has call_progress without live_call: the same row with live_call removed (documented synthetic).
  const ownerOnly = { ...both.row, outreach: { ...both.row.outreach!, live_call: null } } as AttentionRow;
  const ownerL1 = text(lines(render(ownerOnly, both.asOf))[0]!);
  assert.ok(ownerL1.includes("Owner calling") && !ownerL1.includes("On the call"), ownerL1);
});

fixtureTest("A07: the avatar's origin word, row G's primary reason with its amount, `about`, and every reason in the tooltip", () => {
  const crm = rowBy("S6/attention__all-outreach.json", byName("T3 Granot Rep Change"));
  const crmHtml = render(crm.row, crm.asOf);
  const crmL7 = text(lines(crmHtml)[6]!);
  assert.ok(crmL7.startsWith("Not called yet, first call overdue "), crmL7);
  assert.ok(!crmL7.includes("Assigned to"), "row G has no Assigned to segment");
  assert.ok(/Band 2 for about \d/.test(crmL7), crmL7);
  assert.ok(crmHtml.includes('title="Assigned to Marcus Bell (from Granot)" role="img" aria-label="Assigned to Marcus Bell (from Granot)"'), "avatar label");
  assert.ok(text(lines(crmHtml)[0]!).endsWith("MBMarcus B."), text(lines(crmHtml)[0]!));

  const owner = rowBy("S6/attention__all-outreach.json", byName("T3 Owner Kept"));
  assert.ok(render(owner.row, owner.asOf).includes('aria-label="Assigned to Tina Cho (by you)"'));

  const first = rowBy("S6/attention__all-outreach.json", byName("Lena Brandt"));
  assert.ok(render(first.row, first.asOf).includes('aria-label="Assigned to Dana Reyes"'), "no origin word for first_conversation");

  const promised = rowBy("S6/attention__all-outreach.json", byName("Alicia Reyes"));
  const o = promised.row.outreach!;
  assert.deepEqual(promised.row.derived.reasons.slice(0, 2), ["promised_callback_overdue", "promised_by:rep"]);
  const amount = formatDuration(Date.parse(promised.asOf) - Date.parse(o.next_action!.attention_due_at!));
  const pl7 = text(lines(render(promised.row, promised.asOf))[6]!);
  assert.ok(pl7.includes(`Promised callback overdue ${amount}`), pl7);
  assert.equal(o.band_since?.estimated, true);
  assert.ok(pl7.includes("Band 1 for about "), pl7);
  // Tooltip: every reason, primary first.
  const segment = reasonSegment(promised.row, promised.asOf)!;
  assert.equal(segment.tooltipLines.length, promised.row.derived.reasons.length);
  assert.ok(pl7.includes(`(Why it's here: ${segment.tooltipLines.join("; ")})`), pl7);
  assert.ok(segment.tooltipLines[1]!.startsWith("Rep's promised callback overdue "));

  const exact = rowBy("S6/attention__all-outreach.json", (r) => r.outreach?.band_since?.estimated === false && r.derived.attention_band === 1);
  assert.ok(/Band 1 for \d/.test(text(lines(render(exact.row, exact.asOf))[6]!)), "estimated false reads without about");
});

fixtureTest("reason phrases: every fixture key has its own phrase, followups_due follows the server state, unknown keys fall back", () => {
  const known = ["promised_by:rep", "promised_by:customer", "promised_by:owner", "promised_callback_overdue", "promise_unreached", "followups_due", "no_call_yet", "new_not_yet_due",
    "no_callback_after_inbound", "called_before_form", "no_call_observed", "rep_discretion", "unreached", "going_cold", "no_next_step", "missing_responsibility"];
  const seen = new Set<string>();
  for (const rel of ["S1/attention__all-outreach.json", "S5c/attention__all-outreach.json", "AC/attention__all-outreach.json", "S6/attention__all-outreach.json"]) {
    for (const row of page(rel).rows) for (const key of row.derived.reasons) seen.add(key);
  }
  for (const key of seen) assert.ok(known.includes(key), `fixture key ${key} has no phrase`);
  const { row, asOf } = rowBy("AC/attention__all-outreach.json", byName("Hannah Nair"));
  assert.equal(row.outreach!.facts!.next_action_state, "overdue");
  assert.match(reasonPhrase("followups_due", row, asOf).text, /^Follow-up overdue \d/);
  const due = rowBy("S1/attention__all-outreach.json", byName("Priya Nair"));
  assert.equal(due.row.outreach!.facts!.next_action_state, "due");
  assert.match(reasonPhrase("followups_due", due.row, due.asOf).text, /^Follow-up due in \d/);
  assert.equal(reasonPhrase("some_new_reason:x", row, asOf).text, "Some new reason x");
  assert.equal(reasonPhrase("going_cold", row, asOf).text, "Going cold, no activity");

  const cbf = rowBy("AC/attention__all-outreach.json", byName("Keisha Lopez"));
  const phrase = reasonPhrase("called_before_form", cbf.row, cbf.asOf);
  assert.equal(phrase.text, "Called before the form arrived");
  assert.match(phrase.tooltipLines[0]!, /^Called [A-Z][a-z]{2} \d{1,2}, before the form$/);

  const fresh = rowBy("AC/attention__all-outreach.json", (r) => r.derived.reasons[0] === "new_not_yet_due");
  assert.match(reasonSegment(fresh.row, fresh.asOf)!.text, /^Not called yet, first call due in \d/);
  const noReason = { ...due.row, derived: { ...due.row.derived, reasons: [] } } as AttentionRow;
  assert.match(reasonSegment(noReason, due.asOf)!.text, /^Due in \d/);
});

fixtureTest("the Next panel: retry, the Default note, Apply, the due line, Message rep inside, and the closed override", () => {
  const retry = rowBy("AC/attention__all-outreach.json", byName("Keisha Nair"));
  const rl = text(lines(render(retry.row, retry.asOf))[4]!);
  assert.ok(rl.startsWith(`Next${retry.row.outreach!.next_action!.description}Due `), rl);
  assert.ok(rl.includes("Try again (1 of 2)"), rl);

  const dflt = rowBy("AC/attention__all-outreach.json", byName("Hannah Nair"));
  const dhtml = lines(render(dflt.row, dflt.asOf))[4]!;
  assert.ok(text(dhtml).includes("Default — Created by the system when the Lead was quoted."));
  assert.ok(/data-next="overdue"/.test(dhtml) && text(dhtml).startsWith("Next · Overdue"), "overdue panel from the server's next_action_state");
  assert.ok(/si-text--amber"> · overdue \d/.test(dhtml), "overdue due clause is amber (server next_action_state)");

  const noDue = rowBy("S1/attention__all-outreach.json", byName("Carlos Sato"));
  assert.ok(text(lines(render(noDue.row, noDue.asOf))[4]!).includes("Due date needed"));

  const dueSoon = rowBy("S1/attention__all-outreach.json", byName("Priya Nair"));
  const dhtml2 = render(dueSoon.row, dueSoon.asOf, { onMessageRep: () => {} });
  const dl = text(lines(dhtml2)[4]!);
  assert.ok(/Due Sep 24, 8:45 PM ET · in \d/.test(dl), dl);
  assert.ok(lines(dhtml2)[4]!.includes('data-action="message-rep"'), "Message rep sits in the Next panel");

  const sug = rowBy("AC/attention__all-outreach.json", (r) => !!r.outreach?.suggested_next_step?.apply?.enabled);
  const shtml = render(sug.row, sug.asOf, { onApplySuggestion: () => {} });
  assert.ok(text(lines(shtml)[4]!).startsWith(`Suggested${sug.row.outreach!.suggested_next_step!.description}`));
  assert.ok(/<button[^>]*aria-label="Apply the suggested next step: [^"]*"[^>]*>Apply<\/button>/.test(decode(shtml)));
  assert.ok(!render(sug.row, sug.asOf).includes(">Apply</button>"), "no Apply without a handler");

  const override = render(dueSoon.row, dueSoon.asOf, { line6Override: createElement("span", { "data-override": "1" }, "Closed · Booked") as ReactNode });
  assert.ok(lines(override)[4]!.includes('data-override="1"'));
});

fixtureTest("layouts and lists: band tag first in both layouts, sort line, closed actions, Message rep rule, Number-review row", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Priya Nair"));
  const grouped = render(row, asOf, { layout: "grouped" });
  const flat = render(row, asOf, { layout: "flat" });
  assert.equal(grouped, flat, "the layout no longer changes the card (D2)");
  assert.ok(text(lines(grouped)[0]!).startsWith("Open work nobody owns · Band 6"), text(lines(grouped)[0]!));
  assert.ok(grouped.includes('data-card-band="6"'));
  const nullBand = rowBy("S2/attention-closed__closed.json", (r) => !!r.outreach && r.derived.attention_band == null);
  assert.ok(text(lines(render(nullBand.row, nullBand.asOf, { layout: "flat" }))[0]!).includes("Not in Attention"));

  const sorted = render(row, asOf, { layout: "flat", sortLine: { label: "Last call", value: "2d ago", nullLabel: "No call observed" } });
  assert.ok(text(lines(sorted)[6]!).endsWith("Last call: 2d ago"));
  const sortedNull = render(row, asOf, { layout: "flat", sortLine: { label: "Last call", value: null, nullLabel: "No call observed" } });
  assert.ok(text(lines(sortedNull)[6]!).endsWith("Last call: No call observed"));
  assert.ok(!grouped.includes("data-sortline"));

  // Promised by precedence and the enabled Message rep.
  assert.ok(text(lines(grouped)[6]!).startsWith("Promised by Marcus Bell · "));
  const withHandler = render(row, asOf, { onMessageRep: () => {}, onNavigate: () => {} });
  assert.ok(/<button[^>]*data-action="message-rep"(?![^>]*disabled)[^>]*>/.test(withHandler));
  assert.ok(withHandler.includes('href="/sales-intelligence/outreach/'));
  assert.ok(withHandler.includes('aria-label="Open Priya Nair · '), "body opens the full page");
  const unassigned = rowBy("S1/attention__all-outreach.json", byName("Sam Carter"));
  const uhtml = render(unassigned.row, unassigned.asOf, { onMessageRep: () => {} });
  assert.ok(/data-action="message-rep"[^>]*disabled=""/.test(uhtml) && text(uhtml).includes("No rep to message"));
  const forced = render(unassigned.row, unassigned.asOf, { onMessageRep: () => {}, messageRepDisabledReason: null });
  assert.ok(!text(forced).includes("No rep to message"));

  for (const rel of ["S2/attention-closed__closed.json", "S6/attention-closed__closed-outcome-granot-booked.json"]) {
    const closed = page(rel);
    assert.ok(closed.rows.length > 0);
    for (const c of closed.rows) {
      const html = render(c, closed.asOf, { view: "closed", layout: "flat", onMessageRep: () => {} });
      assert.ok(html.includes(`href="/sales-intelligence/outreach/${c.outreach!.id}"`) && !html.includes("Open analysis") && !html.includes("Message rep"), `${rel} ${c.subject_key}`);
    }
  }

  const review = rowBy("S1/attention__all-outreach.json", (r) => r.outreach === null);
  const rhtml = render(review.row, review.asOf);
  const rl = lines(rhtml).map(text);
  assert.ok(rl[0]!.includes("Contact Number waiting on your review") && rl[0]!.includes("Needs review"), rl[0]);
  if (review.row.sort_keys?.interactions != null) {
    assert.ok(/<ul class="si-tiles si-tiles--single"[^>]*><li class="si-tile" data-tile="calls">/.test(rhtml), "interactions as one calls tile");
  }
  assert.ok(!rl[0]!.includes("Review first"), "review_only makes no chip");
  assert.ok(decode(rhtml).includes(`href="${legacyNumberHref("6ab448740705ca95222b4b0c")}"`) && text(rhtml).includes("Previous version"));
  assert.ok(!rhtml.includes("Open analysis") && !rhtml.includes("Message rep"));
});

test("the skeleton is the card shell's seven-line skeleton", () => {
  const html = renderToStaticMarkup(createElement(OutreachCard.Skeleton));
  assert.equal((html.match(/si-skeleton si-skeleton--line/g) ?? []).length, 7);
  assert.ok(html.includes("si-cardshell is-skeleton"));
});

test("gallery Card section: every card sample, grouped vs flat, the skeleton, the dialog body and the 390 px frame", async () => {
  const { CardSection, CARD_SAMPLES } = await import("../../app/(dashboard)/sales-intelligence/dev/gallery/sections/card");
  const html = renderToStaticMarkup(createElement(CardSection));
  assert.ok(html.includes('<section id="card"'));
  for (const sample of CARD_SAMPLES) assert.ok(html.includes(`data-card-sample="${sample.id}"`), sample.id);
  for (const id of ["grouped-vs-flat", "skeleton", "phone"]) assert.ok(html.includes(`data-card-sample="${id}"`), id);
  assert.ok(/data-frame="390" data-card-sample="phone"/.test(html));
  const t = text(html);
  for (const needle of ["Owner calling", "On the call · ", "Don't call", "Details disagree", "Try again (1 of 2)", "Default", "Apply", "No Lead attached", "Granot Priority 5 (Booked in Granot) · No Vantage Booking yet", "Last call: ", "(from Granot)", "for about "]) {
    assert.ok(t.includes(needle), `gallery shows ${needle}`);
  }
  assert.ok(!t.includes("%"), "no % in any card text (skeleton widths are styles)");
});

test("UX-C2: line 1 shows the formatted phone after the name; no number leaves no empty separator; Number-only unchanged", () => {
  const lead = (primary_number: { id: string; e164: string } | null) =>
    ({ subject: { kind: "lead" }, primary_number, lead_display: { name: "Priya Nair", job_no: "5562924", source_company: "Moving Pros" } }) as unknown as CardOutreach;
  assert.equal(identityText(lead({ id: "n1", e164: "+14045551028" })), "Priya Nair · (404) 555-1028 · Job 5562924 · Moving Pros");
  assert.equal(identityText(lead(null)), "Priya Nair · Job 5562924 · Moving Pros");
  const numberOnly = { subject: { kind: "number" }, primary_number: { id: "n1", e164: "+14045551028" }, lead_display: null } as unknown as CardOutreach;
  assert.equal(identityText(numberOnly), "(404) 555-1028 · No Lead attached");
});

fixtureTest("UX-C2: every fixture Lead card with a number shows it in the identity row (B)", () => {
  const { rows, asOf } = page("S1/attention__all-outreach.json");
  let seen = 0;
  for (const row of rows) {
    const o = row.outreach;
    if (!o || o.subject.kind !== "lead" || !o.primary_number) continue;
    const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(o.primary_number.e164);
    const shown = us ? `(${us[1]}) ${us[2]}-${us[3]}` : o.primary_number.e164;
    assert.ok(text(lines(render(row, asOf))[1]!).includes(shown), `${row.subject_key} row B has ${shown}`);
    seen++;
  }
  assert.ok(seen > 0, "the fixture has Lead rows with a number");
});

test("rep avatar: initials, short name, and a colour that depends only on the Agent id and passes AA with white", async () => {
  const { REP_COLORS, REP_INITIALS_COLOR, repColor, repInitials, repShortName } = await import("../../components/sales-intelligence/lib/rep-color");
  const { contrastRatio } = await import("../../components/sales-intelligence/primitives/band-badge");
  assert.equal(repInitials("Jake Bell"), "JB");
  assert.equal(repInitials("jake van der bell"), "JB");
  assert.equal(repInitials("Jake"), "J");
  assert.equal(repShortName("Jake Bell"), "Jake B.");
  assert.equal(repShortName("Jake"), "Jake");
  assert.ok(REP_COLORS.length >= 8 && REP_COLORS.length <= 10);
  for (const color of REP_COLORS) assert.ok(contrastRatio(color, REP_INITIALS_COLOR) >= 4.5, `${color} ${contrastRatio(color, REP_INITIALS_COLOR).toFixed(2)}`);
  const ids = Array.from({ length: 40 }, (_, i) => `6ab5ab18${String(i).padStart(4, "0")}2eb383d94893`);
  const first = ids.map(repColor);
  assert.deepEqual([...ids].reverse().map(repColor), [...first].reverse(), "list order never changes a colour");
  assert.deepEqual(ids.map(repColor), first, "stable across calls");
  assert.ok(new Set(first).size >= 5, "ids spread over the palette");
});

fixtureTest("rep avatar on the card: same colour for the same agent in any list; promiser equal to the assignee leaves row G's segment out", async () => {
  const { repColor } = await import("../../components/sales-intelligence/lib/rep-color");
  const { row, asOf } = rowBy("S6/attention__all-outreach.json", byName("Lena Brandt"));
  const agent = row.outreach!.assignment.agent!;
  for (const layout of ["grouped", "flat"] as const) {
    assert.ok(render(row, asOf, { layout }).includes(`background:${repColor(agent.id)}`), layout);
  }
  const promisedBy = (id: string, name: string) =>
    ({ ...row, outreach: { ...row.outreach!, next_action: { ...(row.outreach!.next_action ?? { description: "Call back", due_at: null }), promised_by: { id, name } } } }) as AttentionRow;
  const same = text(lines(render(promisedBy(agent.id, agent.name), asOf))[6]!);
  assert.ok(!same.includes("Promised by"), same);
  const other = text(lines(render(promisedBy("someone-else", "Marcus Bell"), asOf))[6]!);
  assert.ok(other.startsWith("Promised by Marcus Bell"), other);
});
