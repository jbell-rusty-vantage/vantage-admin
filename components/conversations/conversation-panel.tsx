"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { Pause, Play } from "lucide-react";
import { formatConversationCost, formatConversationDuration, formatConversationMatchLine, formatFloridaDate, conversationStatusLabel, CONVERSATION_BODY_SECTIONS } from "./conversation-presentation";
import { StatusBadge } from "@/components/data-table/status-badge";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { fetchConversationAudioUrl, type ConversationDetail } from "@/lib/api/conversations";

export function ConversationPanelView({
  conversation,
  transcriptOpen = false,
  onToggleTranscript,
  audioSrc,
  playing = false,
  audioError,
  onPlay,
  audioRef,
  onAudioError,
  onAudioEnded,
}: {
  conversation: ConversationDetail;
  transcriptOpen?: boolean;
  onToggleTranscript?: () => void;
  audioSrc?: string | null;
  playing?: boolean;
  audioError?: string | null;
  onPlay?: () => void;
  audioRef?: Ref<HTMLAudioElement>;
  onAudioError?: () => void;
  onAudioEnded?: () => void;
}) {
  const status = conversationStatusLabel(conversation);
  const mismatch = conversation.summary?.sections.mismatch ?? null;
  const transcript = conversation.transcript?.text ?? "";

  return (
    <article className="overflow-hidden rounded-md border border-steel-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/40 bg-pale-gold/40 px-5 py-4">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-steel">Job</p>
          <h2 className="font-heading text-2xl font-extrabold text-navy">
            {conversation.normalized_job_no ?? "Lead Conversation"}
          </h2>
          {conversation.receiver_agent_name_snapshot ? (
            <p className="text-sm text-navy/80">{conversation.receiver_agent_name_snapshot}</p>
          ) : null}
        </div>
        {status ? <StatusBadge tone="success">{status}</StatusBadge> : null}
      </header>

      <div className="flex flex-wrap items-center gap-4 border-b border-steel-200 px-5 py-4">
        <Button
          type="button"
          variant="gold"
          onClick={onPlay}
          className="h-12 w-12 shrink-0 rounded-full px-0"
          aria-label={playing ? "Pause recording" : "Play recording"}
        >
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </Button>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-navy">
            {conversation.direction}
            {" · "}
            {formatFloridaDate(conversation.started_at)}
            {" · "}
            {formatConversationDuration(conversation.duration_seconds)}
          </p>
          <p className="text-sm text-steel">
            {formatConversationMatchLine(conversation.match_method, conversation.match_confidence)}
          </p>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        preload="none"
        className="hidden"
        controlsList="nodownload"
        onError={onAudioError}
        onEnded={onAudioEnded}
      />

      {audioError ? (
        <div className="px-5 pt-4">
          <FeedbackMessage tone="warning">{audioError}</FeedbackMessage>
        </div>
      ) : null}

      <div className="space-y-5 px-5 py-5">
        {mismatch ? (
          <FeedbackMessage tone="warning" className="space-y-1">
            <p className="font-heading text-sm font-bold uppercase tracking-wide">Mismatch vs CRM</p>
            <p className="text-sm leading-relaxed">{mismatch}</p>
          </FeedbackMessage>
        ) : null}

        {CONVERSATION_BODY_SECTIONS.map((section) => {
          const body = conversation.summary?.sections[section.key];
          if (!body) return null;
          return (
            <section key={section.key} className="space-y-1.5">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-navy">
                {section.label}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy/90">{body}</p>
            </section>
          );
        })}

        {transcript ? (
          <div className="border-t border-steel-200 pt-4">
            <Button type="button" variant="outline" onClick={onToggleTranscript}>
              {transcriptOpen ? "Hide transcript" : "Show transcript"}
            </Button>
            {transcriptOpen ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-md border border-steel-200 bg-cool-white p-4 font-body text-sm leading-relaxed text-navy">
                {transcript}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="space-y-1 border-t border-steel-200 bg-steel-100/70 px-5 py-3 text-xs text-steel">
        <p>
          {conversation.transcript?.model ?? "STT not recorded"}
          {" · "}
          {conversation.summary?.model ?? "Summary not recorded"}
          {" · "}
          {conversation.summary?.prompt_version ?? "no prompt version"}
          {" · "}
          {formatConversationCost(conversation.cost_cents)}
        </p>
        <p>This run was a replay of already-paid artifacts, not a live AI Gateway call.</p>
      </footer>
    </article>
  );
}

export function ConversationPanel({
  conversation,
  requestAudioUrl = fetchConversationAudioUrl,
}: {
  conversation: ConversationDetail;
  requestAudioUrl?: typeof fetchConversationAudioUrl;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playAfterSrcRef = useRef(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [expiredOnce, setExpiredOnce] = useState(false);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !audioSrc || !playAfterSrcRef.current) {
      return;
    }
    playAfterSrcRef.current = false;
    void node.play().then(() => setPlaying(true)).catch(() => {
      setAudioError("Unable to play this recording.");
      setPlaying(false);
    });
  }, [audioSrc]);

  async function handlePlay() {
    const node = audioRef.current;
    if (playing && node) {
      node.pause();
      setPlaying(false);
      return;
    }

    if (audioSrc && node && !expiredOnce) {
      try {
        await node.play();
        setPlaying(true);
        setAudioError(null);
      } catch {
        setAudioError("Unable to play this recording.");
      }
      return;
    }

    // Fetch the signed URL only from this play handler — never from a component
    // body, useEffect on mount, prefetch, or hover. Opening the tab is not listening.
    try {
      playAfterSrcRef.current = true;
      const data = await requestAudioUrl(conversation.id);
      setExpiredOnce(false);
      setAudioError(null);
      setAudioSrc(data.url);
    } catch {
      playAfterSrcRef.current = false;
      setAudioError("Unable to get a playable recording URL.");
    }
  }

  function handleAudioError() {
    setPlaying(false);
    setAudioSrc(null);
    setExpiredOnce(true);
    setAudioError("That play link expired. Press play to request a new one.");
  }

  return (
    <ConversationPanelView
      conversation={conversation}
      transcriptOpen={transcriptOpen}
      onToggleTranscript={() => setTranscriptOpen((open) => !open)}
      audioSrc={audioSrc}
      playing={playing}
      audioError={audioError}
      onPlay={() => {
        void handlePlay();
      }}
      audioRef={audioRef}
      onAudioError={handleAudioError}
      onAudioEnded={() => setPlaying(false)}
    />
  );
}
