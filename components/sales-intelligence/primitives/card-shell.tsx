"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

export const CARD_LINES = 7;

const isEmpty = (node: ReactNode) => node === null || node === undefined || node === false || node === "";

/**
 * UI-0 §7.4 card anatomy: 16 px padding, 1 px `--si-line` border, radius 8, seven fixed line slots.
 * A slot with no content prints its `nullText` (the specific null wording), so every slot always renders.
 * The body opens through one stretched button (keyboard reachable); links and buttons inside lines stay clickable.
 */
export function CardShell({
  lines,
  nullText = [],
  actions,
  live = false,
  href,
  onNavigate,
  openLabel = copy.ui1.prim.openCard,
  className,
  band,
  outreachId,
}: {
  lines: ReactNode[];
  nullText?: (string | undefined)[];
  actions?: ReactNode;
  live?: boolean;
  href?: string;
  onNavigate?: () => void;
  openLabel?: string;
  className?: string;
  /** The card's Attention band, for the band-colour left edge (`data-card-band`); null or omitted draws none. */
  band?: number | null;
  outreachId?: string;
}) {
  return (
    <article className={cx("si-cardshell", live && "is-live", !!href && "is-openable", className)} data-card-band={band ?? undefined} data-outreach-id={outreachId}>
      <div className="si-cardshell__body">
        {href && <Link href={href} className="si-cardshell__hit" aria-label={openLabel} onClick={(event) => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.();
        }} />}
        <ol className="si-cardshell__lines">
          {Array.from({ length: CARD_LINES }, (_, i) => {
            const content = lines[i];
            const empty = isEmpty(content);
            return (
              <li key={i} className={cx("si-cardshell__line", `si-cardshell__line--${i + 1}`, empty && "is-empty")}>
                {empty ? (nullText[i] ?? " ") : content}
              </li>
            );
          })}
        </ol>
      </div>
      {actions && <div className="si-cardshell__actions">{actions}</div>}
    </article>
  );
}

export function CardShellSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <article className="si-cardshell is-skeleton" aria-hidden>
      <div className="si-cardshell__body">
        <ol className="si-cardshell__lines">
          {Array.from({ length: CARD_LINES }, (_, i) => (
            <li key={i} className={cx("si-cardshell__line", `si-cardshell__line--${i + 1}`)}>
              <span className="si-skeleton si-skeleton--line" style={{ width: i === 0 ? "48%" : `${[72, 64, 58, 70, 52, 44][i - 1]}%` }} />
            </li>
          ))}
        </ol>
      </div>
      {actions && (
        <div className="si-cardshell__actions">
          <span className="si-skeleton si-skeleton--btn" />
        </div>
      )}
    </article>
  );
}

CardShell.Skeleton = CardShellSkeleton;
