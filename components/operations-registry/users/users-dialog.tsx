"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { cx } from "@/components/sales-intelligence/lib/format";

/**
 * UI2-USERS: the dialog frame for the Users tab. A native `<dialog>` opened with `showModal()`, so Escape
 * closes the innermost one; focus returns to the button that opened it. `inline` renders the same markup as
 * a static panel (the gallery and render tests, which have no DOM). At 390 px `.si-dialog` is full screen.
 */
export function UsersDialog({
  title,
  description,
  busy = false,
  inline = false,
  onClose,
  onSubmit,
  footer,
  children,
  size = "sm",
}: {
  title: string;
  description?: ReactNode;
  busy?: boolean;
  inline?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  footer: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md";
}) {
  const titleId = useId();
  const descId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (inline) return;
    const dialog = ref.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [inline]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit?.();
  };

  const body = (
    <form className="si-dialog__form" onSubmit={submit} noValidate>
      <header className="si-dialog__header">
        <div>
          <h2 id={titleId} className="si-dialog__title">{title}</h2>
          {description && <div id={descId} className="si-dialog__desc">{description}</div>}
        </div>
      </header>
      {children && <div className="si-dialog__body">{children}</div>}
      <footer className="si-dialog__footer si-users__dialogfooter">{footer}</footer>
    </form>
  );

  const common = {
    className: cx("si-root si-dialog si-users__dialog", size === "sm" && "si-dialog--sm", inline && "si-users__dialog--inline"),
    "aria-labelledby": titleId,
    "aria-describedby": description ? descId : undefined,
  };

  if (inline) {
    return (
      <div role="dialog" aria-modal="false" {...common}>
        {body}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      {...common}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
    >
      {body}
    </dialog>
  );
}
