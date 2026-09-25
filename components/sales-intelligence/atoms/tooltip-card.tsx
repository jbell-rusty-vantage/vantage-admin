"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { copy } from "../sales-intelligence-copy";
import { guideHref, type GuideTopic } from "../sales-intelligence-tabs";
import { cx } from "../lib/format";

type Place = { top: number; left: number };

/** Hover waits this long before the card opens, so passing the pointer over a card doesn't pop tips. Focus opens at once. */
const OPEN_DELAY_MS = 350;
const HIDE_DELAY_MS = 120;
const EDGE = 8;
const GAP = 6;

/** Above the anchor when it fits (the content below is what the reader is reading next), else below; centred and kept on screen. */
export function placeCard(anchor: DOMRect, card: { width: number; height: number }, viewport: { width: number; height: number }): Place {
  const above = anchor.top - GAP - card.height;
  const below = anchor.bottom + GAP;
  let top = above >= EDGE ? above : below;
  if (top + card.height > viewport.height - EDGE) top = Math.max(EDGE, viewport.height - EDGE - card.height);
  const centred = anchor.left + anchor.width / 2 - card.width / 2;
  const left = Math.min(Math.max(EDGE, centred), Math.max(EDGE, viewport.width - EDGE - card.width));
  return { top, left };
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function nextTabbableAfter(from: HTMLElement, skip: HTMLElement | null): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => !skip?.contains(el) && el.offsetParent !== null);
  const at = all.indexOf(from);
  return at >= 0 ? all[at + 1] ?? null : null;
}

/**
 * The card renders in a portal (the open `<dialog>` it sits in, else `<body>`): cards and rows set `z-index` on their
 * parts, which trapped an inline card under the next card in the list.
 */
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
  const openTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const role = guideTopic ? "dialog" : "tooltip";

  const clearTimers = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    openTimer.current = null;
    hideTimer.current = null;
  };
  const openCard = () => {
    setHost(wrapRef.current?.closest<HTMLElement>("dialog[open]") ?? document.body);
    setOpen(true);
  };
  const showNow = () => {
    clearTimers();
    openCard();
  };
  const showSoon = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
    if (open || openTimer.current) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      openCard();
    }, OPEN_DELAY_MS);
  };
  const hide = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  };

  useEffect(() => clearTimers, []);

  // The portal puts the guide link outside the anchor's tab order: Tab from the anchor reaches it, and Tab or
  // Shift+Tab from it returns to the anchor (the next Tab then leaves the tip as before).
  const onAnchorKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Tab" || event.shiftKey || !open) return;
    const link = cardRef.current?.querySelector<HTMLElement>(".si-tip__guide");
    if (!link) return;
    event.preventDefault();
    link.focus();
  };
  const onLinkKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Tab") return;
    const anchor = wrapRef.current?.querySelector<HTMLElement>(".si-tip__anchor");
    if (!anchor) return;
    event.preventDefault();
    if (event.shiftKey) {
      anchor.focus();
      return;
    }
    setOpen(false);
    nextTabbableAfter(anchor, cardRef.current)?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Fixed position doesn't follow the anchor, so any scroll (the desk scrolls its own area) or resize closes the card.
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && cardRef.current?.contains(event.target)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Placed before paint, so the card never flashes at the top-left corner.
  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !cardRef.current) return;
    const anchor = wrapRef.current.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();
    setPlace(placeCard(anchor, { width: card.width || 280, height: card.height || 80 }, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, title, children]);

  return (
    <span
      ref={wrapRef}
      className={cx("si-tip", className)}
      onMouseEnter={showSoon}
      onMouseLeave={hide}
      onFocusCapture={showNow}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && (wrapRef.current?.contains(next) || cardRef.current?.contains(next))) return;
        hide();
      }}
    >
      <span
        className="si-tip__anchor"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onKeyDown={onAnchorKey}
      >
        {label}
      </span>
      {open && host && createPortal(
        <span className="si-root si-tipportal">
          <span
            ref={cardRef}
            id={id}
            role={role}
            className="si-tip__card"
            style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
            onMouseEnter={showNow}
            onMouseLeave={hide}
          >
            <strong className="si-tip__title">{title}</strong>
            <span className="si-tip__body">{children}</span>
            {guideTopic && (
              <Link className="si-tip__guide" href={guideHref(guideTopic)} onClick={() => setOpen(false)} onKeyDown={onLinkKey}>
                See {copy.guide.title}
              </Link>
            )}
          </span>
        </span>,
        host,
      )}
    </span>
  );
}
