"use client";
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {readSalesIntelligence,SalesIntelligenceError} from '@/lib/api/salesIntelligence';
import {analysisRunsSchema,analysisSchema,runStatusText,type AnalysisFinding} from '@/lib/api/salesIntelligenceAnalysis';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {Button} from './atoms/button';
import {Badge} from './atoms/badge';
import { copy } from "./sales-intelligence-copy";
import {evidenceChainCopy as chain} from './evidence-chain-copy';
import {formatDateTime,label} from './lib/format';
import {AnalysisCommand,type AnalysisAction} from './analysis-command';
import {EvidenceChain,RunEvidenceList} from './evidence-chain';
import { TooltipCard } from "./atoms/tooltip-card";

const SUMMARY_FIELDS=['customer_wanted','money_and_dates','outcome','commitments','discrepancies'] as const;
/** Same selection, one panel over. Keeps the Owner inside this Number. */
function panelHref(params:URLSearchParams,values:Record<string,string>) {
 const next=new URLSearchParams(params.toString());
 for(const [key,value] of Object.entries(values))next.set(key,value);
 return `/sales-intelligence?${next.toString()}`;
}
function summaryText(value:unknown) {
 return typeof value==='string'&&value.trim()?value:copy.fields.unknown;
}
function Json({value}:{value:unknown}) {
 return <details className="si-chain__disclose"><summary>{chain.run.showJson}</summary>
 <div className="si-chain__panel"><pre className="si-chain__json">{JSON.stringify(value,null,2)}</pre></div></details>;
}
export function AnalysisPanel({numberId,selectedRun,onSelect}:{numberId:string;selectedRun:string|null;onSelect:(id:string)=>void}) {
 const params=useSearchParams();
 const [cursor,setCursor]=useState<string|null>(null),[historyCursor,setHistoryCursor]=useState<string|null>(null);
 const [command,setCommand]=useState<{action:AnalysisAction;finding?:AnalysisFinding;focus?:AnalysisFinding}|null>(null);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-runs',numberId,cursor],queryFn:({signal})=>readSalesIntelligence(`analysis-runs?contact_number_id=${numberId}${cursor?`&cursor=${cursor}`:''}`,analysisRunsSchema,signal),retry:false});
 const runId=selectedRun??list.data?.data.items[0]?.id;
 const detail=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-run',runId,historyCursor],enabled:!!runId,queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}${historyCursor?`?history_cursor=${historyCursor}`:''}`,analysisSchema,signal),retry:false});
 const run=detail.data?.data;
 const gone=detail.error instanceof SalesIntelligenceError&&detail.error.status===404;
 const activityHref=panelHref(params,{panel:'activity'});
 const workHref=()=>run?.outreach?panelHref(params,{panel:'work',outreach:run.outreach.id}):null;
 return <section className="si-local-stack" aria-label={copy.panel.analysisTitle}><h3>{copy.panel.analysisTitle}</h3>
 {list.isPending&&<p role="status">{chain.run.loading}</p>}
 {list.error&&<p role="alert">{copy.errors.analysisFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.data&&!list.data.data.items.length&&<p>{chain.run.none}</p>}
 <div className="si-local-filters" role="group" aria-label={chain.run.pickerLabel}>{list.data?.data.items.map(item=><Button key={item.id} aria-pressed={item.id===runId} onClick={()=>onSelect(item.id)}>{formatDateTime(item.created_at)} · {label(item.mode)} · {label(item.status)}</Button>)}</div>
 <div className="si-local-filters">{cursor&&<Button onClick={()=>setCursor(null)}>{chain.run.newest}</Button>}{list.data?.data.next_cursor&&<Button onClick={()=>setCursor(list.data!.data.next_cursor)}>{chain.run.older}</Button>}</div>
 {gone&&<p className="si-local-notice">{chain.run.gone}</p>}
 {detail.error&&!gone&&<p role="alert">{chain.run.detailFailed} <Button variant="link" onClick={()=>void detail.refetch()}>{copy.actions.retry}</Button></p>}
 {run&&<>
 <p><Badge tone={run.current?'blue':'neutral'}>{run.current?chain.run.current:chain.run.earlier}</Badge> {runStatusText(run.status)}</p>
 {run.current&&<p className="si-text--subtle">{copy.panel.originalIsCurrent}</p>}
 {run.processing_reason&&<p className="si-chain__meta">{label(run.processing_reason)}</p>}
 {/* A completed analysis is only as useful as what it may change. Say so before the Owner reads the findings. */}
 {run.conversation_id&&run.status==='completed'&&<p className={run.outreach?'si-text--subtle':'si-local-notice'}>{run.outreach?copy.panel.leadActionableRun:copy.panel.numberOnlyRun}</p>}

 <section className="si-chain-summary" aria-label={copy.panel.originalModelSummary}>
  <TooltipCard title={copy.panel.originalModelSummary} guideTopic="summary" label={<h4>{copy.panel.originalModelSummary}</h4>}>{copy.panel.originalModelTip}</TooltipCard>
  {run.status!=='completed'&&<p>{chain.run.notFinishedYet}</p>}
  {run.status==='completed'&&!run.output&&<p>{chain.run.noOutput}</p>}
  {run.output&&<>
   <p className="si-chain-summary__overview">{run.output.summary.overview}</p>
   <dl className="si-chain-summary__fields">{SUMMARY_FIELDS.map(field=><div key={field}><dt>{label(field)}</dt><dd>{summaryText(run.output!.summary[field])}</dd></div>)}</dl>
   <div className="si-chain-card__actions"><Button disabled={!run.editable} onClick={()=>setCommand({action:'confirm_run'})}>{copy.panel.confirmAnalysis}</Button></div>
   <p className="si-chain__meta">{copy.commandExplain.confirm_analysis}</p>
  </>}
 </section>

 {run.output?.next_step_suggestion&&<section className="si-chain-summary" aria-label={chain.run.nextStep}>
  <h4>{chain.run.nextStep}</h4>
  <p>{run.output.next_step_suggestion.description}</p>
  {typeof run.output.next_step_suggestion.rationale==='string'&&<p className="si-chain__meta">{chain.run.nextStepWhy(run.output.next_step_suggestion.rationale)}</p>}
  <p className="si-chain__meta">{copy.panel.suggestionNote}</p>
  <div className="si-chain-card__actions"><Button disabled={!run.editable||!run.outreach} onClick={()=>setCommand({action:'apply_suggestion'})}>{copy.panel.apply}</Button></div>
  <p className="si-chain__meta">{copy.commandExplain.apply_suggestion}</p>
  {!run.outreach&&<p className="si-chain__meta">{copy.panel.noOutreachOnNumber}</p>}
 </section>}

 <section className="si-local-stack" aria-label={chain.chain.title}>
  <h4>{chain.chain.title}</h4>
  <p className="si-chain__meta">{chain.chain.intro} {chain.chain.openAlways}</p>
  {!run.findings.length&&<p>{chain.chain.claimsNone}</p>}
  <ol className="si-local-stack" aria-label={chain.chain.listLabel}>{run.findings.map((finding,order)=><li key={finding.id}>
   <EvidenceChain run={run} finding={finding} position={order+1} total={run.findings.length}
    activityHref={activityHref} workHref={workHref}
    onAction={action=>setCommand({action,finding})}
    onLookAgain={()=>setCommand({action:run.original_evidence_available?'original_evidence':'current_context',focus:finding})}/>
  </li>)}</ol>
 </section>

 <section className="si-chain-rerun" aria-label={chain.rerun.title}>
  <h4 className="si-chain-rerun__title">{chain.rerun.title}</h4>
  <p>{chain.rerun.intro}</p>
  <p className="si-chain__meta">{chain.rerun.queued}</p>
  <div className="si-chain-rerun__modes">
   <div className="si-chain-rerun__mode">
    <h5>{chain.rerun.keptTitle}</h5>
    <p className="si-chain-rerun__note">{chain.rerun.keptNote}</p>
    {!run.original_evidence_available&&<p className="si-chain-rerun__note">{chain.rerun.keptUnavailable} {copy.panel.originalUnavailable}.</p>}
    <Button disabled={!run.output||!run.original_evidence_available} onClick={()=>setCommand({action:'original_evidence'})}>{copy.panel.reanalyzeOriginal}</Button>
   </div>
   <div className="si-chain-rerun__mode">
    <h5>{chain.rerun.freshTitle}</h5>
    <p className="si-chain-rerun__note">{chain.rerun.freshNote}</p>
    <Button disabled={!run.output} onClick={()=>setCommand({action:'current_context'})}>{copy.panel.reanalyzeCurrent}</Button>
   </div>
  </div>
  {!run.output&&<p className="si-chain__meta">{chain.rerun.needsOutput}</p>}
  <h5 className="si-chain__title">{chain.rerun.requests}</h5>
  {!run.reanalysis_requests.length&&<p className="si-chain__meta">{chain.rerun.requestsNone}</p>}
  <ul className="si-chain__body">{run.reanalysis_requests.map(request=><li key={request.id} className="si-chain__meta">
   {chain.rerun.requestLine(label(request.mode),formatDateTime(request.created_at),label(request.status))}
   {request.reason?` · ${request.reason}`:''}
   {request.focus_finding_id?` · ${chain.rerun.scopedTo(run.findings.find(f=>f.id===request.focus_finding_id)?.assertion.claim??label(request.focus_finding_id))}`:''}
  </li>)}</ul>
 </section>

 <details className="si-chain__disclose"><summary>{chain.run.instructions}</summary><div className="si-chain__panel">
  {!run.instructions.length&&<p>{chain.run.instructionsNone}</p>}
  <ul className="si-chain__snaps">{run.instructions.map(instruction=><li key={instruction.id} className="si-chain__snap">
   <span className="si-chain__snap__head"><strong>{label(instruction.field)}</strong>
   <Badge tone={instruction.assessment==='cannot_determine'?'amber':'neutral'}>{instruction.assessment==='cannot_determine'?copy.panel.cannotDetermine:label(instruction.assessment)}</Badge></span>
   <span className="si-chain__meta">{instruction.actor} · {formatDateTime(instruction.happened_at)}</span>
   <span>{instruction.reason}</span>
   {instruction.stale&&<span className="si-chain__meta">{chain.run.instructionStale}</span>}
   <Json value={{before:instruction.prior,after:instruction.current}}/>
  </li>)}</ul>
  {!run.instructions_complete&&<p className="si-chain__meta">{chain.run.instructionsTruncated}</p>}
 </div></details>

 <RunEvidenceList key={run.id} runId={run.id}/>

 <details className="si-chain__disclose"><summary>{chain.run.historyTitle}</summary><div className="si-chain__panel">
  <p className="si-chain__meta">{chain.run.historyNote}</p>
  {!run.history.length&&<p>{chain.run.historyNone}</p>}
  <ul className="si-chain__snaps">{run.history.map(event=><li key={event.id} className="si-chain__snap">
   <span className="si-chain__snap__head"><strong>{label(event.event)}</strong></span>
   <span className="si-chain__meta">{event.actor} · {formatDateTime(event.happened_at)}</span>
   <Json value={{before:event.prior,after:event.current}}/>
  </li>)}</ul>
  <div className="si-chain__pages">{historyCursor&&<Button size="sm" onClick={()=>setHistoryCursor(null)}>{chain.run.historyNewest}</Button>}
  {run.history_next_cursor&&<Button size="sm" onClick={()=>setHistoryCursor(run.history_next_cursor)}>{chain.run.historyOlder}</Button>}</div>
 </div></details>

 {command&&<AnalysisCommand key={`${run.id}:${command.action}:${command.finding?.id??command.focus?.id??''}`} run={run} finding={command.finding} focus={command.focus} action={command.action} onClose={()=>setCommand(null)}/>}
 </>}
 </section>;
}
