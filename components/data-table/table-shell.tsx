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

function RowScrollControls({
  canScrollLeft,
  canScrollRight,
  onScroll,
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScroll: (direction: "left" | "right") => void;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-full border border-steel-200 bg-white/95 shadow-sm"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Scroll row left"
        disabled={!canScrollLeft}
        onClick={() => onScroll("left")}
        className="flex h-6 w-6 items-center justify-center text-navy transition hover:bg-steel-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div className="w-px bg-border" />
      <button
        type="button"
        aria-label="Scroll row right"
        disabled={!canScrollRight}
        onClick={() => onScroll("right")}
        className="flex h-6 w-6 items-center justify-center text-navy transition hover:bg-steel-100 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function LeadInfoScrollOverlay({
  canScrollLeft,
  canScrollRight,
  onScroll,
  fadeClassName,
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  onScroll: (direction: "left" | "right") => void;
  fadeClassName: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-full z-10 w-16 bg-linear-to-l to-transparent",
          fadeClassName,
        )}
      />
      <div className="absolute top-1/2 right-full z-20 mr-1.5 -translate-y-1/2 opacity-80 transition-opacity group-hover:opacity-100">
        <RowScrollControls
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          onScroll={onScroll}
        />
      </div>
    </>
  );
}

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
  getRowKey: (item: TItem, index: number) => string;
  onRowClick?: (item: TItem) => void;
  isRowSelected?: (item: TItem) => boolean;
  className?: string;
  stickyHeader?: boolean;
  compact?: boolean;
  horizontalControls?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickyRightRef = useRef<HTMLTableCellElement | null>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const [stickyRightWidth, setStickyRightWidth] = useState(0);
  const firstStickyRightIndex = columns.findIndex((column) => column.sticky === "right");
  const hasStickyRight = firstStickyRightIndex >= 0;

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

  useEffect(() => {
    const node = stickyRightRef.current;
    if (!node || !horizontalControls) {
      setStickyRightWidth(0);
      return;
    }

    const updateWidth = () => setStickyRightWidth(node.getBoundingClientRect().width);
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [horizontalControls, hasStickyRight, items.length, columns.length]);

  const scrollTable = useCallback(
    (direction: "left" | "right") => {
      const node = scrollRef.current;
      if (!node) {
        return;
      }

      const leadViewport = Math.max(160, node.clientWidth - stickyRightWidth);
      node.scrollBy({
        left: direction === "right" ? leadViewport * 0.7 : leadViewport * -0.7,
        behavior: "smooth",
      });
    },
    [stickyRightWidth],
  );

  const showControls = horizontalControls && (scrollState.canScrollLeft || scrollState.canScrollRight);

  function stickyColumnClass(sticky: DataTableColumn<TItem>["sticky"], selected: boolean, isHeader: boolean) {
    if (sticky === "left") {
      return cn(
        "sticky left-0",
        isHeader ? "z-30 bg-muted" : cn("z-10", selected ? "bg-primary/10" : "bg-background group-hover:bg-muted"),
      );
    }
    if (sticky === "right") {
      return cn(
        "sticky right-0",
        isHeader
          ? "z-30 bg-steel-100 shadow-[-12px_0_16px_-8px_rgba(15,23,42,0.22)]"
          : cn(
              "z-20 shadow-[-12px_0_16px_-8px_rgba(15,23,42,0.16)]",
              selected ? "bg-primary/15" : "bg-steel-100 group-hover:bg-steel-100",
            ),
      );
    }
    return undefined;
  }

  const overlayFade = (selected: boolean, isHeader: boolean) =>
    isHeader ? "from-muted" : selected ? "from-primary/15" : "from-background group-hover:from-muted";

  return (
    <div className={cn("relative isolate overflow-hidden rounded-lg border bg-background", className)}>
      {showControls ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-8 bg-linear-to-r from-background to-transparent" />
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
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  ref={index === firstStickyRightIndex ? stickyRightRef : undefined}
                  className={cn(
                    compact ? "px-3 py-2" : "px-4 py-3",
                    "font-medium",
                    index === firstStickyRightIndex ? "relative" : undefined,
                    stickyColumnClass(column.sticky, false, true),
                    column.className,
                    column.headerClassName,
                  )}
                >
                  {showControls && index === firstStickyRightIndex ? (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-y-0 right-full z-10 w-16 bg-linear-to-l to-transparent",
                        overlayFade(false, true),
                      )}
                    />
                  ) : null}
                  {column.header}
                </th>
              ))}
              {showControls && !hasStickyRight ? (
                <th className={cn(compact ? "py-2" : "py-3", "sticky right-0 z-30 w-0 max-w-0 bg-muted p-0")}>
                  <span className="sr-only">Row scroll controls</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const selected = isRowSelected?.(item) === true;
              return (
                <tr
                  key={getRowKey(item, index)}
                  aria-selected={selected}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "group border-t",
                    onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined,
                    selected ? "bg-primary/10" : undefined,
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={cn(
                        compact ? "px-3 py-2" : "px-4 py-3",
                        "align-top",
                        index === firstStickyRightIndex ? "relative" : undefined,
                        stickyColumnClass(column.sticky, selected, false),
                        column.className,
                        column.cellClassName,
                      )}
                    >
                      {showControls && index === firstStickyRightIndex ? (
                        <LeadInfoScrollOverlay
                          canScrollLeft={scrollState.canScrollLeft}
                          canScrollRight={scrollState.canScrollRight}
                          onScroll={scrollTable}
                          fadeClassName={overlayFade(selected, false)}
                        />
                      ) : null}
                      {column.truncate ? (
                        <div className="max-w-56 truncate">{column.cell(item)}</div>
                      ) : (
                        column.cell(item)
                      )}
                    </td>
                  ))}
                  {showControls && !hasStickyRight ? (
                    <td
                      className={cn(
                        compact ? "py-2" : "py-3",
                        "sticky right-0 z-20 w-0 max-w-0 overflow-visible p-0 align-middle",
                        selected ? "bg-transparent" : undefined,
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="relative h-full min-h-7 w-0">
                        <LeadInfoScrollOverlay
                          canScrollLeft={scrollState.canScrollLeft}
                          canScrollRight={scrollState.canScrollRight}
                          onScroll={scrollTable}
                          fadeClassName={overlayFade(selected, false)}
                        />
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
