"use client";
/** Analysis run reads (extracted from the legacy evidence chain in UI1-QUAR; same query keys). */
import {useQuery,useSuspenseQuery} from '@tanstack/react-query';
import {readSalesIntelligence} from '@/lib/api/salesIntelligence';
import {analysisEvidenceSchema,analysisSchema} from '@/lib/api/salesIntelligenceAnalysis';
import {readRunOutput,readRunPresentation} from '@/lib/api/salesIntelligenceAssessment';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {siKeys} from './query-keys';

/** One evidence-snapshot page per run, shared by the per-assertion steps and the run-level list. `_legacy/` imports it. */
export function useRunEvidence(runId:string,cursor:string|null=null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence',runId,cursor],
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence${cursor?`?cursor=${cursor}`:''}`,analysisEvidenceSchema,signal),retry:false});
}

/* ── UI1-DATA: suspense reads for the analysis kit. ── */

/** The newest run's presentation (`data.outreach.newest_run_id`): Situation discrepancies, next step, findings, changes, full-output picker. */
export function useRunPresentation(runId:string) {
 const query=useSuspenseQuery({queryKey:siKeys.analysisPresentation(runId),queryFn:({signal})=>readRunPresentation(runId,signal),retry:false});
 return {...query,presentation:query.data.data};
}
/** Run detail (Advanced: reanalysis requests, `editable` for Confirm analysis, original evidence availability). Owner only. */
export function readRun(runId:string,signal?:AbortSignal) {
 return readSalesIntelligence(`analysis-runs/${encodeURIComponent(runId)}`,analysisSchema,signal);
}
export function useRun(runId:string) {
 const query=useSuspenseQuery({queryKey:siKeys.analysisRun(runId),queryFn:({signal})=>readRun(runId,signal),retry:false});
 return {...query,run:query.data.data};
}
/** One retained output of a run (Full output §11.8). Owner only. */
export function useRunOutput(runId:string,outputId:string) {
 const query=useSuspenseQuery({queryKey:siKeys.analysisOutput(runId,outputId),queryFn:({signal})=>readRunOutput(runId,outputId,signal),retry:false});
 return {...query,output:query.data.data};
}
