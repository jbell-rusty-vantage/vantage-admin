import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SalesIntelligenceError, outreachReadSchema, type OutreachRead } from "../../lib/api/salesIntelligence";
import { easternInput } from "../../components/sales-intelligence/lib/commands";
import {
  REP_FOLLOWUP_ACTIONS, RepFollowupSheet, RepFollowups, noteReady, repDateBounds, repFollowupAccess, repFollowupErrorText, repFollowupIntent,
  type RepFollowupAction,
} from "../../components/sales-intelligence/rep/followup-actions";
import { ViewerProvider, viewerFromSession, OWNER_VIEWER } from "../../components/sales-intelligence/rep/viewer";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { findContractsDir, fixtureTest, ifFixtures } from "./contracts-dir";

// UI2-FOLLOWUP (UI-2 §4, E9; UI2-A06, A07): the rep's Complete / Snooze / Change date on its own follow-ups. No DOM.

const CONTRACTS = findContractsDir() ?? "";
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const k = copy.ui2.followup;

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const MANIFEST = ifFixtures(() => read("S8/_seed-manifest.json"));
const detail = (rel: string): OutreachRead => outreachReadSchema.parse(read(rel));
const own = ifFixtures(() => detail("S8/rep-outreach__ac-callback-owner-exact.json"));
const OWN = ifFixtures(() => own.data.outreach.followups.find((f) => f.id === MANIFEST.followups.own.id)!);

const render = (el: ReactElement, viewer = DANA) =>
  decode(renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(ViewerProvider, { viewer } as Parameters<typeof ViewerProvider>[0], el))));
const sheet = (action: RepFollowupAction, props: { initialNote?: string; initialDate?: string } = {}) =>
  render(createElement(RepFollowupSheet, { action, followup: OWN, outreachId: own.data.outreach.id, asOf: own.as_of, open: true, onClose: () => {}, onDone: () => {}, ...props }));
const sendButton = (html: string) => /<button[^>]*data-action="send"[^>]*>/.exec(html)![0];

fixtureTest("A06: Send stays disabled for an empty or whitespace-only note, and for a dated action without a date", () => {
  assert.equal(noteReady(""), false);
  assert.equal(noteReady("   \n\t"), false);
  assert.equal(noteReady(" x "), true);
  for (const action of REP_FOLLOWUP_ACTIONS) {
    assert.match(sendButton(sheet(action)), /disabled=""/, `${action}: empty`);
    assert.match(sendButton(sheet(action, { initialNote: "   " })), /disabled=""/, `${action}: whitespace`);
  }
  assert.doesNotMatch(sendButton(sheet("complete_followup", { initialNote: "Spoke with them" })), /disabled=""/);
  assert.match(sendButton(sheet("snooze_followup", { initialNote: "At work" })), /disabled=""/, "snooze needs a date");
  assert.doesNotMatch(sendButton(sheet("snooze_followup", { initialNote: "At work", initialDate: "2026-09-26T09:00" })), /disabled=""/);
  assert.doesNotMatch(sendButton(sheet("patch_followup", { initialNote: "Monday", initialDate: "2026-09-28T10:00" })), /disabled=""/);
  // The note is required, focused on open, and says the Owner sees it.
  const html = sheet("complete_followup");
  assert.match(html, /<textarea[^>]*autofocus=""[^>]*required=""|<textarea[^>]*required=""[^>]*autofocus=""/);
  assert.ok(text(html).includes(k.noteHint) && text(html).includes(k.titles.complete_followup));
  assert.ok(html.includes('data-sheet="full"'), "a full-screen sheet at 390 px");
});

