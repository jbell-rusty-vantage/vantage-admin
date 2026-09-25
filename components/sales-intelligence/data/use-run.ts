"use client";
/** Analysis run reads (extracted from the legacy evidence chain in UI1-QUAR; same query keys). */
import {useQuery} from '@tanstack/react-query';
import {readSalesIntelligence} from '@/lib/api/salesIntelligence';
import {analysisEvidenceSchema} from '@/lib/api/salesIntelligenceAnalysis';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';

/** One evidence-snapshot page per run, shared by the per-assertion steps and the run-level list. */
export function useRunEvidence(runId:string,cursor:string|null=null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence',runId,cursor],
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence${cursor?`?cursor=${cursor}`:''}`,analysisEvidenceSchema,signal),retry:false});
}
