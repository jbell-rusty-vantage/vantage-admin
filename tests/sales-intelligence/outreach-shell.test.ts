import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outreachReadSchema, type Outreach } from "../../lib/api/salesIntelligence";
import { buildIntent, initialDraft } from "../../components/sales-intelligence/lib/commands";
import { FollowupsSection } from "../../components/sales-intelligence/outreach-detail";
import { RelatedRecordChips } from "../../components/sales-intelligence/related-record-chips";
import {
  ANALYSIS_SECTIONS, CorrectionsView, OutreachNotFound, OutreachPageFrame, OutreachRouteSkeleton, RecordCommands, RecordHeaderView,
  activeCallRestriction, backHref, deepLinkTarget, groupCommands, headerChips, headerRow, isNotFoundError, leadTargetHref, outreachRouteHref,
  outreachTabs, parseOutreachTab, showReceiverAgent,
} from "../../components/sales-intelligence/outreach";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-SHELL: the Outreach route (UI-1 §5), rendered from the contract fixtures. No DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";
const raw = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const detail = (rel: string) => outreachReadSchema.parse(raw(rel));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const noop = () => {};
const RETURN = "/sales-intelligence/outreach/o1?tab=work";

function header(rel: string, extra: Partial<Parameters<typeof RecordHeaderView>[0]> = {}) {
  const d = detail(rel);
  return renderToStaticMarkup(createElement(RecordHeaderView, { outreach: d.data.outreach, asOf: d.as_of, returnTo: RETURN, onCommand: noop, onMessageRep: noop, messageRepDisabledReason: null, ...extra }));
}
function headerOf(o: Outreach, asOf: string, extra: Partial<Parameters<typeof RecordHeaderView>[0]> = {}) {
  return renderToStaticMarkup(createElement(RecordHeaderView, { outreach: o, asOf, returnTo: RETURN, onCommand: noop, onMessageRep: noop, messageRepDisabledReason: null, ...extra }));
}
const withClient = (el: ReactElement) => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, el));
const outreachFiles = (dir: string) => fs.readdirSync(path.join(CONTRACTS, dir)).filter((f) => /^outreach__.*\.json$/.test(f)).map((f) => `${dir}/${f}`);

fixtureTest("every S1, S5c, S6, AC and S11 detail fixture renders the record header: lines 1–4 and 7, band line, provenance, links, commands; no %", () => {
  const files = ["S1", "S5c", "S6", "AC", "S11"].flatMap(outreachFiles);
  assert.ok(files.length > 50, `fixtures found: ${files.length}`);
  for (const rel of files) {
    const html = header(rel);
    for (const line of ["1", "3", "4", "6", "7"]) assert.ok(html.includes(`data-line="${line}"`), `${rel}: line ${line}`);
    assert.ok(html.includes("data-band-line"), `${rel}: band line`);
    assert.ok(html.includes("data-provenance="), `${rel}: provenance block`);
    assert.ok(html.includes('aria-label="Related records"'), `${rel}: official links`);
    assert.ok(html.includes('role="group" aria-label="Commands"'), `${rel}: command group`);
    assert.ok(!text(html).includes("%"), `${rel}: no % anywhere`);
    assert.ok(!html.includes("undefined") && !html.includes("NaN"), `${rel}: no undefined / NaN`);
  }
});

