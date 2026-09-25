"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "../lib/format";

type Remember = "session" | "local";

const KEY_PREFIX = "si:disclosure:";
const CHANGE_EVENT = "si-disclosure-change";

function storageFor(remember: Remember): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return remember === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** "1" open, "0" closed, null when nothing is remembered or storage is unavailable. */
export function readRemembered(remember: Remember, id: string): "1" | "0" | null {
  try {
    const value = storageFor(remember)?.getItem(KEY_PREFIX + id) ?? null;
    return value === "1" || value === "0" ? value : null;
  } catch {
    return null;
  }
}

function writeRemembered(remember: Remember, id: string, open: boolean) {
  try {
    storageFor(remember)?.setItem(KEY_PREFIX + id, open ? "1" : "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: the in-memory state still works for this visit.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const noRemember = () => null;

/**
 * A disclosure with a 44 px summary button and `aria-expanded`. With `remember`, the open/closed choice is kept in
 * session or local storage under `id`. The server snapshot is always "nothing remembered", so the first render
 * matches the server and the remembered value applies after hydration (useSyncExternalStore).
 */
export function Disclosure({
  id,
  title,
  defaultOpen = false,
  remember,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  remember?: Remember;
  children: ReactNode;
  className?: string;
}) {
  const panelId = useId();
  const [local, setLocal] = useState(defaultOpen);
  const getSnapshot = useCallback(() => (remember ? readRemembered(remember, id) : null), [remember, id]);
  const stored = useSyncExternalStore(subscribe, getSnapshot, noRemember);
  const open = stored === null ? local : stored === "1";
  const toggle = () => {
    setLocal(!open);
    if (remember) writeRemembered(remember, id, !open);
  };
  return (
    <div className={cx("si-disclosure", open && "is-open", className)}>
      <button type="button" className="si-disclosure__summary" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <ChevronRight size={16} aria-hidden className="si-disclosure__chevron" />
        <span className="si-disclosure__title">{title}</span>
      </button>
      <div id={panelId} className="si-disclosure__panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
