"use client";
/**
 * UI1-CARD: the Outreach card (UI-1 §2, final spec §5). One component for every list (grouped, flat, closed, rep pages);
 * seven rows in a fixed order through `CardShell`, laid out by OUTREACH-CARD-LAYOUT-SPECIFICATION §3: A band + rep,
 * B identity, C metric tiles, D scores, E move info, F next step, G secondary. Row E is empty (and hidden) without a
 * route. A Number-review row (`outreach: null`) renders its identity, its interactions tile, `Needs review` and `Open`.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CardShell } from "../primitives";
import { legacyNumberHref } from "../lib/legacy-links";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { outreachRouteHref } from "../outreach/deep-links";
import { useIsRep } from "../rep/viewer";
import { CardActions, NumberReviewActions } from "./card-actions";
import {
  CardBandRow,
  CardSecondary,
  ChipView,
  LineFive,
  LineSix,
  MetricTiles,
  SortLine,
  identityText,
  formatE164,
  isNumberOnly,
  lineOneChips,
  metricTiles,
  MoveLine,
  type CardRow,
} from "./card-lines";

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
  /** UI1-CLOSED's `Closed · {outcome}` line replaces line 6 on a closed record. */
  line6Override?: ReactNode;
  selectedFollowup?: { id: string; name: string } | null;
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
  if (isNumberOnly(o)) return <>{text}</>;
  const meta = [formatE164(o.primary_number?.e164), o.lead_display?.job_no ? c.job(o.lead_display.job_no) : null, o.lead_display?.source_company]
    .filter(Boolean).join(" · ");
  return <><strong className="si-card__name">{o.lead_display?.name || c.unknownName}</strong>{meta && <span className="si-card__meta"> · {meta}</span>}</>;
}

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
  const lines: ReactNode[] = [
    <CardBandRow key="a" row={row} asOf={asOf} />,
    <span key="b" className="si-card__identity">
      <Identity row={row} />
    </span>,
    <MoveLine key="c" o={o} asOf={asOf} />,
    <MetricTiles key="d" tiles={metricTiles(o, asOf)} />,
    <LineFive key="e" o={o} />,
    line6Override ?? <LineSix key="f" o={o} asOf={asOf} onApply={onApply ? () => onApply(row) : undefined} selectedFollowup={selectedFollowup} />,
    <CardSecondary key="g" row={row} o={o} asOf={asOf} sortLine={sortLine ? <SortLine sortLine={sortLine} /> : undefined} />,
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
