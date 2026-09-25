"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { conversationsSchema, outreachReadSchema } from "@/lib/api/salesIntelligence";
import { evidenceReadSchema, outreachAssessmentReadSchema, runPresentationReadSchema } from "@/lib/api/salesIntelligenceAssessment";
import { analysisSchema, currentFindingsSchema } from "@/lib/api/salesIntelligenceAnalysis";
import { siKeys } from "@/components/sales-intelligence/data/query-keys";
import {
  Advanced, AnalysisTab, AnalysisTabSkeleton, MoveDetails, MoveDetailsSkeleton, NextStep, NextStepSkeleton, Scores, ScoresSkeleton, Situation, SituationSkeleton,
} from "@/components/sales-intelligence/outreach/analysis";
import { Disclosure } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { ANALYSIS_FIXTURES } from "./analysis-fixtures";
import { ANALYSIS_TAB_FIXTURES as TAB } from "./analysis-tab-fixtures";
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

/**
 * UI1-ANALYSIS-WIRE: a gallery-only query cache primed with every read the joined tab makes for the s-findings record
 * (detail, assessment, findings, the newest run's presentation and detail, the Number's conversations, the assessment
 * evidence). Nothing goes stale, so the tab renders from the fixtures without a request; opening a transcript still reads.
 */
export function analysisTabClient(): { client: QueryClient; outreachId: string } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnWindowFocus: false } } });
  const detail = outreachReadSchema.parse(TAB.outreach.body);
  const id = detail.data.outreach.id;
  const runId = detail.data.outreach.newest_run_id!;
  const numberId = detail.data.outreach.primary_number!.id;
  const assessmentRead = outreachAssessmentReadSchema.parse(TAB.assessment.body);
  client.setQueryData(siKeys.outreach(id), detail);
  client.setQueryData(siKeys.assessment(id), assessmentRead);
  client.setQueryData(siKeys.findings(id, false), currentFindingsSchema.parse(TAB.findings.body));
  client.setQueryData(siKeys.analysisPresentation(runId), runPresentationReadSchema.parse(TAB.presentation.body));
  client.setQueryData(siKeys.analysisRun(runId), analysisSchema.parse(TAB.run.body));
  client.setQueryData(siKeys.conversations(numberId), { pages: [conversationsSchema.parse(TAB.conversations.body)], pageParams: [null] });
  const artifactId = assessmentRead.data.current?.artifact_id;
  if (artifactId) client.setQueryData(siKeys.assessmentEvidence(artifactId), evidenceReadSchema.parse(TAB.assessmentEvidence.body));
  return { client, outreachId: id };
}

/** The joined Analysis tab (TOP + MOVE + FIND + CONV) from the fixtures, wide and in the 390 px frame (prefixed ids). */
function JoinedTab() {
  const [{ client, outreachId }] = useState(analysisTabClient);
  return (
    <QueryClientProvider client={client}>
      <Sample label="AnalysisTab (Owner) · s-findings" copyKey={Object.values(TAB).map((entry) => entry.source).join(" · ")} wide>
        <AnalysisTab outreachId={outreachId} role="owner" cardLines={false} idPrefix="gallery-tab-" />
      </Sample>
      <div className="si-gallery__frame" data-frame="390">
        <AnalysisTab outreachId={outreachId} role="owner" cardLines={false} idPrefix="gallery-tab-390-" />
      </div>
    </QueryClientProvider>
  );
}

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

        <Subhead>{a.frame.sections.findings} · {a.frame.sections.conversations}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="joined-tab">
          <JoinedTab />
        </div>

        <Subhead>{copy.ui1.prim.loading}</Subhead>
        <div className="si-gallery__body" data-analysis-sample="tab-skeleton">
          <Sample label="AnalysisTab.Skeleton" copyKey="AnalysisTabSkeleton" wide><AnalysisTabSkeleton /></Sample>
        </div>
      </div>
    </GallerySection>
  );
}