fixtureTest("A41 / UX-C4: one primary call button, the three everyday secondaries in preference order (Assign included), the rest under More actions, disabled reasons", () => {
  const o = detail("S1/outreach__s-assessment-pending.json").data.outreach;
  const groups = groupCommands(o.allowed_actions);
  assert.equal(groups.primary?.action, "start_call");
  assert.deepEqual(groups.secondary.map((a) => a.action), ["mark_worked", "create_followup", "assign"]);
  assert.deepEqual(groups.more.map((a) => a.action), ["set_waiting", "add_note", "close", "reopen", "override_disposition"]);
  assert.ok(!groups.more.some((a) => a.action === "end_call" || a.action === "start_call"), "the other call command isn't repeated");
  const html = renderToStaticMarkup(createElement(RecordCommands, { record: o, onCommand: noop, onMessageRep: noop, messageRepDisabledReason: null }));
  const t = text(html);
  assert.equal((html.match(/si-btn--primary/g) ?? []).length, 1, "one primary");
  assert.ok(t.includes("Start the call") && t.includes("Mark as worked") && t.includes("Add next step") && t.includes("More actions"));
  for (const word of ["Wait for customer", "Add note", "Close", "Reopen", "Override disposition", "Assign"]) assert.ok(t.includes(word), word);
  // A disabled command carries its server reason as a sentence (screen-reader text + the tooltip anchor).
  assert.ok(/data-command="reopen"[^>]*disabled/.test(html) || /disabled[^>]*data-command="reopen"/.test(html), "Reopen disabled");
  // Reopen arrives disabled with no blocker code: the generic sentence, never a blank reason.
  assert.ok(t.includes("Reopen (Not available on this record right now.)"), "Reopen's reason");
  assert.ok(t.includes("Override disposition (This is not available on the record as it stands.)"), "ILLEGAL_TRANSITION sentence");
  assert.ok(html.includes("data-more") && html.includes("hidden"), "More actions starts closed");
  assert.equal((html.match(/data-command="assign"/g) ?? []).length, 1, "Assign once");
  assert.ok(html.indexOf('data-command="assign"') < html.indexOf("data-more"), "Assign sits in the header row, not under More actions");
});

fixtureTest("A41: End the call is the primary while a call is running (live fixture); a blocked Start keeps its reason", () => {
  const live = detail("S5c/outreach__t3-live-call.json").data.outreach;
  assert.equal(groupCommands(live.allowed_actions).primary?.action, "end_call");
  const t = text(renderToStaticMarkup(createElement(RecordCommands, { record: live, onCommand: noop, messageRepDisabledReason: null, onMessageRep: noop })));
  assert.ok(t.includes("End the call") && !t.includes("Start the call"));
  const uncertain = detail("S6/outreach__t3-p5-uncertain.json").data.outreach;
  const g = groupCommands(uncertain.allowed_actions);
  assert.equal(g.primary?.action, "start_call");
  assert.equal(g.primary?.enabled, false);
  const html = renderToStaticMarkup(createElement(RecordCommands, { record: uncertain, onCommand: noop, messageRepDisabledReason: null, onMessageRep: noop }));
  assert.ok(text(html).includes("A disposition review is open on this Lead."), "DISPOSITION_REVIEW sentence");
});

fixtureTest("Override disposition is hidden when its only blocker is FEATURE_DISABLED, shown disabled otherwise", () => {
  const o = detail("S1/outreach__s-assessment-pending.json").data.outreach;
  const off = o.allowed_actions.map((a) => a.action === "override_disposition" ? { ...a, enabled: false, blocker_codes: ["FEATURE_DISABLED"] } : a);
  assert.ok(!groupCommands(off).more.some((a) => a.action === "override_disposition"));
  assert.ok(groupCommands(o.allowed_actions).more.some((a) => a.action === "override_disposition" && !a.enabled));
});

fixtureTest("Message rep: disabled with `No rep to message`, enabled when a rep is linked", () => {
  const o = detail("S1/outreach__s-assessment-pending.json").data.outreach;
  const off = renderToStaticMarkup(createElement(RecordCommands, { record: o, onCommand: noop, onMessageRep: noop, messageRepDisabledReason: "No rep to message" }));
  assert.ok(/data-command="message_rep"[^>]*disabled/.test(off) || /disabled[^>]*data-command="message_rep"/.test(off));
  assert.ok(text(off).includes("No rep to message"));
  const on = renderToStaticMarkup(createElement(RecordCommands, { record: o, onCommand: noop, onMessageRep: noop, messageRepDisabledReason: null }));
  assert.ok(!/data-command="message_rep"[^>]*disabled=""/.test(on) && !/disabled=""[^>]*data-command="message_rep"/.test(on), "enabled");
});