fixtureTest("A06: the date picker runs from the read's as_of to as_of + 60 days (never the browser clock)", () => {
  const bounds = repDateBounds(own.as_of);
  assert.equal(bounds.min, easternInput(own.as_of).slice(0, 16));
  assert.equal(bounds.maxIso, new Date(Date.parse(own.as_of) + 60 * 86_400_000).toISOString());
  assert.equal(bounds.max, easternInput(bounds.maxIso).slice(0, 16));
  for (const action of ["snooze_followup", "patch_followup"] as const) {
    const html = sheet(action);
    const input = /<input[^>]*type="datetime-local"[^>]*>/.exec(html)![0];
    assert.ok(input.includes(`min="${bounds.min}"`) && input.includes(`max="${bounds.max}"`), input);
    assert.ok(text(html).includes(k.dateHint) && text(html).includes(k.dateLabel[action]!));
  }
  assert.ok(!/type="datetime-local"/.test(sheet("complete_followup")), "Complete has no date");
});

fixtureTest("A06: the three request bodies match rep-command__{complete,snooze,redate}-own.json", () => {
  const strip = (p: string) => p.replace("/api/v1/admin/sales-intelligence/", "");
  const complete = read("S8/rep-command__complete-own.json").request;
  const snooze = read("S8/rep-command__snooze-own.json").request;
  const redate = read("S8/rep-command__redate-own.json").request;
  const id = MANIFEST.followups.own.id;
  const c = repFollowupIntent({ action: "complete_followup", followup: { id, revision: complete.body.expected_revision }, note: ` ${complete.body.note} `, disposition: complete.body.disposition, key: "k1" });
  assert.deepEqual({ path: c.path, method: c.method, body: c.body }, { path: strip(complete.path), method: complete.method, body: complete.body });
  assert.equal(c.key, "k1");
  const s = repFollowupIntent({ action: "snooze_followup", followup: { id, revision: snooze.body.expected_revision }, note: snooze.body.reason, dueIso: snooze.body.until, key: "k2" });
  assert.deepEqual({ path: s.path, method: s.method, body: s.body }, { path: strip(snooze.path), method: snooze.method, body: snooze.body });
  // Change date sends `due_at` only; the fixture's optional `date_note` isn't part of the UI (UI-2 §4).
  const r = repFollowupIntent({ action: "patch_followup", followup: { id, revision: redate.body.expected_revision }, note: redate.body.reason, dueIso: redate.body.changes.due_at, key: "k3" });
  const changes = { ...redate.body.changes };
  delete changes.date_note;
  assert.deepEqual({ path: r.path, method: r.method, body: r.body }, { path: strip(redate.path), method: redate.method, body: { ...redate.body, changes } });
  assert.throws(() => repFollowupIntent({ action: "complete_followup", followup: { id, revision: 1 }, note: "  ", key: "k" }));
  assert.throws(() => repFollowupIntent({ action: "snooze_followup", followup: { id, revision: 1 }, note: "x", dueIso: null, key: "k" }));
});

fixtureTest("A06: the error mapping for rep-command-invalid__* and rep-command-refused__*", () => {
  const dir = path.join(CONTRACTS, "S8");
  const rep = new Set<string>(REP_FOLLOWUP_ACTIONS);
  const files = fs.readdirSync(dir).filter((f) => /^rep-command-(invalid|refused)__/.test(f));
  let checked = 0;
  for (const file of files) {
    const fixture = read(`S8/${file}`);
    const action = fixture.request.body.command as RepFollowupAction;
    if (!rep.has(action)) continue; // Owner commands a rep never sees (assign, close, …)
    const sentence = repFollowupErrorText(new SalesIntelligenceError(fixture.body.code, fixture.status, fixture.body.request_id), action);
    if (file.startsWith("rep-command-invalid__")) assert.equal(sentence, action === "complete_followup" ? k.errors.generic : k.errors.tooFar, file);
    else assert.equal(sentence, k.errors.forbidden, file);
    checked += 1;
  }
  assert.ok(checked >= 8, `checked ${checked}`);
  assert.equal(repFollowupErrorText(new SalesIntelligenceError("REVISION_CONFLICT", 409), "snooze_followup"), k.errors.stale);
  assert.equal(repFollowupErrorText(new SalesIntelligenceError("INTERNAL", 500), "patch_followup"), k.errors.generic);
  assert.equal(repFollowupErrorText(new TypeError("fetch failed"), "complete_followup"), k.errors.generic);
});

