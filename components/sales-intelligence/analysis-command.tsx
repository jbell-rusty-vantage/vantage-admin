"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {sendSalesIntelligence,SalesIntelligenceError,type CommandIntent} from '@/lib/api/salesIntelligence';
import type {Analysis,AnalysisFinding} from '@/lib/api/salesIntelligenceAnalysis';
import {salesIntelligenceKeys} from '@/lib/query/salesIntelligence';
import {Button} from './atoms/button';
import {formatDateTime,label} from './lib/format';
import {easternInstant} from './lib/commands';
import {fetchCatalogItems} from '@/lib/api/catalog';

export type AnalysisAction='confirm_run'|'confirm_finding'|'correct_finding'|'retract_finding'|'apply_suggestion'|'original_evidence'|'current_context';
const titles:Record<AnalysisAction,string>={confirm_run:'Confirm this analysis',confirm_finding:'Confirm this finding',correct_finding:'Correct this finding',retract_finding:'Retract this finding',apply_suggestion:'Apply suggestion',original_evidence:'Reanalyze original evidence',current_context:'Reanalyze current context'};
export function AnalysisCommand({run,finding,action,onClose}:{run:Analysis;finding?:AnalysisFinding;action:AnalysisAction;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),id=useId(),client=useQueryClient(),intent=useRef<CommandIntent|null>(null),lock=useRef(false);
 const version=JSON.stringify([run.id,run.revision,run.output_digest,finding?.revision,run.actions.map(a=>[a.id,a.revision]),run.outreach?.revision]);
 const [base,setBase]=useState(version),[reason,setReason]=useState(''),[claim,setClaim]=useState(finding?.assertion.claim??''),[target,setTarget]=useState(''),[description,setDescription]=useState(''),[due,setDue]=useState(''),[editDue,setEditDue]=useState(false),[corrections,setCorrections]=useState<string[]>([]);
 const [descriptionEdited,setDescriptionEdited]=useState(false);
 const [agentId,setAgentId]=useState(''),[agentEdited,setAgentEdited]=useState(false);
 const agents=useQuery({queryKey:['catalog','agents','csi-current'],queryFn:()=>fetchCatalogItems('agents',{includeInactive:true})});
 const [pending,setPending]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Record<string,unknown>|null>(null);
 const targets=run.actions.filter(a=>finding?.effects.some(e=>e.target_id===a.id));
 const changed=base!==version,rerun=action==='original_evidence'||action==='current_context';
 useEffect(()=>{const node=dialog.current,opener=document.activeElement;node?.showModal();return()=>{node?.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus();};},[]);
 function build():CommandIntent {
  const common={command:action,expected_revision:finding?.revision??run.revision};
  let path=`analysis-runs/${run.id}/confirm`,body:Record<string,unknown>={...common,expected_output_digest:run.output_digest};
  if(action==='confirm_finding')path=`findings/${finding!.id}/confirm`;
  if(action==='correct_finding') {
   const selected=targets.find(a=>a.id===target),changes:Record<string,unknown>={};
   if(selected&&descriptionEdited)changes.description=description;
   if(selected&&editDue)changes.due_at=easternInstant(due);
   if(selected&&agentEdited)changes.responsible_agent_id=agentId||null;
   if(selected&&!Object.keys(changes).length)throw new Error('Change the selected action or choose assertion only.');
   path=`findings/${finding!.id}/correct`;body={...body,replacement:{...finding!.assertion,claim},target_effect_id:null,target_followup_id:selected?.id??null,reason,
    ...(selected?{action_changes:changes,expected_revisions:[{target:'followup',id:selected.id,revision:selected.revision}]}:{})};
  }
  if(action==='retract_finding') {path=`findings/${finding!.id}/retract`;body={...body,reason,expected_revisions:targets.map(a=>({target:'followup',id:a.id,revision:a.revision}))};}
  if(action==='apply_suggestion') {path=`analysis-runs/${run.id}/apply-suggestion`;body={...common,run_id:run.id,suggestion_output_digest:run.suggestion_output_digest,due_at:easternInstant(due),...(agentEdited?{responsible_agent_id:agentId||null}:{}),expected_revisions:run.outreach?[{target:'outreach',id:run.outreach.id,revision:run.outreach.revision}]:[]};}
  if(rerun){path=`analysis-runs/${run.id}/reanalyze`;body={...common,command:'reanalyze',mode:action,source_run_id:run.id,owner_correction_ids:corrections,reason};}
  return {path,method:'POST',body,key:crypto.randomUUID()};
 }
 async function submit(){if(lock.current)return;lock.current=true;setError('');
  try {if(!intent.current)intent.current=build();}catch(e){setError(e instanceof Error?e.message:'Review your changes.');lock.current=false;return;}
  setPending(true);
  try{const response=await sendSalesIntelligence(intent.current);setResult(response.response);setUnknown(false);intent.current=null;await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});}
  catch(e){const uncertain=!(e instanceof SalesIntelligenceError)||e.status>=500;setUnknown(uncertain);if(!uncertain)intent.current=null;setError(uncertain?'Outcome unknown. Retry the same request to recover its saved result.':`Request rejected: ${label(e.code)}. Your draft is preserved.`);await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});}
  finally{setPending(false);lock.current=false;}
 }
 const needsReason=rerun||action==='correct_finding'||action==='retract_finding';
 return <dialog ref={dialog} className="si-root si-local-command" aria-labelledby={id} onCancel={e=>{e.stopPropagation();if(pending)e.preventDefault();else onClose();}}><form className="si-local-stack" onSubmit={e=>{e.preventDefault();void submit();}}>
 <h2 id={id}>{titles[action]}</h2><p>Analysis from {formatDateTime(run.created_at)} · {label(run.mode)}. Enter dates in Eastern time.</p>
 {finding&&<p>Original model assertion: {finding.assertion.claim}</p>}
 {action.startsWith('confirm')&&<p>Records your review of this exact version. Existing effects remain as recorded.</p>}
 {action==='retract_finding'&&<p>Eligible effects will be reversed immediately. Completed actions, official closure and later Owner work are protected. Blocked reversals will be shown in the result.</p>}
 {rerun&&<p>{action==='original_evidence'?'Uses the retained original evidence and prompt, with the corrections you explicitly select below.':'Captures fresh context for a new analysis.'} Processing may remain queued while AI is paused.</p>}
 {!result&&<><fieldset disabled={pending||unknown} className="si-local-stack">
 {action==='correct_finding'&&<><label>Owner assertion<textarea className="si-textarea" required value={claim} onChange={e=>setClaim(e.target.value)}/></label><label>Affected action<select className="si-select" value={target} onChange={e=>{setTarget(e.target.value);const a=targets.find(a=>a.id===e.target.value);setDescription(a?.description??'');setDescriptionEdited(false);setAgentId(a?.responsible_agent_id??'');setAgentEdited(false);setEditDue(false);setDue('');}}><option value="">Assertion only</option>{targets.map(a=><option key={a.id} value={a.id}>{a.description} · {label(a.status)}</option>)}</select></label>{target&&<><label>Action description<textarea className="si-textarea" required value={description} onChange={e=>{setDescription(e.target.value);setDescriptionEdited(true);}}/></label><label><input type="checkbox" checked={editDue} onChange={e=>setEditDue(e.target.checked)}/> Change due date (leave blank for no date)</label>{editDue&&<input aria-label="Action due date" type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/>}</>}</>}
 {action==='apply_suggestion'&&<><p>{run.output?.next_step_suggestion?.description}</p><p>Creates Owner-origin work. A blank date creates an undated action.</p><label>Due date<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label></>}
 {(target||action==='apply_suggestion')&&<label>Action responsibility (only changed when selected)<select className="si-select" value={agentId} onChange={e=>{setAgentId(e.target.value);setAgentEdited(true);}}><option value="">Unassigned</option>{agents.data?.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>}
 {rerun&&<fieldset><legend>Include Owner corrections</legend>{run.instructions.map(i=><label key={i.id} style={{display:'block'}}><input type="checkbox" checked={corrections.includes(i.id)} onChange={e=>setCorrections(e.target.checked?[...corrections,i.id]:corrections.filter(x=>x!==i.id))}/>{label(i.field)} · {formatDateTime(i.happened_at)} · {i.actor}</label>)}</fieldset>}
 {needsReason&&<label>Reason<textarea className="si-textarea" required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
 </fieldset>{changed&&<div role="status"><p>Server values changed. Your draft is preserved; review the current evidence before acknowledging.</p><Button type="button" disabled={pending||unknown} onClick={()=>{setBase(version);intent.current=null;}}>Acknowledge current version and keep draft</Button></div>}
 {error&&<p role="alert">{error}</p>}<Button type="submit" disabled={pending||(!unknown&&(changed||(!rerun&&!run.editable)||(needsReason&&!reason.trim())))}>{pending?'Saving…':unknown?'Retry same request':'Confirm'}</Button></>}
 {result!==null&&<div role="status"><p>{rerun?'Analysis refresh queued. Processing may remain paused.':action==='apply_suggestion'?(result.status==='blocked'?'Suggestion application was blocked by current Outreach state. Review the updated Outreach record.':'Suggestion applied as Owner-origin work.'):action.startsWith('confirm')?'Your review of this exact version is recorded.':'Your Owner instruction is saved.'}</p>
 {Array.isArray(result.outcomes)&&result.outcomes.map((outcome,index)=>{if(typeof outcome!=='object'||outcome===null)return null;return <p key={index}>{label(String(outcome.status))}{outcome.reason?`: ${label(String(outcome.reason))}`:''}</p>;})}
 {result.reanalysis!==null&&typeof result.reanalysis==='object'&&'status' in result.reanalysis&&<p>Analysis refresh: {label(String(result.reanalysis.status))}.</p>}
 </div>}
 <Button type="button" disabled={pending} onClick={onClose}>{result?'Done':'Cancel'}</Button>
 </form></dialog>;
}
