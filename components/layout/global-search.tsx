"use client";
/**
 * ⌘K is record search, not nav search (doc 01, behaviour 3). Typing a job number, phone, name or email searches leads
 * and bookings (`GET /api/v1/admin/search`) and opens the hit in place; the six destinations stay reachable as a
 * secondary group. Enter on the first row sends the text to the Leads workspace (`/leads?q=`).
 */
import { BookOpenCheck, FileText, Phone, Search, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { MIN_SEARCH_QUERY_LENGTH } from "@/components/filters/debounced-search-input";
import { Pill, cx } from "@/components/ui/crm";
import { fetchGlobalSearch } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
  paletteRecordsFromSearch,
  type PaletteDestination,
  type PaletteRecord,
} from "./command-palette";
import { visibleDashboardNav } from "./dashboard-nav";
import { useDashboardRole } from "./dashboard-role-context";

export {
  buildSearchHref,
  filterPaletteDestinations,
  isCommandPaletteHotkey,
} from "./command-palette";
export type { PaletteDestination } from "./command-palette";

const SEARCH_DEBOUNCE_MS = 300;

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

const noopSubscribe = () => () => {};

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function RecordIcon({ record }: { record: PaletteRecord }) {
  if (record.kind === "cancellation") return <XCircle className="h-4 w-4 shrink-0 text-[var(--crm-red)]" aria-hidden="true" />;
  if (record.kind === "booking") return <BookOpenCheck className="h-4 w-4 shrink-0 text-[var(--crm-green)]" aria-hidden="true" />;
  if (record.pill === "Call") return <Phone className="h-4 w-4 shrink-0 text-[var(--crm-blue)]" aria-hidden="true" />;
  return <FileText className="h-4 w-4 shrink-0 text-[var(--crm-blue)]" aria-hidden="true" />;
}

