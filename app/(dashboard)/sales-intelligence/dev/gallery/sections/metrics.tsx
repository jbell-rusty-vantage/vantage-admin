"use client";

import type { DeskMetrics } from "@/lib/api/salesIntelligence";
import { MetricsStripView } from "@/components/sales-intelligence/desk/metrics-strip";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-DESK gallery samples. Values copied from the contract fixtures (the page can't read the workspace).
// Sample labels are dev-only gallery text (not Owner-facing copy).

/** S1/attention__all-outreach.json `data.metrics` (no booking in 7 days: `booked_7d_median_days` null). */
export const S1_METRICS: DeskMetrics = {
  as_of: "2026-09-23T21:46:37.661Z", leads_received_7d: 7, not_called_yet: 11, callbacks_overdue: 0, awaiting_assessment: 11, booked_7d: 0, booked_7d_median_days: null,
};
export const S1_AS_OF = "2026-09-23T21:46:37.661Z";
/** S6/attention__all-outreach.json `data.metrics` (with `median 5d`). */
export const S6_METRICS: DeskMetrics = {
  as_of: "2026-09-24T22:58:37.661Z", leads_received_7d: 53, not_called_yet: 30, callbacks_overdue: 5, awaiting_assessment: 33, booked_7d: 1, booked_7d_median_days: 5,
};
export const S6_AS_OF = "2026-09-24T22:58:37.661Z";

export const METRICS_SAMPLES = [
  { id: "s6", label: "Five tiles with median · S6/attention__all-outreach.json", metrics: S6_METRICS, asOf: S6_AS_OF },
  { id: "s1", label: "No booking in 7 days (no median) · S1/attention__all-outreach.json", metrics: S1_METRICS, asOf: S1_AS_OF },
  { id: "absent", label: "metrics absent · S2/flag-off/attention__all-outreach.json", metrics: null, asOf: "2026-09-23T21:45:28.863Z" },
] as const;

export function MetricsSection() {
  const g = copy.ui1.gallery;
  return (
    <GallerySection id="metrics" title={g.sections.metrics}>
      <p className="si-gallery__note">
        Each tile is a button: Leads received 7d → All Outreach + Lead received last 7d; Not called yet → Band 2; Callbacks overdue → Band 1; Awaiting assessment → Newer call since assessment; Booked 7d → Closed, preset All, outcome Booked, closed last 7d. The gallery doesn&apos;t navigate.
      </p>
      {METRICS_SAMPLES.map((sample) => (
        <div key={sample.id} data-metrics-sample={sample.id}>
          <Sample label={sample.label} copyKey="copy.ui1.desk.metrics" wide>
            <MetricsStripView metrics={sample.metrics} asOf={sample.asOf} onApply={() => {}} />
          </Sample>
        </div>
      ))}
      <Subhead>Skeleton</Subhead>
      <div data-metrics-sample="skeleton">
        <Sample label="MetricsStrip.Skeleton" copyKey="MetricsStrip.Skeleton" wide>
          <MetricsStripView.Skeleton />
        </Sample>
      </div>
      <Subhead>390 px</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-metrics-sample="phone">
        <MetricsStripView metrics={S6_METRICS} asOf={S6_AS_OF} onApply={() => {}} />
      </div>
    </GallerySection>
  );
}
