"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { parseDeskUrl } from "@/components/sales-intelligence/data/url-state";
import {
  FilterRail, FilterSheet, activeFilterChips, closedRegions, customRange, outreachRegions, windowFrom, CLOSED_WINDOWS, RECEIVED_WINDOWS,
  type RailPatch, type RailRegion, type RailValue,
} from "@/components/sales-intelligence/rail";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-RAIL gallery samples: both rails with selections and their chips, and the 390 px sheet trigger.
// Sample labels are dev-only gallery text (not Owner-facing copy).

/** S7/attention__default.json `as_of`: every window starts from it. */
export const RAIL_AS_OF = "2026-09-24T20:32:56.744Z";
/** The assigned agents on S7/attention__default.json + attention__all-outreach.json (`outreach.assignment.agent`). */
export const RAIL_REPS = [{ id: "6ab588e5d96cfb93201a2fd4", name: "Dana Reyes" }, { id: "6ab588e5d96cfb93201a2fd5", name: "Marcus Bell" }];

const outreachStart = (): RailValue => {
  const received = windowFrom(RAIL_AS_OF, RECEIVED_WINDOWS["7d"]);
  return parseDeskUrl(new URLSearchParams(`band=1&band=2&needs_review=true&state=open&agent_id=${RAIL_REPS[0].id}&newer_call=true&ti_min=50&received_from=${received ?? ""}&move_date_within=30`));
};
const closedStart = (): RailValue => {
  const range = customRange("2026-09-01", "2026-09-20");
  return parseDeskUrl(new URLSearchParams(`outcome=booked&outcome=granot_booked&unassigned=true&closed_from=${range.from}&closed_to=${range.to}`));
};
const closedWindowStart = (): RailValue => parseDeskUrl(new URLSearchParams(`outcome=crm_dead&closed_from=${windowFrom(RAIL_AS_OF, CLOSED_WINDOWS["30d"])}`));

function ChipRow({ value, regions, onChange }: { value: RailValue; regions: readonly RailRegion[]; onChange: (patch: RailPatch) => void }) {
  const chips = activeFilterChips(value, regions, RAIL_REPS, { asOf: RAIL_AS_OF, onChange });
  if (!chips.length) return <p className="si-gallery__note">No filters.</p>;
  return (
    <ul className="si-gallery__railchips" data-rail-chips>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button type="button" className="si-badge si-badge--neutral si-chip si-gallery__railchip" onClick={chip.remove} aria-label={copy.ui1.desk.rail.chip.remove(chip.label)}>
            <span>{chip.label}</span>
            <X size={12} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function LiveRail({ start, regions, sheet }: { start: () => RailValue; regions: readonly RailRegion[]; sheet?: boolean }) {
  const [value, setValue] = useState(start);
  const onChange = (patch: RailPatch) => setValue((current) => ({ ...current, ...patch }));
  return (
    <div className="si-gallery__body">
      <ChipRow value={value} regions={regions} onChange={onChange} />
      {sheet
        ? <FilterSheet regions={regions} value={value} onChange={onChange} reps={RAIL_REPS} asOf={RAIL_AS_OF} alwaysShown />
        : <FilterRail regions={regions} value={value} onChange={onChange} reps={RAIL_REPS} asOf={RAIL_AS_OF} responsive={false} className="si-gallery__rail" />}
    </div>
  );
}

export function RailSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="rail" title={g.sections.rail}>
      <p className="si-gallery__note">
        Interactive (local state). The chips above each rail come from `activeFilterChips` and stay visible when a region is collapsed; each region remembers open/closed per desk in localStorage (`si.rail.view.region`).
      </p>
      <div className="si-gallery__grid">
        <div data-rail-sample="outreach">
          <Sample label="Needs Attention / All Outreach: Band · Status · Rep · Analysis · Time" copyKey="outreachRegions('attention')">
            <LiveRail start={outreachStart} regions={outreachRegions("attention")} />
          </Sample>
        </div>
        <div data-rail-sample="closed">
          <Sample label="Closed: Outcome · Rep · Closed (custom range)" copyKey="closedRegions()">
            <LiveRail start={closedStart} regions={closedRegions()} />
          </Sample>
        </div>
        <div data-rail-sample="closed-window">
          <Sample label="Closed: a 30-day window" copyKey="closedRegions()">
            <LiveRail start={closedWindowStart} regions={closedRegions()} />
          </Sample>
        </div>
      </div>
      <Subhead>Skeleton</Subhead>
      <div data-rail-sample="skeleton">
        <Sample label="FilterRail.Skeleton" copyKey="FilterRail.Skeleton">
          <FilterRail.Skeleton />
        </Sample>
      </div>
      <Subhead>390 px: Filters sheet</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-rail-sample="phone">
        <LiveRail start={outreachStart} regions={outreachRegions("all_outreach")} sheet />
      </div>
    </GallerySection>
  );
}
