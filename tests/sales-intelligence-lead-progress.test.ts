import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ATTENTION_SORTS, ATTENTION_SORT_DEFAULT_DIRECTION, NUMBER_SORTS, type AttentionRow as Row, type LeadProgress, type Outreach } from "../lib/api/salesIntelligence";
import { attachedLeadView, bookedClosure, closureText, priorityText, progressExplanation, progressLine, quotedText } from "../components/sales-intelligence/lib/lead-progress";
import {
  NUMBER_SORT_OPTIONS,
  OUTREACH_SORT_OPTIONS,
  applyNumberSort,
  applyOutreachSort,
  directionLabel,
  numberSortFromParams,
  outreachLayout,
  outreachSortFromParams,
  sortKeyText,
  sortOption,
} from "../components/sales-intelligence/lib/sort";
import { buildIntent, initialDraft } from "../components/sales-intelligence/lib/commands";
import { callBlockerSentence, offeredActions } from "../components/sales-intelligence/lib/owner-now";
import { copy } from "../components/sales-intelligence/sales-intelligence-copy";
import { label } from "../components/sales-intelligence/lib/format";
import { AttachedLeadLine, BookedNotice, LeadProgressLine, LeadProgressSection } from "../components/sales-intelligence/lead-progress";
import { AttentionBands, AttentionFlatList } from "../components/sales-intelligence/attention";

const progress = (over: Partial<LeadProgress> = {}): LeadProgress => ({
  lead_ref: { model: "FormLead", id: "L1" },
  granot_priority: "1",
  priority_label: "Quoted",
  quoted: true,
  disposition: "open",
  disposition_label: "Open",
  work_observed: true,
  basis: "quoted",
  basis_label: "Lead quoted",
  provenance: "accepted",
  source_origin: "granot",
  source_applied_at: "2026-09-22T14:05:00.000Z",
  last_progress_at: "2026-09-22T14:05:00.000Z",
  first_work_observed_at: null,
  closure: null,
  override: null,
  reopen_review_id: null,
  disposition_revision: "rev-1",
  explanation: "Lead updated in Granot · No next step set",
  no_call_observed: true,
  projected_at: "2026-09-22T14:06:00.000Z",
  ...over,
});

const availability = (action: string, enabled = true, blocker_codes: string[] = []) =>
  ({ action, enabled, blocker_codes, target_id: "o1", expected_revision: 4 });

const outreach = (over: Partial<Outreach> = {}): Outreach => ({
  id: "o1",
  revision: 4,
  subject: { kind: "lead", model: "FormLead", id: "L1" },
  state: "open",
  reason: null,
  allowed_actions: [],
  assignment: { agent: null, origin: null },
  followups: [],
  derived: { overdue: false, attention_band: 5, reasons: ["no_next_step", "no_call_observed"], call_blockers: [], age_wall_ms: 0, age_staffed_ms: 0 },
  last_meaningful_contact_at: null,
  ...over,
} as Outreach);

const row = (key: string, band: number | null, over: Partial<Outreach> = {}): Row => ({
  subject_key: key,
  subject: { kind: "lead", model: "FormLead", id: key },
  outreach: outreach({ id: key, ...over, derived: { ...outreach().derived, attention_band: band } }),
  derived: { ...outreach().derived, attention_band: band },
  sort_keys: { next_action_due: null, lead_received: "2026-09-20T12:00:00.000Z", last_human_contact: null, last_lead_progress: null },
});

test("Priority shows the raw code beside the server label; Not set and Unknown stay explicit", () => {
  assert.equal(priorityText(progress()), "1 (Quoted)");
  assert.equal(priorityText(progress({ granot_priority: null, priority_label: "Not set" })), "Not set");
  assert.equal(priorityText(progress({ granot_priority: "9", priority_label: "Unknown meaning" })), "9 (Unknown meaning)");
  assert.equal(quotedText(true), "Yes");
  assert.equal(quotedText(false), "No");
  assert.equal(quotedText(null), "Unknown");
  assert.equal(progressLine(progress()), "Granot Priority: 1 (Quoted) · Quoted: Yes");
});

