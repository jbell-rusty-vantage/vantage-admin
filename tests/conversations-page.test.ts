import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationPanel, ConversationPanelView } from "../components/conversations/conversation-panel";
import {
  conversationStatusLabel,
  formatConversationDuration,
  formatConversationMatchLine,
  formatFloridaDate,
} from "../components/conversations/conversation-presentation";
import { ConversationsPageView } from "../components/conversations/conversations-page";
import { visibleDashboardNav } from "../components/layout/dashboard-nav";
import type { ConversationDetail, ConversationListItem } from "../lib/api/conversations";

const listItem: ConversationListItem = {
  id: "6a905b5cf7dda52cfacb721e",
  state: "complete",
  direction: "Inbound",
  started_at: "2026-08-07T16:00:00.000Z",
  duration_seconds: 482,
  match_method: "call_lead_telephony_session",
  match_confidence: "high",
  normalized_job_no: "P5562014",
  receiver_agent_name_snapshot: "Patrick",
  lead_ref: { model: "CallLead", id: "6a761d3d7ceae445794c57bd" },
  booking_ref: "6a7d4e3529d500054c6b5be5",
  has_transcript: true,
  has_summary: true,
  has_mismatch: false,
  cost_cents: { stt: 3, summary: 0 },
};

const fixture: ConversationDetail = {
  ...listItem,
  rc_result: "Accepted",
  telephony_session_id: "s-session",
  call_log_id: "AL0AaWD26IINT41A",
  from_phone_masked: "•••1212",
  to_phone_masked: "•••1000",
  match_evidence: { chosen_reason: "owner_seeded" },
  media: {
    blob_pathname: "conversations/3750152612023.mp3",
    bytes: 1665549,
    content_type: "audio/mpeg",
    stored_at: "2026-08-27T00:00:00.000Z",
    purged_at: null,
  },
  transcript: {
    text: "Please send the quote to [REDACTED:EMAIL] after the call.",
    model: "gpt-4o-mini-transcribe",
    chars: 56,
    redactions: 1,
    created_at: "2026-08-19T00:00:00.000Z",
  },
  summary: {
    text: "Patrick took an inbound inquiry.",
    model: "gpt-4.1-nano",
    prompt_version: "owner-demo-v1",
    created_at: "2026-08-19T00:00:00.000Z",
    sections: {
      overview: "Patrick took an inbound out-of-state inquiry.",
      customer_wanted: "A small furniture move to a third-floor apartment.",
      money_dates: "Quote $2,114. Due now $814.",
      outcome: "Quote and pay link sent. Job booked later.",
      promised: "Patrick texted so the customer has a direct number.",
      mismatch: null,
    },
  },
};

test("duration and match line use the seeded inbound facts", () => {
  assert.equal(formatConversationDuration(482), "8:02");
  assert.equal(
    formatConversationMatchLine("call_lead_telephony_session", "high"),
    "Matched by telephony session · HIGH confidence",
  );
  assert.equal(formatFloridaDate("2026-08-07T16:00:00.000Z"), "Aug 7, 2026");
  assert.equal(conversationStatusLabel(fixture), "BOOKED");
});

test("Owner nav shows Lead Conversations with New, above Form Leads; Admin does not", () => {
  const owner = visibleDashboardNav("owner");
  const admin = visibleDashboardNav("admin");
  const ownerIndex = owner.findIndex((item) => item.href === "/conversations");
  const formIndex = owner.findIndex((item) => item.href === "/form-leads");
  assert.equal(owner[ownerIndex]?.label, "Lead Conversations");
  assert.equal(owner[ownerIndex]?.ownerOnly, true);
  assert.equal(owner[ownerIndex]?.isNew, true);
  assert.ok(ownerIndex >= 0 && ownerIndex < formIndex);
  assert.equal(admin.some((item) => item.href === "/conversations"), false);
});

test("page banner names the seeded example and the Vercel AI Gateway path", () => {
  const markup = renderToStaticMarkup(
    createElement(ConversationsPageView, { items: [listItem], selectedId: listItem.id }),
  );
  assert.match(markup, /Lead Conversations/);
  assert.match(markup, />New</);
  assert.match(markup, /Example/);
  assert.match(markup, /seeded from a known booked inbound Call Lead/);
  assert.match(markup, /Vercel AI Gateway/);
  assert.match(markup, /attached to the Lead/);
  assert.match(markup, /every Agent/);
  assert.match(markup, /Attach →/);
  assert.match(markup, /Retry/);
  assert.match(markup, /Requires the conversation pipeline/);
  assert.match(markup, /disabled/);
  assert.doesNotMatch(markup, /Please send the quote/);
});

