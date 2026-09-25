"use client";
/**
 * UI1-RAIL: the narrow-layout (390 px) filter sheet. A `Filters ({n})` button with `sliders-horizontal` opens the
 * same regions in a modal sheet: Escape closes it and focus returns to the button.
 *
 * UI2-PHONE (UI-2 §7, A11): the sheet is the shared `Sheet` primitive as a **bottom sheet** below 768 px (a centred
 * dialog above), with 44 px rows, `Clear all` (clears every region this rail owns, as the desk's chip row does) and
 * `Show results` (closes the sheet; each change already applies to the list through the URL). The Owner gets the same
 * sheet on a phone; the desktop rail is unchanged.
 */
import { SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { Sheet } from "../primitives";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { activeFilterChips } from "./chips";
import { RailRegions, type FilterRailProps } from "./filter-rail";
import { clearAll } from "./regions";

const ph = copy.ui2.phone;

/** Shown below 768 px only; `alwaysShown` shows the button at any width (the gallery's 390 px sample). */
export function FilterSheet({ className, initialOpen = false, alwaysShown = false, ...props }: FilterRailProps & { initialOpen?: boolean; alwaysShown?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const n = activeFilterChips(props.value, props.regions, props.reps, { asOf: props.asOf }).length;
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const footer = (
    <>
      <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit" data-action="clear-all" disabled={n === 0} onClick={() => props.onChange(clearAll(props.regions))}>
        {ph.clearAll}
      </button>
      <button type="button" className="si-btn si-btn--primary si-btn--md si-hit" data-action="show-results" onClick={close}>
        {ph.showResults}
      </button>
    </>
  );
  return (
    <div className={cx("si-railsheet", alwaysShown && "is-static", className)}>
      <button ref={buttonRef} type="button" className="si-btn si-btn--secondary si-btn--md si-hit si-railsheet__trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <SlidersHorizontal size={16} aria-hidden />
        {n > 0 ? ph.filtersCount(n) : ph.filters}
      </button>
      <Sheet open={open} onClose={close} title={ph.filtersTitle} footer={footer} variant="bottom" className="si-railsheet__sheet" closeLabel={ph.close}>
        <RailRegions {...props} />
      </Sheet>
    </div>
  );
}
