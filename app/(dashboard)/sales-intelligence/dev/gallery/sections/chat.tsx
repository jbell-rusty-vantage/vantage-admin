"use client";
/**
 * UI1-CHAT gallery section (UI-0 §2.7, §7.4): every bubble and delivery state, the day and unread dividers, the
 * composer (empty, typed, sending, failed with Retry, blank attempt, no rep), the recipient picker, the inline
 * Message rep panel, the `Updated list available · Show` pill, the ThreadSkeleton, and a 390 px frame.
 * No contract fixture carries a sent nudge (every `nudges.items` is empty), so the records here are synthetic,
 * in the `nudgeSchema` shape, timed against the gallery's S1 `as_of`.
 */
import { useState, type ReactNode } from "react";
import type { NudgeRecord, repsSchema } from "@/lib/api/salesIntelligence";
import { Composer, DeliveryIndicator, MessageBubble, Thread, ThreadSkeleton, UnreadDivider, type ThreadItem } from "@/components/sales-intelligence/chat";
import { MessageHistoryView, MessageRepPanelView, RecipientPickerView, historyItems, pickerRows, type LocalMessage } from "@/components/sales-intelligence/composer";
import { UpdatedListPill } from "@/components/sales-intelligence/data/live";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GALLERY_AS_OF } from "../fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const noop = () => {};
const s = copy.ui1.chat.gallery;

function nudge(id: string, status: NudgeRecord["status"], created: string, body: string, extra: Partial<NudgeRecord> = {}): NudgeRecord {
  return {
    id, revision: 1, outreach_record_id: "gallery-outreach", rc_account_id: "acct-1", rc_extension_id: "101", rep_identity_link_id: "link-1",
    agent_id: "agent-1", actor_id: "owner-1", channel: status === "fallback_sent" ? "pager" : "team_messaging", purpose: "call_suggestion",
    template_key: "call_suggestion", template_version: 1, body_as_sent: body, status, fallback_channel: status === "fallback_sent" ? "pager" : null,
    error_code: null, created_at: created, sent_at: status === "sent" || status === "fallback_sent" ? created : null, delivery_note: "", automatic_resend: false, ...extra,
  };
}

/** Synthetic history: Sun Sep 20, Yesterday (Sep 22) and Today (Sep 23) against GALLERY_AS_OF. */
export const CHAT_NUDGES: NudgeRecord[] = [
  nudge("n-today-pending", "pending", "2026-09-23T21:40:00.000Z", s.sampleBody),
  nudge("n-today-unknown", "unknown_delivery", "2026-09-23T19:05:00.000Z", "Did the Lopez estimate go out?"),
  nudge("n-yesterday-fallback", "fallback_sent", "2026-09-22T15:12:00.000Z", "Customer asked for a callback after 3."),
  nudge("n-yesterday-failed", "failed", "2026-09-22T14:02:00.000Z", "Please call 555-0100 back.", { error_code: "NUDGE_BODY_INVALID" }),
  nudge("n-older-sent", "sent", "2026-09-20T13:30:00.000Z", s.sampleLong),
];

export const CHAT_LOCAL: LocalMessage[] = [
  { key: "k-failed", text: "Call her before 5 today.", body: {}, state: "failed", code: "RATE_LIMITED", reason: copy.ui1.chat.errors.RATE_LIMITED_FALLBACK, at: GALLERY_AS_OF },
];

