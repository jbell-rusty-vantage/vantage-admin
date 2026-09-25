"use client";
/** Move assessment reads (extracted from the legacy assessment section in UI1-QUAR; same query keys). */
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { readAssessment, readAssessmentEvidence, readAssessmentOutput, readOutreachAssessment } from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";
import { siKeys } from "./query-keys";

// `_legacy/` imports these three; they keep their names, keys and non-suspense behaviour.
export const assessmentQueryKey = (outreachId: string | null) => [...salesIntelligenceKeys.all, "assessment", outreachId] as const;
export function useOutreachAssessment(outreachId: string | null) {
  return useQuery({ queryKey: assessmentQueryKey(outreachId), enabled: !!outreachId, retry: false,
    queryFn: ({ signal }) => readOutreachAssessment(outreachId!, signal) });
}
export function useAssessmentArtifact(artifactId: string | null) {
  return useQuery({ queryKey: [...salesIntelligenceKeys.all, "assessment-artifact", artifactId], enabled: !!artifactId, retry: false,
    queryFn: ({ signal }) => readAssessment(artifactId!, signal) });
}

/* ── UI1-DATA: suspense reads for the analysis kit (final §11.2–11.4, §11.6, §11.8). ── */

/** Scores, `From the calls`, move table (or the Lead-only table) and the version picker: `GET /outreach/:id/assessment`. */
export function useAssessment(outreachId: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.assessment(outreachId), queryFn: ({ signal }) => readOutreachAssessment(outreachId, signal), retry: false });
  return { ...query, assessment: query.data.data, asOf: query.data.as_of ?? null };
}
/** One stored version picked in the version picker. */
export function useAssessmentVersion(artifactId: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.assessmentArtifact(artifactId), queryFn: ({ signal }) => readAssessment(artifactId, signal), retry: false });
  return { ...query, section: query.data.data };
}
export function useAssessmentEvidence(artifactId: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.assessmentEvidence(artifactId), queryFn: ({ signal }) => readAssessmentEvidence(artifactId, signal), retry: false });
  return { ...query, evidence: query.data.data };
}
export function useAssessmentOutput(artifactId: string) {
  const query = useSuspenseQuery({ queryKey: siKeys.assessmentOutput(artifactId), queryFn: ({ signal }) => readAssessmentOutput(artifactId, signal), retry: false });
  return { ...query, output: query.data.data };
}
