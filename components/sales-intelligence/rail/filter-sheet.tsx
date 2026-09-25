"use client";
/**
 * UI1-RAIL: the narrow-layout (390 px) filter sheet. A `Filters ({n})` button with `sliders-horizontal` opens the
 * same regions in a full-screen modal sheet (the kept `atoms/filter-sheet.tsx`, a native `<dialog>`): Escape
 * closes it and focus returns to the button.
 */
import { SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { FilterSheet as SheetDialog } from "../atoms/filter-sheet";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { activeFilterChips } from "./chips";
import { RailRegions, type FilterRailProps } from "./filter-rail";

/** Shown below 768 px only; `alwaysShown` shows the button at any width (the gallery's 390 px sample). */
export function FilterSheet({ className, initialOpen = false, alwaysShown = false, ...props }: FilterRailProps & { initialOpen?: boolean; alwaysShown?: boolean }) {
  const r = copy.ui1.desk.rail;
  const [open, setOpen] = useState(initialOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const n = activeFilterChips(props.value, props.regions, props.reps, { asOf: props.asOf }).length;
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  return (
    <div className={cx("si-railsheet", alwaysShown && "is-static", className)}>
      <button ref={buttonRef} type="button" className="si-btn si-btn--secondary si-btn--md si-hit si-railsheet__trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <SlidersHorizontal size={16} aria-hidden />
        {r.filtersCount(n)}
      </button>
      <SheetDialog title={r.filters} open={open} onClose={close}>
        <RailRegions {...props} />
      </SheetDialog>
    </div>
  );
}
