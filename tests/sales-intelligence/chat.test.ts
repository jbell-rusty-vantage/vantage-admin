import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outreachReadSchema, repsSchema, type NudgeRecord } from "../../lib/api/salesIntelligence";
import {
  Composer,
  DayDivider,
  DeliveryIndicator,
  MessageBubble,
  Thread,
  ThreadSkeleton,
  UnreadDivider,
  canSend,
  deliveryStateOf,
  groupByDay,
  type ThreadItem,
} from "../../components/sales-intelligence/chat";
import {
  MessageHistoryView,
  MessageRepPanelView,
  filterRows,
  historyItems,
  panelTitle,
  pickerRows,
  sendErrorText,
  type LocalMessage,
} from "../../components/sales-intelligence/composer";
import { defaultRecipient, nudgePurpose, nudgeSendBody } from "../../components/sales-intelligence/data/use-nudges";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";
import { CHAT_NUDGES, CHAT_REPS, ChatSection } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/chat";

// UI1-CHAT: the chat kit and the Message rep composer as static markup (no DOM, ADMIN-REBUILD trap 7).

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
const detail = (rel: string) => outreachReadSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8")));
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el).replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

const AS_OF = "2026-09-23T21:46:37.661Z"; // S1 as_of: Wed Sep 23, 5:46 PM ET
const noop = () => {};

test("deliveryStateOf maps every nudge status", () => {
  assert.equal(deliveryStateOf("pending"), "sending");
  assert.equal(deliveryStateOf("sent"), "sent");
  assert.equal(deliveryStateOf("fallback_sent"), "fallback");
  assert.equal(deliveryStateOf("failed"), "failed");
  assert.equal(deliveryStateOf("unknown_delivery"), "unknown");
});

test("every delivery indicator state has its words, icon and action", () => {
  const sending = html(createElement(DeliveryIndicator, { state: "sending" }));
  assert.ok(sending.includes("Sending…") && sending.includes('width="12"') && sending.includes("si-spin"));
  const sentAt = "2026-09-23T21:30:04.000Z";
  const sent = html(createElement(DeliveryIndicator, { state: "sent", at: sentAt }));
  assert.ok(sent.includes(">Sent 5:30 PM ET</time>"), sent);
  assert.ok(sent.includes(`title="${formatExactFull(sentAt)}"`) && sent.includes(`aria-label="Sent ${formatExactFull(sentAt)}"`));
  assert.ok(sent.includes("lucide-check"));
  const fallback = html(createElement(DeliveryIndicator, { state: "fallback" }));
  assert.ok(fallback.includes("Sent by extension message instead") && fallback.includes("lucide-check"));
  const failed = html(createElement(DeliveryIndicator, { state: "failed", reason: "The message can't include a full customer phone number.", onRetry: noop }));
  assert.ok(failed.includes('<span class="si-text--danger">Failed · The message can\'t include a full customer phone number.</span>'), failed);
  assert.ok(failed.includes(">Retry</button>") && failed.includes('role="alert"'));
  const unknown = html(createElement(DeliveryIndicator, { state: "unknown", onCheckStatus: noop }));
  assert.ok(unknown.includes("Unknown delivery") && unknown.includes(">Check status</button>"));
  assert.ok(unknown.includes("lucide-circle-question-mark") || unknown.includes("lucide-circle-help"));
  assert.ok(html(createElement(DeliveryIndicator, { state: "unknown", onCheckStatus: noop, checking: true })).includes("Checking…"));
});

