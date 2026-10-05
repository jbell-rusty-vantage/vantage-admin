import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NumberDetail, NumberSearchItem, TimelineEvent } from "../../lib/api/salesIntelligence";
import { salesIntelligenceTopicKeys } from "../../lib/query/salesIntelligence";
import { AttachedLeadLine, AttachedLeadPanel } from "../../components/sales-intelligence/numbers/attached-lead";
import { NumberFacts } from "../../components/sales-intelligence/numbers/number-detail";
import { TimelineEntry, repText } from "../../components/sales-intelligence/numbers/number-timeline";
import { NumberRow, recoverStaleNumbersCursor } from "../../components/sales-intelligence/numbers/numbers-view";
import { numberChips, numberFilterCount } from "../../components/sales-intelligence/numbers/numbers-filters";
import { Restrictions } from "../../components/sales-intelligence/restrictions";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { parseSiUrl } from "../../components/sales-intelligence/data/url-state";
import { siNavigation } from "../../components/sales-intelligence/data/use-url-state";

const render = (type: unknown, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(type as never, props as never));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const ID = "6ab03e836894bcef715051db";
const LEAD = "6ab065812d126e8df7d70862";
const rollups = { interactions_total: 5, inbound_total: 4, outbound_total: 1, human_conversations_total: 1, last_inbound_at: "2026-09-21T03:39:41.120Z", last_outbound_at: null,
  last_human_conversation_at: "2026-09-21T01:00:00.000Z", attached_lead_count: 1, candidate_lead_count: 0, recordings_total: 2 };
const item = (attached: NumberSearchItem["attached_lead"], extra: Partial<NumberSearchItem> = {}): NumberSearchItem => ({
  id: ID, revision: 13, e164: "+15550100200", national_ten: "5550100200", kind: "external", classification: "customer", eligibility: "allowed",
  provider_names: ["Synthetic Customer"], first_observed_at: "2026-09-20T16:19:12.431Z", last_activity_at: "2026-09-21T03:39:41.120Z", rollups, linked: true,
  match: { kind: "none" }, attached_lead: attached, created_via: "call", has_calls: true, ...extra,
});
const resolved = { status: "resolved" as const, lead_ref: { model: "FormLead" as const, id: LEAD }, lead_display: { name: "Synthetic Lead", job_no: "5562924", source_company: "Top 10 Forms" },
  official: { status: "cancelled", booking_id: "6ab0000000000000000000b1", cancellation_id: "6ab0000000000000000000c1" } };

test("a Number row shows E.164, provider names, classification, counts and the one resolved Lead with its official status", () => {
  const html = render(NumberRow, { number: item(resolved), selected: true, returnTo: "/sales-intelligence", onOpen: () => {} });
  const words = text(html);
  assert.match(words, /\+15550100200/);
  assert.match(words, /Synthetic Customer/);
  assert.match(words, /Customer/);
  assert.match(words, /Can contact/);
  assert.match(words, /Synthetic Lead · Job 5562924 · Top 10 Forms Cancelled/);
  assert.match(words, /5 calls · 4 in · 1 out · 1 conversation/);
  assert.match(html, /href="\/form-leads\?record=6ab065812d126e8df7d70862[^"]*si_return=%2Fsales-intelligence"/);
  assert.match(html, /si-nrow is-selected/);
  // No Outreach, analysis, assessment or summary wording exists on a Number row.
  assert.doesNotMatch(words, /Outreach|analysis|assessment|summary|transcript/i);
});

test("multiple and none carry no Lead fact; a form-only Number says so", () => {
  const multiple = text(render(AttachedLeadLine, { value: { status: "multiple" } }));
  assert.equal(multiple, "More than one Lead is attached. Review the matches.");
  assert.equal(text(render(AttachedLeadLine, { value: { status: "none" } })), "No Lead attached");
  const gone = text(render(AttachedLeadLine, { value: { ...resolved, lead_display: null, official: null } }));
  assert.equal(gone, "The attached Lead is no longer on file.");
  const formOnly = text(render(NumberRow, { number: item({ status: "none" }, { has_calls: false, created_via: "form_lead", rollups: { ...rollups, interactions_total: 0, inbound_total: 0, outbound_total: 0, human_conversations_total: 0 } }), selected: false, returnTo: "/sales-intelligence", onOpen: () => {} }));
  assert.match(formOnly, /From a Form Lead · no call yet/);
  assert.match(formOnly, /No Lead attached/);
});

