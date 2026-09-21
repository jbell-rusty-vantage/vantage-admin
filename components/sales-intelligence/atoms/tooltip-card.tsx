"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { copy } from "../sales-intelligence-copy";
import { guideHref, type GuideTopic } from "../sales-intelligence-tabs";
import { cx } from "../lib/format";

type Place = { top: number; left: number };

function placeCard(anchor: DOMRect, card: { width: number; height: number }): Place {
  const gap = 8;
  const maxLeft = window.innerWidth - card.width - 8;
  const maxTop = window.innerHeight - card.height - 8;
  let top = anchor.bottom + gap;
  let left = anchor.left;
  if (top + card.height > window.innerHeight - 8) top = anchor.top - card.height - gap;
  if (left > maxLeft) left = Math.max(8, maxLeft);
  if (top < 8) top = 8;
  if (top > maxTop) top = Math.max(8, maxTop);
  return { top, left: Math.max(8, left) };
}

export function TooltipCard({
  title,
  label,
  children,
  guideTopic,
  className,
}: {
  title: string;
  label: ReactNode;
  children: ReactNode;
  guideTopic?: GuideTopic;
  className?: string;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place>({ top: 0, left: 0 });
  const role = guideTopic ? "dialog" : "tooltip";

  const show = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setOpen(true);
  };
  const hide = () => {
    hideTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !wrapRef.current || !cardRef.current) return;
    const anchor = wrapRef.current.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();
    setPlace(placeCard(anchor, { width: card.width || 280, height: card.height || 80 }));
  }, [open, title, children]);

  return (
    <span
      ref={wrapRef}
      className={cx("si-tip", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && wrapRef.current?.contains(next)) return;
        hide();
      }}
    >
      <span
        className="si-tip__anchor"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
      >
        {label}
      </span>
      {open && (
        <span
          ref={cardRef}
          id={id}
          role={role}
          className="si-tip__card"
          style={{ top: place.top, left: place.left }}
        >
          <strong className="si-tip__title">{title}</strong>
          <span className="si-tip__body">{children}</span>
          {guideTopic && (
            <Link className="si-tip__guide" href={guideHref(guideTopic)} onClick={() => setOpen(false)}>
              See {copy.guide.title}
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
