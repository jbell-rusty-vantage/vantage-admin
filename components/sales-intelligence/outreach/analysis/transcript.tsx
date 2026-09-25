"use client";
/**
 * UI1-CONV: one conversation's transcript (final spec §11.7 `Transcript` disclosure; S4 transcript read) and the
 * `Open in transcript` target (§11.6). Speaker turns carry `sid` anchors; `Load more` pages by `next_offset`;
 * `completeness.missing_ranges` prints its markers. `scrollToSegments(conversationId, sids)` opens that card's
 * transcript, loads pages until the first sid is there, scrolls to it and highlights every cited sid for a moment.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { TranscriptPage } from "@/lib/api/salesIntelligence";
import { Button } from "../../atoms/button";
import { useTranscript } from "../../data/use-conversations";
import { SkeletonLines } from "../../primitives";
import { copy } from "../../sales-intelligence-copy";
import { cx } from "../../lib/format";
import { formatExactFull } from "../../lib/time";

const tr = copy.ui1.analysis.transcript;

export type TranscriptSegment = TranscriptPage["data"]["segments"][number];

/* ── The `Open in transcript` target: a tiny external store so any card (mounted now or later) can pick it up. ── */

/** `highlight` is true until the highlight has run; the card stays open afterwards (the target is kept, unhighlighted). */
export type TranscriptTarget = { conversationId: string; sids: string[]; seq: number; highlight: boolean };

/** How long the highlight stays once the segment is on screen (ms). */
export const HIGHLIGHT_MS = 4000;
/** Fallback: a target nobody could show (a conversation not on this Number) stops paging after this long (ms). */
export const TARGET_GIVE_UP_MS = 10_000;

let current: TranscriptTarget | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const snapshot = () => current;
const serverSnapshot = () => null;

/**
 * Final spec §11.6 `Open in transcript`: opens the card of `conversationId`, scrolls to the first `sid` and highlights
 * all of them. The Conversations section pages in more cards when the conversation isn't loaded yet.
 */
export function scrollToSegments(conversationId: string, sids: readonly (number | string)[]): TranscriptTarget {
  seq += 1;
  const target = { conversationId, sids: sids.map(String), seq, highlight: true };
  current = target;
  emit();
  if (typeof window !== "undefined") window.setTimeout(() => clearTranscriptTarget(target.seq), TARGET_GIVE_UP_MS);
  return target;
}

/** Ends the target's highlight (only if no newer target replaced it). The card it opened stays open. */
export function clearTranscriptTarget(targetSeq: number) {
  if (current && current.seq === targetSeq && current.highlight) {
    current = { ...current, highlight: false };
    emit();
  }
}

/** The live target (any conversation). */
export function useTranscriptTarget(): TranscriptTarget | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** The newest target sequence number, so a manual toggle can tell an older target from a newer one. */
export const currentTargetSeq = () => current?.seq ?? seq;

/** DOM id of a segment anchor. */
export const segmentAnchor = (conversationId: string, sid: number | string) => `si-seg-${conversationId}-${sid}`;

/* ── Presentational transcript ── */

/** `m:ss` into the call from `start_ms`. */
export function offsetText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** `segments_before:2` → `2 earlier segments are not shown.`; `transcript_unavailable` / `retention_pending` → their sentence. */
export function missingRangeText(range: string): string | null {
  const [kind, value] = range.split(":");
  const n = Number(value);
  if (kind === "segments_before" && Number.isFinite(n)) return tr.missing.before(n);
  if (kind === "segments_after" && Number.isFinite(n)) return tr.missing.after(n);
  if (kind === "transcript_unavailable") return tr.missing.transcript_unavailable;
  if (kind === "retention_pending") return tr.missing.retention_pending;
  return null;
}

export type TranscriptViewProps = {
  conversationId: string;
  segments: readonly TranscriptSegment[];
  available: boolean;
  missingRanges: readonly string[];
  hasMore: boolean;
  loadingMore?: boolean;
  moreFailed?: boolean;
  onLoadMore?: () => void;
  /** Segment ids to highlight (the `Open in transcript` target). */
  highlight?: readonly string[];
};

