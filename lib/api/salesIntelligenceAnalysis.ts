import { z } from 'zod';
import { evidenceChainCopy as chainCopy } from '@/components/sales-intelligence/evidence-chain-copy';
import { copy } from '@/components/sales-intelligence/sales-intelligence-copy';

const runSummary = z.object({ id:z.string(), revision:z.number(), status:z.string(), mode:z.string(), conversation_id:z.string().nullable(), created_at:z.string(), completed_at:z.string().nullable() });
export const analysisRunsSchema=z.object({data:z.object({items:z.array(runSummary),next_cursor:z.string().nullable()})});
const assertion=z.object({key:z.string(),kind:z.string(),claim:z.string()}).catchall(z.json());
export const analysisSchema=z.object({data:runSummary.extend({current:z.boolean(),editable:z.boolean(),output_digest:z.string().nullable(),suggestion_output_digest:z.string().nullable(),
 model_version:z.string(),prompt_version:z.string(),processing_reason:z.string().nullable(),original_evidence_available:z.boolean(),contact_number_id:z.string(),
 reanalysis_requests:z.array(z.object({id:z.string(),run_id:z.string(),mode:z.string(),status:z.string(),reason:z.string().nullable(),created_at:z.string(),focus_finding_id:z.string().nullable().optional()})).default([]),
 outreach:z.object({id:z.string(),revision:z.number(),state:z.string()}).nullable(),
 output:z.object({summary:z.object({overview:z.string()}).catchall(z.json()),next_step_suggestion:z.object({description:z.string(),action_kind:z.string()}).catchall(z.json()).nullable()}).catchall(z.json()).nullable(),
 findings:z.array(z.object({id:z.string(),revision:z.number(),assertion,review_state:z.string(),validation:z.json(),effects:z.array(z.object({id:z.string(),kind:z.string(),status:z.string(),reason:z.string().nullable(),target_id:z.string().nullable(),applied_at:z.string()}))})),
 actions:z.array(z.object({id:z.string(),revision:z.number(),kind:z.string(),description:z.string(),due_at:z.string().nullable(),responsible_agent_id:z.string().nullable(),status:z.string(),origin:z.string()})),
 instructions:z.array(z.object({id:z.string(),instruction_id:z.string(),revision:z.number(),finding_id:z.string().nullable(),field:z.string(),prior:z.json(),current:z.json(),actor:z.string(),happened_at:z.string(),assessment:z.string(),reason:z.string(),finding_ids:z.array(z.string()),stale:z.boolean()})),instructions_complete:z.boolean(),
 history:z.array(z.object({id:z.string(),event:z.string(),actor:z.string(),happened_at:z.string(),prior:z.json(),current:z.json()})),history_next_cursor:z.string().nullable().default(null)})});
export const analysisEvidenceSchema=z.object({data:z.object({items:z.array(z.object({id:z.string(),tool:z.string().nullable(),digest:z.string().nullable(),retrieved_at:z.string().nullable(),unavailable:z.boolean(),completeness:z.string().nullable().optional()})),next_cursor:z.string().nullable()})});
export const analysisEvidenceContentSchema=z.object({data:z.object({id:z.string(),unavailable:z.boolean(),reason:z.string().optional(),purged_at:z.string().nullable().optional(),as_of:z.string().nullable().optional(),complete:z.boolean().optional(),content:z.string().nullable(),next_cursor:z.string().nullable()})});
export type Analysis=z.infer<typeof analysisSchema>['data'];
export type AnalysisFinding=Analysis['findings'][number];
export type AnalysisEffect=AnalysisFinding['effects'][number];
export type AnalysisAssertion=AnalysisFinding['assertion'];

/* ── Evidence chain derivations ──
 * Plain-English readings of stored run values. These never upgrade an unchecked
 * state into a pass and never invent a value the run does not carry. */
export type ChainTone='neutral'|'blue'|'green'|'amber'|'red';
export type ChainReadout={label:string;text:string;tone:ChainTone};
export type ChainVerdict={text:string;tone:ChainTone;important:boolean};

const record=(value:unknown):Record<string,unknown>=>(value&&typeof value==='object'&&!Array.isArray(value))?value as Record<string,unknown>:{};
const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value:null;

