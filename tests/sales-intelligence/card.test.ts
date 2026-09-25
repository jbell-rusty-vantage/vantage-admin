import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, type AttentionRow } from "../../lib/api/salesIntelligence";
import { OutreachCard, reasonPhrase, reasonSegment, type OutreachCardProps } from "../../components/sales-intelligence/card";
import { formatDuration, formatExactFull, formatRelative } from "../../components/sales-intelligence/lib/time";
import { legacyNumberHref } from "../../components/sales-intelligence/lib/legacy-links";

// UI1-CARD: the card rendered from the contract fixtures (UI1-A01–A07). No DOM (ADMIN-REBUILD trap 7).

const WORKSPACE_CONTRACTS = "sales-intelligence-ui-ux-workspace/contracts";
function contractsDir(): string {
  const repo = path.resolve(__dirname, "../..");
  const tried = [process.env.SI_CONTRACTS_DIR, path.resolve(repo, "..", WORKSPACE_CONTRACTS)].filter((v): v is string => !!v);
  try {
    const gitdir = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(path.join(repo, ".git"), "utf8"))?.[1]?.trim();
    if (gitdir) tried.push(path.resolve(gitdir, "..", "..", "..", "..", WORKSPACE_CONTRACTS));
  } catch { /* a normal checkout */ }
  const dir = tried.find((candidate) => fs.existsSync(path.join(candidate, "S1")));
  assert.ok(dir, `contracts not found; tried ${tried.join(", ")}`);
  return dir;
}
const CONTRACTS = contractsDir();

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
const lineClass = (html: string, n: number) => new RegExp(`class="si-cardshell__line si-cardshell__line--${n}([^"]*)"`).exec(html)?.[1] ?? "";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

test("every row in every attention fixture renders seven lines without throwing, in every layout and view", () => {
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
        const html = render(row, parsed.data.as_of, { layout, view, onOpen: () => {}, onMessageRep: () => {}, onApplySuggestion: () => {} });
        lines(html);
        assert.ok(!text(html).includes("undefined") && !text(html).includes("NaN"), `${row.subject_key} prints undefined/NaN`);
        rendered += 1;
      }
    }
  }
  console.log(`card renders: ${rendered} (rows × 2 layouts) from ${files.length - skipped.length} fixtures; skipped ${skipped.length}: ${skipped.join(", ") || "none"}`);
  assert.ok(rendered > 1000);
});

test("A01: a Number-only subject prints its specific nulls and no route line", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", bySubject("number:6ab448710705ca95222b49be"));
  const html = render(row, asOf);
  const l = lines(html).map(text);
  assert.ok(l[0]!.includes("(305) 555-1001 · No Lead attached"), l[0]);
  assert.ok(l[0]!.includes("Previous version"));
  assert.ok(decode(html).includes(`href="${legacyNumberHref("6ab448710705ca95222b49be")}"`), "identity links to the legacy Number");
  assert.equal(l[1]!.trim(), "");
  assert.ok(lineClass(html, 2).includes("is-empty") && html.includes("is-number-only"), "route slot empty and hidden");
  assert.ok(l[2]!.startsWith("Not a Lead · No conversation observed · Last call "), l[2]);
  assert.equal(l[3], "3 calls · 0 conversations · 0 recordings analyzed");
  assert.ok(l[4]!.startsWith("Transaction intent Not assessedMove likelihood Not assessed"), l[4]);
  assert.equal(l[5], "No next step set");
  assert.ok(l[6]!.startsWith("Unassigned · Nobody owns this work"), l[6]);
});

test("A01 (nulls): no Number, no conversation, no call, unknown score", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Maria Klein"));
  const l = lines(render(row, asOf)).map(text);
  assert.equal(l[3], "No Number on file");
  assert.ok(l[2]!.includes("No conversation observed") && l[2]!.includes("No call observed"), l[2]);
  assert.ok(l[4]!.includes("Transaction intent Unknown"), l[4]);
});

test("A02: `Received 4d ago` carries the exact ET time in title and aria-label, from as_of", () => {
  const { row, asOf } = rowBy("S5c/attention__all-outreach.json", byName("Alicia Reyes"));
  const t = row.outreach!.trigger_at!;
  assert.equal(formatRelative(t, asOf), "4d ago");
  const exact = formatExactFull(t);
  assert.equal(exact, "Sep 20, 2026, 2:38 PM ET");
  const html = render(row, asOf);
  assert.ok(html.includes(`<time dateTime="${t}" title="${exact}" aria-label="Received ${exact}" class="si-time">Received <!-- -->4d ago</time>`) ||
    html.includes(`<time dateTime="${t}" title="${exact}" aria-label="Received ${exact}" class="si-time">Received 4d ago</time>`), "received time element");
  assert.ok(text(lines(html)[2]!).startsWith("Received 4d ago · Last conversation "));
});

