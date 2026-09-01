"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MIN_SEARCH_QUERY_LENGTH } from "@/components/filters/debounced-search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatabaseScope } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
  type PaletteDestination,
} from "./command-palette";
import { visibleDashboardNav } from "./dashboard-nav";
import { useDashboardRole } from "./dashboard-role-context";

export {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
} from "./command-palette";
export type { PaletteDestination } from "./command-palette";

function paletteHotkeyHint(): string {
  if (typeof navigator === "undefined") {
    return "⌘K";
  }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "⌘K" : "Ctrl K";
}

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])")].filter(
    (element) => element.tabIndex !== -1 && element.offsetParent !== null,
  );
}

export function GlobalSearch({
  scope = "production",
  destinations: destinationsProp,
}: {
  scope?: DatabaseScope;
  destinations?: Array<PaletteDestination>;
}) {
  const router = useRouter();
  const role = useDashboardRole();
  const navDestinations = useMemo(
    () => visibleDashboardNav(role ?? "admin").map(({ label, href }) => ({ label, href })),
    [role],
  );
  const destinations = destinationsProp ?? navDestinations;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hotkeyHint, setHotkeyHint] = useState("⌘K");
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_SEARCH_QUERY_LENGTH;
  const matches = filterPaletteDestinations(destinations, query);
  const itemCount = (canSearch ? 1 : 0) + matches.length;

  useEffect(() => {
    setHotkeyHint(paletteHotkeyHint());
  }, []);

  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (isCommandPaletteHotkey(event)) {
        event.preventDefault();
        setOpen((current) => {
          if (current) {
            return false;
          }
          const active = document.activeElement;
          restoreFocusRef.current = active instanceof HTMLElement ? active : null;
          return true;
        });
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setHighlightedIndex(0);
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector("input")?.focus();
    });

    function onDialogKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = focusableIn(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !dialogRef.current.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onDialogKeyDown);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  function openPalette(trigger: HTMLElement | null) {
    restoreFocusRef.current = trigger;
    setOpen(true);
  }

  function closePalette() {
    setOpen(false);
  }

  function goToSearch() {
    const href = buildSearchHref(query, scope);
    if (!href) {
      return;
    }
    closePalette();
    router.push(href);
  }

  function goToDestination(href: string) {
    closePalette();
    router.push(href);
  }

  function activateHighlighted() {
    if (canSearch && highlightedIndex === 0) {
      goToSearch();
      return;
    }

    const destinationIndex = canSearch ? highlightedIndex - 1 : highlightedIndex;
    const destination = matches[destinationIndex];
    if (destination) {
      goToDestination(destination.href);
      return;
    }

    if (canSearch) {
      goToSearch();
    }
  }

  function onPaletteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (itemCount === 0) {
        return;
      }
      setHighlightedIndex((current) => (current + 1) % itemCount);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (itemCount === 0) {
        return;
      }
      setHighlightedIndex((current) => (current - 1 + itemCount) % itemCount);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      activateHighlighted();
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="h-9 w-9 px-0 md:hidden"
        aria-label="Open search"
        onClick={(event) => openPalette(event.currentTarget)}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="relative hidden w-full max-w-md md:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
          aria-hidden="true"
        />
        <Input
          readOnly
          placeholder="Search job, phone, email…"
          className="cursor-pointer pl-9 pr-16"
          aria-label="Global search"
          onClick={(event) => openPalette(event.currentTarget)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-steel">
          {hotkeyHint}
        </span>
      </div>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close search"
                className="absolute inset-0 bg-navy/40"
                onClick={closePalette}
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Search and go to"
                className="relative mx-auto mt-[15vh] w-full max-w-lg rounded-lg border border-steel-200 bg-white shadow-xl"
              >
                <div className="relative border-b border-steel-200">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onPaletteKeyDown}
                    placeholder="Search job, phone, email…"
                    className="border-0 pl-9 focus-visible:ring-0"
                    aria-label="Search and go to"
                    autoComplete="off"
                  />
                </div>
                <ul className="max-h-80 overflow-y-auto p-2">
                  {canSearch ? (
                    <li>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                          highlightedIndex === 0 ? "bg-pale-gold text-navy" : "text-steel hover:bg-steel-100",
                        )}
                        onClick={goToSearch}
                        onMouseEnter={() => setHighlightedIndex(0)}
                      >
                        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Search records for “{trimmed}”
                      </button>
                    </li>
                  ) : null}
                  {matches.map((destination, index) => {
                    const itemIndex = (canSearch ? 1 : 0) + index;
                    return (
                      <li key={destination.href}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center rounded-md px-3 py-2 text-left text-sm",
                            highlightedIndex === itemIndex ? "bg-pale-gold text-navy" : "text-steel hover:bg-steel-100",
                          )}
                          onClick={() => goToDestination(destination.href)}
                          onMouseEnter={() => setHighlightedIndex(itemIndex)}
                        >
                          {destination.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
