"use client";
/**
 * UI1-CARD: the Outreach card (UI-1 §2, final spec §5). One component for every list; seven lines in a fixed order
 * through `CardShell`. Line 2 is left empty (and hidden) only for a Number-only subject. A Number-review row
 * (`outreach: null`) renders its identity, what counts it has, `Needs review` and `Open` (legacy link-out).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CardShell } from "../primitives";
import { legacyNumberHref } from "../lib/legacy-links";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { useIsRep } from "../rep/viewer";
import { CardActions, NumberReviewActions } from "./card-actions";
import {
  ChipView,
  LineFive,
  LineOne,
  LineSeven,
  LineSix,
  LineThree,
  SortLine,
  countsText,
  identityText,
  isNumberOnly,
  lineOneChips,
  routeText,
  type CardRow,
} from "./card-lines";

const c = copy.ui1.card;

export type OutreachCardProps = {
  row: CardRow;
  asOf: string;
  layout: "grouped" | "flat";
  view: "attention" | "all_outreach" | "closed";
  sortLine?: { label: string; value: string | null; nullLabel: string } | null;
  onOpen?: (row: CardRow) => void;
  onMessageRep?: (row: CardRow) => void;
  onApplySuggestion?: (row: CardRow) => void;
  /** UI1-CHAT passes the nudge-destination rule's reason; `null` forces enabled; omitted uses the card's default rule. */
  messageRepDisabledReason?: string | null;
  /** UI1-CLOSED's `Closed · {outcome}` line replaces line 6 on a closed record. */
  line6Override?: ReactNode;
};

/**
 * Number-only identity links to the legacy Number (UI-1 §1.3), with the `Previous version` note. UI2-SCOPE: not for a
 * rep (the Numbers view is Owner-only), whose identity is plain text.
 */
function Identity({ row }: { row: CardRow }) {
  const o = row.outreach!;
  const text = identityText(o);
  const rep = useIsRep();
  if (isNumberOnly(o) && o.primary_number && !rep) {
    return (
      <>
        <Link className="si-card__idlink" href={legacyNumberHref(o.primary_number.id)}>
          {text}
        </Link>
        <span className="si-card__prev si-text--sm si-text--subtle">{c.previousVersion}</span>
      </>
    );
  }
  return <>{text}</>;
}

export function OutreachCard({
  row,
  asOf,
  layout,
  view,
  sortLine,
  onOpen,
  onMessageRep,
  onApplySuggestion,
  messageRepDisabledReason,
  line6Override,
}: OutreachCardProps) {
  const o = row.outreach;
  const rep = useIsRep();
  if (!o) return <NumberReviewCard row={row} asOf={asOf} />;
  // UI2-SCOPE (UI-2 §3): a rep has no `Apply` (not in the E9 allowlist) and no `Message rep`.
  const onApply = rep ? undefined : onApplySuggestion;
  const onMessage = rep ? undefined : onMessageRep;
  const closed = view === "closed" || o.state === "closed";
  const live = !!o.live_call || o.call_progress?.state === "in_progress";
  const lines: ReactNode[] = [
    <LineOne key={1} row={row} asOf={asOf} layout={layout} identity={<Identity row={row} />} />,
    routeText(o, asOf),
    <LineThree key={3} o={o} asOf={asOf} />,
    countsText(o),
    <LineFive key={5} o={o} />,
    line6Override ?? <LineSix key={6} o={o} asOf={asOf} onApply={onApply ? () => onApply(row) : undefined} />,
    <LineSeven key={7} row={row} o={o} asOf={asOf} sortLine={sortLine ? <SortLine sortLine={sortLine} /> : undefined} />,
  ];
  return (
    <CardShell
      className={cx("si-outreachcard", isNumberOnly(o) && "is-number-only", closed && "is-closed", rep && "is-rep")}
      lines={lines}
      live={live}
      onOpen={onOpen ? () => onOpen(row) : undefined}
      openLabel={c.openQuickLook(identityText(o))}
      actions={
        <CardActions
          o={o}
          closed={closed}
          onMessageRep={onMessage ? () => onMessage(row) : undefined}
          messageRepDisabledReason={messageRepDisabledReason}
        />
      }
    />
  );
}

/** Final spec §5.7: a Number in Attention needing review, with no Outreach. */
export function NumberReviewCard({ row }: { row: CardRow; asOf: string }) {
  const rep = useIsRep();
  const subject = row.subject;
  const numberId = subject.kind === "number_review" ? subject.contact_number_id : null;
  const interactions = row.sort_keys?.interactions;
  const chips = lineOneChips(row, "");
  const lines: ReactNode[] = [
    <span key={1} className="si-card__l1">
      <span className="si-card__l1main">
        <span className="si-card__identity">{c.numberReviewIdentity}</span>
        {chips.map((chip) => (
          <ChipView key={chip.id} chip={chip} />
        ))}
      </span>
    </span>,
    null,
    null,
    interactions != null ? c.calls(interactions) : null,
    null,
    null,
    null,
  ];
  return (
    <CardShell
      className="si-outreachcard is-number-review"
      lines={lines}
      actions={numberId && !rep ? <NumberReviewActions contactNumberId={numberId} /> : undefined}
    />
  );
}

function OutreachCardSkeleton() {
  return <CardShell.Skeleton />;
}

OutreachCard.Skeleton = OutreachCardSkeleton;
