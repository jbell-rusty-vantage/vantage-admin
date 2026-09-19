"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {readSalesIntelligence} from '@/lib/api/salesIntelligence';
import {analysisRunsSchema,analysisSchema,analysisEvidenceSchema,analysisEvidenceContentSchema} from '@/lib/api/salesIntelligenceAnalysis';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {Button} from './atoms/button';
import {Badge} from './atoms/badge';
import { copy } from "./sales-intelligence-copy";
import {formatDateTime,label} from './lib/format';
import {AnalysisCommand,type AnalysisAction} from './analysis-command';

function Evidence({runId}:{runId:string}) {
 const [cursor,setCursor]=useState<string|null>(null),[snapshot,setSnapshot]=useState<string|null>(null),[offset,setOffset]=useState<string|null>(null);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence',runId,cursor],queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence${cursor?`?cursor=${cursor}`:''}`,analysisEvidenceSchema,signal),retry:false});
 const content=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence-content',runId,snapshot,offset],enabled:!!snapshot,queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence/${snapshot}${offset?`?cursor=${offset}`:''}`,analysisEvidenceContentSchema,signal),retry:false});
 return <details><summary>{copy.panel.originalEvidence}</summary>{list.error&&<p role="alert">{copy.errors.evidenceFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.data?.data.items.map(item=><p key={item.id}><Button onClick={()=>{setSnapshot(item.id);setOffset(null);}}>{item.tool?label(item.tool):copy.panel.locatorProvided} · {formatDateTime(item.retrieved_at)}</Button>{item.unavailable?' · Unavailable':''}</p>)}
 {cursor&&<Button onClick={()=>setCursor(null)}>First evidence page</Button>}{list.data?.data.next_cursor&&<Button onClick={()=>setCursor(list.data!.data.next_cursor)}>Next evidence page</Button>}
 {content.error&&<p role="alert">Could not load this evidence. <Button onClick={()=>void content.refetch()}>Retry</Button></p>}
 {content.data?.data.unavailable?<p>Original evidence is unavailable. {content.data.data.purged_at?`Purged ${formatDateTime(content.data.data.purged_at)}.`:''} {label(content.data.data.reason??'')}</p>:content.data&&<><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:420,overflow:'auto'}}>{content.data.data.content}</pre>{offset&&<Button onClick={()=>setOffset(null)}>Start of evidence</Button>}{content.data.data.next_cursor&&<Button onClick={()=>setOffset(content.data!.data.next_cursor)}>Next evidence section</Button>}</>}
 </details>;
}
export function AnalysisPanel({numberId,selectedRun,onSelect}:{numberId:string;selectedRun:string|null;onSelect:(id:string)=>void}) {
 const [cursor,setCursor]=useState<string|null>(null),[command,setCommand]=useState<{action:AnalysisAction;findingId?:string}|null>(null);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-runs',numberId,cursor],queryFn:({signal})=>readSalesIntelligence(`analysis-runs?contact_number_id=${numberId}${cursor?`&cursor=${cursor}`:''}`,analysisRunsSchema,signal),retry:false});
 const [historyCursor,setHistoryCursor]=useState<string|null>(null);
 const runId=selectedRun??list.data?.data.items[0]?.id;
 const detail=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-run',runId,historyCursor],enabled:!!runId,queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}${historyCursor?`?history_cursor=${historyCursor}`:''}`,analysisSchema,signal),retry:false});
 const run=detail.data?.data;
 return <section className="si-local-stack" aria-label={copy.panel.analysisTitle}><h3>{copy.panel.analysisTitle}</h3>
 {list.isPending&&<p role="status">Loading analyses…</p>}{list.error&&<p role="alert">{copy.errors.analysisFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.data&&!list.data.data.items.length&&<p>No analysis runs are available.</p>}
 <div className="si-local-filters">{list.data?.data.items.map(item=><Button key={item.id} aria-pressed={item.id===runId} onClick={()=>onSelect(item.id)}>{formatDateTime(item.created_at)} · {label(item.mode)} · {label(item.status)}</Button>)}</div>
 {cursor&&<Button onClick={()=>setCursor(null)}>Newest analyses</Button>}{list.data?.data.next_cursor&&<Button onClick={()=>setCursor(list.data!.data.next_cursor)}>Older analyses</Button>}
 {detail.error&&<p role="alert">Could not load this analysis. <Button onClick={()=>void detail.refetch()}>Retry</Button></p>}
 {run&&<><p>{run.current?'Current analysis':'Earlier analysis'} · {label(run.status)}</p>
 {run.processing_reason&&<p>{label(run.processing_reason)}</p>}<h4>Original model summary</h4><p>{run.output?.summary.overview??'No completed output.'}</p>
 {run.output&&['customer_wanted','money_and_dates','outcome','commitments','discrepancies'].map(field=><p key={field}><strong>{label(field)}: </strong>{String(run.output!.summary[field]??'Unknown')}</p>)}
 <div className="si-local-filters"><Button disabled={!run.editable} onClick={()=>setCommand({action:'confirm_run'})}>{copy.panel.confirmAnalysis}</Button><Button disabled={!run.output||!run.original_evidence_available} onClick={()=>setCommand({action:'original_evidence'})}>{copy.panel.reanalyzeOriginal}</Button><Button disabled={!run.output} onClick={()=>setCommand({action:'current_context'})}>{copy.panel.reanalyzeCurrent}</Button></div>
 {!run.original_evidence_available&&<p>{copy.panel.originalUnavailable}.</p>}
 {run.reanalysis_requests.map(r=><p key={r.id}>{label(r.mode)} requested {formatDateTime(r.created_at)} · {label(r.status)}{r.reason?` · ${label(r.reason)}`:''}</p>)}
 {run.findings.map(f=><article key={f.id} className="si-local-stack"><h4>{label(f.assertion.kind)}</h4><p>{f.assertion.claim}</p><Badge>{f.review_state==='confirmed'?copy.panel.confirmedByYou:f.review_state==='corrected'?copy.panel.correctedByYou:label(f.review_state)}</Badge><p>Original model assertion · {label(String(f.assertion.basis??copy.fields.unknown))}</p><p>{copy.panel.locatorProvided}. {copy.panel.locatorNotChecked}.</p><details><summary>Assertion references</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(f.assertion.evidence,null,2)}</pre></details>
 <h5>Recorded effects</h5>{!f.effects.length&&<p>No effects recorded.</p>}{f.effects.map(e=><p key={e.id}>{label(e.kind)}: {label(e.status)}{e.reason?` · ${label(e.reason)}`:''} · {formatDateTime(e.applied_at)}</p>)}
 <div className="si-local-filters"><Button disabled={!run.editable} onClick={()=>setCommand({action:'confirm_finding',findingId:f.id})}>{copy.panel.confirm}</Button><Button disabled={!run.editable} onClick={()=>setCommand({action:'correct_finding',findingId:f.id})}>{copy.panel.correct}</Button><Button disabled={!run.editable} onClick={()=>setCommand({action:'retract_finding',findingId:f.id})}>{copy.panel.retract}</Button></div></article>)}
 {run.output?.next_step_suggestion&&<section><h4>Suggested next step</h4><p>{run.output.next_step_suggestion.description}</p><p>{copy.panel.suggestionNote}</p><Button disabled={!run.editable||!run.outreach} onClick={()=>setCommand({action:'apply_suggestion'})}>{copy.panel.apply}</Button></section>}
 <section><h4>Owner changes and AI assessments</h4>{!run.instructions.length&&<p>No Owner instructions are recorded.</p>}{run.instructions.map(i=><article key={i.id}><p>{label(i.field)} · {i.actor} · {formatDateTime(i.happened_at)}</p><Badge>{i.assessment==='cannot_determine'?copy.panel.cannotDetermine:label(i.assessment)}</Badge><p>{i.reason}{i.stale?' An assessment exists for an earlier instruction version.':''}</p><details><summary>Owner change</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({before:i.prior,after:i.current},null,2)}</pre></details></article>)}{!run.instructions_complete&&<p>Only the first 200 instructions are shown.</p>}</section>
 <Evidence key={run.id} runId={run.id}/><details><summary>Immutable review history</summary>{run.history.map(h=><article key={h.id}><p>{label(h.event)} · {h.actor} · {formatDateTime(h.happened_at)}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({before:h.prior,after:h.current},null,2)}</pre></article>)}{historyCursor&&<Button onClick={()=>setHistoryCursor(null)}>Newest review events</Button>}{run.history_next_cursor&&<Button onClick={()=>setHistoryCursor(run.history_next_cursor)}>Older review events</Button>}</details>
 {command&&<AnalysisCommand key={`${run.id}:${command.action}:${command.findingId??''}`} run={run} finding={run.findings.find(f=>f.id===command.findingId)} action={command.action} onClose={()=>setCommand(null)}/>}</>}
 </section>;
}