test("Quoted true beside Priority 8 is rendered as sent, never corrected", () => {
  const dead = progress({ granot_priority: "8", priority_label: "CRM dead opportunity", quoted: true, closure: { basis: "granot_dead_opportunity", closed_at: "2026-09-22T15:00:00.000Z" } });
  assert.equal(progressLine(dead), "Granot Priority: 8 (CRM dead opportunity) · Quoted: Yes");
  assert.equal(closureText(dead.closure), "Closed: Granot dead opportunity");
  assert.equal(closureText({ basis: "granot_bad_unusable", closed_at: null }), "Closed: Granot bad/unusable");
  const html = renderToStaticMarkup(createElement(LeadProgressLine, { record: outreach({ state: "closed", lead_progress: dead }) }));
  assert.match(html, /Granot Priority: 8 \(CRM dead opportunity\)/);
  assert.match(html, /Quoted: Yes/);
  assert.match(html, /Quoted is retained from the Lead&#x27;s quote history\./);
  assert.match(html, /Closed: Granot dead opportunity/);
  assert.doesNotMatch(html, /band/i);
});

test("the explanation shows only while the record is open, and an old server adds nothing", () => {
  assert.equal(progressExplanation(progress(), "open"), "Lead updated in Granot · No next step set");
  assert.equal(progressExplanation(progress(), "closed"), null);
  assert.equal(renderToStaticMarkup(createElement(LeadProgressLine, { record: outreach() })), "");
  assert.equal(renderToStaticMarkup(createElement(LeadProgressLine, { record: outreach({ lead_progress: null }) })), "");
  const html = renderToStaticMarkup(createElement(LeadProgressLine, { record: outreach({ lead_progress: progress() }) }));
  assert.match(html, /Lead updated in Granot · No next step set/);
});

test("detail shows basis, Lead update time in Eastern, no-call line, override and reopen review", () => {
  const record = outreach({
    state: "closed",
    lead_progress: progress({
      closure: { basis: "granot_bad_unusable", closed_at: "2026-09-22T15:00:00.000Z" },
      override: { reason: "Customer called back", decided_at: "2026-09-22T16:00:00.000Z", decided_by: "owner-1", disposition_revision: "rev-1" },
      reopen_review_id: "rv1",
    }),
    allowed_actions: [availability("override_disposition"), availability("reopen", false, ["CRM_DISPOSITION_CLOSED"])],
  });
  const html = renderToStaticMarkup(createElement(LeadProgressSection, { record, onCommand: () => {} }));
  assert.match(html, /Work basis: Lead quoted/);
  assert.match(html, /Lead update time Sep 22, 10:05 AM EDT from Granot/);
  assert.match(html, /No call observed in available history/);
  assert.match(html, /Closed: Granot bad\/unusable/);
  assert.match(html, /Disposition overridden by owner-1/);
  assert.match(html, /Reason: Customer called back/);
  assert.match(html, /Reopen review/);
  assert.match(html, /Override disposition/);
  assert.match(html, /current Granot Priority closes this work/);
  assert.doesNotMatch(html, /%/);
});

test("new reasons, badges and blockers read as sentences", () => {
  assert.equal(label("no_call_observed"), "No call observed in available history");
  assert.equal(label("disposition_reopen"), "Reopen review");
  assert.equal(label("disposition_review"), "Disposition review");
  const closed = outreach({ state: "closed" });
  const why = (action: string, codes: string[]) => callBlockerSentence(action, closed, codes, copy.call.blockers, copy.call.blockerCodes);
  assert.equal(why("reopen", ["CRM_DISPOSITION_CLOSED"]), copy.call.blockerCodes.CRM_DISPOSITION_CLOSED);
  assert.equal(why("start_call", ["DISPOSITION_REVIEW"]), copy.call.blockerCodes.DISPOSITION_REVIEW);
  assert.equal(why("override_disposition", ["FEATURE_DISABLED"]), "This is switched off in this deployment.");
  assert.equal(why("start_call", ["ILLEGAL_TRANSITION"]), "This Outreach is closed.");
});

test("override_disposition sends the disposition revision the Owner saw", () => {
  const record = outreach({ lead_progress: progress({ disposition_revision: "rev-7" }) });
  const intent = buildIntent("override_disposition", { ...initialDraft(), reason: "  Customer still moving  " }, record, undefined, "k1");
  assert.deepEqual(intent, {
    path: "outreach/o1/commands",
    method: "POST",
    key: "k1",
    body: { command: "override_disposition", expected_revision: 4, reason: "Customer still moving", disposition_revision: "rev-7" },
  });
  assert.throws(() => buildIntent("override_disposition", { ...initialDraft(), reason: "x" }, outreach(), undefined, "k2"));
  assert.throws(() => buildIntent("override_disposition", initialDraft(), record, undefined, "k3"));
});

test("Booked while open keeps the panel and offers Open Booking", () => {
  const booked = outreach({ state: "closed", reason: "booked", related_record_links: [{ model: "BookedLead", id: "B9", href: "", certainty: "exact" }] });
  assert.deepEqual(bookedClosure(booked), { id: "B9" });
  assert.equal(bookedClosure(outreach({ state: "closed", reason: "lost" })), null);
  const html = renderToStaticMarkup(createElement(BookedNotice, { record: booked }));
  assert.match(html, /Booked — removed from active Outreach/);
  assert.match(html, /href="\/bookings\?record=B9&amp;database_scope=production/);
});

test("Number card: one resolved Lead, multiple Leads, no Lead, and an older server", () => {
  assert.equal(attachedLeadView(undefined), null);
  assert.deepEqual(attachedLeadView({ status: "multiple" }), { kind: "multiple" });
  assert.deepEqual(attachedLeadView({ status: "none" }), { kind: "none" });
  const resolved = attachedLeadView({
    status: "resolved", lead_ref: { model: "FormLead", id: "L1" }, lead_progress: progress(), booking: { id: "B1", cancelled: false },
    lead_display: { name: "Maria Delgado", job_no: "J-100" },
  });
  assert.deepEqual(resolved, { kind: "resolved", who: "Maria Delgado · Job J-100", line: "Granot Priority: 1 (Quoted) · Quoted: Yes", quotedTrue: true, booked: "Booked", bookingId: "B1" });
  const noProgress = attachedLeadView({ status: "resolved", lead_ref: { model: "CallLead", id: "C1" }, lead_progress: null, booking: null });
  assert.equal(noProgress?.kind === "resolved" && noProgress.line, "Granot Priority: Unknown · Quoted: Unknown");
  assert.equal(noProgress?.kind === "resolved" && noProgress.booked, "Not booked");
  const html = (value: Parameters<typeof AttachedLeadLine>[0]["value"]) =>
    renderToStaticMarkup(createElement(AttachedLeadLine, { value, onReviewMatches: () => {} }));
  assert.equal(html(undefined), "");
  assert.match(html({ status: "multiple" }), /Multiple Leads · Review matches/);
  assert.doesNotMatch(html({ status: "multiple" }), /Granot Priority/);
  assert.match(html({ status: "none" }), /No Lead attached/);
  assert.doesNotMatch(html({ status: "none" }), /Quoted: (No|Yes)/);
  assert.match(html({ status: "resolved", lead_ref: { model: "FormLead", id: "L1" }, lead_progress: progress(), booking: { id: "B1", cancelled: false } }), /Open Booking/);
});

test("Sort options: Outreach and Numbers mirror the server enums and default directions", () => {
  assert.deepEqual(OUTREACH_SORT_OPTIONS.map((option) => option.value), [...ATTENTION_SORTS]);
  for (const option of OUTREACH_SORT_OPTIONS) assert.equal(option.defaultDirection, ATTENTION_SORT_DEFAULT_DIRECTION[option.value]);
  assert.deepEqual(NUMBER_SORT_OPTIONS.map((option) => option.value), [...NUMBER_SORTS]);
  assert.equal(directionLabel(sortOption(OUTREACH_SORT_OPTIONS, "next_action_due"), "asc"), "Soonest first");
  assert.equal(directionLabel(sortOption(OUTREACH_SORT_OPTIONS, "next_action_due"), "desc"), "Latest first");
  assert.equal(directionLabel(sortOption(OUTREACH_SORT_OPTIONS, "lead_received"), "desc"), "Newest first");
  assert.equal(directionLabel(sortOption(OUTREACH_SORT_OPTIONS, "last_human_contact"), "asc"), "Oldest first");
  assert.equal(directionLabel(sortOption(OUTREACH_SORT_OPTIONS, "attention"), "asc"), null);
  assert.equal(directionLabel(sortOption(NUMBER_SORT_OPTIONS, "first_observed"), "asc"), "Oldest first");
});

test("Sort state lives in the URL; Attention order and the Numbers default send no parameters", () => {
  assert.deepEqual(outreachSortFromParams(new URLSearchParams("")), { sort: "attention", direction: "asc" });
  assert.deepEqual(outreachSortFromParams(new URLSearchParams("sort=lead_received")), { sort: "lead_received", direction: "desc" });
  assert.deepEqual(outreachSortFromParams(new URLSearchParams("sort=bogus&direction=desc")), { sort: "attention", direction: "desc" });
  assert.deepEqual(numberSortFromParams(new URLSearchParams("number_sort=first_observed&number_direction=asc")), { sort: "first_observed", direction: "asc" });
  const q = new URLSearchParams("limit=100");
  applyOutreachSort(q, { sort: "attention", direction: "asc" });
  assert.equal(q.toString(), "limit=100");
  applyOutreachSort(q, { sort: "next_action_due", direction: "asc" });
  assert.equal(q.toString(), "limit=100&sort=next_action_due&direction=asc");
  const n = new URLSearchParams("limit=100");
  applyNumberSort(n, { sort: "last_activity", direction: "desc" });
  assert.equal(n.toString(), "limit=100");
  applyNumberSort(n, { sort: "last_activity", direction: "asc" });
  assert.equal(n.toString(), "limit=100&sort=last_activity&direction=asc");
});

test("a time sort renders one flat list in server order with band labels; Attention order regroups", () => {
  assert.equal(outreachLayout(undefined), "bands");
  assert.equal(outreachLayout("attention"), "bands");
  assert.equal(outreachLayout("lead_received"), "flat");
  assert.equal(outreachLayout("transaction_intent"), "flat");
  const items = [row("s-band7", 7), row("s-band1", 1), row("s-review", null), row("s-band3", 3)];
  const flat = renderToStaticMarkup(createElement(AttentionFlatList, { items, selected: () => false, onOpen: () => {}, sortedBy: "lead_received" }));
  const order = ["Band 7 · Going cold", "Band 1 · Promised callbacks overdue", "Needs review", "Band 3 · Missed calls with no callback"].map((text) => flat.indexOf(text));
  assert.ok(order.every((index) => index >= 0), "each card keeps its band label");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "server order is preserved");
  assert.doesNotMatch(flat, /si-band__header/);
  assert.match(flat, /Lead received: Sep 20, 8:00 AM EDT/);
  const grouped = renderToStaticMarkup(createElement(AttentionBands, { items, selected: () => false, onOpen: () => {} }));
  assert.match(grouped, /si-band__header/);
  assert.ok(grouped.indexOf("Promised callbacks overdue") < grouped.indexOf("Going cold"));
});

test("D-01: a null sort key uses the sort's own wording; an absent key is Unknown", () => {
  const fmt = (iso: string) => `at ${iso}`;
  const text = (sort: string, value: string | null | undefined) => sortKeyText(sortOption(OUTREACH_SORT_OPTIONS, sort), value, fmt, "Unknown");
  assert.equal(text("last_human_contact", null), "No conversation observed");
  assert.equal(text("last_lead_progress", null), "Time unknown");
  assert.equal(text("next_action_due", null), "No next action");
  assert.equal(text("lead_received", null), "Not a Lead");
  assert.equal(text("lead_received", undefined), "Unknown");
  assert.equal(text("lead_received", "2026-09-01T12:00:00.000Z"), "at 2026-09-01T12:00:00.000Z");
  const flat = renderToStaticMarkup(createElement(AttentionFlatList, { items: [row("s1", 5)], selected: () => false, onOpen: () => {}, sortedBy: "last_lead_progress" }));
  assert.match(flat, /Last Lead progress: Time unknown/);
  assert.doesNotMatch(flat, /Last Lead progress: Not observed/);
});

test("D-03: Override disposition is hidden when only the deployment switch blocks it", () => {
  const actions = [availability("override_disposition", false, ["FEATURE_DISABLED"]), availability("mark_worked", false, ["FEATURE_DISABLED"]), availability("reopen", false, ["CRM_DISPOSITION_CLOSED"])];
  assert.deepEqual(offeredActions(actions).map((item) => item.action), ["mark_worked", "reopen"]);
  assert.equal(offeredActions([availability("override_disposition", false, ["ILLEGAL_TRANSITION"])]).length, 1);
  assert.equal(offeredActions([availability("override_disposition", false, ["FEATURE_DISABLED", "ILLEGAL_TRANSITION"])]).length, 1);
  const hidden = renderToStaticMarkup(createElement(LeadProgressSection, { record: outreach({ lead_progress: progress(), allowed_actions: [availability("override_disposition", false, ["FEATURE_DISABLED"])] }), onCommand: () => {} }));
  assert.doesNotMatch(hidden, /Override disposition/);
  assert.doesNotMatch(hidden, /switched off/);
  const shown = renderToStaticMarkup(createElement(LeadProgressSection, { record: outreach({ lead_progress: progress(), allowed_actions: [availability("override_disposition", false, ["ILLEGAL_TRANSITION"])] }), onCommand: () => {} }));
  assert.match(shown, /Override disposition/);
});