test("a bubble keeps line breaks, never auto-links, sits on its side and shows the exact time", () => {
  const body = "Line one\nLine two https://example.com/x";
  const owner = html(createElement(MessageBubble, { side: "owner", body, at: "2026-09-23T21:30:00.000Z", asOf: AS_OF, delivery: createElement(DeliveryIndicator, { state: "sending" }) }));
  assert.ok(owner.includes('class="si-bubble si-bubble--owner"'));
  assert.ok(owner.includes(`<p class="si-bubble__body">${body}</p>`), "text kept as sent (pre-wrap in CSS)");
  assert.ok(!owner.includes("<a "), "links are not auto-linked");
  assert.ok(owner.includes(">Sep 23, 5:30 PM ET</time>") && owner.includes('title="Sep 23, 2026, 5:30 PM ET"'));
  assert.ok(owner.includes('<span class="si-sr">You: </span>'));
  const rep = html(createElement(MessageBubble, { side: "rep", author: "Dana Reyes", body: "ok", at: AS_OF, asOf: AS_OF }));
  assert.ok(rep.includes("si-bubble--rep") && rep.includes("Dana Reyes: "));
  const css = fs.readFileSync(path.join(process.cwd(), "components/sales-intelligence/styles/sales-intelligence.css"), "utf8");
  assert.match(css, /\.si-bubble \{[^}]*max-width: 72%/);
  assert.match(css, /@container \(max-width: 479px\) \{ \.si-bubble \{ max-width: 88%; \} \}/);
  assert.match(css, /\.si-bubble__body \{[^}]*white-space: pre-wrap/);
  assert.match(css, /\.si-bubble--owner \{[^}]*var\(--si-bubble-owner\)/);
  assert.match(css, /\.si-bubble--rep \{[^}]*var\(--si-bubble-rep\)/);
});

test("day dividers read Today, Yesterday and the weekday date against as_of; the unread divider reads New", () => {
  assert.ok(html(createElement(DayDivider, { t: "2026-09-23T13:00:00.000Z", asOf: AS_OF })).includes(">Today</span>"));
  assert.ok(html(createElement(DayDivider, { t: "2026-09-22T13:00:00.000Z", asOf: AS_OF })).includes(">Yesterday</span>"));
  assert.ok(html(createElement(DayDivider, { t: "2026-09-20T13:00:00.000Z", asOf: AS_OF })).includes(">Sun Sep 20</span>"));
  // 00:30 UTC on Sep 23 is Sep 22 in New York.
  assert.ok(html(createElement(DayDivider, { t: "2026-09-23T00:30:00.000Z", asOf: AS_OF })).includes(">Yesterday</span>"));
  assert.ok(html(createElement(UnreadDivider)).includes(">New</span>"));
});

test("the thread is oldest first, grouped under day dividers", () => {
  const items: ThreadItem[] = [
    { id: "c", side: "owner", body: "third", at: "2026-09-23T20:00:00.000Z" },
    { id: "a", side: "owner", body: "first", at: "2026-09-20T13:00:00.000Z" },
    { id: "b", side: "owner", body: "second", at: "2026-09-22T13:00:00.000Z" },
    { id: "d", side: "rep", body: "fourth", at: "2026-09-23T21:00:00.000Z" },
  ];
  assert.deepEqual(groupByDay(items).map((g) => [g.day, g.items.map((i) => i.id).join("")]), [["2026-09-20", "a"], ["2026-09-22", "b"], ["2026-09-23", "cd"]]);
  const out = html(createElement(Thread, { items, asOf: AS_OF, label: "Messages to the rep" }));
  const order = ["Sun Sep 20", "first", "Yesterday", "second", "Today", "third", "fourth"].map((w) => out.indexOf(w));
  assert.deepEqual([...order].sort((x, y) => x - y), order, "oldest at the top");
  assert.ok(out.includes('role="log"'));
});