test("A03: Details disagree and Newer call since assessment appear exactly when the server booleans are true", () => {
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

test("A04: no `%` in any card", () => {
  for (const rel of ["S1/attention__all-outreach.json", "S5c/attention__all-outreach.json", "AC/attention__all-outreach.json", "S6/attention__all-outreach.json", "S2/attention__sort-transaction-intent.json", "S2/attention__sort-move-likelihood.json"]) {
    const { rows, asOf } = page(rel);
    for (const row of rows) assert.ok(!render(row, asOf, { layout: "flat" }).includes("%"), `${rel} ${row.subject_key}`);
  }
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Ivan Sato"));
  const l5 = text(lines(render(row, asOf))[4]!);
  assert.ok(l5.startsWith("Transaction intent 75 / 100 · StrongMove likelihood "), l5);
  assert.ok(l5.includes("Ordinal evidence assessment out of 100. Not a percentage or a booking probability."));
});

test("A04 (stale): the stale reason is a tooltip sentence on the score line, never a chip", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Hannah Duarte"));
  const l = lines(render(row, asOf));
  assert.ok(text(l[4]!).includes("Assessment stale: move date passed"));
  assert.ok(!text(l[0]!).includes("stale"));
  assert.ok(text(l[1]!).includes("(passed)"), "route line reads the server's move_date_passed");
});

test("A05: an uncertain Priority 5 reads `Granot Priority 5 (Booked in Granot) · No Vantage Booking yet` on line 7", () => {
  const { row, asOf } = rowBy("S6/attention__all-outreach.json", byName("T3 P5 Uncertain"));
  const html = render(row, asOf);
  const l = lines(html).map(text);
  assert.ok(l[6]!.includes("Granot Priority 5 (Booked in Granot) · No Vantage Booking yet"), l[6]);
  assert.ok(l[0]!.includes("Disposition review"), "disposition_review call blocker chip");
  assert.ok(/data-chip="blocker-disposition_review">[\s\S]*?si-badge--amber[\s\S]*?lucide-phone-off/.test(html));
  assert.ok(l[0]!.includes("Needs review"));
  assert.ok(!l[0]!.includes("Review first") && !l[0]!.includes("Review only"));
});

test("A06: live chip precedence (live_call over call_progress; Owner calling alone)", () => {
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

test("A07: line 7 origin word, primary reason with its amount, `about`, and every reason in the tooltip", () => {
  const crm = rowBy("S6/attention__all-outreach.json", byName("T3 Granot Rep Change"));
  const crmL7 = text(lines(render(crm.row, crm.asOf))[6]!);
  assert.ok(crmL7.startsWith("Assigned to Marcus Bell (from Granot) · Not called yet, first call overdue "), crmL7);
  assert.ok(/Band 2 for about \d/.test(crmL7), crmL7);

  const owner = rowBy("S6/attention__all-outreach.json", byName("T3 Owner Kept"));
  assert.ok(text(lines(render(owner.row, owner.asOf))[6]!).startsWith("Assigned to Tina Cho (by you) · "));

  const first = rowBy("S6/attention__all-outreach.json", byName("Lena Brandt"));
  const l7 = text(lines(render(first.row, first.asOf))[6]!);
  assert.ok(l7.startsWith("Assigned to Dana Reyes · "), `no origin word for first_conversation: ${l7}`);

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

test("reason phrases: every fixture key has its own phrase, followups_due follows the server state, unknown keys fall back", () => {
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

test("line 6: retry, Default chip, Apply, due clause and the closed override", () => {
  const retry = rowBy("AC/attention__all-outreach.json", byName("Keisha Nair"));
  const rl6 = text(lines(render(retry.row, retry.asOf))[5]!);
  assert.ok(rl6.startsWith(`Next: ${retry.row.outreach!.next_action!.description} · Try again (1 of 2) · Due `), rl6);

  const dflt = rowBy("AC/attention__all-outreach.json", byName("Hannah Nair"));
  const dhtml = lines(render(dflt.row, dflt.asOf))[5]!;
  assert.ok(/data-chip="default">[\s\S]*?si-badge--neutral[\s\S]*?lucide-bot[\s\S]*?Default/.test(dhtml));
  assert.ok(text(dhtml).includes("Created by the system when the Lead was quoted."));
  assert.ok(/si-text--amber">.*overdue \d/.test(dhtml), "overdue due clause is amber (server next_action_state)");

  const noDue = rowBy("S1/attention__all-outreach.json", byName("Carlos Sato"));
  assert.ok(text(lines(render(noDue.row, noDue.asOf))[5]!).endsWith("· Due date needed"));

  const dueSoon = rowBy("S1/attention__all-outreach.json", byName("Priya Nair"));
  const dl6 = text(lines(render(dueSoon.row, dueSoon.asOf))[5]!);
  assert.ok(/ · Due Sep 24, 8:45 PM ET \(in \d/.test(dl6), dl6);

  const sug = rowBy("AC/attention__all-outreach.json", (r) => !!r.outreach?.suggested_next_step?.apply?.enabled);
  const shtml = render(sug.row, sug.asOf, { onApplySuggestion: () => {} });
  assert.ok(text(lines(shtml)[5]!).startsWith(`Suggested: ${sug.row.outreach!.suggested_next_step!.description}`));
  assert.ok(/<button[^>]*aria-label="Apply the suggested next step: [^"]*"[^>]*>Apply<\/button>/.test(decode(shtml)));
  assert.ok(!render(sug.row, sug.asOf).includes(">Apply</button>"), "no Apply without a handler");

  const override = render(dueSoon.row, dueSoon.asOf, { line6Override: createElement("span", { "data-override": "1" }, "Closed · Booked") as ReactNode });
  assert.ok(lines(override)[5]!.includes('data-override="1"'));
});

test("layouts and lists: band tag only in flat, sort line, closed actions, Message rep rule, Number-review row", () => {
  const { row, asOf } = rowBy("S1/attention__all-outreach.json", byName("Priya Nair"));
  const grouped = render(row, asOf, { layout: "grouped" });
  const flat = render(row, asOf, { layout: "flat" });
  assert.ok(!grouped.includes("si-bandtag") && flat.includes("si-bandtag"));
  assert.ok(text(lines(flat)[0]!).includes("Band 6 · Open work nobody owns"));
  const nullBand = rowBy("S2/attention-closed__closed.json", (r) => !!r.outreach && r.derived.attention_band == null);
  assert.ok(text(lines(render(nullBand.row, nullBand.asOf, { layout: "flat" }))[0]!).includes("Not in Attention"));

  const sorted = render(row, asOf, { layout: "flat", sortLine: { label: "Last call", value: "2d ago", nullLabel: "No call observed" } });
  assert.ok(text(lines(sorted)[6]!).endsWith("Last call: 2d ago"));
  const sortedNull = render(row, asOf, { layout: "flat", sortLine: { label: "Last call", value: null, nullLabel: "No call observed" } });
  assert.ok(text(lines(sortedNull)[6]!).endsWith("Last call: No call observed"));
  assert.ok(!grouped.includes("data-sortline"));

  // Promised by precedence and the enabled Message rep.
  assert.ok(text(lines(grouped)[6]!).startsWith("Promised by Marcus Bell · "));
  const withHandler = render(row, asOf, { onMessageRep: () => {}, onOpen: () => {} });
  assert.ok(/<button[^>]*data-action="message-rep"(?![^>]*disabled)[^>]*>/.test(withHandler));
  assert.ok(withHandler.includes('href="/sales-intelligence/outreach/'));
  assert.ok(withHandler.includes('aria-label="Quick look: Priya Nair · Job '), "body opens the side dialog");
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
      assert.ok(html.includes('data-action="open"') && !html.includes("Open analysis") && !html.includes("Message rep"), `${rel} ${c.subject_key}`);
    }
  }

  const review = rowBy("S1/attention__all-outreach.json", (r) => r.outreach === null);
  const rhtml = render(review.row, review.asOf);
  const rl = lines(rhtml).map(text);
  assert.ok(rl[0]!.includes("Contact Number waiting on your review") && rl[0]!.includes("Needs review"), rl[0]);
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
  for (const id of ["grouped-vs-flat", "skeleton", "preview", "phone"]) assert.ok(html.includes(`data-card-sample="${id}"`), id);
  assert.ok(/data-frame="390" data-card-sample="phone"/.test(html));
  const t = text(html);
  for (const needle of ["Owner calling", "On the call · ", "Don't call", "Details disagree", "Try again (1 of 2)", "Default", "Apply", "No Lead attached", "Granot Priority 5 (Booked in Granot) · No Vantage Booking yet", "Last call: ", "(from Granot)", "for about "]) {
    assert.ok(t.includes(needle), `gallery shows ${needle}`);
  }
  assert.ok(!t.includes("%"), "no % in any card text (skeleton widths are styles)");
});
