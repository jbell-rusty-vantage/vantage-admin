import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conversationsSchema, transcriptSchema, type ConversationsPage, type TranscriptPage } from "../../lib/api/salesIntelligence";
import {
  ConversationCardView, Conversations, ConversationsSkeleton, OtherCalls, durationText, recordingText, repText,
} from "../../components/sales-intelligence/outreach/analysis/conversations";
import {
  TranscriptSkeleton, TranscriptView, clearTranscriptTarget, missingRangeText, offsetText, scrollToSegments, segmentAnchor,
} from "../../components/sales-intelligence/outreach/analysis/transcript";
import { AudioPlayer, audioStateForStatus } from "../../components/sales-intelligence/outreach/analysis/audio-player";
import { conversationMediaSrc } from "../../components/sales-intelligence/data/use-conversations";
import { copy } from "../../components/sales-intelligence/sales-intelligence-copy";
import { formatExactFull } from "../../components/sales-intelligence/lib/time";

// UI1-CONV: Conversations, transcript and the player rendered from the S4 / S6 contract fixtures (final spec §11.7,
// UI-1 §5.2, UI1-A25 target, UI1-A29 render side). No DOM (ADMIN-REBUILD trap 7).

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
const raw = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const conversations = (rel: string): ConversationsPage => conversationsSchema.parse(raw(rel));
const transcript = (rel: string): TranscriptPage => transcriptSchema.parse(raw(rel));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
const c = copy.ui1.analysis.conversations;

function render(page: ConversationsPage, props: Partial<Parameters<typeof Conversations>[0]> = {}) {
  return renderToStaticMarkup(createElement(Conversations, { items: page.data.items, otherCalls: page.data.other_calls, asOf: page.as_of, hasMore: !!page.data.next_cursor, ...props }));
}
function card(html: string, id: string): string {
  const at = html.indexOf(`data-conversation="${id}"`);
  assert.ok(at >= 0, `card ${id}`);
  return html.slice(at, html.indexOf("</article>", at));
}

const S4_FINDINGS = conversations("S4/number-conversations__s-findings.json");

test("one card per conversation, newest first, with the header line, recording line and server summary labels", () => {
  const html = render(S4_FINDINGS);
  let last = -1;
  for (const item of S4_FINDINGS.data.items) {
    const at = html.indexOf(`data-conversation="${item.conversation_id}"`);
    assert.ok(at > last, "server order kept");
    last = at;
    const t = text(card(html, item.conversation_id));
    const head = [item.direction_label, item.started_at_label, durationText(item.duration_seconds), repText(item.rep), item.contact_type_label].join(" · ");
    assert.ok(t.includes(head), `${head} in ${t}`);
    assert.ok(card(html, item.conversation_id).includes(`title="${formatExactFull(item.started_at)}"`), "exact time on title");
    assert.ok(t.includes(recordingText(item)));
    for (const section of item.summary_sections) {
      if (section.text) assert.ok(t.includes(`${section.label} ${section.text}`), section.key);
      else assert.ok(!card(html, item.conversation_id).includes(`<dt>${section.label}</dt>`), `null ${section.key} omitted`);
    }
    assert.ok(t.includes("Transcript"));
  }
  assert.ok(text(html).includes("Recording: available") && text(html).includes("Recording: not recorded"));
  assert.equal(durationText(38), "38s");
  assert.equal(durationText(610), "10m 10s");
  assert.equal(durationText(null), null);
});