test("the composer counts characters, sends only non-blank text, and says why it is disabled", () => {
  const empty = html(createElement(Composer, { value: "", onChange: noop, onSend: noop }));
  assert.ok(empty.includes(">0 / 1,000</span>") && /maxlength="1000"/i.test(empty));
  assert.match(empty, /<button[^>]*type="submit"[^>]*disabled=""/);
  assert.ok(empty.includes("Ctrl+Enter to send") && empty.includes(">Send</button>"));
  const typed = html(createElement(Composer, { value: "Please call back today", onChange: noop, onSend: noop }));
  assert.ok(typed.includes(">22 / 1,000</span>"));
  assert.doesNotMatch(typed, /<button[^>]*type="submit"[^>]*disabled=""/);
  const long = html(createElement(Composer, { value: "x".repeat(1000), onChange: noop, onSend: noop }));
  assert.ok(long.includes(">1,000 / 1,000</span>"));
  const sending = html(createElement(Composer, { value: "", onChange: noop, onSend: noop, sending: true }));
  assert.match(sending, /<button[^>]*type="submit"[^>]*disabled=""/);
  const blank = html(createElement(Composer, { value: "   ", onChange: noop, onSend: noop, defaultBlankNote: true }));
  assert.ok(blank.includes("Write a note first.") && blank.includes('aria-invalid="true"'));
  const noRep = html(createElement(Composer, { value: "hello", onChange: noop, onSend: noop, disabledReason: "No rep to message" }));
  assert.ok(noRep.includes("No rep to message"));
  assert.match(noRep, /<button[^>]*type="submit"[^>]*disabled=""/);
  assert.equal(canSend("hi", false), true);
  assert.equal(canSend("  \n ", false), false);
  assert.equal(canSend("hi", true), false);
  assert.equal(canSend("hi", false, "No rep to message"), false);
});

test("ThreadSkeleton draws three bubble placeholders on alternate sides", () => {
  const out = html(createElement(ThreadSkeleton));
  const sides = [...out.matchAll(/si-bubble--skeleton si-bubble--(owner|rep)/g)].map((m) => m[1]);
  assert.deepEqual(sides, ["owner", "rep", "owner"]);
});

// A reviewed identity link for the fixture's assigned agent (no contract fixture carries a `GET /reps` directory).
const reps = (agentId: string, agentName: string) => repsSchema.parse({
  data: {
    items: [{ id: "link-dana", revision: 4, agent_id: agentId, agent_name: agentName, rc_account_id: "acct-1", rc_extension_id: "101", rc_extension_name: "Dana R.",
      rc_extension_number: "101", role_kind: "sales", status: "reviewed", effective_from: "2026-09-01T00:00:00.000Z", effective_to: null, nudge_channels_allowed: ["pager"],
      rc_direct_numbers: [], history: [], metrics: { status: "unknown", interactions_total: null } }],
    next_cursor: null,
    directory: { status: "ok", snapshot_id: null, taken_at: null, users: [], next_cursor: null },
  },
}).data;

test("the panel's first line, default recipient and title (fixture record, reviewed link)", () => {
  const read = detail("AC/outreach__ac-attempt-50-early.json");
  const o = read.data.outreach;
  const recipient = defaultRecipient(reps(o.assignment.agent!.id, o.assignment.agent!.name), o);
  assert.ok(recipient);
  assert.equal(recipient.name, o.assignment.agent!.name);
  assert.equal(recipient.rep_identity_link_id, "link-dana");
  const view = (r: typeof recipient | null, resolved: boolean) => html(createElement(MessageRepPanelView, {
    mode: "panel", recipient: r, resolved, picking: false, picker: null, history: null, composer: null, onSomeoneElse: noop, onClose: noop,
  }));
  const out = view(recipient, true);
  assert.ok(out.includes(`<h2 id="`) && out.includes(`>Message ${o.assignment.agent!.name}</h2>`));
  assert.ok(out.includes("Goes to the rep's RingCentral, never to the customer."));
  assert.ok(out.includes(`To ${o.assignment.agent!.name}`) && out.includes(">Send to someone else</button>"));
  assert.ok(out.includes('role="dialog"') && out.includes('aria-modal="false"') && out.includes('aria-label="Close"'));
  const none = view(null, true);
  assert.ok(none.includes(">Message rep</h2>") && none.includes("No rep to message"));
  assert.ok(view(null, false).includes("No recipient chosen"), "no `No rep to message` before the read answers");
  assert.equal(panelTitle({ name: "Marcus Bell" }), "Message Marcus Bell");
  // The promiser's identity is used when nobody is assigned (UX28).
  const promised = detail("S1/outreach__s-findings.json").data.outreach;
  const p = promised.next_action!.promised_by!;
  assert.equal(defaultRecipient(reps(p.id, p.name), promised)?.name, p.name);
  // No reviewed link for the agent: no default.
  assert.equal(defaultRecipient(reps("someone-else", "X"), o), null);
  const inline = html(createElement(MessageRepPanelView, { mode: "inline", recipient, resolved: true, picking: false, picker: null, history: null, composer: null, onSomeoneElse: noop }));
  assert.ok(!inline.includes('role="dialog"') && inline.includes('data-mode="inline"') && inline.includes("Goes to the rep's RingCentral"));
});

