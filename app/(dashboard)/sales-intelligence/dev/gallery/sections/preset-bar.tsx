"use client";

import { useState } from "react";
import type { PriorityCounts } from "@/lib/api/salesIntelligence";
import { PresetBar, type PresetValue, type PresetView } from "@/components/sales-intelligence/desk/preset-bar";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-PRESET gallery samples. Counts copied from the contract fixtures (the page can't read the workspace).
// Sample labels are dev-only gallery text (not Owner-facing copy).

/** S5c/attention__all-outreach.json `data.priority_counts` (as_of 2026-09-24T18:39:02.909Z). */
export const S5C_COUNTS: PriorityCounts = {
  "0": { attention: 1, active: 1, closed: 0 },
  "1": { attention: 7, active: 7, closed: 0 },
  "3": { attention: 1, active: 1, closed: 0 },
  "7": { attention: 1, active: 1, closed: 1 },
  "8": { attention: 0, active: 0, closed: 1 },
  not_set: { attention: 41, active: 41, closed: 6 },
  no_lead: { attention: 2, active: 2, closed: 0 },
};

/** S7/attention__default.json `data.priority_counts` (as_of 2026-09-24T20:32:56.744Z; the same header on every S7 attention file). */
export const S7_COUNTS: PriorityCounts = {
  "0": { attention: 2, active: 2, closed: 0 },
  "1": { attention: 8, active: 7, closed: 1 },
  "3": { attention: 1, active: 1, closed: 0 },
  "4": { attention: 1, active: 1, closed: 0 },
  "5": { attention: 1, active: 1, closed: 2 },
  "7": { attention: 1, active: 1, closed: 1 },
  "8": { attention: 0, active: 0, closed: 1 },
  "9": { attention: 1, active: 1, closed: 0 },
  not_set: { attention: 57, active: 57, closed: 7 },
  no_lead: { attention: 3, active: 3, closed: 0 },
};

type PresetSample = { id: string; label: string; source: string; view: PresetView; counts: PriorityCounts | undefined; value: PresetValue };

export const PRESET_SAMPLES: PresetSample[] = [
  { id: "all", label: "All · Needs Attention (attention counts)", source: "S7/attention__default.json", view: "attention", counts: S7_COUNTS, value: { priority: [], attachment: null } },
  { id: "new", label: "New · All Outreach (active counts)", source: "S7/attention__all-outreach-preset-new.json", view: "all_outreach", counts: S7_COUNTS, value: { priority: ["0", "not_set"], attachment: null } },
  { id: "quoted", label: "Quoted · Needs Attention", source: "S7/attention__attention-preset-quoted.json", view: "attention", counts: S7_COUNTS, value: { priority: ["1"], attachment: null } },
  { id: "other", label: "Other · Closed (closed counts)", source: "S7/attention__closed-preset-other.json", view: "closed", counts: S7_COUNTS, value: { priority: ["3", "4", "7", "8", "9"], attachment: null } },
  { id: "custom", label: "Custom (1 + 7) · All Outreach", source: "S5c/attention__all-outreach.json", view: "all_outreach", counts: S5C_COUNTS, value: { priority: ["1", "7"], attachment: null } },
  { id: "has-lead", label: "Has a Lead + New · Overview (active counts)", source: "S5c/attention__all-outreach.json", view: "overview", counts: S5C_COUNTS, value: { priority: ["0", "not_set"], attachment: "lead" } },
  { id: "no-lead", label: "No Lead: presets and multi-select disabled", source: "S7/attention__all-outreach-no-lead.json", view: "all_outreach", counts: S7_COUNTS, value: { priority: [], attachment: "none" } },
  { id: "flag-off", label: "No priority_counts (ATTENTION_V2 off): no counts", source: "priority_counts absent", view: "attention", counts: undefined, value: { priority: ["1"], attachment: null } },
];

function LiveSample({ sample }: { sample: PresetSample }) {
  const [value, setValue] = useState(sample.value);
  return <PresetBar counts={sample.counts} view={sample.view} value={value} onChange={setValue} />;
}

export function PresetBarSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="presets" title={g.sections.presets}>
      <p className="si-gallery__note">
        Every sample is interactive (local state only). Counts are the fixture&apos;s `priority_counts` column for the view: attention on Needs Attention, active on All Outreach and the Overview, closed on Closed.
      </p>
      {PRESET_SAMPLES.map((sample) => (
        <div key={sample.id} data-preset-sample={sample.id}>
          <Sample label={sample.label} copyKey={sample.source} wide>
            <LiveSample sample={sample} />
          </Sample>
        </div>
      ))}
      <Subhead>Skeleton</Subhead>
      <div data-preset-sample="skeleton">
        <Sample label="PresetBar.Skeleton" copyKey="PresetBar.Skeleton" wide>
          <PresetBar.Skeleton />
        </Sample>
      </div>
      <Subhead>390 px</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-preset-sample="phone">
        <LiveSample sample={PRESET_SAMPLES[1]} />
      </div>
    </GallerySection>
  );
}
