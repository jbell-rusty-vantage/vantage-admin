"use client";
/**
 * One assertion, read as a chain of custody: the call it came from, the evidence
 * kept, what the model said, what that changed in the Owner's work, and what the
 * Owner decided. Every step renders only what the stored run supports.
 */
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {readSalesIntelligence} from '@/lib/api/salesIntelligence';
import {analysisEvidenceSchema,analysisEvidenceContentSchema,assertionEvidence,assertionFacts,citedSnapshotIds,effectKindLabel,effectVerdict,requestsForFinding,reviewVerdict,validationReadouts,validationVerdict,
 type Analysis,type AnalysisFinding,type ChainTone,type ChainVerdict} from '@/lib/api/salesIntelligenceAnalysis';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {Badge,type Tone} from './atoms/badge';
import {Button} from './atoms/button';
import {copy} from './sales-intelligence-copy';
import {evidenceChainCopy as chain} from './evidence-chain-copy';
import {formatDateTime,label} from './lib/format';
import './styles/evidence-chain.css';

const badgeTone=(tone:ChainTone):Tone=>tone==='amber'?'amber':tone==='red'?'red':tone==='green'?'green':tone==='blue'?'blue':'neutral';
const pick=(map:Record<string,string|undefined>,key:string)=>map[key]??label(key);

/** One evidence-snapshot page per run, shared by the per-assertion steps and the run-level list. */
export function useRunEvidence(runId:string,cursor:string|null=null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence',runId,cursor],
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence${cursor?`?cursor=${cursor}`:''}`,analysisEvidenceSchema,signal),retry:false});
}
type Snapshot={id:string;tool:string|null;retrieved_at:string|null;unavailable:boolean};

/** Retained content for one snapshot, paged exactly as the server pages it. */
function EvidenceContent({runId,snapshotId}:{runId:string;snapshotId:string}) {
 const [offset,setOffset]=useState<string|null>(null);
 const content=useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-evidence-content',runId,snapshotId,offset],
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}/evidence/${snapshotId}${offset?`?cursor=${offset}`:''}`,analysisEvidenceContentSchema,signal),retry:false});
 if(content.error)return <p role="alert">{chain.evidence.contentFailed} <Button variant="link" onClick={()=>void content.refetch()}>{copy.actions.retry}</Button></p>;
 if(!content.data)return <p role="status">{copy.page.preparing}</p>;
 const data=content.data.data;
 if(data.unavailable)return <p>{data.reason==='retention_in_progress'?chain.evidence.retentionInProgress:chain.evidence.gone}{data.purged_at?` ${chain.evidence.goneOn(formatDateTime(data.purged_at))}`:''}</p>;
 return <>
 {data.as_of&&<p className="si-chain__meta">{chain.evidence.keptAt(formatDateTime(data.as_of))}</p>}
 {data.complete===false&&<p className="si-chain__meta">{chain.evidence.partial}</p>}
 <pre className="si-chain__json">{data.content}</pre>
 <div className="si-chain__pages">{offset&&<Button size="sm" onClick={()=>setOffset(null)}>{chain.evidence.startOfItem}</Button>}
 {data.next_cursor&&<Button size="sm" onClick={()=>setOffset(data.next_cursor)}>{chain.evidence.nextSection}</Button>}</div>
 </>;
}

