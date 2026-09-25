"use client";
/** Move assessment reads (extracted from the legacy assessment section in UI1-QUAR; same query keys). */
import { useQuery } from "@tanstack/react-query";
import { readAssessment, readOutreachAssessment } from "@/lib/api/salesIntelligenceAssessment";
import { salesIntelligenceKeys } from "@/lib/query/salesIntelligence";

export const assessmentQueryKey = (outreachId: string | null) => [...salesIntelligenceKeys.all, "assessment", outreachId] as const;
export function useOutreachAssessment(outreachId: string | null) {
  return useQuery({ queryKey: assessmentQueryKey(outreachId), enabled: !!outreachId, retry: false,
    queryFn: ({ signal }) => readOutreachAssessment(outreachId!, signal) });
}
export function useAssessmentArtifact(artifactId: string | null) {
  return useQuery({ queryKey: [...salesIntelligenceKeys.all, "assessment-artifact", artifactId], enabled: !!artifactId, retry: false,
    queryFn: ({ signal }) => readAssessment(artifactId!, signal) });
}