fixtureTest("A07: another rep's follow-up, and one the rep only promised, show no actions and say why", () => {
  const promisedOnly = detail("S8/rep-outreach__t3-promise-across-b.json");
  const otherRep = detail("S6/outreach__t3-promise-across-a.json");
  const pf = promisedOnly.data.outreach.followups.find((f) => f.id === MANIFEST.followups.rep_promised_not_responsible.id)!;
  const of = otherRep.data.outreach.followups.find((f) => f.id === MANIFEST.followups.other_rep_promise.id)!;
  // The server lists the Owner's actions on both: the rep sees none of them.
  assert.ok(pf.allowed_actions.some((a) => a.enabled) && of.allowed_actions.some((a) => a.enabled));
  assert.deepEqual(repFollowupAccess(pf, DANA), { actions: [], readOnly: k.readOnly.promisedOnly });
  assert.deepEqual(repFollowupAccess(of, DANA), { actions: [], readOnly: k.readOnly.promisedByOther("Marcus Bell") });
  for (const [read, sentence] of [[promisedOnly, k.readOnly.promisedOnly], [otherRep, k.readOnly.promisedByOther("Marcus Bell")]] as const) {
    const html = render(createElement(RepFollowups, { record: read.data.outreach, asOf: read.as_of }));
    assert.ok(!html.includes("data-rep-command="), "no actions");
    assert.ok(text(html).includes(sentence), sentence);
  }
  // S-findings: a Marcus promise with no responsible agent, and an Owner follow-up with none.
  const s = detail("S8/rep-outreach__s-findings.json");
  const open = s.data.outreach.followups.filter((f) => f.status === "open");
  assert.deepEqual(open.map((f) => repFollowupAccess(f, DANA).readOnly), [k.readOnly.promisedByOther("Marcus Bell"), k.readOnly.owner]);
  const done = s.data.outreach.followups.find((f) => f.status !== "open")!;
  assert.deepEqual(repFollowupAccess(done, DANA), { actions: [], readOnly: null }, "a finished follow-up has neither");
});

fixtureTest("A06: the rep's own open follow-up shows Complete, Snooze and Change date (from its allowed_actions)", () => {
  assert.equal(OWN.assignment.agent?.id, DANA.agentId);
  assert.deepEqual(repFollowupAccess(OWN, DANA), { actions: ["complete_followup", "snooze_followup", "patch_followup"], readOnly: null });
  const html = render(createElement(RepFollowups, { record: own.data.outreach, asOf: own.as_of }));
  assert.deepEqual([...html.matchAll(/data-rep-command="([a-z_]+)"/g)].map((m) => m[1]), ["complete_followup", "snooze_followup", "patch_followup"]);
  assert.ok(text(html).includes("Complete") && text(html).includes("Snooze") && text(html).includes("Change date"));
  assert.ok(!html.includes("cancel_followup"), "never Cancel (not in E9)");
  // Only enabled actions show; after completion none do.
  const after = detail("S8/rep-outreach-after-commands__ac-callback-owner-exact.json");
  assert.ok(!render(createElement(RepFollowups, { record: after.data.outreach, asOf: after.as_of })).includes("data-rep-command="));
  const disabled = { ...OWN, allowed_actions: OWN.allowed_actions.map((a) => (a.action === "snooze_followup" ? { ...a, enabled: false } : a)) };
  assert.deepEqual(repFollowupAccess(disabled, DANA).actions, ["complete_followup", "patch_followup"]);
});

test("the Owner viewer never gets rep actions (the rep list is a rep-only component)", () => {
  const f = { status: "open", assignment: { agent: { id: "a", name: "A" } }, promised_by: null, allowed_actions: [{ action: "complete_followup", enabled: true, blocker_codes: [] }] } as never;
  assert.deepEqual(repFollowupAccess(f, OWNER_VIEWER).actions, []);
});
