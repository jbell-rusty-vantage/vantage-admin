"use client";
/**
 * UI1-LIVE: the list rule of UI-0 §2.5 (UX18). A list (Needs Attention, All Outreach, Closed, Numbers, Messages)
 * never reorders under the reader. The live topic refetches the list into the query cache as usual; this hook keeps
 * the page the reader is looking at until they press `Show`:
 *
 * - same order and count (or the same snapshot): the new data is shown at once, so card contents update in place;
 * - a different order or count: the old data stays, `pending` is true and `apply()` shows the new one
 *   (the `Updated list available · Show` pill);
 * - a new `key` (a filter, sort or view change) always shows the new data.
 *
 * Usage (desk): `const list = useAttentionList(params); const refresh = useListRefresh(list.data, { key: requestString,
 * shape: attentionListShape });` then render `refresh.shown` and `{refresh.pending && <UpdatedListPill onShow={refresh.apply}/>}`.
 */
import { useCallback, useState } from "react";

export type ListShape = { snapshotId: string | null; totalItems: number | null; keys: readonly string[] };

/**
 * Pure: does `next` change the order or the count the reader sees? The same non-null snapshot id never does
 * (paging within one snapshot only appends). Otherwise the `subject_key` sequence and `total_items` decide.
 */
export function listChanged(prev: ListShape, next: ListShape): boolean {
  if (prev.snapshotId !== null && prev.snapshotId === next.snapshotId) return false;
  if (prev.totalItems !== next.totalItems) return true;
  if (prev.keys.length !== next.keys.length) return true;
  return prev.keys.some((key, index) => key !== next.keys[index]);
}

type AttentionLikePage = { data: { snapshot_id: string | null; total_items: number | null; items: readonly { subject_key: string }[] } };

/** The shape of an attention infinite query's data (`useAttentionList(...).data`). */
export function attentionListShape(data: { pages: readonly AttentionLikePage[] }): ListShape {
  const first = data.pages[0]?.data;
  return {
    snapshotId: first?.snapshot_id ?? null,
    totalItems: first?.total_items ?? null,
    keys: data.pages.flatMap((page) => page.data.items.map((item) => item.subject_key)),
  };
}

export function useListRefresh<T>(data: T, { key, shape }: { key: string; shape: (data: T) => ListShape }) {
  const [accepted, setAccepted] = useState<{ key: string; data: T }>({ key, data });
  let current = accepted;
  // Adjust during render (React's documented pattern for state derived from props): a new key, or a change that
  // keeps the order and count, is taken at once. Guarded, so it settles after one extra render.
  if (accepted.key !== key || (accepted.data !== data && !listChanged(shape(accepted.data), shape(data)))) {
    current = { key, data };
    setAccepted(current);
  }
  const apply = useCallback(() => setAccepted({ key, data }), [key, data]);
  return { shown: current.data, pending: current.data !== data, apply };
}
