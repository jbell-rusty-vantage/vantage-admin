"use client";
/**
 * UI1-CONV: Conversations (final spec §11.7, UI-1 §5.2). One card per call with a conversation, newest first (server
 * order): the header line, `Recording: …`, the player, the six per-call summary sections in the server's labels, and a
 * `Transcript` disclosure. Calls without a conversation sit in `Other calls ({n})`. `In progress` and
 * `Details may still change` come from the server's `in_progress` and `call_log_state`; nothing here is derived.
 */
import { ChevronRight } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { ConversationCard, OtherCall } from "@/lib/api/salesIntelligence";
import { Button } from "../../atoms/button";
import { useConversations } from "../../data/use-conversations";
import { Chip, Disclosure, Region, SkeletonBlock, SkeletonLines } from "../../primitives";
import { copy } from "../../sales-intelligence-copy";
import { cx } from "../../lib/format";
import { formatDuration, formatExactFull } from "../../lib/time";
import { AudioPlayer, type AudioState } from "./audio-player";
import { Transcript, TranscriptSkeleton, currentTargetSeq, scrollToSegments, useTranscriptTarget } from "./transcript";

export { scrollToSegments };

const c = copy.ui1.analysis.conversations;

/** `38s`, `10m 10s`, `1h 5m`. Null → null (omitted). */
export function durationText(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return c.seconds(s);
  if (s < 3600) return c.minutes(Math.floor(s / 60), s % 60);
  return formatDuration(s * 1000);
}

/** The rep's reviewed name, else the identity status word (SERVER-STATE `rep.name` null path). */
export const repText = (rep: { name: string | null; status: string }) => rep.name?.trim() || c.rep[rep.status] || c.rep.unknown;

/** `Recording: available` / `not recorded` / `audio removed under retention; transcript kept`. */
export const recordingText = (card: Pick<ConversationCard, "recording_state" | "recording_label">) =>
  c.recording[card.recording_state] ?? c.recordingOther(card.recording_label ?? card.recording_state);

function StartedAt({ t, label }: { t: string; label: string }) {
  const exact = formatExactFull(t);
  return (
    <time dateTime={t} title={exact} aria-label={exact} className="si-time">
      {label}
    </time>
  );
}

/** `{Inbound|Outbound} · {exact time} · {duration} · {rep} · {contact type}`; duration omitted while in progress or null. */
function HeaderLine({ call, withContact = true }: { call: ConversationCard | OtherCall; withContact?: boolean }) {
  const duration = call.in_progress ? null : durationText(call.duration_seconds === 0 ? null : call.duration_seconds);
  const parts: ReactNode[] = [call.direction_label, <StartedAt key="t" t={call.started_at} label={call.started_at_label} />];
  if (duration) parts.push(duration);
  parts.push(repText(call.rep));
  if (withContact) parts.push(call.contact_type_label);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </>
  );
}

const headerLabel = (call: ConversationCard) =>
  [call.direction_label, call.started_at_label, call.in_progress ? null : durationText(call.duration_seconds), repText(call.rep), call.contact_type_label].filter(Boolean).join(" · ");

function StateChips({ call }: { call: ConversationCard | OtherCall }) {
  if (!call.in_progress && call.call_log_state !== "provisional") return null;
  return (
    <span className="si-conv__chips">
      {call.in_progress && (
        <Chip tone="live" icon={null}>
          {c.inProgress}
        </Chip>
      )}
      {call.call_log_state === "provisional" && <Chip>{c.provisional}</Chip>}
    </span>
  );
}

/** Default transcript body: its own region (suspense + error boundary), so a failed transcript leaves the card working. */
const defaultTranscript = (conversationId: string) => (
  <Region name={`transcript:${conversationId}`} skeleton={<TranscriptSkeleton />}>
    <Transcript conversationId={conversationId} />
  </Region>
);

export type ConversationCardProps = {
  card: ConversationCard;
  /** Opens the transcript on first render (gallery, tests). The `Open in transcript` target opens it too. */
  transcriptOpen?: boolean;
  renderTranscript?: (conversationId: string) => ReactNode;
  /** Gallery / tests only: the player's starting state. */
  audioState?: AudioState;
};

