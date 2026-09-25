"use client";
/**
 * UI1-CARD: the card's actions (final spec §5.2, §5.7). `Open analysis` → the Outreach route; `Message rep` opens
 * the composer (UI1-CHAT) and is disabled with `No rep to message` when the record has no linked rep. A closed
 * record keeps only `Open`. A Number-review row's `Open` links out to the legacy Numbers view (UI-1 §1.3).
 */
import { FileSearch, Send } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { Button } from "../atoms/button";
import { legacyNumberHref } from "../lib/legacy-links";
import { copy } from "../sales-intelligence-copy";
import type { CardOutreach } from "./card-lines";

const c = copy.ui1.card;

export const outreachHref = (id: string) => `/sales-intelligence/outreach/${encodeURIComponent(id)}`;

/** The default `Message rep` rule: a rep is linked when the record has an assigned agent or a promiser. */
export function defaultMessageRepDisabledReason(o: CardOutreach): string | null {
  return o.assignment.agent || o.next_action?.promised_by ? null : c.noRep;
}

const linkClass = "si-btn si-btn--secondary si-btn--md si-hit si-card__action";

export function CardActions({
  o,
  closed,
  onMessageRep,
  messageRepDisabledReason,
}: {
  o: CardOutreach;
  closed: boolean;
  onMessageRep?: () => void;
  messageRepDisabledReason?: string | null;
}) {
  const noteId = useId();
  if (closed) {
    return (
      <Link className={linkClass} href={outreachHref(o.id)} data-action="open">
        {c.open}
      </Link>
    );
  }
  const disabledReason = messageRepDisabledReason === undefined ? defaultMessageRepDisabledReason(o) : messageRepDisabledReason;
  return (
    <>
      <Link className={linkClass} href={outreachHref(o.id)} data-action="open-analysis">
        <FileSearch size={16} aria-hidden />
        {c.openAnalysis}
      </Link>
      <span className="si-card__msg">
        <Button
          variant="secondary"
          className="si-hit si-card__action"
          data-action="message-rep"
          disabled={!!disabledReason || !onMessageRep}
          aria-describedby={disabledReason ? noteId : undefined}
          onClick={onMessageRep}
        >
          <Send size={16} aria-hidden />
          {c.messageRep}
        </Button>
        {disabledReason && (
          <span id={noteId} className="si-card__msgnote si-text--sm si-text--subtle">
            {disabledReason}
          </span>
        )}
      </span>
    </>
  );
}

export function NumberReviewActions({ contactNumberId }: { contactNumberId: string }) {
  return (
    <span className="si-card__linkout">
      <Link className={linkClass} href={legacyNumberHref(contactNumberId)} data-action="open-legacy">
        {c.open}
      </Link>
      <span className="si-card__prev si-text--sm si-text--subtle">{c.previousVersion}</span>
    </span>
  );
}