fixtureTest("A21 / E26: the receiver agent shows beside an Owner assignment and when it differs; never when it is the assigned rep", () => {
  const kept = detail("S6/outreach__t3-owner-kept.json");
  assert.equal(showReceiverAgent(kept.data.outreach), true);
  const t = text(header("S6/outreach__t3-owner-kept.json"));
  assert.ok(t.includes("Assigned to Tina Cho (by you) · Receiver agent in Granot: Dana Reyes"), t);
  assert.ok(t.includes("from the Granot username."), "tooltip: source");
  for (const rel of ["S6/outreach__t3-receiver-granot.json", "S6/outreach__t3-receiver-extension.json", "S6/outreach__t3-receiver-manual.json", "S6/outreach__t3-receiver-sheet.json", "S6/outreach__t3-receiver-ringcentral.json"]) {
    const o = detail(rel).data.outreach;
    assert.equal(o.assignment.origin, "crm_receiver", rel);
    assert.equal(showReceiverAgent(o), false, rel);
    assert.ok(!text(header(rel)).includes("Receiver agent in Granot"), rel);
  }
  const across = detail("S6/outreach__t3-promise-across-a.json").data.outreach;
  assert.equal(showReceiverAgent(across), true, "Owner assigned Dana, Granot says Marcus");
  assert.ok(!text(header("S1/outreach__s-assessment-pending.json")).includes("Receiver agent"), "no receiver_agent → nothing");
});

