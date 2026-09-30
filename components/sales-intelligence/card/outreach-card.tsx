"use client";
/**
 * UI1-CARD: the Outreach card (UI-1 §2, final spec §5). One component for every list (grouped, flat, closed, rep pages);
 * seven slots in a fixed order through `CardShell`. 2026-09-29 refresh (the Owner's Claude Design reference): 1 band,
 * chips, state and rep · 2 name, phone / Job / source · 3 the Move / Estimate panel · 4 the activity (received, last
 * conversation, last call, counts) · 5 the Next panel with the card's actions (a closed card shows its outcome there)
 * · 6 the score bars · 7 the secondary line (promiser, reason, band age, sort line). Owner, 2026-09-30: the times sit
 * under the move; Next and the scores close the card.
 * A Number-review row (`outreach: null`) renders its identity, its interactions tile, `Needs review` and `Open`.
 */
import type { ReactNode } from "react";
import { CardShell } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { outreachRouteHref } from "../outreach/deep-links";
import { useIsRep } from "../rep/viewer";
import { CardActions, NumberReviewActions } from "./card-actions";
import { CardBandRow, CardSecondary, ChipView, MetricTiles, SortLine, identityText, isNumberOnly, lineOneChips, type CardRow } from "./card-lines";
import { ActivityFooter, CardIdentity, MovePanel, NextPanel, ScoreBars } from "./card-sections";
import { outcomeWord } from "./outcome-line";

const c = copy.ui1.card;

export type OutreachCardProps = {
  row: CardRow;
  asOf: string;
  /** D2: every card starts with its band, so the layout no longer changes the card; the lists still pass it. */
  layout: "grouped" | "flat";
  view: "attention" | "all_outreach" | "closed";
  sortLine?: { label: string; value: string | null; nullLabel: string } | null;
  returnTo?: string;
  onNavigate?: (row: CardRow) => void;
  onMessageRep?: (row: CardRow) => void;
  onApplySuggestion?: (row: CardRow) => void;
  /** UI1-CHAT passes the nudge-destination rule's reason; `null` forces enabled; omitted uses the card's default rule. */
  messageRepDisabledReason?: string | null;
  /** UI1-CLOSED's outcome line: it takes the Next panel's place on a closed record. */
  line6Override?: ReactNode;
  selectedFollowup?: { id: string; name: string } | null;
};

export function OutreachCard({
  row,
  asOf,
  view,
  sortLine,
  returnTo,
  onNavigate,
  onMessageRep,
  onApplySuggestion,
  messageRepDisabledReason,
  line6Override,
  selectedFollowup,
}: OutreachCardProps) {
  const o = row.outreach;
  const rep = useIsRep();
  if (!o) return <NumberReviewCard row={row} asOf={asOf} />;
  // UI2-SCOPE (UI-2 §3): a rep has no `Apply` (not in the E9 allowlist) and no `Message rep`.
  const onApply = rep ? undefined : onApplySuggestion;
  const onMessage = rep ? undefined : onMessageRep;
  const closed = view === "closed" || o.state === "closed";
  const live = !!o.live_call || o.call_progress?.state === "in_progress";
  const band = row.derived.attention_band;
  const actions = <CardActions o={o} closed={closed} onMessageRep={onMessage ? () => onMessage(row) : undefined} messageRepDisabledReason={messageRepDisabledReason} />;
  const outcome = row.outcome;
  const lines: ReactNode[] = [
    <CardBandRow key="a" row={row} asOf={asOf} />,
    <CardIdentity key="b" o={o} />,
    <MovePanel key="c" o={o} asOf={asOf} />,
    <ActivityFooter key="e" o={o} asOf={asOf} />,
    <NextPanel key="d" o={o} asOf={asOf} onApply={onApply ? () => onApply(row) : undefined} selectedFollowup={selectedFollowup} actions={actions}
      outcome={line6Override} outcomeLabel={outcome ? `Closed · ${outcomeWord(outcome.reason, rep)}` : undefined} booked={outcome?.reason === "booked"} />,
    <ScoreBars key="f" o={o} />,
    <CardSecondary key="g" row={row} o={o} asOf={asOf} recordings={false} sortLine={sortLine ? <SortLine sortLine={sortLine} /> : undefined} />,
  ];
  return (
    <CardShell
      className={cx("si-outreachcard", isNumberOnly(o) && "is-number-only", closed && "is-closed", rep && "is-rep")}
      band={typeof band === "number" ? band : null}
      outreachId={o.id}
      lines={lines}
      live={live}
      href={outreachRouteHref(o.id, { siReturn: returnTo })}
      onNavigate={onNavigate ? () => onNavigate(row) : undefined}
      openLabel={copy.oi.card.open(identityText(o))}
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
    interactions != null ? (
      <MetricTiles
        key="c"
        className="si-tiles--single"
        tiles={[{ id: "calls", label: c.tile.calls(interactions), value: interactions.toLocaleString("en-US") }]}
      />
    ) : null,
    null,
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