test("the player: the Owner media route as src, only for retained media; retention and error sentences (A29 render side)", () => {
  const html = render(S4_FINDINGS);
  const withMedia = S4_FINDINGS.data.items.filter((i) => i.media_available);
  assert.equal((html.match(/<audio /g) ?? []).length, withMedia.length);
  const src = `/api/proxy/api/v1/admin/sales-intelligence/conversations/${withMedia[0]!.conversation_id}/media?scope=production`;
  assert.equal(conversationMediaSrc(withMedia[0]!.conversation_id), src);
  assert.ok(card(html, withMedia[0]!.conversation_id).includes(`src="${src}"`));
  const purged = conversations("S4/number-conversations__s-audio-purged.json");
  const p = render(purged);
  const removed = purged.data.items.find((i) => i.recording_state === "audio_removed")!;
  assert.ok(text(card(p, removed.conversation_id)).includes("Recording: audio removed under retention; transcript kept"));
  assert.ok(!card(p, removed.conversation_id).includes("<audio"));
  // Media route statuses captured in S4: 404 purged, 500 with no blob store.
  assert.equal(raw("S4/conversation-media-purged__s-audio-purged.json").status, 404);
  assert.equal(audioStateForStatus(raw("S4/conversation-media-purged__s-audio-purged.json").status), "removed");
  assert.equal(audioStateForStatus(raw("S4/conversation-media-retained__s-audio-purged.json").status), "failed");
  const gone = text(renderToStaticMarkup(createElement(AudioPlayer, { conversationId: "c1", label: "x", initialState: "removed" })));
  assert.equal(gone.trim(), "Audio removed under retention; the transcript is kept.");
  const failed = renderToStaticMarkup(createElement(AudioPlayer, { conversationId: "c1", label: "x", initialState: "failed" }));
  assert.equal(text(failed).trim(), "Couldn't load the audio. The transcript is still available.");
  assert.ok(failed.includes('role="alert"'));
});

test("Other calls ({n}): compact rows with the result; rep status words when no reviewed name", () => {
  const t = text(render(S4_FINDINGS));
  assert.ok(t.includes(`Other calls (${S4_FINDINGS.data.other_calls.length})`));
  for (const call of S4_FINDINGS.data.other_calls) assert.ok(t.includes(`${call.started_at_label}`) && t.includes(call.result!));
  const sixty = conversations("S4/number-conversations__s-calls-60.json");
  const html = renderToStaticMarkup(createElement(OtherCalls, { calls: sixty.data.other_calls }));
  assert.ok(text(html).includes(c.rep.proposed) && text(html).includes(c.rep.unknown));
  assert.ok(render(sixty).includes(c.loadMore), "next_cursor → Load more");
});

test("in-progress and provisional calls: `In progress` with no result or duration; `Details may still change`", () => {
  const live = conversations("S6/number-conversations__t3-live-call.json");
  const html = renderToStaticMarkup(createElement(OtherCalls, { calls: live.data.other_calls }));
  const inProgress = live.data.other_calls.find((o) => o.in_progress)!;
  const at = html.indexOf(`data-interaction="${inProgress.interaction_id}"`);
  const row = html.slice(at, html.indexOf("</li>", at));
  assert.ok(text(row).includes("In progress"));
  assert.ok(row.includes("si-chip--live"));
  assert.ok(!text(row).includes(c.resultUnknown));
  assert.ok(!/\d+s\b|\d+m\b/.test(text(row).replace(inProgress.started_at_label, "")), "no duration");
  const settled = conversations("S6/number-conversations__t3-capture-states.json");
  assert.ok(!text(renderToStaticMarkup(createElement(OtherCalls, { calls: settled.data.other_calls }))).includes(c.provisional), "settled → no note");
  // No fixture carries `provisional` on a card: a synthetic one from the S6 card.
  const base = conversations("S6/number-conversations__s-findings.json").data.items[1]!;
  const provisional = renderToStaticMarkup(createElement(ConversationCardView, { card: { ...base, call_log_state: "provisional" } }));
  assert.ok(text(provisional).includes("Details may still change"));
  const running = renderToStaticMarkup(createElement(ConversationCardView, { card: { ...base, in_progress: true, duration_seconds: null } }));
  assert.ok(text(running).includes("In progress"));
  assert.ok(!text(running).includes(durationText(base.duration_seconds)!));
});

test("legacy summary source prints its note; no conversations prints the empty line", () => {
  const legacy = conversations("S4/number-conversations__s-legacy.json");
  assert.ok(text(render(legacy)).includes(c.legacySummary));
  assert.ok(text(render({ ...legacy, data: { ...legacy.data, items: [], other_calls: [] } })).includes(c.none));
});

