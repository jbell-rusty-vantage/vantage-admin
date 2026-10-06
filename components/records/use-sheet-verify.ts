"use client";
/**
 * Verify in Master Sheet (doc 03 "Prove the record is in the sheet"): a select mode over the visible cards (25 cap),
 * one `POST sheet-sync/contains` per entity model, verdicts kept per record for the session so the chips persist
 * while the Owner scrolls, and the results drawer state. The caller resolves each id to its entity model.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { checkSheetContains, type SheetContainsEntityModel, type SheetContainsItem, type SheetContainsResult } from "@/lib/api/admin";
import { SHEET_CONTAINS_MAX_IDS } from "@/lib/sheet-contains";
import { RECORDS_COPY } from "./records-copy";

export type SheetVerify = {
  selectMode: boolean;
  enterSelect: () => void;
  exitSelect: () => void;
  toggleSelectMode: () => void;
  selectedIds: ReadonlySet<string>;
  toggleSelected: (id: string, checked: boolean) => void;
  selectAll: (ids: readonly string[]) => void;
  clearSelection: () => void;
  verdicts: ReadonlyMap<string, SheetContainsItem>;
  verify: () => void;
  isVerifying: boolean;
  result: SheetContainsResult | null;
  error: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function useSheetVerify({ modelFor }: { modelFor: (id: string) => SheetContainsEntityModel }): SheetVerify {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [verdicts, setVerdicts] = useState<ReadonlyMap<string, SheetContainsItem>>(() => new Map());
  const [result, setResult] = useState<SheetContainsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Plain functions: the React Compiler memoizes them.
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= SHEET_CONTAINS_MAX_IDS && !next.has(id)) return current;
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };
  const selectAll = (ids: readonly string[]) => setSelectedIds(new Set(ids.slice(0, SHEET_CONTAINS_MAX_IDS)));
  const clearSelection = () => setSelectedIds(new Set());
  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const enterSelect = () => setSelectMode(true);

  const mutation = useMutation({
    mutationFn: async (): Promise<SheetContainsResult> => {
      const byModel = new Map<SheetContainsEntityModel, string[]>();
      for (const id of selectedIds) {
        const model = modelFor(id);
        byModel.set(model, [...(byModel.get(model) ?? []), id]);
      }
      const results = await Promise.all([...byModel].map(([entity_model, ids]) => checkSheetContains({ entity_model, ids })));
      return {
        entity_model: results[0]?.entity_model ?? "FormLead",
        checked_at: results[0]?.checked_at ?? new Date().toISOString(),
        items: results.flatMap((entry) => entry.items),
      };
    },
    onSuccess: (next) => {
      setError(null);
      setResult(next);
      setOpen(true);
      setVerdicts((current) => {
        const merged = new Map(current);
        for (const item of next.items) merged.set(item.id, item);
        return merged;
      });
    },
    onError: (failure) => {
      setResult(null);
      setError(failure instanceof Error ? failure.message : RECORDS_COPY.sheetCheckFailed);
      setOpen(true);
    },
  });

  return {
    selectMode,
    enterSelect,
    exitSelect,
    toggleSelectMode: () => (selectMode ? exitSelect() : enterSelect()),
    selectedIds,
    toggleSelected,
    selectAll,
    clearSelection,
    verdicts,
    verify: () => mutation.mutate(),
    isVerifying: mutation.isPending,
    result,
    error,
    open,
    setOpen,
  };
}
