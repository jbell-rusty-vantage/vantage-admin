"use client";
/**
 * UI1-CHAT (UI-0 §2.7): one message. Owner on the right on `--si-bubble-owner`, rep on the left on `--si-bubble-rep`;
 * max width 72% of the thread column (88% at 390 px). The body keeps its line breaks and shows links as plain text
 * (never auto-linked). The footer has the exact time and, on an Owner bubble, the delivery indicator.
 */
import type { ReactNode } from "react";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { TimeText } from "../primitives";

export type BubbleSide = "owner" | "rep";

export function MessageBubble({
  side,
  body,
  at,
  asOf,
  author,
  delivery,
  className,
}: {
  side: BubbleSide;
  body: string;
  /** `null` until the server has stored the message (no time on a `Sending…` bubble, FIX-UI1 m9). */
  at: string | null;
  asOf: string | null;
  /** Screen-reader author; the Owner's defaults to `You`. */
  author?: string;
  delivery?: ReactNode;
  className?: string;
}) {
  const who = author ?? (side === "owner" ? copy.ui1.chat.you : "");
  return (
    <div className={cx("si-bubble", `si-bubble--${side}`, className)} data-side={side}>
      {who && <span className="si-sr">{who}: </span>}
      <p className="si-bubble__body">{body}</p>
      <div className="si-bubble__foot">
        {at !== null && <TimeText t={at} asOf={asOf} mode="exact" className="si-bubble__time" />}
        {delivery}
      </div>
    </div>
  );
}

function BubbleSkeleton({ side, lines = 2 }: { side: BubbleSide; lines?: number }) {
  return (
    <div className={cx("si-bubble si-bubble--skeleton", `si-bubble--${side}`)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="si-skeleton si-skeleton--line" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

MessageBubble.Skeleton = BubbleSkeleton;