/** Every snapshot this run kept, for the Owner who wants the whole retained set. */
export function RunEvidenceList({runId}:{runId:string}) {
 const [cursor,setCursor]=useState<string|null>(null),[open,setOpen]=useState<string|null>(null);
 const list=useRunEvidence(runId,cursor);
 return <details className="si-chain__disclose"><summary>{chain.evidence.allTitle}</summary><div className="si-chain__panel">
 {list.error&&<p role="alert">{copy.errors.evidenceFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.isPending&&<p role="status">{copy.page.preparing}</p>}
 {list.data&&!list.data.data.items.length&&<p>{chain.evidence.none}</p>}
 <ul className="si-chain__snaps">{list.data?.data.items.map(item=><li key={item.id} className="si-chain__snap">
  <span className="si-chain__snap__head"><strong>{item.tool?chain.evidence.readWith(label(item.tool)):chain.evidence.unknownSource}</strong>
  <Badge tone={item.unavailable?'amber':'neutral'}>{item.unavailable?chain.evidence.gone:chain.evidence.stored}</Badge></span>
  <span className="si-chain__meta">{item.retrieved_at?chain.evidence.keptAt(formatDateTime(item.retrieved_at)):chain.evidence.keptUnknown}</span>
  {!item.unavailable&&<span><Button size="sm" variant="link" aria-expanded={open===item.id} onClick={()=>setOpen(open===item.id?null:item.id)}>{open===item.id?chain.evidence.close:chain.evidence.open}</Button></span>}
  {open===item.id&&<EvidenceContent runId={runId} snapshotId={item.id}/>}
 </li>)}</ul>
 <div className="si-chain__pages">{cursor&&<Button size="sm" onClick={()=>setCursor(null)}>{chain.evidence.firstPage}</Button>}
 {list.data?.data.next_cursor&&<Button size="sm" onClick={()=>setCursor(list.data!.data.next_cursor)}>{chain.evidence.nextPage}</Button>}</div>
 </div></details>;
}

/** A chain step. The lede is always visible; only the detail collapses. */
function Step({n,title,tone,lede,children,startOpen}:{n:number;title:string;tone:ChainTone;lede:ReactNode;children?:ReactNode;startOpen?:boolean}) {
 const [open,setOpen]=useState(Boolean(startOpen));
 return <li className="si-chain__step">
 <span className={`si-chain__mark si-chain__mark--${tone}`} aria-hidden="true">{n}</span>
 <div className="si-chain__pane">
  <h6 className="si-chain__title">{title}</h6>
  <div className="si-chain__lede">{lede}</div>
  {children&&<details className="si-chain__disclose" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
   <summary>{open?chain.chain.hide(title):chain.chain.show(title)}</summary><div className="si-chain__panel">{children}</div></details>}
 </div></li>;
}
type Row={label:string;value:ReactNode;tone?:ChainTone};
function Rows({rows}:{rows:Row[]}) {
 if(!rows.length)return null;
 return <dl className="si-chain__rows">{rows.map(row=><div key={row.label}>
  <dt>{row.label}</dt><dd className={row.tone&&row.tone!=='neutral'?`si-chain__value--${row.tone}`:undefined}>{row.value}</dd></div>)}</dl>;
}
function Verdict({verdict}:{verdict:ChainVerdict}) {
 return <Badge tone={badgeTone(verdict.tone)} className="si-badge--wrap">{verdict.text}</Badge>;
}

export function EvidenceChain({run,finding,position,total,activityHref,workHref,onAction,onLookAgain}:{
 run:Analysis;finding:AnalysisFinding;position:number;total:number;activityHref:string;
 workHref:(followupId:string)=>string|null;
 onAction:(action:'confirm_finding'|'correct_finding'|'retract_finding')=>void;onLookAgain:()=>void;
}) {
 const [openSnapshot,setOpenSnapshot]=useState<string|null>(null);
 const index=useRunEvidence(run.id);
 const snapshots=new Map<string,Snapshot>((index.data?.data.items??[]).map(item=>[item.id,item]));
 const indexComplete=Boolean(index.data&&!index.data.data.next_cursor);
 const refs=assertionEvidence(finding.assertion),cited=citedSnapshotIds(finding.assertion);
 const facts=assertionFacts(finding.assertion);
 const checks=validationReadouts(finding.validation),claimVerdict=validationVerdict(finding.validation);
 const review=reviewVerdict(finding.review_state);
 const effects=finding.effects.map(effect=>({effect,verdict:effectVerdict(effect.status,effect.reason)}));
 const worstEffect=effects.find(row=>row.verdict.important)??effects[0];
 const transcript=refs.find(ref=>ref.source==='transcript');
 const asked=requestsForFinding(run.reanalysis_requests,finding.id);
 const decidedBy=run.history.find(row=>{
  const current=row.current&&typeof row.current==='object'&&!Array.isArray(row.current)?row.current as Record<string,unknown>:{};
  return Array.isArray(current.finding_ids)&&current.finding_ids.some(id=>String(id)===finding.id);
 });
 const attention=review.tone==='red'||effects.some(row=>row.verdict.tone==='red')||claimVerdict.tone==='red';
 const basis=facts.basis?pick(chain.claim.basis,facts.basis):null;
 return <article className={`si-chain-card${attention?' si-chain-card--attention':finding.review_state==='confirmed'?' si-chain-card--decided':''}`}>
 <header className="si-chain-card__head">
  <h5 className="si-chain-card__kind">{finding.assertion.kind?label(finding.assertion.kind):chain.chain.claimFallback}</h5>
  <span className="si-chain__meta">{chain.chain.claimIndex(position,total)}</span>
 </header>
 <p className="si-chain-card__claim">{finding.assertion.claim}</p>
 <div className="si-chain-card__glance"><Verdict verdict={review}/><Verdict verdict={claimVerdict}/>
 {worstEffect?<Verdict verdict={worstEffect.verdict}/>:<Badge className="si-badge--wrap">{chain.effect.none}</Badge>}</div>
 <ol className="si-chain" aria-label={chain.chain.stepsLabel}>
  <Step n={1} title={chain.chain.steps.source} tone="neutral" lede={<span>{run.conversation_id?chain.source.oneConversation:chain.source.wholeNumber}</span>}>
   <p className="si-chain__meta">{chain.source.ranAt(formatDateTime(run.created_at))} {run.completed_at?chain.source.finishedAt(formatDateTime(run.completed_at)):chain.source.notFinished}</p>
   <p className="si-chain__meta">{chain.source.modelUsed(run.model_version,run.prompt_version)}</p>
   {transcript?.transcript_version&&<p className="si-chain__meta">{chain.source.transcriptVersion(transcript.transcript_version)} {chain.source.segments(transcript.segment_count)}</p>}
   <p><Link className="si-link" href={activityHref}>{chain.source.activityLink}</Link></p>
   <p className="si-chain__meta">{chain.source.activityNote}</p>
  </Step>
  <Step n={2} title={chain.chain.steps.evidence} tone={refs.length?'neutral':'amber'}
   lede={<span>{refs.length?chain.evidence.cited(refs.length):chain.evidence.none}</span>}>
   {index.error&&<p role="alert">{copy.errors.evidenceFailed} <Button variant="link" onClick={()=>void index.refetch()}>{copy.actions.retry}</Button></p>}
   {refs.length>0&&!cited.length&&<p>{chain.evidence.none}</p>}
   <ul className="si-chain__snaps">{refs.map((ref,order)=>{
    const snapshot=ref.snapshot_id?snapshots.get(ref.snapshot_id):undefined;
    const missing=Boolean(ref.snapshot_id)&&!snapshot&&indexComplete;
    return <li key={`${ref.snapshot_id??'ref'}:${order}`} className="si-chain__snap">
     <span className="si-chain__snap__head"><strong>{ref.source==='transcript'?chain.evidence.transcript:ref.source==='vantage_record'?chain.evidence.record:chain.evidence.unknownSource}</strong>
     {snapshot&&<Badge tone={snapshot.unavailable?'amber':'neutral'}>{snapshot.unavailable?chain.evidence.gone:chain.evidence.stored}</Badge>}
     {missing&&<Badge tone="amber">{chain.evidence.notInRun}</Badge>}</span>
     <Rows rows={[
      ...(snapshot?.tool?[{label:chain.rows.tool,value:chain.evidence.readWith(label(snapshot.tool))}]:[]),
      ...(snapshot?[{label:chain.rows.kept,value:snapshot.retrieved_at?chain.evidence.keptAt(formatDateTime(snapshot.retrieved_at)):chain.evidence.keptUnknown}]:[]),
      ...(ref.source==='vantage_record'&&ref.record_type&&ref.record_id?[{label:chain.rows.record,value:chain.evidence.recordRef(label(ref.record_type),ref.record_id)}]:[]),
      ...(ref.field_paths.length?[{label:chain.rows.fields,value:ref.field_paths.join(', ')}]:[]),
     ]}/>
     {ref.source==='transcript'&&<p className="si-chain__meta">{ref.quote?chain.evidence.quoteKept:chain.evidence.quoteNone}</p>}
     {ref.quote&&<p className="si-chain__quote">{ref.quote}</p>}
     {snapshot&&!snapshot.unavailable&&ref.snapshot_id&&<span><Button size="sm" variant="link" aria-expanded={openSnapshot===ref.snapshot_id}
      onClick={()=>setOpenSnapshot(openSnapshot===ref.snapshot_id?null:ref.snapshot_id)}>{openSnapshot===ref.snapshot_id?chain.evidence.close:chain.evidence.open}</Button></span>}
     {openSnapshot&&openSnapshot===ref.snapshot_id&&<EvidenceContent runId={run.id} snapshotId={openSnapshot}/>}
    </li>;
   })}</ul>
   <details className="si-chain__disclose"><summary>{chain.evidence.showJson}</summary><div className="si-chain__panel">
    <p className="si-chain__meta">{chain.evidence.jsonNote}</p>
    <pre className="si-chain__json">{JSON.stringify(finding.assertion.evidence??null,null,2)}</pre></div></details>
  </Step>
  <Step n={3} title={chain.chain.steps.claim} tone={claimVerdict.tone}
   lede={<><Verdict verdict={claimVerdict}/>{basis&&<span className="si-chain__meta">{basis}</span>}</>}>
   <Rows rows={[
    ...(basis?[{label:chain.rows.basis,value:basis}]:[]),
    ...(facts.actor?[{label:chain.rows.speaker,value:pick(chain.claim.actor,facts.actor)}]:[]),
    ...(facts.actionStatus?[{label:chain.rows.actionStatus,value:pick(chain.claim.actionStatus,facts.actionStatus)}]:[]),
    ...(facts.clarity?[{label:chain.rows.clarity,value:pick(chain.claim.clarity,facts.clarity),tone:facts.clarity==='uncertain'?'amber' as ChainTone:undefined}]:[]),
    ...(facts.confidence?[{label:chain.rows.confidence,value:facts.confidence}]:[]),
   ]}/>
   <p className="si-chain__meta">{chain.claim.checksNote}</p>
   <Rows rows={checks.map(row=>({label:row.label,value:row.text,tone:row.tone}))}/>
  </Step>
  <Step n={4} title={chain.chain.steps.effect} tone={worstEffect?worstEffect.verdict.tone:'neutral'}
   startOpen={effects.some(row=>row.verdict.important)}
   lede={worstEffect?<Verdict verdict={worstEffect.verdict}/>:<span>{chain.effect.none}</span>}>
   {!effects.length&&<p>{chain.effect.none}</p>}
   <ul className="si-chain__snaps">{effects.map(({effect,verdict})=>{
    const action=effect.target_id?run.actions.find(row=>row.id===effect.target_id):undefined;
    const href=effect.target_id?workHref(effect.target_id):null;
    return <li key={effect.id} className="si-chain__snap">
     <span className="si-chain__snap__head"><strong>{effectKindLabel(effect.kind)}</strong><Verdict verdict={verdict}/></span>
     {verdict.important&&<p className="si-chain__flag">{verdict.text}</p>}
     <span className="si-chain__meta">{chain.effect.at(formatDateTime(effect.applied_at))}</span>
     {action?<>
      <Rows rows={[{label:chain.rows.followup,value:action.description},
       {label:copy.fields.status,value:`${label(action.status)} · ${action.due_at?copy.time.due(formatDateTime(action.due_at)):copy.time.noDueRecorded}`}]}/>
      {href&&<span><Link className="si-link" href={href}>{chain.effect.openWork}</Link></span>}
     </>:<span className="si-chain__meta">{effect.target_id?chain.effect.targetUnknown:chain.effect.untouched}</span>}
    </li>;
   })}</ul>
  </Step>
  <Step n={5} title={chain.chain.steps.decision} tone={review.tone} startOpen={review.important}
   lede={<><Verdict verdict={review}/>{asked.length>0&&<span className="si-chain__meta">{chain.decision.requestOnClaim(formatDateTime(asked[0].created_at),label(asked[0].status))}</span>}</>}>
   {decidedBy?<p className="si-chain__meta">{chain.decision.decidedBy(decidedBy.actor,formatDateTime(decidedBy.happened_at))}</p>
    :<p className="si-chain__meta">{chain.decision.whoWhere}</p>}
   {!run.editable&&<p className="si-chain__flag si-chain__flag--amber">{chain.decision.lockedRun}</p>}
   <div className="si-chain-card__actions">
    <Button disabled={!run.editable} onClick={()=>onAction('confirm_finding')}>{copy.panel.confirm}</Button>
    <Button disabled={!run.editable} onClick={()=>onAction('correct_finding')}>{copy.panel.correct}</Button>
    <Button disabled={!run.editable} onClick={()=>onAction('retract_finding')}>{copy.panel.retract}</Button>
    <Button variant="link" disabled={!run.output} onClick={onLookAgain}>{chain.decision.lookAgain}</Button>
   </div>
   <p className="si-chain__meta">{chain.decision.lookAgainNote}</p>
   <p className="si-chain__title">{chain.decision.whatTheseDo}</p>
   <ul className="si-chain__body">
    <li className="si-chain__meta">{copy.panel.confirm}: {copy.commandExplain.confirm_analysis}</li>
    <li className="si-chain__meta">{copy.panel.correct}: {copy.commandExplain.correct}</li>
    <li className="si-chain__meta">{copy.panel.retract}: {copy.commandExplain.retract}</li>
   </ul>
   {asked.length>0&&<ul className="si-chain__body">{asked.map(request=><li key={request.id} className="si-chain__meta">
    {chain.rerun.requestLine(label(request.mode),formatDateTime(request.created_at),label(request.status))}</li>)}</ul>}
  </Step>
 </ol>
 </article>;
}