export function ConversationCardView({ card, transcriptOpen = false, renderTranscript = defaultTranscript, audioState }: ConversationCardProps) {
  const panelId = useId();
  const target = useTranscriptTarget();
  const targeted = target && target.conversationId === card.conversation_id ? target : null;
  // A manual toggle wins until a newer `Open in transcript` target for this card arrives.
  const [manual, setManual] = useState<{ open: boolean; seq: number } | null>(null);
  const open = targeted && (!manual || targeted.seq > manual.seq) ? true : manual ? manual.open : transcriptOpen;
  const cardId = `si-conversation-${card.conversation_id}`;

  useEffect(() => {
    if (!targeted?.highlight) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(cardId)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [targeted, cardId]);

  const sections = card.summary_sections.filter((section) => section.text);
  const showPlayer = card.media_available && card.recording_state === "available";
  const hasTranscript = card.transcript_available !== false;
  return (
    <article id={cardId} className={cx("si-conv", card.in_progress && "is-live")} data-conversation={card.conversation_id} data-recording={card.recording_state}>
      <header className="si-conv__header">
        <p className="si-conv__head">
          <HeaderLine call={card} />
        </p>
        <StateChips call={card} />
      </header>
      <p className="si-conv__recording">{recordingText(card)}</p>
      {showPlayer && <AudioPlayer conversationId={card.conversation_id} label={headerLabel(card)} initialState={audioState} />}
      {sections.length > 0 && (
        <dl className="si-conv__summary" data-summary-source={card.summary_source ?? "none"}>
          {sections.map((section) => (
            <div key={section.key} className="si-conv__section">
              <dt>{section.label}</dt>
              <dd>{section.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {sections.length > 0 && card.summary_source === "legacy" && <p className="si-conv__note">{c.legacySummary}</p>}
      {hasTranscript && (
        <div className={cx("si-disclosure si-conv__transcript", open && "is-open")}>
          <button type="button" className="si-disclosure__summary" aria-expanded={open} aria-controls={panelId} onClick={() => setManual({ open: !open, seq: currentTargetSeq() })}>
            <ChevronRight size={16} aria-hidden className="si-disclosure__chevron" />
            <span className="si-disclosure__title">{c.transcript}</span>
          </button>
          <div id={panelId} className="si-disclosure__panel" hidden={!open}>
            {open ? renderTranscript(card.conversation_id) : null}
          </div>
        </div>
      )}
    </article>
  );
}

export function OtherCalls({ calls }: { calls: readonly OtherCall[] }) {
  if (calls.length === 0) return null;
  return (
    <Disclosure id="si-conv-other" title={c.other(calls.length)} className="si-conv__other">
      <ul className="si-conv__otherlist">
        {calls.map((call) => (
          <li key={call.interaction_id} className="si-conv__otherrow" data-interaction={call.interaction_id}>
            <span className="si-conv__otherline">
              <HeaderLine call={call} withContact={false} />
              {!call.in_progress && <span>{` · ${call.result ?? c.resultUnknown}`}</span>}
            </span>
            <StateChips call={call} />
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export type ConversationsProps = {
  items: readonly ConversationCard[];
  otherCalls: readonly OtherCall[];
  asOf: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  moreFailed?: boolean;
  onLoadMore?: () => void;
  renderTranscript?: (conversationId: string) => ReactNode;
  /** Gallery / tests: conversation ids whose transcript starts open. */
  openTranscripts?: readonly string[];
  /** Gallery / tests: a player state per conversation id. */
  audioStates?: Record<string, AudioState>;
};

/** Presentational Conversations (UX15: props in, no role read). */
export function Conversations({ items, otherCalls, hasMore = false, loadingMore = false, moreFailed = false, onLoadMore, renderTranscript, openTranscripts = [], audioStates = {} }: ConversationsProps) {
  return (
    <div className="si-convs">
      {items.length === 0 ? (
        <p className="si-conv__empty">{c.none}</p>
      ) : (
        items.map((card) => (
          <ConversationCardView key={card.conversation_id} card={card} transcriptOpen={openTranscripts.includes(card.conversation_id)} renderTranscript={renderTranscript} audioState={audioStates[card.conversation_id]} />
        ))
      )}
      {hasMore && (
        <div className="si-convs__more">
          <Button variant="secondary" size="sm" className="si-hit" disabled={loadingMore} onClick={onLoadMore}>{c.loadMore}</Button>
          {moreFailed && <p className="si-conv__note" role="alert">{c.loadMoreFailed}</p>}
        </div>
      )}
      <OtherCalls calls={otherCalls} />
    </div>
  );
}

function ConversationsLoaded({ numberId }: { numberId: string }) {
  const query = useConversations(numberId);
  const { items, otherCalls, asOf, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  const target = useTranscriptTarget();
  const missing = !!target?.highlight && !items.some((card) => card.conversation_id === target.conversationId);
  // `Open in transcript` for a call on a later page: page in cards until it is loaded.
  useEffect(() => {
    if (missing && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [missing, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  return (
    <Conversations
      items={items}
      otherCalls={otherCalls}
      asOf={asOf}
      hasMore={!!hasNextPage}
      loadingMore={isFetchingNextPage}
      moreFailed={isFetchNextPageError}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

/** The section wrapper the analysis frame mounts: its own region; `numberId` is `outreach.primary_number.id`. */
export function ConversationsSection({ numberId, onRetry }: { numberId: string | null; onRetry?: () => void }) {
  if (!numberId) return <p className="si-conv__empty">{c.noNumber}</p>;
  return (
    <Region name="conversations" skeleton={<ConversationsSkeleton />} onRetry={onRetry}>
      <ConversationsLoaded numberId={numberId} />
    </Region>
  );
}

export function ConversationCardSkeleton() {
  return (
    <div className="si-conv is-skeleton" aria-hidden>
      <SkeletonLines lines={2} widths={["72%", "34%"]} />
      <SkeletonBlock height={40} width="100%" />
      <SkeletonLines lines={4} widths={["90%", "80%", "65%", "40%"]} />
    </div>
  );
}

export function ConversationsSkeleton() {
  return (
    <div className="si-convs is-skeleton">
      <ConversationCardSkeleton />
      <ConversationCardSkeleton />
    </div>
  );
}