type RepsData = ReturnType<typeof repsSchema.parse>["data"];
const link = (id: string, agent: string, name: string, ext: string): RepsData["items"][number] => ({
  id, revision: 2, agent_id: `agent-${id}`, agent_name: name, rc_account_id: "acct-1", rc_extension_id: ext, rc_extension_name: agent, rc_extension_number: ext,
  role_kind: "sales", status: "reviewed", effective_from: "2026-09-01T00:00:00.000Z", effective_to: null, nudge_channels_allowed: ["pager"],
  rc_direct_numbers: [], rc_team_messaging_person_id: null, history: [], metrics: { status: "unknown", interactions_total: null },
});
const user = (ext: string, name: string | null, status = "matched"): RepsData["directory"]["users"][number] => ({
  extension_id: ext, extension_name: name, status, candidates: [], extension_number: ext, rc_account_id: "acct-1",
});
/** Synthetic directory: two reviewed Agents, one unmatched extension, one with no name. */
export const CHAT_REPS: RepsData = {
  items: [link("1", "Dana R.", "Dana Reyes", "101"), link("2", "Marcus B.", "Marcus Bell", "102")],
  next_cursor: null,
  directory: {
    status: "ok", snapshot_id: "dir-1", taken_at: GALLERY_AS_OF, accounts: [{ rc_account_id: "acct-1", snapshot_id: "dir-1", taken_at: GALLERY_AS_OF, status: "ok" }],
    users: [user("101", "Dana R."), user("102", "Marcus B."), user("140", "Front desk", "unmatched"), user("155", null, "not_proposed")],
    next_cursor: null,
  },
};

const ROWS = pickerRows(CHAT_REPS);
const DANA = ROWS[0]!.recipient!;
const bubbleItems = (): ThreadItem[] => historyItems(CHAT_NUDGES, CHAT_LOCAL, { onResend: noop, onRetryLocal: noop, onCheckLocal: noop, onCheckStored: noop });

function TypedComposer({ initial, sending = false, disabledReason = null, blank = false }: { initial: string; sending?: boolean; disabledReason?: string | null; blank?: boolean }) {
  const [value, setValue] = useState(initial);
  return <Composer value={value} onChange={setValue} onSend={() => setValue("")} sending={sending} disabledReason={disabledReason} defaultBlankNote={blank} />;
}

function Frame390({ children }: { children: ReactNode }) {
  return <div className="si-gallery__frame" data-frame="390">{children}</div>;
}

