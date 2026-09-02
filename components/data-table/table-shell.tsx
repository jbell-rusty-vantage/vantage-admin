"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTableColumn<TItem> = {
  key: string;
  header: React.ReactNode;
  cell: (item: TItem) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
  truncate?: boolean;
  sticky?: "left" | "right";
};

export function DataTable<TItem>({
  items,
  columns,
  getRowKey,
  onRowClick,
  isRowSelected,
  className,
  stickyHeader = false,
  compact = false,
  horizontalControls = false,
}: {
  items: TItem[];
  columns: DataTableColumn<TItem>[];
  getRowKey: (item: TItem) => string;
  onRowClick?: (item: TItem) => void;
  isRowSelected?: (item: TItem) => boolean;
  className?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  horizontalControls?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    setScrollState({
      canScrollLeft: node.scrollLeft > 4,
      canScrollRight: node.scrollLeft < maxScrollLeft - 4,
    });
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !horizontalControls) {
      return;
    }

    const frame = window.requestAnimationFrame(updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(node);
    resizeObserver.observe(node.firstElementChild ?? node);
    node.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      node.removeEventListener("scroll", updateScrollState);
    };
  }, [horizontalControls, updateScrollState, items.length, columns.length]);

  const scrollTable = useCallback((direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollBy({
      left: direction === "right" ? node.clientWidth * 0.75 : node.clientWidth * -0.75,
      behavior: "smooth",
    });
  }, []);

  const showControls = horizontalControls && (scrollState.canScrollLeft || scrollState.canScrollRight);
  const stickyRightOffset = showControls ? "right-16" : "right-0";

  function stickyColumnClass(sticky: DataTableColumn<TItem>["sticky"], selected: boolean, isHeader: boolean) {
    if (sticky === "left") {
      return cn(
        "sticky left-0",
        isHeader ? "z-30 bg-muted" : cn("z-10", selected ? "bg-primary/10" : "bg-background group-hover:bg-muted"),
      );
    }
    if (sticky === "right") {
      return cn(
        "sticky",
        stickyRightOffset,
        isHeader
          ? "z-30 bg-muted shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.18)]"
          : cn(
              "z-20 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]",
              selected ? "bg-primary/10" : "bg-background group-hover:bg-muted",
            ),
      );
    }
    return undefined;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-background", className)}>
      {showControls ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-12 bg-linear-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-12 bg-linear-to-l from-background to-transparent" />
        </>
      ) : null}
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead
            className={cn(
              "bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground",
              stickyHeader ? "sticky top-0 z-20 shadow-sm" : undefined,
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    compact ? "px-3 py-2" : "px-4 py-3",
                    "font-medium",
                    stickyColumnClass(column.sticky, false, true),
                    column.className,
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
              {showControls ? (
                <th
                  className={cn(
                    compact ? "px-2 py-2" : "px-3 py-3",
                    "sticky right-0 z-30 w-px bg-muted text-right font-medium",
                  )}
                >
                  <span className="sr-only">Row scroll controls</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const selected = isRowSelected?.(item) === true;
              return (
              <tr
                key={getRowKey(item)}
                aria-selected={selected}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "group border-t",
                  onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined,
                  selected ? "bg-primary/10" : undefined,
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      compact ? "px-3 py-2" : "px-4 py-3",
                      "align-top",
                      stickyColumnClass(column.sticky, selected, false),
                      column.className,
                      column.cellClassName,
                    )}
                  >
                    <div className={column.truncate ? "max-w-56 truncate" : undefined}>
                      {column.cell(item)}
                    </div>
                  </td>
                ))}
                {showControls ? (
                  <td
                    className={cn(
                      compact ? "px-2 py-2" : "px-3 py-3",
                      "sticky right-0 z-30 w-px align-top",
                      selected ? "bg-primary/10" : "bg-background group-hover:bg-muted",
                    )}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex overflow-hidden rounded-full border bg-white shadow-sm">
                      <button
                        type="button"
                        aria-label="Scroll row left"
                        disabled={!scrollState.canScrollLeft}
                        onClick={() => scrollTable("left")}
                        className="flex h-7 w-7 items-center justify-center text-navy transition hover:bg-steel-100 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        type="button"
                        aria-label="Scroll row right"
                        disabled={!scrollState.canScrollRight}
                        onClick={() => scrollTable("right")}
                        className="flex h-7 w-7 items-center justify-center text-navy transition hover:bg-steel-100 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
