"use client";

import { outreachReadSchema } from "@/lib/api/salesIntelligence";
import { outreachAssessmentReadSchema, runPresentationReadSchema } from "@/lib/api/salesIntelligenceAssessment";
import { analysisSchema } from "@/lib/api/salesIntelligenceAnalysis";
import {
  Advanced, AnalysisTabSkeleton, MoveDetails, MoveDetailsSkeleton, NextStep, NextStepSkeleton, Scores, ScoresSkeleton, Situation, SituationSkeleton,
} from "@/components/sales-intelligence/outreach/analysis";
import { Disclosure } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { ANALYSIS_FIXTURES } from "./analysis-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-TOP / UI1-MOVE: the analysis kit's top half and Move details, every state from the S3 fixtures. Labels are the
// fixture's state (dev only); the copy key column names the fixture file. UI1-FIND / UI1-CONV add their samples in
// their own `analysis-findings` section, right after this one.

const a = copy.ui1.analysis;
const noop = () => {};
const fx = (key: string) => ANALYSIS_FIXTURES[key]!;
const outreach = (key: string) => outreachReadSchema.parse(fx(key).body);
const assessment = (key: string) => outreachAssessmentReadSchema.parse(fx(key).body);
const presentation = (key: string) => runPresentationReadSchema.parse(fx(key).body).data;
const run = (key: string) => analysisSchema.parse(fx(key).body).data;

/** The Scores states the gate reviews: ready, pending, lead_only, not_applicable, stale. */
export const SCORE_SAMPLES = [
  { id: "ready", key: "assessReady" },
  { id: "pending", key: "assessPending" },
  { id: "lead_only", key: "assessLeadOnly" },
  { id: "not_applicable", key: "assessNotApplicable", priorityLabel: "CRM bad/unusable" },
  { id: "stale", key: "assessStale" },
] as const;

export function AnalysisSection() {
  const findings = outreach("outreachFindings");
  const spend = outreach("outreachSpendLegacy");
  const noAnalysis = outreach("outreachNoAnalysis");
  const run3 = presentation("presentationRun3");
  const open = presentation("presentationOpen");
  const engagement = assessment("assessEngagement").data.current!;
  return (
    <GallerySection id="analysis" title={copy.ui1.gallery.sections.analysis}>
      <div className="si-analysis" data-gallery="analysis">
        <Subhead>{a.frame.sections.situation}</Subhead>
        <div className="si-gallery__grid" data-analysis-sample="situation">
          <Sample label="newest analysis + disputed" copyKey={`${fx("outreachFindings").source} · ${fx("presentationRun3").source}`} wide>
            <Situation outreach={findings.data.outreach} asOf={findings.as_of} discrepancies={run3.summary_findings.story_discrepancies} />
          </Sample>
          <Sample label="lead cost (legacy price), no analysis" copyKey={fx("outreachSpendLegacy").source} wide>
            <Situation outreach={spend.data.outreach} asOf={spend.as_of} cardLines={false} />
          </Sample>
          <Sample label="one conversation" copyKey={fx("outreachNoAnalysis").source} wide>
            <Situation outreach={noAnalysis.data.outreach} asOf={noAnalysis.as_of} cardLines={false} />
          </Sample>
          <Sample label="skeleton" copyKey="Situation.Skeleton" wide><SituationSkeleton /></Sample>
        </div>

        <Subhead>{a.frame.sections.scores}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="scores">
          {SCORE_SAMPLES.map((sample) => {
            const body = assessment(sample.key);
            return (
              <Sample key={sample.id} label={sample.id} copyKey={fx(sample.key).source} wide>
                <div data-score-sample={sample.id}>
                  <Scores assessment={body.data} asOf={body.as_of ?? findings.as_of} priorityLabel={"priorityLabel" in sample ? sample.priorityLabel : null} />
                </div>
              </Sample>
            );
          })}
          <Sample label="skeleton" copyKey="Scores.Skeleton" wide><ScoresSkeleton /></Sample>
        </div>

        <Subhead>{a.frame.nextStep}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="next-step">
          <Sample label="recorded · applied suggestion · engagement" copyKey={`${fx("outreachFindings").source} · ${fx("presentationRun3").source} · ${fx("assessEngagement").source}`} wide>
            <NextStep outreach={findings.data.outreach} asOf={findings.as_of} suggestion={run3.summary_findings.suggested_next_step} engagement={engagement.engagement} artifactId={engagement.artifact_id} />
          </Sample>
          <Sample label="no next step · open suggestion with Apply · not assessed" copyKey={`${fx("outreachNoAnalysis").source} · ${fx("presentationOpen").source}`} wide>
            <NextStep outreach={noAnalysis.data.outreach} asOf={noAnalysis.as_of} suggestion={open.summary_findings.suggested_next_step} engagement={null} artifactId={null} onApply={noop} />
          </Sample>
          <Sample label="skeleton" copyKey="NextStep.Skeleton" wide><NextStepSkeleton /></Sample>
        </div>

        <Subhead>{a.frame.sections.move}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="move">
          <Sample label="conflict rows" copyKey={fx("assessReady").source} wide><MoveDetails assessment={assessment("assessReady").data} /></Sample>
          <Sample label="score conflict, inventory conflict" copyKey={fx("assessStale").source} wide><MoveDetails assessment={assessment("assessStale").data} /></Sample>
          <Sample label="Lead-only table (no assessment)" copyKey={fx("assessPending").source} wide><MoveDetails assessment={assessment("assessPending").data} /></Sample>
          <Sample label="empty (no Lead, no assessment)" copyKey={fx("assessNumberOnly").source} wide><MoveDetails assessment={assessment("assessNumberOnly").data} /></Sample>
          <Sample label="skeleton" copyKey="MoveDetails.Skeleton" wide><MoveDetailsSkeleton /></Sample>
        </div>

        <Subhead>{a.advanced.title}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="advanced">
          <Sample label="editable run, original evidence gone" copyKey={fx("runRun3").source} wide>
            <Disclosure id="gallery-analysis-advanced" title={a.advanced.title} defaultOpen>
              <Advanced run={run("runRun3")} asOf={findings.as_of} onCommand={noop} />
            </Disclosure>
          </Sample>
        </div>

        <Subhead>{copy.ui1.prim.loading}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="tab-skeleton">
          <Sample label="AnalysisTab.Skeleton" copyKey="AnalysisTabSkeleton" wide><AnalysisTabSkeleton /></Sample>
        </div>
      </div>
    </GallerySection>
  );
}
