"use client";
/**
 * UI1-RAIL (UI-1 §3.3, final spec §7.3): the filter rail. Sticky under the top bar, capped to the viewport and
 * scrolling inside itself. Each region is a `Disclosure`, open by default, its open/closed state remembered per
 * desk in localStorage (`si.rail.{view}.{region}`). Selected values also show as chips above the list
 * (`activeFilterChips`), so a collapsed region never hides a filter.
 */
import { Disclosure } from "../primitives";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { RegionBody } from "./region-controls";
import type { RailPatch, RailRegion, RailRep, RailValue } from "./regions";

export type FilterRailProps = {
  regions: readonly RailRegion[];
  value: RailValue;
  onChange: (patch: RailPatch) => void;
  reps: readonly RailRep[];
  /** The list response's `as_of`: windows (`last 7d`) start from it. */
  asOf: string | null | undefined;
  className?: string;
};

/**
 * The regions alone (shared by the rail and the narrow-layout sheet). UI2-SCOPE (UI-2 §3): a rep's rail has no Rep
 * region; a foot note says the list is the rep's own records (the server forces the scope).
 */
export function RailRegions({ regions, value, onChange, reps, asOf }: FilterRailProps) {
  const rep = useIsRep();
  return (
    <div className="si-rail__regions">
      {regions.map((region) => (
        <Disclosure key={region.id} id={region.storageId} title={region.title} defaultOpen remember="local" className="si-rail__region">
          <div data-rail-region={region.id}>
            <RegionBody region={region} value={value} onChange={onChange} reps={reps} asOf={asOf} />
          </div>
        </Disclosure>
      ))}
      {rep && <p className="si-rail__repnote si-text--sm si-text--subtle" data-rail-note="rep">{copy.ui2.scope.noRailRep}</p>}
    </div>
  );
}

/** `responsive` (default) hides the rail below 768 px, where the desk shows `FilterSheet` instead. */
export function FilterRail({ className, responsive = true, ...props }: FilterRailProps & { responsive?: boolean }) {
  return (
    <aside className={cx("si-rail", responsive && "is-responsive", className)} aria-label={copy.ui1.desk.rail.railLabel}>
      <RailRegions {...props} />
    </aside>
  );
}

function FilterRailSkeleton({ regions = 5 }: { regions?: number }) {
  return (
    <aside className="si-rail is-skeleton" aria-hidden>
      {Array.from({ length: regions }, (_, i) => (
        <div key={i} className="si-rail__skregion">
          <span className="si-skeleton si-skeleton--short" />
          <span className="si-skeleton si-skeleton--line" />
          <span className="si-skeleton si-skeleton--line" style={{ width: "58%" }} />
        </div>
      ))}
    </aside>
  );
}

FilterRail.Skeleton = FilterRailSkeleton;
