"use client";
/**
 * UI1-CARD: the side dialog (final spec §4, UI-1 §2.4). A non-modal panel on the right for a quick look from a
 * list: the card's header block (line 1 with the live chip, the route, line 7), the two score cards, the next step,
 * a five-event timeline preview (UI1-TL plugs `TimelinePreview` in through `timelinePreview`) and
 * `Open full record`. It reads the record live with `useOutreach(id)` inside its own region.
 *
 * Mechanics (read from `_legacy/detail-panel.tsx`, not imported): focus moves into the panel when it opens and
 * returns to the opener when it closes; Escape closes it; Tab cycles inside it. The list behind stays usable with
 * the mouse, so picking another card swaps the record.
 *
 * UI2-SCOPE (UI-2 §3): for a rep the same dialog, without Owner commands: no `Apply` on the suggestion, and line 7 reads
 * the rep's `Yours` / `Promised by you` (the card's own rule). It reads only the detail, which a rep may read.
 */
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { scoreLabel } from "@/lib/api/salesIntelligence";
import { Button } from "./atoms/button";
import { LineOne, LineSeven, LineSix, identityText, routeText, scoreTipLines, type CardOutreach, type CardRow } from "./card";
import { outreachHref } from "./card/card-actions";
import { siKeys } from "./data/query-keys";
import { useOutreach } from "./data/use-outreach";
import { Region, SkeletonBlock, SkeletonLines } from "./primitives";
import { copy } from "./sales-intelligence-copy";
import { cx } from "./lib/format";
import { useIsRep } from "./rep/viewer";

const c = copy.ui1.card;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type PreviewDialogProps = {
  /** The list row that was opened. Its Outreach id drives the live read; `filter_keys` still come from the row. */
  row: CardRow;
  onClose: () => void;
  timelinePreview?: ReactNode;
  onApplySuggestion?: (row: CardRow) => void;
};

function ScoreCard({ o, which }: { o: CardOutreach; which: "ti" | "ml" }) {
  const a = o.move_assessment;
  const score = which === "ti" ? a?.transaction_intent : a?.move_likelihood;
  const level = which === "ti" ? a?.transaction_intent_level_label : a?.move_likelihood_level_label;
  const label = scoreLabel(a?.status ?? null, score ?? null, a?.applicability);
  const numeric = label.endsWith("/ 100");
  return (
    <div className="si-preview__score" data-score-card={which}>
      <span className="si-preview__scorename">{which === "ti" ? c.transactionIntent : c.moveLikelihood}</span>
      <span className={cx("si-preview__scorevalue", !numeric && "is-word")}>{label}</span>
      {numeric && level && <span className="si-preview__scorelevel">{level}</span>}
    </div>
  );
}

/** The dialog's content for one live record (pure: tested with the detail fixtures). */
export function PreviewBody({
  row,
  asOf,
  timelinePreview,
  onApplySuggestion,
}: {
  row: CardRow;
  asOf: string;
  timelinePreview?: ReactNode;
  onApplySuggestion?: (row: CardRow) => void;
}) {
  const o = row.outreach!;
  const route = routeText(o, asOf);
  const onApply = useIsRep() ? undefined : onApplySuggestion;
  return (
    <div className="si-preview__content">
      <section className="si-preview__block" aria-label={identityText(o)}>
        <LineOne row={row} asOf={asOf} layout="flat" identity={null} />
        {route && <p className="si-preview__line">{route}</p>}
        <p className="si-preview__line">
          <LineSeven row={row} o={o} asOf={asOf} />
        </p>
      </section>
      <section className="si-preview__block" aria-labelledby="si-preview-scores">
        <h3 id="si-preview-scores" className="si-heading si-heading--4">{c.scoresTipTitle}</h3>
        <div className="si-preview__scores">
          <ScoreCard o={o} which="ti" />
          <ScoreCard o={o} which="ml" />
        </div>
        <p className="si-preview__note si-text--sm si-text--subtle">{scoreTipLines(o).join(" ")}</p>
      </section>
      <section className="si-preview__block" aria-labelledby="si-preview-next">
        <h3 id="si-preview-next" className="si-heading si-heading--4">{c.nextStepTitle}</h3>
        <p className="si-preview__line">
          <LineSix o={o} asOf={asOf} onApply={onApply ? () => onApply(row) : undefined} />
        </p>
      </section>
      <section className="si-preview__block" aria-labelledby="si-preview-activity">
        <h3 id="si-preview-activity" className="si-heading si-heading--4">{c.recentActivity}</h3>
        {timelinePreview ?? <SkeletonLines lines={5} widths={["80%", "72%", "76%", "64%", "70%"]} />}
      </section>
      <Link className="si-btn si-btn--primary si-btn--md si-hit si-preview__full" href={outreachHref(o.id)}>
        {c.openFullRecord}
      </Link>
    </div>
  );
}

function PreviewLive({ row, timelinePreview, onApplySuggestion }: Omit<PreviewDialogProps, "onClose">) {
  const { outreach, asOf } = useOutreach(row.outreach!.id);
  // The detail read is the live record; `filter_keys` (Needs review) stay the list row's.
  const live: CardRow = { ...row, outreach, derived: outreach.derived };
  return <PreviewBody row={live} asOf={asOf} timelinePreview={timelinePreview} onApplySuggestion={onApplySuggestion} />;
}

function PreviewSkeleton() {
  return (
    <div className="si-preview__content" aria-hidden>
      <SkeletonLines lines={3} widths={["60%", "70%", "50%"]} />
      <div className="si-preview__scores">
        <SkeletonBlock height={72} />
        <SkeletonBlock height={72} />
      </div>
      <SkeletonLines lines={1} widths={["66%"]} />
      <SkeletonLines lines={5} widths={["80%", "72%", "76%", "64%", "70%"]} />
    </div>
  );
}

export function PreviewDialog({ row, onClose, timelinePreview, onApplySuggestion }: PreviewDialogProps) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const queryClient = useQueryClient();
  const id = row.outreach?.id ?? null;

  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  if (!id) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <aside ref={ref} className="si-preview" role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      <header className="si-preview__header">
        <h2 id={titleId} className="si-preview__title">{row.outreach ? identityText(row.outreach) : c.dialogTitle}</h2>
        <Button variant="ghost" className="si-iconbtn--hit" aria-label={c.close} onClick={onClose}>
          <X size={18} aria-hidden />
        </Button>
      </header>
      <div className="si-preview__body">
        <Region name="preview-dialog" skeleton={<PreviewSkeleton />} onRetry={() => queryClient.resetQueries({ queryKey: siKeys.outreach(id) })}>
          <PreviewLive row={row} timelinePreview={timelinePreview} onApplySuggestion={onApplySuggestion} />
        </Region>
      </div>
    </aside>
  );
}

PreviewDialog.Skeleton = PreviewSkeleton;
