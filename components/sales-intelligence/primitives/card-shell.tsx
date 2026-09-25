"use client";

import { type ReactNode } from "react";
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
  onOpen,
  openLabel = copy.ui1.prim.openCard,
  className,
}: {
  lines: ReactNode[];
  nullText?: (string | undefined)[];
  actions?: ReactNode;
  live?: boolean;
  onOpen?: () => void;
  openLabel?: string;
  className?: string;
}) {
  return (
    <article className={cx("si-cardshell", live && "is-live", !!onOpen && "is-openable", className)}>
      <div className="si-cardshell__body">
        {onOpen && <button type="button" className="si-cardshell__hit" aria-label={openLabel} onClick={onOpen} />}
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

function CardShellSkeleton({ actions = true }: { actions?: boolean }) {
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