export function GlobalSearch({
  destinations: destinationsProp,
  variant = "sidebar",
}: {
  destinations?: Array<PaletteDestination>;
  /** `sidebar`: the full box with the hotkey hint; `icon`: a single button (phones, collapsed rail). */
  variant?: "sidebar" | "icon";
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
  // The hint depends on the platform: "⌘K" on the server render, the real key once hydrated.
  const hotkeyHint = useSyncExternalStore(noopSubscribe, paletteHotkeyHint, () => "⌘K");
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const trimmed = query.trim();
  const canSearch = trimmed.length >= MIN_SEARCH_QUERY_LENGTH;
  const debouncedQuery = useDebounced(canSearch ? trimmed : "", SEARCH_DEBOUNCE_MS);
  const recordsQuery = useQuery({
    queryKey: queryKeys.search.global(debouncedQuery),
    queryFn: () => fetchGlobalSearch({ q: debouncedQuery, limit: 6 }),
    enabled: open && debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH,
    staleTime: 30_000,
    retry: false,
  });
  const records = useMemo(() => (canSearch ? paletteRecordsFromSearch(recordsQuery.data, 8) : []), [canSearch, recordsQuery.data]);
  const matches = filterPaletteDestinations(destinations, query);
  const itemCount = (canSearch ? 1 : 0) + records.length + matches.length;

  useEffect(() => {
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (isCommandPaletteHotkey(event)) {
        event.preventDefault();
        setQuery("");
        setHighlightedIndex(0);
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

  // A new query starts the highlight at the first row (state adjusted from the previous render).
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setHighlightedIndex(0);
  }

  function openPalette(trigger: HTMLElement | null) {
    restoreFocusRef.current = trigger;
    setQuery("");
    setHighlightedIndex(0);
    setOpen(true);
  }

  function closePalette() {
    setOpen(false);
  }

  function goTo(href: string) {
    closePalette();
    router.push(href);
  }

  function goToSearch() {
    const href = buildSearchHref(query);
    if (!href) {
      return;
    }
    goTo(href);
  }

  function activateHighlighted() {
    if (canSearch && highlightedIndex === 0) {
      goToSearch();
      return;
    }
    const offset = canSearch ? 1 : 0;
    const record = records[highlightedIndex - offset];
    if (record) {
      goTo(record.href);
      return;
    }
    const destination = matches[highlightedIndex - offset - records.length];
    if (destination) {
      goTo(destination.href);
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

  const rowClass = (active: boolean) =>
    cx(
      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold",
      active ? "bg-[var(--crm-blue-50)] text-[var(--crm-blue-ink)]" : "text-[var(--crm-text)] hover:bg-[#f2f6fc]",
    );

  const recordOffset = canSearch ? 1 : 0;
  const destinationOffset = recordOffset + records.length;

  return (
    <>
      {variant === "icon" ? (
        <button type="button" className="crm-button crm-button--quiet crm-button--icon" aria-label="Open search" onClick={(event) => openPalette(event.currentTarget)}>
          <Search aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="crm-search crm-sidebar__search" aria-label="Search job, phone, name or email" onClick={(event) => openPalette(event.currentTarget)} data-testid="global-search-trigger">
          <Search aria-hidden="true" width={16} height={16} />
          <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, color: "var(--crm-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Search job, phone, email…</span>
          <span className="crm-search__hint">{hotkeyHint}</span>
        </button>
      )}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50" data-ui="crm">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close search"
                className="absolute inset-0 bg-[rgba(16,28,61,0.32)]"
                onClick={closePalette}
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Search records"
                className="relative mx-auto mt-[12vh] w-full max-w-xl rounded-[12px] border border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-pop)]"
              >
                <div className="relative border-b border-[var(--crm-border)] px-3 py-2">
                  <div className="crm-search" style={{ border: 0, paddingInline: 4 }}>
                    <Search aria-hidden="true" width={18} height={18} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onPaletteKeyDown}
                      placeholder="Job number, phone, name or email…"
                      aria-label="Search records"
                      autoComplete="off"
                      style={{ fontSize: 15 }}
                    />
                  </div>
                </div>
                <ul className="max-h-[60vh] overflow-y-auto p-2">
                  {canSearch ? (
                    <li>
                      <button type="button" className={rowClass(highlightedIndex === 0)} onClick={goToSearch} onMouseEnter={() => setHighlightedIndex(0)}>
                        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Search leads for “{trimmed}”
                      </button>
                    </li>
                  ) : (
                    <li className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-faint)]">Type at least {MIN_SEARCH_QUERY_LENGTH} characters to search records</li>
                  )}
                  {canSearch && recordsQuery.isFetching && records.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-[var(--crm-muted)]">Searching…</li>
                  ) : null}
                  {canSearch && recordsQuery.isError ? (
                    <li className="px-3 py-2 text-sm text-[var(--crm-red)]" role="alert">
                      Record search failed. Press Enter to open the Leads workspace instead.
                    </li>
                  ) : null}
                  {canSearch && recordsQuery.data && records.length === 0 && !recordsQuery.isFetching ? (
                    <li className="px-3 py-2 text-sm text-[var(--crm-muted)]">No lead or booking matched.</li>
                  ) : null}
                  {records.length > 0 ? <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-faint)]">Records</li> : null}
                  {records.map((record, index) => {
                    const itemIndex = recordOffset + index;
                    return (
                      <li key={`${record.kind}:${record.id}`}>
                        <button type="button" className={rowClass(highlightedIndex === itemIndex)} onClick={() => goTo(record.href)} onMouseEnter={() => setHighlightedIndex(itemIndex)} data-record-kind={record.kind}>
                          <RecordIcon record={record} />
                          <span className="min-w-0 flex-1 truncate">
                            {record.primary}
                            {record.secondary ? <span className="ml-2 font-medium text-[var(--crm-muted)]">{record.secondary}</span> : null}
                          </span>
                          {record.pill ? <Pill variant={record.kind === "cancellation" ? "red" : record.kind === "booking" ? "green" : "neutral"}>{record.pill}</Pill> : null}
                          {record.badges.slice(0, 2).map((badge) => (
                            <Pill key={badge} variant="neutral">
                              {badge}
                            </Pill>
                          ))}
                        </button>
                      </li>
                    );
                  })}
                  {matches.length > 0 ? <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--crm-faint)]">Go to</li> : null}
                  {matches.map((destination, index) => {
                    const itemIndex = destinationOffset + index;
                    return (
                      <li key={destination.href}>
                        <button type="button" className={rowClass(highlightedIndex === itemIndex)} onClick={() => goTo(destination.href)} onMouseEnter={() => setHighlightedIndex(itemIndex)}>
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