test("purpose: call_suggestion with an open follow-up or a suggestion, otherwise review_context", () => {
  const withNext = detail("AC/outreach__ac-attempt-50-early.json").data.outreach;
  const bare = detail("AC/outreach__ac-attempts-same-rep.json").data.outreach;
  assert.ok(withNext.next_action);
  assert.equal(nudgePurpose(withNext), "call_suggestion");
  assert.equal(bare.next_action, null);
  assert.equal(nudgePurpose(bare), "review_context");
  assert.equal(nudgePurpose({ next_action: null, suggested_next_step: {} as never }), "call_suggestion");
});

test("the send body carries the legacy dialog's field set, with team_messaging and pager fallback", () => {
  const o = detail("AC/outreach__ac-attempt-50-early.json").data.outreach;
  const recipient = defaultRecipient(reps(o.assignment.agent!.id, o.assignment.agent!.name), o)!;
  const payload = nudgeSendBody({ outreach: o, recipient, text: "  Call her back  " });
  // `_legacy/message-rep-dialog.tsx` commandBody(): nudge {rc_account_id, rc_extension_id, channel, template_key,
  // template_version, purpose, allow_pager_fallback, outreach_record_id, body, rep_identity_link_id}; payload
  // {nudge, expected_revision, expected_rep_revision}.
  assert.deepEqual(Object.keys(payload).sort(), ["expected_rep_revision", "expected_revision", "nudge"]);
  const nudge = payload.nudge as Record<string, unknown>;
  assert.deepEqual(Object.keys(nudge).sort(), ["allow_pager_fallback", "body", "channel", "outreach_record_id", "purpose", "rc_account_id", "rc_extension_id", "rep_identity_link_id", "template_key", "template_version"]);
  assert.equal(nudge.channel, "team_messaging");
  assert.equal(nudge.allow_pager_fallback, true);
  assert.equal(nudge.template_key, nudge.purpose);
  assert.equal(nudge.purpose, "call_suggestion");
  assert.equal(nudge.template_version, 1);
  assert.equal(nudge.body, "Call her back");
  assert.equal(nudge.outreach_record_id, o.id);
  assert.equal(payload.expected_revision, o.revision);
  assert.equal(payload.expected_rep_revision, 4);
});

test("refusal codes have their own words; RATE_LIMITED shows counts only when the error carries them", () => {
  assert.equal(sendErrorText("NUDGE_BODY_INVALID"), "The message can't include a full customer phone number.");
  assert.equal(sendErrorText("NUDGE_NOT_ACTIONABLE"), "This Outreach is closed, so there's no one to nudge.");
  assert.equal(sendErrorText("NUDGE_DESTINATION_EVIDENCE_INCOMPLETE"), "This rep's RingCentral identity hasn't been reviewed yet.");
  assert.equal(sendErrorText("REVISION_CONFLICT"), "The record changed while you were writing. Your text is kept; send again.");
  assert.equal(sendErrorText("RATE_LIMITED"), "Hourly message limit reached. Try again later.");
  assert.equal(sendErrorText("RATE_LIMITED", { remaining: 0, limit: 20 }), "0 of 20 messages left this hour. Try again later.");
  assert.equal(sendErrorText("SOMETHING_NEW"), "Couldn't send: SOMETHING_NEW");
  assert.equal(sendErrorText("RATE_LIMITED_FALLBACK"), "Hourly message limit reached. Try again later.", "a copy key name is still words, never blank");
});

