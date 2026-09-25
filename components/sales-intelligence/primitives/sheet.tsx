"use client";
/**
 * UI2-PHONE (UI-2 §7): the one sheet the rep pages open, a native modal `<dialog>`.
 * - `variant="full"`: a full-screen sheet at ≤ 480 px and a centred dialog above (the follow-up action sheets, UI-2 §4).
 * - `variant="bottom"`: a bottom sheet below 768 px and a centred dialog above (the rail's `Filters`, UI-2 §7).
 * Escape (the dialog's `cancel`) closes it unless `busy`; focus goes to `initialFocus` on open (the note field) and back
 * to the element that opened it on close. The footer stays pinned while the body scrolls. Layout: `.si-sheet` in the
 * UI2-PHONE CSS block.
 */
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";

export type SheetVariant = "full" | "bottom";

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "full",
  busy = false,
  initialFocus,
  className,
  closeLabel = copy.ui2.phone.close,
  inline = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: SheetVariant;
  /** While true, Escape and the close button don't close the sheet (a request is in flight). */
  busy?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  closeLabel?: string;
  /** The gallery's static sample: the same frame in the page flow (a `div role="dialog"`), never modal. */
  inline?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      initialFocus?.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialFocus]);

  // Focus returns to the opener when the sheet closes or unmounts.
  useEffect(() => {
    if (open) return;
    const target = opener.current;
    opener.current = null;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  }, [open]);
  useEffect(() => () => {
    const target = opener.current;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  }, []);

  const frame = (
    <div className="si-sheet__frame">
      <header className="si-sheet__head">
        <h2 id={titleId} className="si-sheet__title">{title}</h2>
        <button type="button" className="si-btn si-btn--ghost si-iconbtn--hit si-sheet__close" aria-label={closeLabel} disabled={busy} onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="si-sheet__body">{children}</div>
      {footer && <footer className="si-sheet__foot">{footer}</footer>}
    </div>
  );
  if (inline) {
    return (
      <div role="dialog" aria-labelledby={titleId} className={cx("si-root si-sheet is-inline", `si-sheet--${variant}`, className)} data-sheet={variant}>
        {frame}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      className={cx("si-root si-sheet", `si-sheet--${variant}`, className)}
      aria-labelledby={titleId}
      data-sheet={variant}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {frame}
    </dialog>
  );
}
