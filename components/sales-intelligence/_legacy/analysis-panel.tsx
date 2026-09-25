"use client";
/**
 * The analysis reading surface inside the existing detail panel (specification §8.3–8.4).
 * One vertical reading region with a small section switcher:
 * Assessment · Summary & findings · Evidence · Full output.
 * The assessment version and the analysis run are chosen separately and keep their own
 * source, time and version; neither implies the other was generated with it.
 * Owner commands and their permission gates are unchanged; audit and reanalysis
 * machinery is collapsed by default. Nothing here starts model processing on read.
 */
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {useQuery} from '@tanstack/react-query';
import {readSalesIntelligence,SalesIntelligenceError} from '@/lib/api/salesIntelligence';
import {analysisRunsSchema,analysisSchema,findingAlert,readableFindings,readableSummary,reviewVerdict,runStatusText,effectKindLabel,effectVerdict,
 type Analysis,type AnalysisFinding,type ReadableFinding} from '@/lib/api/salesIntelligenceAnalysis';
import {outputChoices,readRunPresentation,scopeText,type SummaryFindingsSection} from '@/lib/api/salesIntelligenceAssessment';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {Button} from '../atoms/button';
import {Badge,type Tone} from '../atoms/badge';
import {EmptyState} from '../chrome';
import {copy} from '../sales-intelligence-copy';
import {evidenceChainCopy as chain,assessmentCopy as ac} from '../evidence-chain-copy';
import {formatDateTime,label} from '../lib/format';
import {AnalysisCommand,type AnalysisAction} from '../analysis-command';
import {EvidenceChain,EvidenceViewer,type EvidenceFocus} from './evidence-chain';
import {AssessmentSection,FieldRows,type CiteTarget} from './assessment-section';
import {useAssessmentArtifact,useOutreachAssessment} from '../data/use-assessment';
import {FullOutputSection} from '../full-output';
import {TooltipCard} from '../atoms/tooltip-card';

export const ANALYSIS_SECTIONS=['assessment','summary','evidence','output'] as const;
export type AnalysisSectionKey=(typeof ANALYSIS_SECTIONS)[number];

/** Same selection, one panel over. Keeps the Owner inside this Number. */
function panelHref(params:URLSearchParams,values:Record<string,string>) {
 const next=new URLSearchParams(params.toString());
 for(const [key,value] of Object.entries(values))next.set(key,value);
 return `/sales-intelligence?${next.toString()}`;
}
function Json({value}:{value:unknown}) {
 return <details className="si-chain__disclose"><summary>{chain.run.showJson}</summary>
 <div className="si-chain__panel"><pre className="si-chain__json">{JSON.stringify(value,null,2)}</pre></div></details>;
}
const badgeTone=(tone:string):Tone=>tone==='red'||tone==='amber'||tone==='green'||tone==='blue'?tone:'neutral';

/** A disclosure whose body mounts only while open, so collapsed chains cost no reads. */
function Disclosure({summary,children,className}:{summary:ReactNode;children:()=>ReactNode;className?:string}) {
 const [open,setOpen]=useState(false);
 return <details className={className?`si-chain__disclose ${className}`:'si-chain__disclose'} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{summary}</summary>{open&&<div className="si-chain__panel">{children()}</div>}</details>;
}

