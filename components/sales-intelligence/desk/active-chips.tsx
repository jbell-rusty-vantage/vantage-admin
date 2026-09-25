"use client";
/**
 * UI1-DESK (final spec §7.1, Owner correction D): the active filters as removable chips above the list, with
 * `Clear filters`. Built by the rail's `activeFilterChips`, so a filter in a collapsed region still shows. Each
 * remove button is a 44 px target named `Remove filter: {label}`.
 */
import { X } from "lucide-react";
import type { FilterChip } from "../rail";
import { copy } from "../sales-intelligence-copy";

export function ActiveChips({ chips, onClearAll }: { chips: readonly FilterChip[]; onClearAll: () => void }) {
  if (!chips.length) return null;
  const d = copy.ui1.desk;
  return (
    <div className="si-desk__chips" role="group" aria-label={d.activeFilters}>
      <ul className="si-desk__chiplist">
        {chips.map((chip) => (
          <li key={chip.key} className="si-badge si-badge--blue si-desk__chip" data-chip={chip.key}>
            <span>{chip.label}</span>
            <button type="button" className="si-desk__chipremove" aria-label={d.rail.chip.remove(chip.label)} onClick={chip.remove}>
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="si-btn si-btn--link si-desk__clear" onClick={onClearAll}>
        {d.clearFilters}
      </button>
    </div>
  );
}