fixtureTest("the header's band line, live chip and due state come from the server fields", () => {
  const kept = text(header("S6/outreach__t3-owner-kept.json"));
  assert.ok(/Band 2 · No call yet after form submission · for about \d/.test(kept), "estimated band start reads about");
  const live = text(header("S5c/outreach__t3-live-call.json"));
  assert.ok(live.includes("On the call · Dana Reyes (ext 101, reviewed) · 4m"), live);
  const closed = text(header("S1/outreach__s-closed-owner.json"));
  assert.ok(closed.includes("Not in Attention"), "null band");
  const overdue = header("S1/outreach__s-followup-overdue.json");
  assert.ok(overdue.includes("si-text--amber") && text(overdue).includes("overdue"), "amber overdue from facts.next_action_state");
  const due = header("S1/outreach__s-followup-due.json");
  assert.ok(/Due \w{3} \d+, \d+:\d{2} [AP]M ET \(in /.test(text(due)), "due: exact + countdown");
});

fixtureTest("A37: Lead provenance — is_the_lead (S11 fixtures and a synthetic row with no Number), needs_a_lead, ambiguous, attached", () => {
  const noNumber = text(header("S11/outreach__prov-form-no-number.json"));
  assert.ok(noNumber.includes("This is the Lead") && noNumber.includes("This work is the Form Lead for Job 5590019.") && noNumber.includes("No Contact Number is on file."));
  assert.ok(!noNumber.includes("No Lead attached"), "never No Lead attached for a Lead subject");
  const call = text(header("S11/outreach__prov-call-lead.json"));
  assert.ok(call.includes("This work is the Call Lead for Job 5590056.") && !call.includes("No Contact Number is on file."));
  // Synthetic (A37, before every fixture carries S11-PROV): an S1 Lead with `is_the_lead` and `primary_number: null`.
  const d = detail("S1/outreach__s-lead-only.json");
  const synthetic = { ...d.data.outreach, primary_number: null, derived: { ...d.data.outreach.derived, provenance_state: "is_the_lead" } };
  const s = text(headerOf(synthetic, d.as_of));
  assert.ok(s.includes("This is the Lead") && s.includes("No Contact Number is on file.") && !s.includes("No Lead attached"));
  const number = header("S11/outreach__prov-number-only.json");
  assert.ok(text(number).includes("No Lead attached") && text(number).includes("Attach a Lead"));
  assert.ok(number.includes('href="/sales-intelligence/legacy?view=numbers&amp;number='), "Attach a Lead links out to legacy Numbers");
  const base = detail("S1/outreach__s-assessment-pending.json");
  const ambiguous = { ...base.data.outreach, derived: { ...base.data.outreach.derived, provenance_state: "ambiguous" } };
  const a = headerOf(ambiguous, base.as_of);
  assert.ok(/data-action="review-lead"[^>]*>Review</.test(a), "ambiguous → Review link-out");
  const byYou = { ...base.data.outreach, derived: { ...base.data.outreach.derived, provenance_state: "attached_by_you" } };
  assert.ok(text(headerOf(byYou, base.as_of)).includes("You attached this Lead"), "attached_* keep today's wording");
  const none = { ...base.data.outreach, derived: { ...base.data.outreach.derived, provenance_state: undefined } };
  assert.ok(text(headerOf(none, base.as_of)).includes("How this Lead was attached is not recorded yet."));
});

fixtureTest("A41: official-record links carry si_return and Open in new tab; the Number goes to legacy; `None` when absent", () => {
  const o = detail("S6/outreach__t3-owner-kept.json").data.outreach;
  const html = renderToStaticMarkup(createElement(RelatedRecordChips, { outreach: o, numberId: o.primary_number!.id, returnTo: RETURN }));
  assert.ok(html.includes(`si_return=${encodeURIComponent(RETURN)}`), "si_return on the Lead link");
  assert.ok(text(html).includes("Open in new tab"));
  assert.ok(html.includes(`/sales-intelligence/legacy?view=numbers&amp;number=${o.primary_number!.id}`), "Number via legacyNumberHref");
  assert.ok(text(html).includes("Booking: None") && text(html).includes("Cancellation: None"));
});

fixtureTest("A39: the header's call blocker reads `Don't call until {date}` from the active call restriction, `Don't call` with no end", () => {
  const d = detail("S1/outreach__s-assessment-pending.json");
  const o = { ...d.data.outreach, derived: { ...d.data.outreach.derived, call_blockers: ["restriction"] } };
  const row = headerRow(o);
  const until = activeCallRestriction([
    { id: "r1", revision: 1, channels: ["call", "text"], state: "active", until: "2026-10-02T16:00:00.000Z", allowed_actions: [] },
    { id: "r2", revision: 1, channels: ["text"], state: "active", until: null, allowed_actions: [] },
    { id: "r3", revision: 1, channels: ["call"], state: "lifted", until: null, allowed_actions: [] },
  ]);
  assert.deepEqual(until, { until: "2026-10-02T16:00:00.000Z" });
  const chip = headerChips(row, d.as_of, until, true).find((c) => c.id === "blocker-restriction");
  assert.equal(chip?.label, "Don't call until Oct 2, 12:00 PM ET");
  assert.equal(chip?.tone, "amber");
  const noEnd = headerChips(row, d.as_of, activeCallRestriction([{ id: "r1", revision: 1, channels: ["call"], state: "active", until: null, allowed_actions: [] }]), true);
  assert.equal(noEnd.find((c) => c.id === "blocker-restriction")?.label, "Don't call");
  const pending = headerChips(row, d.as_of, null, false).find((c) => c.id === "blocker-restriction");
  assert.equal(pending?.label, "Don't call");
  assert.ok(text(headerOf(o, d.as_of, { restriction: until, restrictionKnown: true })).includes("Don't call until Oct 2, 12:00 PM ET"));
});

fixtureTest("Work tab follow-ups: retry, superseded wording, due via as_of, each follow-up's own commands", () => {
  const sup = detail("AC/outreach__ac-default-superseded.json");
  const html = renderToStaticMarkup(createElement(FollowupsSection, { record: sup.data.outreach, asOf: sup.as_of }));
  const t = text(html);
  assert.ok(t.includes("Replaced by a specific plan"), "superseded_by_specific_plan");
  assert.ok(t.includes("Owner scheduled the quote follow-up call") && t.includes("Set by you"), "open follow-up with its origin");
  for (const word of ["Edit follow-up / assignment", "Complete follow-up", "Cancel follow-up", "Snooze"]) assert.ok(t.includes(word), word);
  assert.ok(html.includes('data-followup-status="superseded"'));
  const retry = detail("AC/outreach__ac-attempt-50-early.json");
  const r = text(renderToStaticMarkup(createElement(FollowupsSection, { record: retry.data.outreach, asOf: retry.as_of })));
  assert.ok(r.includes("Try again (1 of 2)"), "promise_chain attempt");
  assert.ok(/Due \w{3} \d+, \d+:\d{2} [AP]M ET/.test(r), "exact due time via lib/time");
  const none = detail("S1/outreach__s-followup-none.json");
  assert.ok(text(renderToStaticMarkup(createElement(FollowupsSection, { record: none.data.outreach, asOf: none.as_of }))).includes("No next step set"));
});

fixtureTest("Work tab corrections (owner_instructions) and the blank-note refusal", () => {
  const d = detail("S1/outreach__s-closed-owner.json");
  const items = d.data.owner_instructions ?? [];
  assert.ok(items.length > 0);
  const t = text(renderToStaticMarkup(createElement(CorrectionsView, { items, asOf: d.as_of })));
  assert.ok(t.includes("Note · active") && t.includes("Customer said they will move themselves with family."), t);
  assert.ok(t.includes("Closure · active"));
  assert.ok(text(renderToStaticMarkup(createElement(CorrectionsView, { items: [], asOf: d.as_of }))).includes("You haven't corrected anything on this record."));
  const o = detail("S1/outreach__s-assessment-pending.json").data.outreach;
  assert.throws(() => buildIntent("add_note", { ...initialDraft(), note: "   " }, o, undefined, "k1"), /Write a note first\./);
  assert.equal(buildIntent("add_note", { ...initialDraft(), note: "Called twice" }, o, undefined, "k1").body.text, "Called twice");
});

test("the tab bar: Analysis · Timeline · Work, default Analysis, si_return kept on every tab", () => {
  assert.equal(parseOutreachTab(undefined), "analysis");
  assert.equal(parseOutreachTab("timeline"), "timeline");
  assert.equal(parseOutreachTab("messages"), "analysis");
  const tabs = outreachTabs("o 1", "/sales-intelligence?view=closed");
  assert.deepEqual(tabs.map((t) => t.label), ["Analysis", "Timeline", "Work"]);
  assert.equal(tabs[0]!.href, "/sales-intelligence/outreach/o%201?si_return=%2Fsales-intelligence%3Fview%3Dclosed");
  assert.equal(tabs[2]!.href, "/sales-intelligence/outreach/o%201?tab=work&si_return=%2Fsales-intelligence%3Fview%3Dclosed");
  const html = withClient(createElement(OutreachPageFrame, { back: backHref("/sales-intelligence?view=closed"), header: createElement("div", { "data-header": "1" }), tabs, active: "work" }, createElement("p", null, "body")));
  assert.ok(html.includes('aria-current="page"') && /aria-current="page"[^>]*>|href="[^"]*tab=work[^"]*"[^>]*aria-current="page"/.test(html));
  assert.ok(html.includes('href="/sales-intelligence?view=closed"') && text(html).includes("Back to Outreach Intelligence"), "back link honours si_return");
  assert.ok(html.includes("si-liveind"), "the header live indicator");
  assert.equal(backHref("https://evil.example"), "/sales-intelligence");
  assert.equal(backHref(null), "/sales-intelligence");
});

test("A20: the redirect rule table", () => {
  const params = (q: string) => new URLSearchParams(q);
  assert.deepEqual(deepLinkTarget(params("view=attention&outreach=o1&panel=assessment")), { kind: "redirect", href: "/sales-intelligence/outreach/o1?tab=analysis#scores" });
  assert.deepEqual(deepLinkTarget(params("outreach=o1&panel=analysis&analysis_run=r9")), { kind: "redirect", href: "/sales-intelligence/outreach/o1?tab=analysis&run=r9#full-output" });
  assert.deepEqual(deepLinkTarget(params("outreach=o1&panel=analysis")), { kind: "redirect", href: "/sales-intelligence/outreach/o1?tab=analysis#full-output" });
  assert.deepEqual(
    deepLinkTarget({ outreach: "o1", panel: "assessment", si_return: "/sales-intelligence?view=all_outreach" }),
    { kind: "redirect", href: "/sales-intelligence/outreach/o1?tab=analysis&si_return=%2Fsales-intelligence%3Fview%3Dall_outreach#scores" },
  );
  const lead = deepLinkTarget(params("view=attention&lead=l7&lead_model=FormLead&panel=analysis&analysis_run=r2"));
  assert.deepEqual(lead, { kind: "resolve-lead", model: "FormLead", leadId: "l7", tab: "analysis", run: "r2", anchor: "full-output", siReturn: null });
  assert.equal(leadTargetHref(lead as Extract<typeof lead, { kind: "resolve-lead" }>, "o5"), "/sales-intelligence/outreach/o5?tab=analysis&run=r2#full-output");
  assert.equal(deepLinkTarget(params("view=attention&lead=l7&lead_model=FormLead")), null, "trap 4: the desk opens the dialog");
  assert.equal(deepLinkTarget(params("outreach=o1&panel=work")), null);
  assert.equal(deepLinkTarget(params("lead=l7&lead_model=Nope&panel=assessment")), null);
  assert.equal(outreachRouteHref("o1"), "/sales-intelligence/outreach/o1");
});

fixtureTest("page states: the route skeleton (frame + header skeleton + six section titles), the 404 page state", () => {
  const sk = renderToStaticMarkup(createElement(OutreachRouteSkeleton));
  const t = text(sk);
  assert.deepEqual(ANALYSIS_SECTIONS.map((s) => s.title), ["Situation", "Scores", "Move details", "Findings", "Conversations", "Full output"]);
  for (const s of ANALYSIS_SECTIONS) {
    assert.ok(t.includes(s.title), s.title);
    assert.ok(sk.includes(`id="${s.id}"`), `anchor #${s.id}`);
  }
  assert.ok(t.includes("Analysis") && t.includes("Timeline") && t.includes("Work"), "tab bar");
  assert.ok(sk.includes("si-recordheader is-skeleton") && sk.includes("si-skeleton"), "header skeleton");
  const missing = raw("S8/owner-outreach-missing__missing-id.json");
  assert.equal(isNotFoundError({ status: missing.status, code: missing.body.code }), true);
  assert.equal(isNotFoundError({ status: 500, code: "READ_FAILED" }), false);
  const nf = text(renderToStaticMarkup(createElement(OutreachNotFound, { back: "/sales-intelligence" })));
  assert.ok(nf.includes("This Outreach doesn't exist or was removed.") && nf.includes("Back to Outreach Intelligence"));
  const page = withClient(createElement(OutreachPageFrame, { back: "/sales-intelligence", header: null, tabs: outreachTabs("o1", null), active: "analysis", notFound: true }, createElement("p", null, "hidden body")));
  assert.ok(text(page).includes("This Outreach doesn't exist or was removed.") && !text(page).includes("hidden body") && !page.includes("Couldn't load this."));
});

fixtureTest("FIX-UI1 m7/m3: related records are separated, the Number link has its `Previous version` note, links are 44 px", () => {
  const o = detail("AC/outreach__ac-attempt-50-early.json").data.outreach;
  const out = renderToStaticMarkup(createElement(RelatedRecordChips, { outreach: o, numberId: "n1", returnTo: "/sales-intelligence" }));
  assert.ok(out.includes('class="si-related__sep" aria-hidden="true"> · </span>'));
  const seps = out.split("si-related__sep").length - 1;
  const chips = out.split('class="si-chiprow"').length - 1;
  assert.equal(seps, chips - 1, "one separator between each pair of records");
  const numberAt = out.indexOf("/numbers/") >= 0 ? out.indexOf("/numbers/") : out.indexOf("n1");
  assert.ok(out.indexOf("Previous version", numberAt) > numberAt, "the note follows the legacy Number link");
  assert.equal(out.split("Previous version").length - 1, 1);
  assert.ok(out.includes('class="si-related__link"'));
});

test("FIX-UI1 m1: the kept Lead progress and Coverage blocks format times through lib/time (`ET`)", () => {
  for (const file of ["components/sales-intelligence/lead-progress.tsx", "components/sales-intelligence/coverage-view.tsx"]) {
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.ok(!src.includes('from "./lib/format"'), `${file} no longer formats with lib/format (EDT/EST)`);
    assert.ok(src.includes('from "./lib/time"'), `${file} uses lib/time`);
  }
});
