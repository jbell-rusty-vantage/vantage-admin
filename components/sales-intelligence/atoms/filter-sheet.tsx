"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { copy } from "../sales-intelligence-copy";
import { Button } from "./button";

export function FilterSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="si-root si-filtersheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="si-filtersheet__head">
        <h2 id={titleId} className="si-filters__title">{title}</h2>
        <Button variant="ghost" onClick={onClose}>{copy.filters.close}</Button>
      </div>
      <div className="si-filtersheet__body">{children}</div>
    </dialog>
  );
}