export function TranscriptView({ conversationId, segments, available, missingRanges, hasMore, loadingMore = false, moreFailed = false, onLoadMore, highlight = [] }: TranscriptViewProps) {
  const marked = new Set(highlight);
  const before = missingRanges.filter((r) => r.startsWith("segments_before"));
  const after = missingRanges.filter((r) => !r.startsWith("segments_before"));
  if (!available) {
    const reason = missingRanges.map(missingRangeText).find(Boolean);
    return <p className="si-transcript__note" data-transcript="unavailable">{reason ?? tr.unavailable}</p>;
  }
  return (
    <div className="si-transcript" data-conversation={conversationId}>
      {before.map((range) => (
        <p key={range} className="si-transcript__note" data-missing={range}>{missingRangeText(range)}</p>
      ))}
      {segments.length === 0 ? (
        <p className="si-transcript__note">{tr.empty}</p>
      ) : (
        <ol className="si-transcript__turns">
          {segments.map((segment) => {
            const sid = String(segment.sid);
            const exact = segment.at ? formatExactFull(segment.at) : null;
            return (
              <li key={sid} id={segmentAnchor(conversationId, sid)} className={cx("si-transcript__turn", marked.has(sid) && "is-highlighted")} data-sid={sid} data-speaker={segment.speaker}>
                <span className="si-transcript__who">
                  <span className="si-transcript__speaker">{segment.speaker_label}</span>
                  {segment.start_ms != null && (
                    segment.at && exact ? (
                      <time dateTime={segment.at} title={exact} aria-label={tr.offsetLabel(offsetText(segment.start_ms), exact)} className="si-time si-transcript__offset">
                        {offsetText(segment.start_ms)}
                      </time>
                    ) : (
                      <span className="si-transcript__offset">{offsetText(segment.start_ms)}</span>
                    )
                  )}
                </span>
                <p className="si-transcript__text">{segment.text}</p>
              </li>
            );
          })}
        </ol>
      )}
      {after.map((range) => {
        const text = missingRangeText(range);
        return text ? <p key={range} className="si-transcript__note" data-missing={range}>{text}</p> : null;
      })}
      {hasMore && (
        <div className="si-transcript__more">
          <Button variant="secondary" size="sm" className="si-hit" disabled={loadingMore} onClick={onLoadMore}>{tr.loadMore}</Button>
          {moreFailed && <p className="si-transcript__note" role="alert">{tr.loadMoreFailed}</p>}
        </div>
      )}
    </div>
  );
}

/** Reads the transcript (suspense) and follows the `Open in transcript` target for this conversation. */
export function Transcript({ conversationId }: { conversationId: string }) {
  const query = useTranscript(conversationId);
  const target = useTranscriptTarget();
  const mine = target && target.highlight && target.conversationId === conversationId ? target : null;
  const { segments, hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError } = query;
  const loaded = mine ? mine.sids.some((sid) => segments.some((s) => String(s.sid) === sid)) : false;

  // Page forward until the first cited segment is loaded (a transcript over 100 segments).
  useEffect(() => {
    if (mine && !loaded && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [mine, loaded, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  // Scroll to the first cited segment, then let the highlight fade.
  useEffect(() => {
    if (!mine || !loaded) return;
    const first = mine.sids.map((sid) => document.getElementById(segmentAnchor(conversationId, sid))).find(Boolean);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    first?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const timer = window.setTimeout(() => clearTranscriptTarget(mine.seq), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [mine, loaded, conversationId]);

  return (
    <TranscriptView
      conversationId={conversationId}
      segments={segments}
      available={query.available}
      missingRanges={query.completeness.missing_ranges}
      hasMore={!!hasNextPage}
      loadingMore={isFetchingNextPage}
      moreFailed={isFetchNextPageError}
      onLoadMore={() => void fetchNextPage()}
      highlight={mine?.sids ?? []}
    />
  );
}

export function TranscriptSkeleton() {
  return (
    <div className="si-transcript is-skeleton" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="si-transcript__turn">
          <SkeletonLines lines={2} widths={["18%", i === 1 ? "60%" : "85%"]} />
        </div>
      ))}
    </div>
  );
}
