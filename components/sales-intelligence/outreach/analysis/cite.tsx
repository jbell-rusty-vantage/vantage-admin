"use client";
/**
 * UI1-TOP + UI1-ANALYSIS-WIRE: `View evidence ({n})` for the sections whose citations are refs into another read
 * (Situation, Scores, the next-step strip, Move details; final spec §11.6). It is UI1-FIND's `EvidenceToggle`: the
 * same button and the same inline block as a finding's evidence. The first open reads the cited evidence (the
 * assessment version's `GET assessments/:id/evidence`, or the run's presentation) in its own region and prints each
 * ref in its §11.6 shape through `EvidenceList`; a ref with no served item prints the unavailable sentence.
 */
import type { EvidenceRef } from "@/lib/api/salesIntelligenceAssessment";
import { useAssessmentEvidence } from "../../data/use-assessment";
import { useRunPresentation } from "../../data/use-run";
import { Region } from "../../primitives";
import { EvidenceInlineSkeleton, EvidenceList, EvidenceToggle, resolveEvidenceRefs, type EvidenceView } from "./evidence-inline";

/** What a citation points at: an assessment version's evidence, or a run presentation's evidence. `ids` are the refs' ids. */
export type EvidenceTarget =
  | { source: "assessment"; artifactId: string; ids: string[]; label: string }
  | { source: "run"; runId: string; ids: string[]; label: string };

export const refIds = (refs: readonly Pick<EvidenceRef, "id">[]) => [...new Set(refs.map((ref) => ref.id))];

/** The cited items in ref order; an id the read doesn't serve becomes an unavailable line (never dropped silently). */
const cited = (ids: readonly string[], items: readonly EvidenceView[]) => resolveEvidenceRefs(ids.map((id) => ({ id, kind: "unknown" })), items);

function AssessmentEvidence({ artifactId, ids }: { artifactId: string; ids: string[] }) {
  const { evidence, data } = useAssessmentEvidence(artifactId);
  return <EvidenceList items={cited(ids, evidence.items as EvidenceView[])} asOf={data.as_of ?? ""} />;
}
function RunEvidence({ runId, ids }: { runId: string; ids: string[] }) {
  const { presentation, data } = useRunPresentation(runId);
  return <EvidenceList items={cited(ids, presentation.evidence.items as EvidenceView[])} asOf={data.as_of ?? ""} />;
}

/**
 * `View evidence ({n})`, or `No evidence cited` when nothing is cited or the owner of the evidence is unknown
 * (`target: null`, for example the Lead-only table). `shouldCite` (the server's `evidence_missing`) prints
 * `This score should cite evidence and does not.` instead of the plain empty sentence.
 */
export function ViewEvidence({ target, shouldCite = false }: { target: EvidenceTarget | null; shouldCite?: boolean }) {
  return (
    <EvidenceToggle count={target?.ids.length ?? 0} shouldCite={shouldCite} context={target?.label} inline className="si-cite">
      {() =>
        target && (
          <Region name="analysis-evidence" skeleton={<EvidenceInlineSkeleton />}>
            {target.source === "assessment" ? <AssessmentEvidence artifactId={target.artifactId} ids={target.ids} /> : <RunEvidence runId={target.runId} ids={target.ids} />}
          </Region>
        )
      }
    </EvidenceToggle>
  );
}
