"use client";
/**
 * Infinite load for a card stack (doc 03: 50 per page): a sentinel below the list observed against the dashboard's
 * scroll root. The first screen keeps filling until `minVisible` cards are on it; after that the sentinel drives it.
 */
import { useEffect, useRef, type RefObject } from "react";
import { DASHBOARD_MAIN_ID } from "@/components/layout/dashboard-ids";

export const RECORDS_MIN_VISIBLE_BEFORE_SCROLL = 25;

function scrollRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById(DASHBOARD_MAIN_ID);
}

export function useInfiniteScroll({
  canFetchMore,
  fetchMore,
  visibleCount,
  minVisible = RECORDS_MIN_VISIBLE_BEFORE_SCROLL,
}: {
  canFetchMore: boolean;
  fetchMore: () => void;
  visibleCount: number;
  minVisible?: number;
}): RefObject<HTMLDivElement | null> {
  // The sentinel reads the latest fetcher through refs (written in an effect, never during render).
  const fetchMoreRef = useRef<() => void>(() => undefined);
  const canFetchRef = useRef(false);
  useEffect(() => {
    fetchMoreRef.current = fetchMore;
    canFetchRef.current = canFetchMore;
  });

  useEffect(() => {
    if (canFetchMore && visibleCount < minVisible) fetchMoreRef.current();
  }, [canFetchMore, visibleCount, minVisible]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canFetchMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && canFetchRef.current) fetchMoreRef.current();
      },
      { root: scrollRoot(), rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canFetchMore, visibleCount]);

  return sentinelRef;
}
