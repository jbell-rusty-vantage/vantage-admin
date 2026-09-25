"use client";
/**
 * UI1-CHAT (UI-0 §2.7): bubbles grouped under day dividers, oldest at the top. When a message is added the
 * thread scrolls to the newest. Day grouping is by ET calendar day (lib/time), measured against `asOf`.
 */
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { etDateKey } from "../lib/time";
import { cx } from "../lib/format";
import { DayDivider } from "./day-divider";
import { MessageBubble, type BubbleSide } from "./message-bubble";
import { UnreadDivider } from "./unread-divider";

export type ThreadItem = {
  id: string;
  side: BubbleSide;
  body: string;
  /** `null`: not stored yet (a `Sending…` or refused attempt): no time, kept after the stored messages (FIX-UI1 m9). */
  at: string | null;
  author?: string;
  delivery?: ReactNode;
  /** UI-4: draws `New` above this message. */
  unreadFrom?: boolean;
};

/**
 * Pure: oldest first (stable for equal times), grouped by ET day. Unparseable times sort last, in input order.
 * An item with no time (`at: null`, not stored yet) goes last and joins the newest day (no divider of its own).
 */
export function groupByDay(items: readonly ThreadItem[]): { day: string; at: string | null; items: ThreadItem[] }[] {
  const ordered = items
    .map((item, index) => ({ item, index, ms: item.at === null ? NaN : Date.parse(item.at) }))
    .sort((a, b) => {
      const am = Number.isNaN(a.ms) ? Infinity : a.ms;
      const bm = Number.isNaN(b.ms) ? Infinity : b.ms;
      return am === bm ? a.index - b.index : am - bm;
    })
    .map(({ item }) => item);
  const groups: { day: string; at: string | null; items: ThreadItem[] }[] = [];
  for (const item of ordered) {
    const last = groups[groups.length - 1];
    if (item.at === null) {
      if (last) last.items.push(item);
      else groups.push({ day: "unsent", at: null, items: [item] });
      continue;
    }
    const day = Number.isNaN(Date.parse(item.at)) ? "unknown" : etDateKey(item.at);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, at: item.at, items: [item] });
  }
  return groups;
}

export function Thread({ items, asOf, label, empty, className }: { items: readonly ThreadItem[]; asOf: string; label: string; empty?: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = items.length;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  const groups = groupByDay(items);
  return (
    <div ref={ref} className={cx("si-thread", className)} role="log" aria-label={label}>
      {!count && empty}
      {groups.map((group) => (
        <Fragment key={group.day}>
          {group.at !== null && <DayDivider t={group.at} asOf={asOf} />}
          {group.items.map((item) => (
            <Fragment key={item.id}>
              {item.unreadFrom && <UnreadDivider />}
              <MessageBubble side={item.side} body={item.body} at={item.at} asOf={asOf} author={item.author} delivery={item.delivery} />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