test("empty list is honest, not an error or a fake card", () => {
  const markup = renderToStaticMarkup(createElement(ConversationsPageView, { items: [] }));
  assert.match(markup, /No conversation on file/);
  assert.doesNotMatch(markup, /P5562014/);
  assert.doesNotMatch(markup, /Play recording/);
});

test("list rows on the page never render transcript or summary text", () => {
  const extra: ConversationListItem = {
    ...listItem,
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    normalized_job_no: "P0000000",
    receiver_agent_name_snapshot: "Alex",
  };
  const markup = renderToStaticMarkup(
    createElement(ConversationsPageView, {
      items: [listItem, extra],
      selectedId: listItem.id,
    }),
  );
  assert.match(markup, /P5562014/);
  assert.match(markup, /P0000000/);
  assert.doesNotMatch(markup, /Please send the quote/);
  assert.doesNotMatch(markup, /Patrick took an inbound out-of-state inquiry/);
  assert.equal("transcript" in listItem, false);
  assert.equal("summary" in listItem, false);
});

test("panel shows inbound facts, five body sections, and omits mismatch on this fixture", () => {
  const markup = renderToStaticMarkup(createElement(ConversationPanelView, { conversation: fixture }));
  assert.match(markup, /P5562014/);
  assert.match(markup, /Patrick/);
  assert.match(markup, /BOOKED/);
  assert.match(markup, /Inbound/);
  assert.match(markup, /8:02/);
  assert.match(markup, /Matched by telephony session · HIGH confidence/);
  const overview = markup.indexOf("Overview");
  const wanted = markup.indexOf("What they wanted");
  const money = markup.indexOf("Money / dates");
  const outcome = markup.indexOf("Outcome");
  const promised = markup.indexOf("Promised");
  assert.ok(overview >= 0 && overview < wanted && wanted < money && money < outcome && outcome < promised);
  assert.match(markup, /Patrick took an inbound out-of-state inquiry/);
  assert.doesNotMatch(markup, /Mismatch vs CRM/);
  assert.match(markup, /Show transcript/);
  assert.doesNotMatch(markup, /Please send the quote/);
  assert.doesNotMatch(markup, /\[REDACTED:EMAIL\]/);
  assert.doesNotMatch(markup, /src="/);
  assert.match(markup, /gpt-4o-mini-transcribe/);
  assert.match(markup, /gpt-4.1-nano/);
  assert.match(markup, /owner-demo-v1/);
  assert.match(markup, /replay of already-paid artifacts/);
});

test("mismatch is first and visually distinct only when the section is present", () => {
  const withMismatch: ConversationDetail = {
    ...fixture,
    summary: {
      ...fixture.summary!,
      sections: {
        ...fixture.summary!.sections,
        mismatch: "The quoted deposit does not match the Booking.",
      },
    },
  };
  const markup = renderToStaticMarkup(
    createElement(ConversationPanelView, { conversation: withMismatch }),
  );
  const mismatchAt = markup.indexOf("Mismatch vs CRM");
  const overviewAt = markup.indexOf("Overview");
  assert.ok(mismatchAt >= 0 && mismatchAt < overviewAt);
  assert.match(markup, /quoted deposit does not match/);
});

test("expanded transcript keeps redaction tokens visible", () => {
  const markup = renderToStaticMarkup(
    createElement(ConversationPanelView, { conversation: fixture, transcriptOpen: true }),
  );
  assert.match(markup, /Hide transcript/);
  assert.match(markup, /\[REDACTED:EMAIL\]/);
});

test("ConversationPanel does not request an audio URL on mount", () => {
  let audioCalls = 0;
  const markup = renderToStaticMarkup(
    createElement(ConversationPanel, {
      conversation: fixture,
      requestAudioUrl: async () => {
        audioCalls += 1;
        return { url: "https://signed.example/audio", expires_at: "2026-08-27T16:05:00.000Z", ttl_ms: 300000 };
      },
    }),
  );
  assert.equal(audioCalls, 0);
  assert.doesNotMatch(markup, /src="/);
  assert.doesNotMatch(markup, /audio-url/);
  assert.match(markup, /Play recording/);
});
