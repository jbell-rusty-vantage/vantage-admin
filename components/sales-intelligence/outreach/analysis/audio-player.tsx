"use client";
/**
 * UI1-CONV: the call recording player (final spec §11.7 as amended by UI-1 §5.2). The `<audio>` element's `src` is the
 * Owner media route through the admin proxy; the route streams the recording in 206 chunks of at most 2 MiB and the
 * browser pages them itself. There is no signed redirect. A media element error carries no HTTP status, so on error
 * the player asks the route once for one byte: a 404 means the audio was removed under retention; anything else is
 * the generic failure. The transcript stays available either way.
 */
import { useState } from "react";
import { conversationMediaSrc } from "../../data/use-conversations";
import { SkeletonBlock } from "../../primitives";
import { copy } from "../../sales-intelligence-copy";

const c = copy.ui1.analysis.conversations;

export type AudioState = "ready" | "removed" | "failed";

/** The media route's status for one byte (`Range: bytes=0-0`). Network failure → 0. */
export async function probeMediaStatus(src: string): Promise<number> {
  try {
    const response = await fetch(src, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
    void response.body?.cancel();
    return response.status;
  } catch {
    return 0;
  }
}

/** 404 → removed under retention; any other error status → failed (UI-1 §5.2). */
export const audioStateForStatus = (status: number): AudioState => (status === 404 ? "removed" : "failed");

export function AudioPlayer({
  conversationId,
  label,
  initialState = "ready",
  probe = probeMediaStatus,
}: {
  conversationId: string;
  /** Accessible name: the card's header line. */
  label: string;
  initialState?: AudioState;
  probe?: (src: string) => Promise<number>;
}) {
  const src = conversationMediaSrc(conversationId);
  const [state, setState] = useState<AudioState>(initialState);
  const onError = () => {
    void probe(src).then((status) => setState(status >= 200 && status < 300 ? "failed" : audioStateForStatus(status)));
  };
  if (state === "removed") return <p className="si-audio__note" data-audio="removed">{c.audioRemoved}</p>;
  if (state === "failed") return <p className="si-audio__note" role="alert" data-audio="failed">{c.audioFailed}</p>;
  return (
    <audio className="si-audio" controls preload="metadata" src={src} aria-label={c.audioLabel(label)} onError={onError} data-audio="ready" />
  );
}

export function AudioPlayerSkeleton() {
  return <SkeletonBlock height={40} width="100%" className="si-audio" />;
}