export function ChatSection() {
  const c = copy.ui1.chat;
  const [picked, setPicked] = useState(DANA);
  return (
    <GallerySection id="chat" title={copy.ui1.gallery.sections.chat}>
      <p className="si-gallery__note">{s.note}</p>

      <Subhead>{s.bubbles}</Subhead>
      <div className="si-gallery__body" data-chat="bubbles">
        <Sample label={s.owner} copyKey="copy.ui1.chat.sending" wide>
          <MessageBubble side="owner" body={s.sampleBody} at={null} asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="sending" />} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.sent(t)" wide>
          <MessageBubble side="owner" body={s.sampleBody} at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="sent" at="2026-09-23T21:30:04.000Z" />} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.fallback" wide>
          <MessageBubble side="owner" body={s.sampleBody} at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="fallback" />} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.failed(reason) · retry · errors.NUDGE_BODY_INVALID" wide>
          <MessageBubble side="owner" body="Please call 555-0100 back." at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF}
            delivery={<DeliveryIndicator state="failed" reason={c.errors.NUDGE_BODY_INVALID} onRetry={noop} />} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.unknown · checkStatus" wide>
          <MessageBubble side="owner" body={s.sampleBody} at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="unknown" onCheckStatus={noop} />} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.checking" wide>
          <MessageBubble side="owner" body={s.sampleBody} at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="unknown" onCheckStatus={noop} checking />} />
        </Sample>
        <Sample label={s.rep} wide>
          <MessageBubble side="rep" author="Dana Reyes" body={s.sampleRep} at="2026-09-23T21:35:00.000Z" asOf={GALLERY_AS_OF} />
        </Sample>
        <Sample label={s.longText} wide>
          <MessageBubble side="owner" body={s.sampleLong} at="2026-09-23T21:30:00.000Z" asOf={GALLERY_AS_OF} delivery={<DeliveryIndicator state="sent" at="2026-09-23T21:30:04.000Z" />} />
        </Sample>
      </div>

      <Subhead>{s.dividers}</Subhead>
      <div className="si-gallery__body" data-chat="thread">
        <Sample copyKey="copy.ui1.chat.day.today · day.yesterday · lib/time formatDayHeader" wide>
          <MessageHistoryView items={bubbleItems()} asOf={GALLERY_AS_OF} hasOlder onLoadOlder={noop} />
        </Sample>
        <Sample label={s.unread} copyKey="copy.ui1.chat.unread" wide>
          <UnreadDivider />
        </Sample>
        <Sample copyKey="copy.ui1.chat.noMessages" wide>
          <MessageHistoryView items={[]} asOf={GALLERY_AS_OF} />
        </Sample>
        <Sample label={s.skeleton} wide>
          <ThreadSkeleton />
        </Sample>
      </div>

      <Subhead>{s.composer}</Subhead>
      <div className="si-gallery__body" data-chat="composer">
        <Sample label={s.composerEmpty} copyKey="copy.ui1.chat.counter(n) · send · shortcut" wide>
          <TypedComposer initial="" />
        </Sample>
        <Sample label={s.composerTyped} wide>
          <TypedComposer initial={s.sampleTyped} />
        </Sample>
        <Sample label={s.composerSending} copyKey="copy.ui1.chat.sending" wide>
          <Thread items={[{ id: "sending", side: "owner", body: s.sampleBody, at: GALLERY_AS_OF, delivery: <DeliveryIndicator state="sending" /> }]} asOf={GALLERY_AS_OF} label={c.history} />
          <TypedComposer initial="" sending />
        </Sample>
        <Sample label={s.composerFailed} copyKey="copy.ui1.chat.errors.RATE_LIMITED_FALLBACK · retry" wide>
          <MessageHistoryView items={historyItems([], CHAT_LOCAL, { onRetryLocal: noop })} asOf={GALLERY_AS_OF} />
          <TypedComposer initial="" />
        </Sample>
        <Sample label={s.composerBlank} copyKey="copy.ui1.chat.blankNote" wide>
          <TypedComposer initial="   " blank />
        </Sample>
        <Sample label={s.composerNoRep} copyKey="copy.ui1.chat.noRep" wide>
          <TypedComposer initial="" disabledReason={c.noRep} />
        </Sample>
      </div>

      <Subhead>{s.picker}</Subhead>
      <div className="si-gallery__body" data-chat="picker">
        <Sample copyKey="copy.ui1.chat.pickerPlaceholder · noReviewedMatch · pickerClose" wide>
          <RecipientPickerView rows={ROWS} current={picked} onPick={setPicked} onClose={noop} autoFocus={false} />
        </Sample>
        <Sample copyKey="copy.ui1.chat.pickerEmpty" wide>
          <RecipientPickerView rows={ROWS} current={picked} onPick={setPicked} onClose={noop} autoFocus={false} defaultQuery="zzz" />
        </Sample>
      </div>

      <Subhead>{s.panel}</Subhead>
      <div className="si-gallery__body" data-chat="panel">
        <Sample copyKey="copy.ui1.chat.title(rep) · firstLine · recipient(rep) · sendToSomeoneElse" wide>
          <GalleryPanel />
        </Sample>
      </div>

      <Subhead>{s.pill}</Subhead>
      <div className="si-gallery__body" data-chat="pill">
        <Sample copyKey="copy.ui1.live.updatedList · live.show" wide>
          <UpdatedListPill onShow={noop} />
        </Sample>
      </div>

      <Subhead>{s.phone}</Subhead>
      <Frame390>
        <div data-chat="phone">
          <GalleryPanel />
        </div>
      </Frame390>
    </GallerySection>
  );
}

function GalleryPanel() {
  const [picking, setPicking] = useState(false);
  const [recipient, setRecipient] = useState(DANA);
  const [value, setValue] = useState("");
  return (
    <MessageRepPanelView
      mode="inline"
      recipient={recipient}
      resolved
      picking={picking}
      onSomeoneElse={() => setPicking(true)}
      picker={<RecipientPickerView rows={ROWS} current={recipient} onPick={(r) => { setRecipient(r); setPicking(false); }} onClose={() => setPicking(false)} />}
      history={<MessageHistoryView items={bubbleItems()} asOf={GALLERY_AS_OF} />}
      composer={<Composer value={value} onChange={setValue} onSend={() => setValue("")} />}
    />
  );
}
