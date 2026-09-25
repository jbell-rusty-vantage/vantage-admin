"use client";

import { useState } from "react";
import type { Overview } from "@/lib/api/salesIntelligence";
import type { PresetValue } from "@/components/sales-intelligence/desk/preset-bar";
import { OverviewHeaderBody, OverviewSkeleton, OverviewView, type OverviewPeriodState } from "@/components/sales-intelligence/overview";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { OVERVIEW_CUSTOM, OVERVIEW_DEFAULT } from "./overview-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-OVERVIEW gallery samples (UI-1 §4). Sample labels are dev-only gallery text (not Owner-facing copy).

type OverviewSample = { id: string; label: string; source: string; data: Overview | null; period: OverviewPeriodState };

const customPeriod = (data: Overview): OverviewPeriodState => ({ period: "custom", from: data.periods.activity.from_day, to: data.periods.activity.to_day });
const noPeriod: OverviewPeriodState = { period: null, from: null, to: null };

export const OVERVIEW_SAMPLES: OverviewSample[] = [
  { id: "custom", label: "Four blocks · Custom period (Sep 21 – Sep 24)", source: "S9/overview__custom.json", data: OVERVIEW_CUSTOM, period: customPeriod(OVERVIEW_CUSTOM) },
  { id: "default", label: "Split default (Today · spend and outcomes: last 7 days) · an unpriced Lead · a mixed-rates source", source: "S9/overview__default.json", data: OVERVIEW_DEFAULT, period: noPeriod },
  { id: "flag-off", label: "OVERVIEW off: FEATURE_DISABLED → every number —, no rep activity", source: "S9/flag-off/overview__feature-off.json", data: null, period: noPeriod },
];

/** Local state only: the picker and the preset bar respond, the numbers stay the fixture's. */
function LiveOverview({ sample }: { sample: OverviewSample }) {
  const [period, setPeriod] = useState(sample.period);
  const [preset, setPreset] = useState<PresetValue>({ priority: sample.data?.filters.priority ?? [], attachment: null });
  return <OverviewView data={sample.data} period={period} preset={preset} onPeriod={setPeriod} onPreset={setPreset} />;
}

export function OverviewSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="overview" title={g.sections.overview}>
      <p className="si-gallery__note">
        Rendered from the S9 fixtures. Every number with a list behind it is a link carrying the preset; the reps table becomes stacked cards when the Overview is narrower than 600 px.
      </p>
      <Subhead>Split-default header</Subhead>
      <div data-overview-sample="header">
        <Sample label="Updated {as_of} · the period picker with the two default periods" copyKey="S9/overview__default.json · copy.ui1.overview.period.splitDefault" wide>
          <OverviewHeaderBody data={OVERVIEW_DEFAULT} period={noPeriod} onPeriod={() => {}} />
        </Sample>
      </div>
      {OVERVIEW_SAMPLES.map((sample) => (
        <div key={sample.id} data-overview-sample={sample.id}>
          <Subhead>{sample.label}</Subhead>
          <Sample copyKey={sample.source} wide>
            <LiveOverview sample={sample} />
          </Sample>
        </div>
      ))}
      <Subhead>Skeleton</Subhead>
      <div data-overview-sample="skeleton">
        <Sample label="OverviewSkeleton (each block's own shape)" copyKey="OverviewSkeleton" wide>
          <OverviewSkeleton />
        </Sample>
      </div>
      <Subhead>390 px (stacked reps)</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-overview-sample="phone">
        <LiveOverview sample={OVERVIEW_SAMPLES[0]} />
      </div>
    </GallerySection>
  );
}