test("history: stored nudges and local attempts become bubbles; a local Sending… isn't doubled by the optimistic item", () => {
  const local: LocalMessage[] = [
    { key: "k1", text: "optimistic", body: {}, state: "sending", code: null, reason: null, at: AS_OF },
    { key: "k2", text: "kept text", body: {}, state: "failed", code: "RATE_LIMITED", reason: "Hourly message limit reached. Try again later.", at: AS_OF },
    { key: "k3", text: "lost response", body: {}, state: "unknown", code: "UPSTREAM", reason: null, at: AS_OF },
  ];
  const pending: NudgeRecord = { ...CHAT_NUDGES[0]!, id: "pending:k1", body_as_sent: "optimistic" };
  const items = historyItems([...CHAT_NUDGES, pending], local, { onRetryLocal: noop, onCheckLocal: noop, onResend: noop, onCheckStored: noop });
  assert.equal(items.filter((i) => i.body === "optimistic").length, 1);
  const out = html(createElement(MessageHistoryView, { items, asOf: AS_OF, hasOlder: true, onLoadOlder: noop }));
  assert.ok(out.includes("kept text") && out.includes("Failed · Hourly message limit reached. Try again later."));
  assert.ok(out.includes("lost response") && out.includes(">Check status</button>"));
  assert.ok(out.includes("Failed · The message can't include a full customer phone number."), "a stored failed nudge words its error_code");
  assert.ok(out.includes("Sent by extension message instead") && out.includes("Sending…"));
  assert.ok(out.includes(">Load older messages</button>"));
  assert.ok(html(createElement(MessageHistoryView, { items: [], asOf: AS_OF })).includes("No messages sent to the rep yet."));
});

test("the recipient picker lists the directory, marks users without a reviewed Agent, and filters", () => {
  const rows = pickerRows(CHAT_REPS);
  assert.deepEqual(rows.map((r) => [r.name, r.reviewed]), [["Dana Reyes", true], ["Marcus Bell", true], ["Front desk", false], ["Extension 155", false]]);
  assert.equal(rows[0]!.recipient?.rep_identity_link_id, "1");
  assert.equal(rows[2]!.recipient?.rep_identity_link_id, null);
  assert.deepEqual(filterRows(rows, "marc").map((r) => r.name), ["Marcus Bell"]);
  assert.deepEqual(filterRows(rows, "ext. 140").map((r) => r.name), ["Front desk"]);
});

test("the gallery Chat kit section shows every state and a 390 px frame", () => {
  const out = html(createElement(ChatSection));
  for (const anchor of ["bubbles", "thread", "composer", "picker", "panel", "pill", "phone"]) assert.ok(out.includes(`data-chat="${anchor}"`), anchor);
  for (const words of ["Sending…", "Sent 5:30 PM ET", "Sent by extension message instead", "Failed · ", ">Retry</button>", "Unknown delivery", ">Check status</button>",
    "Today", "Yesterday", "Sun Sep 20", ">New</span>", "Write a note first.", "No rep to message", "No reviewed Agent match", "Search the RingCentral directory",
    "Updated list available", "Goes to the rep's RingCentral, never to the customer.", "No one in the directory matches."]) {
    assert.ok(out.includes(words), words);
  }
  assert.ok(out.includes('data-frame="390"'));
});

test("the composer never calls the preview route and nothing imports _legacy", () => {
  const roots = ["components/sales-intelligence/chat", "components/sales-intelligence/composer", "components/sales-intelligence/data/live"];
  for (const root of roots) {
    for (const file of fs.readdirSync(path.join(process.cwd(), root))) {
      // Code only: the doc comments may name the routes they avoid.
      const src = fs.readFileSync(path.join(process.cwd(), root, file), "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
      assert.ok(!/previewNudge|nudges\/preview/.test(src), `${root}/${file} must not preview`);
      assert.ok(!/_legacy/.test(src), `${root}/${file} imports _legacy`);
      assert.ok(!/Date\.now\(\)|new Date\(\)/.test(src), `${root}/${file} reads the browser clock`);
    }
  }
});