test("the attached Lead panel links the official Lead, Booking and Cancellation", () => {
  const html = render(AttachedLeadPanel, { value: resolved, returnTo: "/sales-intelligence?number=x" });
  assert.match(html, /href="\/form-leads\?record=6ab065812d126e8df7d70862/);
  assert.match(html, /href="\/bookings\?record=6ab0000000000000000000b1/);
  assert.match(html, />Open Cancellation</);
  assert.doesNotMatch(render(AttachedLeadPanel, { value: { status: "multiple" } }), /href=/);
});

const call = (detail: Record<string, unknown>, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "i1", kind: "interaction", happened_at: "2026-09-21T01:31:58.120Z", observed_at: "2026-09-21T01:31:58.120Z", subject_key: `number:${ID}`, description: "Inbound call",
  evidence_refs: [], detail: detail as TimelineEvent["detail"], ...extra,
});

test("a call shows direction, result, duration, the attributed rep and its legs; only a reviewed link names an Agent", () => {
  const html = render(TimelineEntry, { event: call({ direction: "inbound", provider_result: "connected", contact_type: "human_conversation", duration_seconds: 245, call_log_state: "settled", recording_count: 1,
    rep: { status: "reviewed", agent_id: "c".repeat(24), agent_name: "Jordan", extension_id: "101", extension_number: "101" },
    legs: [{ leg_type: "Accept", direction: "Inbound", result: "Accepted", start_time: "2026-09-21T01:31:58.120Z", duration_seconds: 240, extension_id: "101" }], legs_overflow_count: 2 }) });
  const words = text(html);
  assert.match(words, /Inbound call · Connected/);
  assert.match(words, /Duration 4m 05s · Spoke with customer · 1 provider recording/);
  assert.match(words, /Rep: Jordan · ext\. 101/);
  assert.match(words, /Call legs \(1\)/);
  assert.match(words, /2 more legs not shown/);
  assert.equal(repText({ status: "unreviewed", agent_id: null, agent_name: "Not shown", extension_id: "102", extension_number: "102" }), "Extension not yet reviewed · ext. 102");
  assert.equal(repText({ status: "reviewed", agent_id: null, agent_name: null, extension_id: null, extension_number: null }), "reviewed");
  assert.equal(repText(null), null);
  const provisional = text(render(TimelineEntry, { event: call({ direction: "outbound", provider_result: "missed", contact_type: null, duration_seconds: null, call_log_state: "provisional" }, { observed_at: "2026-09-21T02:00:00.000Z" }) }));
  assert.match(provisional, /Outbound call · Missed call/);
  assert.match(provisional, /Duration Unknown/);
  assert.match(provisional, /Still settling with RingCentral/);
  assert.match(provisional, /Observed /);
});

test("a Lead message shows its status, never a body", () => {
  const words = text(render(TimelineEntry, { event: { id: "m1", kind: "lead_message", happened_at: "2026-09-21T01:00:00.000Z", observed_at: "2026-09-21T01:00:00.000Z", subject_key: `number:${ID}`,
    description: "Lead message sent", evidence_refs: [], detail: { status: "sent", purpose: "first_contact", origin: "system", sent_at: "2026-09-21T01:00:00.000Z", delivered_at: null, lead_ref: { model: "FormLead", id: LEAD } } } }));
  assert.match(words, /Message to the Lead/);
  assert.match(words, /Status: sent/);
  assert.match(words, /Sent /);
});

test("restrictions are read-only history; intelligence-origin rows stay visible", () => {
  const html = render(Restrictions, { rows: [{ id: "r1", revision: 2, channels: ["call", "text"], until: null, origin: "intelligence", state: "active" }] });
  const words = text(html);
  assert.match(words, /call, text · Active · No end date recorded/);
  assert.match(words, /Recorded by the retired analysis \(kept as history\)/);
  assert.match(words, /read-only/);
  assert.doesNotMatch(html, /<button/);
  assert.match(text(render(Restrictions, { rows: [] })), /No contact restrictions recorded\./);
});

test("Number facts print the stored rollups, connections and a recount mismatch", () => {
  const number = { ...item(resolved), search_terms: [], attachments: [], restrictions: [], allowed_actions: [],
    connections: { attachments_total: 2, attached: 1, candidate: 1, ambiguous: 0, rejected: 0, interactions_total_recount: 6 } } as NumberDetail;
  const words = text(render(NumberFacts, { number }));
  assert.match(words, /Names from RingCentral Synthetic Customer/);
  assert.match(words, /First seen from A call/);
  assert.match(words, /Calls 5 calls · 4 in · 1 out/);
  assert.match(words, /Provider recordings 2/);
  assert.match(words, /1 attached · 1 candidate · 0 ambiguous · 0 rejected/);
  assert.match(words, /Stored count 5 · fresh recount 6/);
});

test("filter chips and the filter count follow the URL state", () => {
  const state = parseSiUrl(new URLSearchParams("q=smith&classification=customer&attachment=linked&has_recording=true&include_form_only=true"));
  assert.equal(numberFilterCount(state), 5);
  const chips = numberChips(state, () => {});
  assert.equal(chips.length, 5);
  assert.equal(numberFilterCount(parseSiUrl(new URLSearchParams(""))), 0);
});

test("every Sales Intelligence query key segment is reached by a live topic (or resyncs on reconnect)", () => {
  const reached = new Set(Object.values(salesIntelligenceTopicKeys).flat().map((key) => key[1]));
  const keys = [siKeys.numbers("q"), siKeys.number(ID), siKeys.timeline(ID), siKeys.attachments("x"), siKeys.attachmentPair(ID, "FormLead", LEAD), siKeys.reps(""), siKeys.coverage()];
  for (const key of keys) assert.ok(reached.has(key[1]), String(key[1]));
});

/** Every source file of the interim page (components, route, BFF): retired reads and endpoints must not come back. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return statSync(file).isDirectory() ? sources(file) : /\.(ts|tsx)$/.test(name) ? [file] : [];
  });
}

test("no retired Attention, Outreach, Closed, Overview, analysis or conversation read is mounted", () => {
  const files = [
    ...sources(path.join(process.cwd(), "components/sales-intelligence")),
    ...sources(path.join(process.cwd(), "app/(dashboard)/sales-intelligence")),
    path.join(process.cwd(), "lib/api/salesIntelligence.ts"),
    path.join(process.cwd(), "lib/query/salesIntelligence.ts"),
  ];
  // Endpoint-shaped strings only (a capture-health status word or a rollup name is not a read).
  const retired = [/["'`/]attention[?/]/, /["'`/]outreach\//, /closed-history/, /["'`/]overview[?/]/, /analysis-runs/, /["'`/]assessments?\//, /["'`/]findings/, /["'`/]followups/,
    /["'`/]conversations\//, /review-items/, /["'`/]roster/, /database_scope['"]?\s*[:=]/, /_legacy/, /view=(?:attention|all_outreach|closed|overview|coverage|guide)/];
  const hits: string[] = [];
  for (const file of files) {
    const body = readFileSync(file, "utf8");
    for (const pattern of retired) if (pattern.test(body)) hits.push(`${path.relative(process.cwd(), file)} ${pattern}`);
  }
  assert.deepEqual(hits, []);
});

test("a stale cursor restarts at page one by replacing the rejected URL, so Back never lands on it again", () => {
  const stale = Object.assign(new Error("bad cursor"), { code: "INVALID_INPUT" });
  const calls: unknown[] = [];
  let dropped = 0;
  const update = (patch: unknown, options?: unknown) => { calls.push([patch, options]); };
  assert.equal(recoverStaleNumbersCursor(stale, "c-old", () => { dropped++; }, update), true);
  assert.equal(dropped, 1);
  assert.deepEqual(calls, [[{ cursor: null, before: [] }, { replace: true }]]);
  // Page one (no cursor) or any other error is left to the region's error and Try again.
  assert.equal(recoverStaleNumbersCursor(stale, null, () => { dropped++; }, update), false);
  assert.equal(recoverStaleNumbersCursor(Object.assign(new Error("x"), { code: "UPSTREAM_UNAVAILABLE" }), "c-old", () => { dropped++; }, update), false);
  assert.equal(dropped, 1);
  assert.equal(calls.length, 1);
});

test("URL updates push by default and replace only when asked; an unchanged URL navigates nowhere", () => {
  assert.deepEqual(siNavigation("/outreach-desk", "view=numbers&cursor=c-old&before=c0", { cursor: null, before: [] }, { replace: true }), { method: "replace", href: "/outreach-desk?view=numbers" });
  assert.deepEqual(siNavigation("/outreach-desk", "view=numbers", { number: ID }), { method: "push", href: `/outreach-desk?view=numbers&number=${ID}` });
  assert.equal(siNavigation("/outreach-desk", "view=numbers", { cursor: null }), null);
});
