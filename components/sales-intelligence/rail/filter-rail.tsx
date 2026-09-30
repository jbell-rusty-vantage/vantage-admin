"use client";
/**
 * UI1-RAIL (UI-1 §3.3, final spec §7.3; 2026-09-29 cleanup): the filter sidebar, the desk's only filter surface.
 * Sticky under the top bar, capped to the viewport and scrolling inside itself. The whole sidebar opens and closes
 * (`useFilterSidebarOpen`, remembered in localStorage), and so does each section: a `Disclosure` whose open/closed
 * state is remembered per desk (`si.rail.{view}.{region}`) and whose title carries the number of active values.
 * Selected values also show as chips above the list, so neither a closed section nor a hidden sidebar hides a filter.
 */
import { PanelLeftClose } from "lucide-react";
import type { AttentionCapabilities, PriorityCounts } from "@/lib/api/salesIntelligence";
import { Disclosure, useRememberedOpen } from "../primitives";
import { useIsRep } from "../rep/viewer";
import { copy } from "../sales-intelligence-copy";
import { cx } from "../lib/format";
import { RegionBody } from "./region-controls";
import { regionActiveCount, type RailPatch, type RailRegion, type RailRep, type RailValue } from "./regions";

const r = copy.ui1.desk.rail;

export type FilterRailProps = {
  regions: readonly RailRegion[];
  value: RailValue;
  onChange: (patch: RailPatch) => void;
  reps: readonly RailRep[];
  /** The list response's `as_of`: windows (`last 7d`) start from it. */
  asOf: string | null | undefined;
  /** The list's advertised filter families (OI-A4); absent → those controls read `Not available yet`. */
  capabilities?: AttentionCapabilities | null;
  /** The current list's `priority_counts`, for the Granot Priority section. */
  priorityCounts?: PriorityCounts | null;
  className?: string;
};

/** The whole sidebar's open/closed choice, remembered for the viewer (open until they hide it). */
export function useFilterSidebarOpen() {
  return useRememberedOpen("si.rail.sidebar", true, "local");
}

/**
 * The sections alone (shared by the sidebar and the narrow-layout sheet). UI2-SCOPE (UI-2 §3): a rep's sidebar has no
 * Rep section; a foot note says the list is the rep's own records (the server forces the scope).
 */
export function RailRegions({ regions, value, onChange, reps, asOf, capabilities, priorityCounts }: FilterRailProps) {
  const rep = useIsRep();
  return (
    <div className="si-rail__regions">
      {regions.map((region) => {
        const active = regionActiveCount(region, value);
        return (
          <Disclosure key={region.id} id={region.storageId} title={region.title} defaultOpen={region.defaultOpen} remember="local" className="si-rail__region"
            badge={active > 0 ? <span className="si-rail__count" aria-label={`${active} selected`}>{active}</span> : null}>
            <div data-rail-region={region.id}>
              <RegionBody region={region} value={value} onChange={onChange} reps={reps} asOf={asOf} capabilities={capabilities} priorityCounts={priorityCounts} />
            </div>
          </Disclosure>
        );
      })}
      {rep && <p className="si-rail__repnote si-text--sm si-text--subtle" data-rail-note="rep">{copy.ui2.scope.noRailRep}</p>}
    </div>
  );
}

/**
 * `responsive` (default) hides the sidebar below 768 px, where the desk shows `FilterSheet` instead. With `onHide`
 * the header has the hide button; with `onClearAll` it has `Clear all` (disabled while nothing is selected).
 */
export function FilterRail({ className, responsive = true, id, onHide, onClearAll, filterCount = 0, ...props }: FilterRailProps & {
  responsive?: boolean; id?: string; onHide?: () => void; onClearAll?: () => void; filterCount?: number;
}) {
  return (
    <aside id={id} className={cx("si-rail", responsive && "is-responsive", className)} aria-label={r.railLabel}>
      {(onHide || onClearAll) && (
        <div className="si-rail__head">
          <span className="si-rail__title">{r.filters}</span>
          {onClearAll && <button type="button" className="si-btn si-btn--link si-rail__clear" disabled={filterCount === 0} onClick={onClearAll}>{r.clearAll}</button>}
          {onHide && (
            <button type="button" className="si-rail__hide si-hit" aria-label={r.hide} title={r.hide} onClick={onHide}>
              <PanelLeftClose size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
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