export type FindingValidation={schema_ok:boolean;source_snapshots_valid:boolean;locator_status:string;entailment_check:string};
/** Absent or unreadable validation reads as "not checked", never as a pass. */
export function findingValidation(value:unknown):FindingValidation {
 const row=record(value);
 return {schema_ok:row.schema_ok===true,source_snapshots_valid:row.source_snapshots_valid===true,
  locator_status:text(row.locator_status)??'not_run',entailment_check:text(row.entailment_check)??'not_run'};
}
const locatorText:Record<string,string>={...chainCopy.claim.locator};
const supportText:Record<string,string>={...chainCopy.claim.support};
export function validationReadouts(value:unknown):ChainReadout[] {
 const v=findingValidation(value);
 const locatorKnown=v.locator_status in locatorText&&v.locator_status!=='unknown';
 const supportKnown=v.entailment_check in supportText&&v.entailment_check!=='unknown';
 return [
  {label:chainCopy.claim.checksLabel.schema,text:v.schema_ok?chainCopy.claim.schemaPass:chainCopy.claim.schemaFail,tone:v.schema_ok?'green':'red'},
  {label:chainCopy.claim.checksLabel.snapshots,text:v.source_snapshots_valid?chainCopy.claim.snapshotsPass:chainCopy.claim.snapshotsFail,tone:v.source_snapshots_valid?'green':'red'},
  {label:chainCopy.claim.checksLabel.locator,text:locatorKnown?locatorText[v.locator_status]:chainCopy.claim.locator.unknown,
   tone:v.locator_status==='located'?'green':v.locator_status==='unlocated'?'red':'amber'},
  {label:chainCopy.claim.checksLabel.support,text:supportKnown?supportText[v.entailment_check]:chainCopy.claim.support.unknown,
   tone:v.entailment_check==='pass'?'green':v.entailment_check==='fail'?'red':'amber'},
 ];
}
/** One-glance verdict. A deferred check is never reported as verified. */
export function validationVerdict(value:unknown):ChainVerdict {
 const rows=validationReadouts(value);
 if(rows.some(r=>r.tone==='red'))return {text:chainCopy.claim.headline.problem,tone:'red',important:true};
 if(rows.some(r=>r.tone==='amber'))return {text:chainCopy.claim.headline.unchecked,tone:'amber',important:false};
 return {text:chainCopy.claim.headline.checked,tone:'green',important:false};
}
const effectStatusText:Record<string,string>={...chainCopy.effect.status};
/** Blocked and needs-review outcomes are the most important thing on the screen. */
export function effectVerdict(status:string,reason?:string|null):ChainVerdict {
 const known=status in effectStatusText&&status!=='unknown';
 const blocked=status.startsWith('blocked_')||status==='needs_review';
 const base=known?effectStatusText[status]:chainCopy.effect.status.unknown;
 const suffix=reason?` ${chainCopy.effect.reason(reason)}`:'';
 return {text:`${base}${suffix}`,tone:blocked?'red':status==='applied'?'green':status==='stale'?'amber':'neutral',important:blocked||status==='stale'};
}
export function effectKindLabel(kind:string):string {
 const known=chainCopy.effect.kind as Record<string,string|undefined>;
 return known[kind]??kind.replaceAll('_',' ');
}
export function reviewVerdict(state:string):ChainVerdict {
 if(state==='confirmed')return {text:copy.panel.confirmedByYou,tone:'green',important:false};
 if(state==='corrected')return {text:copy.panel.correctedByYou,tone:'blue',important:true};
 if(state==='retracted')return {text:chainCopy.decision.retracted,tone:'red',important:true};
 return {text:chainCopy.decision.unreviewed,tone:'neutral',important:false};
}
export function runStatusText(status:string):string {
 const known=chainCopy.run.status as Record<string,string|undefined>;
 return known[status]??chainCopy.run.status.unknown;
}

export type ChainEvidenceRef={source:'transcript'|'vantage_record'|'other';snapshot_id:string|null;conversation_id:string|null;
 transcript_version:string|null;segment_count:number;quote:string|null;record_type:string|null;record_id:string|null;field_paths:string[]};
/** Reads the assertion's recorded references defensively; server drift must not blank the chain. */
export function assertionEvidence(value:unknown):ChainEvidenceRef[] {
 const refs=record(value).evidence;
 if(!Array.isArray(refs))return [];
 return refs.map(raw=>{
  const row=record(raw),source=text(row.source);
  return {source:source==='transcript'?'transcript':source==='vantage_record'?'vantage_record':'other',
   snapshot_id:text(row.snapshot_id),conversation_id:text(row.conversation_id),transcript_version:text(row.transcript_version),
   segment_count:Array.isArray(row.segment_ids)?row.segment_ids.length:0,quote:text(row.quote),
   record_type:text(row.record_type),record_id:text(row.record_id),
   field_paths:Array.isArray(row.field_paths)?row.field_paths.filter((p):p is string=>typeof p==='string'):[]} satisfies ChainEvidenceRef;
 });
}
export function citedSnapshotIds(value:unknown):string[] {
 return [...new Set(assertionEvidence(value).map(ref=>ref.snapshot_id).filter((id):id is string=>!!id))];
}
export type AssertionFacts={basis:string|null;actor:string|null;actionStatus:string|null;clarity:string|null;confidence:string|null};
export function assertionFacts(value:unknown):AssertionFacts {
 const row=record(value),confidence=row.confidence;
 return {basis:text(row.basis),actor:text(row.actor),actionStatus:text(row.action_status),clarity:text(row.clarity),
  confidence:typeof confidence==='number'&&Number.isFinite(confidence)?String(confidence):null};
}

export type ReanalysisMode='original_evidence'|'current_context';
/**
 * Body for POST analysis-runs/:id/reanalyze. `expected_revision` always fences the run,
 * never a finding: the server compares it against the source run. `focus_finding_id` is
 * sent only when the Owner opened the flow from one assertion, and is additive — the flow
 * behaves the same if the server ignores it.
 */
export function reanalysisBody(input:{runId:string;runRevision:number;mode:ReanalysisMode;ownerCorrectionIds:string[];reason:string;focusFindingId?:string|null}):Record<string,unknown> {
 return {command:'reanalyze',expected_revision:input.runRevision,mode:input.mode,source_run_id:input.runId,
  owner_correction_ids:input.ownerCorrectionIds,reason:input.reason,...(input.focusFindingId?{focus_finding_id:input.focusFindingId}:{})};
}
/** Reanalysis requests the Owner asked for against one assertion, when the server identifies one. */
export function requestsForFinding(requests:Analysis['reanalysis_requests'],findingId:string):Analysis['reanalysis_requests'] {
 return requests.filter(request=>request.focus_finding_id===findingId);
}
export function requestsForRun(requests:Analysis['reanalysis_requests']):Analysis['reanalysis_requests'] {
 return requests.filter(request=>!request.focus_finding_id);
}