type RunState={list:ReturnType<typeof useRunList>;runId:string|null;detail:ReturnType<typeof useRunDetail>;presentation:ReturnType<typeof usePresentation>};
function useRunList(numberId:string|null,cursor:string|null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-runs',numberId,cursor],enabled:!!numberId,retry:false,
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs?contact_number_id=${numberId}${cursor?`&cursor=${cursor}`:''}`,analysisRunsSchema,signal)});
}
function useRunDetail(runId:string|null,historyCursor:string|null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-run',runId,historyCursor],enabled:!!runId,retry:false,
  queryFn:({signal})=>readSalesIntelligence(`analysis-runs/${runId}${historyCursor?`?history_cursor=${historyCursor}`:''}`,analysisSchema,signal)});
}
function usePresentation(runId:string|null) {
 return useQuery({queryKey:[...salesIntelligenceKeys.all,'analysis-presentation',runId],enabled:!!runId,retry:false,
  queryFn:({signal})=>readRunPresentation(runId!,signal)});
}

function FindingCard({finding,position,total,run,activityHref,workHref,onCommand,onCite}:{
 finding:ReadableFinding;position:number;total:number;run:Analysis|null;activityHref:string;workHref:(id:string)=>string|null;
 onCommand:(command:{action:AnalysisAction;finding?:AnalysisFinding;focus?:AnalysisFinding})=>void;onCite:(ids:string[],label:string,key:string)=>void;
}) {
 const alert=findingAlert(finding),review=reviewVerdict(finding.reviewState);
 const detail=finding.detail;
 const meta=[finding.basis?label(finding.basis):null,finding.actor?ac.summary.by(label(finding.actor)):null,finding.actionStatus?label(finding.actionStatus):null,
  finding.clarity&&finding.clarity!=='clear'?label(finding.clarity):null].filter(Boolean).join(' · ');
 return <article className={alert?'si-finding si-finding--attention':'si-finding'} aria-label={chain.chain.claimIndex(position,total)}>
  <header className="si-finding__head"><span className="si-finding__kind">{label(finding.kind)}</span><span className="si-chain__meta">{chain.chain.claimIndex(position,total)}</span></header>
  <p className="si-finding__claim">{finding.claim}</p>
  {meta&&<p className="si-chain__meta">{meta}</p>}
  <div className="si-chain-card__glance">
   <Badge tone={badgeTone(review.tone)} className="si-badge--wrap">{review.text}</Badge>
   {alert&&alert.text!==review.text&&<Badge tone={badgeTone(alert.tone)} className="si-badge--wrap">{alert.text}</Badge>}
   {finding.effects.filter(effect=>!effectVerdict(effect.status,effect.reason).important).slice(0,1).map(effect=>
    <Badge key={effect.kind} tone={badgeTone(effectVerdict(effect.status).tone)} className="si-badge--wrap">{effectKindLabel(effect.kind)}</Badge>)}
  </div>
  <div className="si-finding__actions">
   {finding.evidenceIds.length>0&&<Button size="sm" variant="link" className="si-cite" data-cite={`finding:${finding.id}`}
    aria-label={`${ac.viewEvidence(finding.evidenceIds.length)}: ${chain.chain.claimIndex(position,total)}`}
    onClick={()=>onCite(finding.evidenceIds,chain.chain.claimIndex(position,total),`finding:${finding.id}`)}>{ac.viewEvidence(finding.evidenceIds.length)}</Button>}
  </div>
  {detail&&run&&<Disclosure summary={ac.summary.chainToggle}>{()=>
   <EvidenceChain bare run={run} finding={detail} position={position} total={total} activityHref={activityHref} workHref={workHref}
    onAction={action=>onCommand({action,finding:detail})}
    onLookAgain={()=>onCommand({action:run.original_evidence_available?'original_evidence':'current_context',focus:detail})}/>}</Disclosure>}
 </article>;
}

function SummaryFindings({numberId,state,runCursor,setRunCursor,historyCursor,setHistoryCursor,onSelect,onCite,onFullOutput}:{
 numberId:string|null;state:RunState;runCursor:string|null;setRunCursor:(c:string|null)=>void;historyCursor:string|null;setHistoryCursor:(c:string|null)=>void;
 onSelect:(id:string)=>void;onCite:(ids:string[],label:string,key:string)=>void;onFullOutput:()=>void;
}) {
 const params=useSearchParams();
 const [command,setCommand]=useState<{action:AnalysisAction;finding?:AnalysisFinding;focus?:AnalysisFinding}|null>(null);
 if(!numberId)return <EmptyState title={ac.summary.title}>{ac.summary.noNumber}</EmptyState>;
 const {list,runId,detail,presentation}=state;
 const run=detail.data?.data??null;
 const gone=detail.error instanceof SalesIntelligenceError&&detail.error.status===404;
 const shown:SummaryFindingsSection|null=presentation.data?.data.summary_findings??null;
 // The presentation DTO is the reading source. Only when this server cannot serve it is the run read as recorded.
 const fallback=!!presentation.error;
 const ready=shown&&shown.availability==='ready'?shown:null;
 const summary=readableSummary(ready?.summary,fallback?run?.output:null,label);
 const findings=readableFindings(ready?.findings,fallback?run?.findings:ready?run?.findings:null);
 const suggestion=ready?ready.suggested_next_step:fallback&&run?.output?.next_step_suggestion?{description:run.output.next_step_suggestion.description,
  rationale:typeof run.output.next_step_suggestion.rationale==='string'?run.output.next_step_suggestion.rationale:null}:null;
 const applied=ready?ready.applied_actions:!fallback?[]:(run?.actions??[]).filter(action=>run?.findings.some(f=>f.effects.some(e=>e.status==='applied'&&e.target_id===action.id)));
 const scope=shown?shown.scope:run?(run.conversation_id?'conversation':'number'):null;
 const activityHref=panelHref(params,{panel:'activity'});
 const workHref=()=>run?.outreach?panelHref(params,{panel:'work',outreach:run.outreach.id}):null;
 const unavailable=shown&&shown.availability!=='ready'?ac.summary.unavailable[shown.availability as keyof typeof ac.summary.unavailable]??ac.summary.unavailable.unavailable:null;
 return <section className="si-local-stack" aria-label={ac.summary.title}>
  <div className="si-runpick">
   <h4 id="si-run-picker">{ac.summary.runLabel}</h4>
   {list.isPending&&<p role="status">{chain.run.loading}</p>}
   {list.error&&<p role="alert">{copy.errors.analysisFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
   {list.data&&!list.data.data.items.length&&<p>{chain.run.none}</p>}
   <div className="si-runpick__list" role="group" aria-labelledby="si-run-picker">{list.data?.data.items.map(item=><Button key={item.id} size="sm" aria-pressed={item.id===runId} onClick={()=>onSelect(item.id)}>
    {formatDateTime(item.completed_at??item.created_at)} · {label(item.mode)} · {label(item.status)}</Button>)}</div>
   {(runCursor||list.data?.data.next_cursor)&&<div className="si-chain__pages">{runCursor&&<Button size="sm" onClick={()=>setRunCursor(null)}>{chain.run.newest}</Button>}
    {list.data?.data.next_cursor&&<Button size="sm" onClick={()=>setRunCursor(list.data!.data.next_cursor)}>{chain.run.older}</Button>}</div>}
  </div>
  {gone&&<p className="si-local-notice">{chain.run.gone}</p>}
  {detail.error&&!gone&&<p role="alert">{chain.run.detailFailed} <Button variant="link" onClick={()=>void detail.refetch()}>{copy.actions.retry}</Button></p>}
  {runId&&detail.isPending&&<p role="status">{chain.run.loading}</p>}
  {run&&<>
   <div className="si-runhead">
    <p className="si-runhead__line"><Badge tone={run.current?'blue':'neutral'}>{run.current?chain.run.current:chain.run.earlier}</Badge> {runStatusText(run.status)}</p>
    <FieldRows rows={[
     ...(scope?[{label:ac.summary.scope,value:scopeText(scope)}]:[]),
     {label:ac.summary.source,value:[formatDateTime(run.completed_at??run.created_at),run.model_version,run.prompt_version].join(' · ')},
    ]}/>
    {run.current&&<p className="si-text--subtle">{copy.panel.originalIsCurrent}</p>}
    {run.processing_reason&&<p className="si-chain__meta">{label(run.processing_reason)}</p>}
    {run.conversation_id&&run.status==='completed'&&<p className={run.outreach?'si-text--subtle':'si-local-notice'}>{run.outreach?copy.panel.leadActionableRun:copy.panel.numberOnlyRun}</p>}
    <div className="si-chain-card__actions"><Button variant="primary" onClick={onFullOutput}>{ac.viewFullOutput}</Button></div>
   </div>
   {presentation.isPending&&<p role="status">{chain.run.loading}</p>}
   {fallback&&<p className="si-text--subtle">{ac.summary.presentationFailed}</p>}
   {unavailable&&<p className="si-local-notice">{unavailable}</p>}

   <section className="si-chain-summary" aria-label={copy.panel.originalModelSummary}>
    <TooltipCard title={copy.panel.originalModelSummary} guideTopic="summary" label={<h4>{copy.panel.originalModelSummary}</h4>}>{copy.panel.originalModelTip}</TooltipCard>
    {run.status!=='completed'&&<p>{chain.run.notFinishedYet}</p>}
    {run.status==='completed'&&!summary&&!unavailable&&!presentation.isPending&&<p>{chain.run.noOutput}</p>}
    {summary&&<>
     <FieldRows className="si-fields--summary" rows={summary.sections.map(section=>({label:section.label,value:section.text||copy.fields.unknown}))}/>
     {summary.narrative&&<div><h5>{ac.summary.narrative}</h5><p className="si-prose">{summary.narrative}</p></div>}
     {run.output&&<><div className="si-chain-card__actions"><Button disabled={!run.editable} onClick={()=>setCommand({action:'confirm_run'})}>{copy.panel.confirmAnalysis}</Button></div>
     <p className="si-chain__meta">{copy.commandExplain.confirm_analysis}</p></>}
    </>}
   </section>

   {ready&&ready.said_on_call.length>0&&<section className="si-chain-summary" aria-label={ac.summary.saidTitle}>
    <h4>{ac.summary.saidTitle}</h4>
    <ul className="si-said__list">{ready.said_on_call.map(item=><li key={`${item.call_index}:${item.index}`} className="si-said__item">
     <span className="si-said__text">{item.text}</span><span className="si-chain__meta">{label(item.kind)} · {ac.summary.by(label(item.speaker))}</span></li>)}</ul>
   </section>}

   <section className="si-local-stack" aria-label={ac.summary.findingsTitle(findings.length)}>
    <h4>{ac.summary.findingsTitle(findings.length)}</h4>
    {!findings.length&&!unavailable&&!presentation.isPending&&<p>{ac.summary.findingsNone}</p>}
    <ol className="si-findings">{findings.map((finding,order)=><li key={finding.id}>
     <FindingCard finding={finding} position={order+1} total={findings.length} run={run} activityHref={activityHref} workHref={workHref}
      onCommand={setCommand} onCite={onCite}/>
    </li>)}</ol>
   </section>

   {suggestion&&<section className="si-chain-summary" aria-label={ac.summary.suggested}>
    <h4>{ac.summary.suggested}</h4>
    <p>{suggestion.description}</p>
    {suggestion.rationale&&<p className="si-chain__meta">{chain.run.nextStepWhy(suggestion.rationale)}</p>}
    <p className="si-chain__meta">{copy.panel.suggestionNote}</p>
    <div className="si-chain-card__actions"><Button disabled={!run.editable||!run.outreach} onClick={()=>setCommand({action:'apply_suggestion'})}>{copy.panel.apply}</Button></div>
    <p className="si-chain__meta">{copy.commandExplain.apply_suggestion}</p>
    {!run.outreach&&<p className="si-chain__meta">{copy.panel.noOutreachOnNumber}</p>}
   </section>}

   <section className="si-chain-summary" aria-label={ac.summary.applied}>
    <h4>{ac.summary.applied}</h4>
    {!applied.length?<p className="si-text--subtle">{ac.summary.appliedNone}</p>
     :<ul className="si-said__list">{applied.map(action=><li key={action.id} className="si-said__item"><span className="si-said__text">{action.description}</span>
      <span className="si-chain__meta">{label(action.kind)} · {label(action.status)} · {action.due_at?copy.time.due(formatDateTime(action.due_at)):copy.time.noDueRecorded}</span></li>)}</ul>}
   </section>

   <Disclosure summary={ac.summary.advanced}>{()=><div className="si-chain-rerun">
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
   </div>}</Disclosure>

   <Disclosure summary={chain.run.instructions}>{()=><>
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
   </>}</Disclosure>

   <Disclosure summary={chain.run.historyTitle}>{()=><>
    <p className="si-chain__meta">{chain.run.historyNote}</p>
    {!run.history.length&&<p>{chain.run.historyNone}</p>}
    <ul className="si-chain__snaps">{run.history.map(event=><li key={event.id} className="si-chain__snap">
     <span className="si-chain__snap__head"><strong>{label(event.event)}</strong></span>
     <span className="si-chain__meta">{event.actor} · {formatDateTime(event.happened_at)}</span>
     <Json value={{before:event.prior,after:event.current}}/>
    </li>)}</ul>
    <div className="si-chain__pages">{historyCursor&&<Button size="sm" onClick={()=>setHistoryCursor(null)}>{chain.run.historyNewest}</Button>}
    {run.history_next_cursor&&<Button size="sm" onClick={()=>setHistoryCursor(run.history_next_cursor)}>{chain.run.historyOlder}</Button>}</div>
   </>}</Disclosure>

   {command&&<AnalysisCommand key={`${run.id}:${command.action}:${command.finding?.id??command.focus?.id??''}`} run={run} finding={command.finding} focus={command.focus} action={command.action} onClose={()=>setCommand(null)}/>}
  </>}
 </section>;
}

type Return={section:AnalysisSectionKey;scrollTop:number;key:string};

export function AnalysisPanel({numberId,outreachId=null,selectedRun,onSelect,initialSection='summary'}:{
 numberId:string|null;outreachId?:string|null;selectedRun:string|null;onSelect:(id:string)=>void;initialSection?:AnalysisSectionKey;
}) {
 const [section,setSection]=useState<AnalysisSectionKey>(initialSection);
 const [artifactId,setArtifactId]=useState<string|null>(null);
 const [focus,setFocus]=useState<EvidenceFocus|null>(null);
 const [returnTo,setReturnTo]=useState<Return|null>(null);
 const [outputKey,setOutputKey]=useState<string|null>(null);
 const [runCursor,setRunCursor]=useState<string|null>(null),[historyCursor,setHistoryCursor]=useState<string|null>(null);
 const root=useRef<HTMLDivElement>(null);
 const list=useRunList(numberId,runCursor);
 const runId=numberId?selectedRun??list.data?.data.items.find(item=>item.status==='completed')?.id??list.data?.data.items[0]?.id??null:null;
 const detail=useRunDetail(runId,historyCursor);
 const presentation=usePresentation(runId);
 const subject=useOutreachAssessment(outreachId);
 const currentArtifact=subject.data?.data.current?.artifact_id??null;
 const shownArtifact=artifactId??currentArtifact;
 useAssessmentArtifact(artifactId&&artifactId!==currentArtifact?artifactId:null);
 // The detail dialog is the single scroll container; the section switcher sticks below its header.
 const scroller=()=>root.current?.closest('dialog') as HTMLElement|null;
 /** The scroll offset at which this reading surface starts, less the sticky dialog header. */
 const surfaceTop=(node:HTMLElement)=>{
  if(!root.current)return 0;
  const head=node.querySelector('.si-panel__header')?.getBoundingClientRect().height??0;
  return Math.max(0,root.current.getBoundingClientRect().top-node.getBoundingClientRect().top+node.scrollTop-head);
 };
 // Back returns to the same section, scroll position and citation button.
 const restore=useRef<Return|null>(null);
 useLayoutEffect(()=>{
  const target=restore.current;
  if(!target||target.section!==section)return;
  restore.current=null;
  const node=scroller();
  if(node)node.scrollTop=target.scrollTop;
  root.current?.querySelector<HTMLElement>(`[data-cite="${CSS.escape(target.key)}"]`)?.focus({preventScroll:true});
 },[section]);
 const go=(next:AnalysisSectionKey)=>{
  setSection(next);setFocus(null);setReturnTo(null);
  const node=scroller();
  if(node)node.scrollTop=Math.min(node.scrollTop,surfaceTop(node));
 };
 const cite=(target:CiteTarget)=>{
  setReturnTo({section,scrollTop:scroller()?.scrollTop??0,key:target.key});
  if(target.source==='assessment'&&target.artifactId!==shownArtifact)setArtifactId(target.artifactId);
  setFocus({source:target.source,ids:target.ids,label:target.label});
  setSection('evidence');
  const node=scroller();
  if(node)node.scrollTop=surfaceTop(node);
 };
 const back=returnTo?{label:ac.sections[returnTo.section],onBack:()=>{restore.current=returnTo;setSection(returnTo.section);setFocus(null);setReturnTo(null);}}:null;
 const choices=outputChoices({versions:subject.data?.data.versions,runId,runRefs:presentation.data?.data.full_output});
 const runDetail=detail.data?.data;
 // The two selections, each with its own time: an assessment version and an analysis run are never presented as one.
 const shownVersion=subject.data?.data.versions.find(version=>version.artifact_id===shownArtifact)??null;
 const assessmentContext=!outreachId||!subject.data?null:shownVersion?(shownVersion.generated_at?formatDateTime(shownVersion.generated_at):ac.notRecorded)
  :ac.availability[subject.data.data.availability as keyof typeof ac.availability]??subject.data.data.availability;
 const context=[assessmentContext?`${ac.sections.assessment}: ${assessmentContext}`:null,
  runId&&runDetail?`${ac.summary.runLabel}: ${formatDateTime(runDetail.completed_at??runDetail.created_at)}`:null].filter(Boolean).join(' · ');
 return <div ref={root} className="si-analysis" aria-label={copy.panel.analysisTitle} role="region">
  <nav className="si-sections" aria-label={ac.sections.label}>
   <div className="si-sections__list">{ANALYSIS_SECTIONS.map(key=><button key={key} type="button" className={section===key?'si-sections__item is-active':'si-sections__item'}
    aria-current={section===key?'true':undefined} onClick={()=>go(key)}>{ac.sections[key]}</button>)}</div>
   {context&&<p className="si-sections__context">{context}</p>}
  </nav>
  <div className="si-analysis__body">
   {section==='assessment'&&<AssessmentSection outreachId={outreachId} artifactId={artifactId} onArtifact={id=>{setArtifactId(id);setOutputKey(null);}} onCite={cite}
    onFullOutput={id=>{setOutputKey(`assessment:${id}`);go('output');}}/>}
   {section==='summary'&&<SummaryFindings numberId={numberId} state={{list,runId,detail,presentation}} runCursor={runCursor} setRunCursor={setRunCursor}
    historyCursor={historyCursor} setHistoryCursor={setHistoryCursor} onSelect={id=>{setHistoryCursor(null);setOutputKey(null);onSelect(id);}}
    onCite={(ids,citeLabel,key)=>runId&&cite({source:'run',runId,ids,label:citeLabel,key})}
    onFullOutput={()=>{// The run's own findings / analysis output first; its captured conversation summaries are inputs, listed after.
    const own=choices.find(choice=>choice.source.type==='run'&&choice.source.run_id===runId&&choice.source.output_id===runId)??choices.find(choice=>choice.source.type==='run'&&choice.source.run_id===runId);setOutputKey(own?.key??null);go('output');}}/>}
   {section==='evidence'&&<EvidenceViewer artifactId={shownArtifact} runId={runId}
    runEvidence={{data:presentation.data?.data.evidence??null,pending:!!runId&&presentation.isPending,error:!!presentation.error,retry:()=>void presentation.refetch()}}
    focus={focus} onClearFocus={()=>setFocus(null)} back={back} onOpenRun={id=>{onSelect(id);go('summary');}}/>}
   {section==='output'&&<FullOutputSection choices={choices} selectedKey={outputKey} onSelect={setOutputKey}
    loading={(!!outreachId&&subject.isPending)||(!!runId&&presentation.isPending)}/>}
  </div>
 </div>;
}
