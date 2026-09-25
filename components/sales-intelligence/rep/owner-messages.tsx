"use client";
/**
 * UI2-NUDGES (UI-2 §5, UX11; A10): the rep's Work tab block `Messages from the Owner`, read-only.
 *
 * - Source: the detail read's `nudges.items[]` (`useOutreach`, the same query as the rest of the tab: no extra request).
 *   On a rep's read the server keeps only the nudges addressed to that rep (S12-REPNUDGE), so nothing is filtered here.
 * - UI-1's chat kit, read-only: from the rep's point of view the Owner is the other party, so each message is a
 *   left-side bubble (`side="rep"` in the kit's terms) whose screen-reader author is `Owner`; day dividers; the exact
 *   time on each bubble (title + aria-label through `TimeText`, against the response `as_of`). The header line reads
 *   `Also sent to your RingCentral`.
 * - No composer, no delivery indicator, no Retry / Check status: the rep sees the message, not its plumbing.
 * - The block is omitted entirely when there are no items. No card chip.
 */
import { useId } from "react";
import type { NudgeRecord } from "@/lib/api/salesIntelligence";
import { Thread, ThreadSkeleton, type ThreadItem } from "../chat";
import { useOutreach } from "../data/use-outreach";
import { RegionProgress } from "../primitives";
import { copy } from "../sales-intelligence-copy";

const n = copy.ui2.nudges;

/** Pure: the Owner's nudges as left-side bubbles, timed by when they were sent (else created). */
export function ownerMessageItems(nudges: readonly Pick<NudgeRecord, "id" | "body_as_sent" | "sent_at" | "created_at">[]): ThreadItem[] {
  return nudges.map((nudge) => ({ id: nudge.id, side: "rep", body: nudge.body_as_sent, at: nudge.sent_at ?? nudge.created_at, author: n.from }));
}

/** The pure block (tests and the gallery). Renders nothing without messages. */
/**
 * Coordinator decision (UI-2 §5): the rep sees only messages that reached its RingCentral (`sent`, or `fallback_sent` by
 * pager), so `Also sent to your RingCentral` is always true; pending, failed or unknown deliveries are the Owner's plumbing.
 */
export const DELIVERED_TO_REP: ReadonlySet<string> = new Set(["sent", "fallback_sent"]);

export function OwnerMessagesView({ nudges: all, asOf, refreshing = false }: { nudges: readonly NudgeRecord[]; asOf: string; refreshing?: boolean }) {
  const headingId = useId();
  const nudges = all.filter((nudge) => DELIVERED_TO_REP.has(nudge.status));
  if (!nudges.length) return null;
  return (
    <section className="si-work__messages si-ownermsgs" aria-labelledby={headingId} data-owner-messages={nudges.length}>
      <RegionProgress active={refreshing} />
      <h3 id={headingId} className="si-heading si-heading--3">{n.title}</h3>
      <p className="si-ownermsgs__also si-text--sm si-text--subtle">{n.alsoSent}</p>
      <Thread items={ownerMessageItems(nudges)} asOf={asOf} label={n.title} className="si-ownermsgs__thread" />
    </section>
  );
}

/** Reads the detail (shared query key) and renders the block. Mount inside a Region. */
export function OwnerMessages({ id }: { id: string }) {
  const { nudges, asOf, isRefetching } = useOutreach(id);
  return <OwnerMessagesView nudges={nudges} asOf={asOf} refreshing={isRefetching} />;
}

/** The block's shape while the detail read is pending (the Region shows it after 150 ms). */
export function OwnerMessagesSkeleton() {
  return (
    <div className="si-ownermsgs is-skeleton" aria-label={n.skeletonLabel}>
      <ThreadSkeleton />
    </div>
  );
}
OwnerMessages.Skeleton = OwnerMessagesSkeleton;
