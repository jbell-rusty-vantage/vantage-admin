"use client";
import { PhaseCOverviewView } from "@/components/sales-intelligence/overview/phase-c-overview";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { ACTIVITY_C, ACTIVITY_MISSING_C, OUTCOMES_C, TEAM_C, TEAM_PENDING_C } from "./overview-fixtures-c";
import { GallerySection, Sample, Subhead } from "./section";

export function OverviewSection() {
  return <GallerySection id="overview" title={copy.ui1.gallery.sections.overview}>
    <p className="si-gallery__note">Phase C: workload drill links retain the snapshot; activity and outcomes use independent periods.</p>
    <Subhead>Ready · roster includes zero work and inactive with work</Subhead>
    <Sample copyKey="synthetic from contracts/C/team.json, activity.json, outcomes.json" wide><PhaseCOverviewView team={TEAM_C} activity={ACTIVITY_C} outcomes={OUTCOMES_C} /></Sample>
    <Subhead>Pending projection · missing capture</Subhead>
    <Sample copyKey="contracts/C/activity-missing.json + pending team" wide><PhaseCOverviewView team={TEAM_PENDING_C} activity={ACTIVITY_MISSING_C} outcomes={OUTCOMES_C} /></Sample>
    <Subhead>390 px · rep workload cards</Subhead>
    <div className="si-gallery__frame" data-frame="390" data-overview-sample="phone"><PhaseCOverviewView team={TEAM_C} activity={ACTIVITY_C} outcomes={OUTCOMES_C} /></div>
  </GallerySection>;
}