test("transcript: speaker turns with sid anchors, offsets, missing-range markers and Load more", () => {
  const partial = transcript("S4/conversation-transcript__s-findings-c1-offset-2.json");
  const d = partial.data;
  const html = renderToStaticMarkup(createElement(TranscriptView, { conversationId: d.conversation_id, segments: d.segments, available: d.available, missingRanges: d.completeness.missing_ranges, hasMore: d.next_offset != null }));
  const t = text(html);
  assert.ok(t.includes("2 earlier segments are not shown."));
  assert.ok(t.includes("Segments after 5 are not loaded yet."));
  assert.ok(t.includes("Load more"));
  for (const s of d.segments) {
    assert.ok(html.includes(`id="${segmentAnchor(d.conversation_id, s.sid)}"`));
    assert.ok(t.includes(`${s.speaker_label} ${offsetText(s.start_ms!)} ${s.text}`));
    assert.ok(html.includes(`title="${formatExactFull(s.at!)}"`));
  }
  assert.equal(offsetText(16385), "0:16");
  assert.equal(missingRangeText("retention_pending"), copy.ui1.analysis.transcript.missing.retention_pending);
  const full = transcript("S4/conversation-transcript__s-findings-c2.json").data;
  const fullHtml = renderToStaticMarkup(createElement(TranscriptView, { conversationId: full.conversation_id, segments: full.segments, available: true, missingRanges: [], hasMore: false }));
  assert.ok(!text(fullHtml).includes("Load more") && !text(fullHtml).includes("not shown"));
  const off = renderToStaticMarkup(createElement(TranscriptView, { conversationId: "c", segments: [], available: false, missingRanges: ["retention_pending"], hasMore: false }));
  assert.ok(text(off).includes(copy.ui1.analysis.transcript.missing.retention_pending));
});

test("Open in transcript target: scrollToSegments sets the target; the transcript highlights every cited sid (A25)", () => {
  const full = transcript("S4/conversation-transcript__s-findings-c2.json").data;
  const target = scrollToSegments(full.conversation_id, [3, 6]);
  assert.deepEqual(target.sids, ["3", "6"]);
  assert.equal(target.conversationId, full.conversation_id);
  clearTranscriptTarget(target.seq - 1);
  const next = scrollToSegments(full.conversation_id, [1]);
  assert.ok(next.seq > target.seq);
  clearTranscriptTarget(next.seq);
  // Clearing ends the highlight only; a newer target is never cleared by an older sequence number.
  const after = scrollToSegments(full.conversation_id, [2]);
  clearTranscriptTarget(next.seq);
  assert.equal(after.highlight, true);
  const html = renderToStaticMarkup(createElement(TranscriptView, { conversationId: full.conversation_id, segments: full.segments, available: true, missingRanges: [], hasMore: false, highlight: target.sids }));
  assert.equal((html.match(/is-highlighted/g) ?? []).length, 2);
  assert.ok(/data-sid="3"[^>]*|is-highlighted[^>]*data-sid="3"/.test(html));
  // The card's transcript is lazy: it renders only when open (or targeted).
  const cardItem = S4_FINDINGS.data.items.find((i) => i.conversation_id === full.conversation_id)!;
  const closed = renderToStaticMarkup(createElement(ConversationCardView, { card: cardItem, renderTranscript: () => "TRANSCRIPT-BODY" }));
  assert.ok(!closed.includes("TRANSCRIPT-BODY") && closed.includes('aria-expanded="false"'));
  const open = renderToStaticMarkup(createElement(ConversationCardView, { card: cardItem, transcriptOpen: true, renderTranscript: () => "TRANSCRIPT-BODY" }));
  assert.ok(open.includes("TRANSCRIPT-BODY") && open.includes('aria-expanded="true"'));
  assert.ok(open.includes(`id="si-conversation-${cardItem.conversation_id}"`));
});

test("skeletons render shaped placeholders", () => {
  assert.ok(renderToStaticMarkup(createElement(ConversationsSkeleton)).includes("si-skeleton"));
  assert.ok(renderToStaticMarkup(createElement(TranscriptSkeleton)).includes("si-skeleton"));
});
