"use client";
import { useEffect,useId,useRef,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { fetchCatalogItems } from '@/lib/api/catalog';
import { SalesIntelligenceError,sendSalesIntelligence,type CommandIntent,type Followup,type Outreach } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { buildIntent,commandLabels,initialDraft,type Draft } from './lib/commands';
import { formatDateTime,label } from './lib/format';
import { Button } from './atoms/button';

export function CommandDialog({command,record,action,onClose}:{command:string;record:Outreach;action?:Followup;onClose:()=>void}) {
 const titleId=useId(),ref=useRef<HTMLDialogElement>(null),client=useQueryClient();
 const [baseline,setBaseline]=useState(()=>({record,action}));
 const originalAction=useRef(action);
 const [draft,setDraft]=useState(()=>({...initialDraft(action),...(command==='assign'?{agent:record.assignment.agent?.id??''}:{})}));
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const intent=useRef<CommandIntent|null>(null),submitting=useRef(false);
 const agents=useQuery({queryKey:['catalog','agents','csi-current'],queryFn:()=>fetchCatalogItems('agents',{includeInactive:true}),enabled:['assign','create_followup','patch_followup'].includes(command)});
 useEffect(()=>{const dialog=ref.current,opener=document.activeElement,parent=opener?.closest('dialog');dialog?.showModal();return ()=>{dialog?.close();if(opener instanceof HTMLElement&&opener.isConnected&&!opener.matches(':disabled'))opener.focus();else parent?.querySelector<HTMLElement>('button:not(:disabled),a[href]')?.focus();};},[]);
 const changed=record.revision!==baseline.record.revision||action?.revision!==baseline.action?.revision;
 const available=(action??record).allowed_actions.find(a=>a.action===command)?.enabled===true;
 const change=(field:keyof Draft,value:string)=>{setDraft(old=>({...old,[field]:value}));intent.current=null;setError('');};
 async function submit() {
  if(submitting.current)return;
  submitting.current=true;setPending(true);setError('');
  try {
   intent.current??=buildIntent(command,draft,baseline.record,baseline.action,crypto.randomUUID(),originalAction.current);
   const result=await sendSalesIntelligence(intent.current);
   setUncertain(false);intent.current=null;
   await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});
   if(result.response.blocked) {setError(`The server did not apply this action: ${label(String(result.response.reason??result.response.blocked))}. Review the current record.`);return;}
   onClose();
  } catch(cause) {
   if(cause instanceof SalesIntelligenceError) {
    const unknown=cause.status>=500;
    setUncertain(unknown);
    if(!unknown)intent.current=null;
    setError(cause.code==='REVISION_CONFLICT'?'The record changed. Your draft is preserved. Review the current values below before submitting again.':`The server rejected this request: ${label(cause.code)}${cause.requestId?` (request ${cause.requestId})`:''}.`);
   } else if(intent.current) {setUncertain(true);setError('The outcome is unknown. Retry this exact request to recover its saved result.');}
   else setError(cause instanceof Error?cause.message:'Check your entries.');
   await client.invalidateQueries({queryKey:salesIntelligenceKeys.all});
  } finally {submitting.current=false;setPending(false);}
 }
 const editor=['create_followup','patch_followup'].includes(command),withAgent=editor||command==='assign';
 const withDate=editor||command==='set_waiting'||command==='snooze_followup';
 const withReason=['patch_followup','assign','set_waiting','reopen','snooze_followup','cancel_followup'].includes(command);
 const withNote=['mark_worked','add_note','close','complete_followup'].includes(command);
 return <dialog ref={ref} className="si-root si-local-command" aria-labelledby={titleId} onCancel={event=>{event.stopPropagation();if(pending)event.preventDefault();else onClose();}}>
 <form className="si-local-stack" onSubmit={event=>{event.preventDefault();void submit();}}>
 <h2 id={titleId}>{commandLabels[command]}</h2>
 {action && <p>{action.description} · Due {action.due_at?formatDateTime(action.due_at):'Undated'} · Assigned to {action.assignment.agent?.name??'Unassigned'}</p>}
 <p>Outreach owned by {record.assignment.agent?.name??'Unassigned'} · {label(record.state)}</p>
 {command==='close' && <p>Closing cancels active follow-ups and preserves their history.</p>}
 {command==='reopen' && <p>Reopening checks current eligibility. Cancelled follow-ups remain in history.</p>}
 {command==='mark_worked' && <p>This records work without claiming that anyone spoke with the customer. A next step is optional.</p>}
 {changed && <div className="si-local-notice" role="status"><p>Server values changed while this draft was open.</p><p>Current state: {label(record.state)}. Current Outreach owner: {record.assignment.agent?.name??'Unassigned'}.</p>{action&&<p>Current follow-up: {action.description}; due {action.due_at?formatDateTime(action.due_at):'Undated'}; assigned to {action.assignment.agent?.name??'Unassigned'}; {label(action.status)}.</p>}
 {!uncertain&&<Button type="button" disabled={pending} onClick={()=>{setBaseline({record,action});intent.current=null;setError('');}}>Use these revisions and keep my draft</Button>}</div>}
 {error && <p role="alert">{error}</p>}
 <fieldset disabled={pending||uncertain} className="si-local-stack">
 {editor&&<><label>Action kind<select className="si-select" value={draft.kind} onChange={e=>change('kind',e.target.value)}>{['call','text','send_estimate','check_availability','review','wait','reconcile_identity','other'].map(kind=><option key={kind} value={kind}>{label(kind)}</option>)}</select></label><label>Description<textarea className="si-textarea" maxLength={500} required value={draft.description} onChange={e=>change('description',e.target.value)}/></label></>}
 {withDate&&<label>{command==='snooze_followup'?'Snooze until':command==='set_waiting'?'Wait until':'Due date (optional)'}<input className="si-input" type="datetime-local" step="1" value={draft.due} onChange={e=>change('due',e.target.value)}/><span className="si-text--subtle">Eastern time. Blank follow-up dates remain undated.</span></label>}
 {withAgent&&<label>{command==='assign'?'Overall Outreach owner':'This follow-up’s responsible Agent'}<select className="si-select" value={draft.agent} onChange={e=>change('agent',e.target.value)}><option value="">Unassigned</option>{draft.agent&&!agents.data?.some(a=>a.id===draft.agent)&&<option value={draft.agent}>{action?.assignment.agent?.name??record.assignment.agent?.name??'Current Agent'}</option>}{agents.data?.map(agent=><option value={agent.id} key={agent.id}>{agent.name}{agent.active?'':' (inactive)'}</option>)}</select>{agents.error&&<span role="alert">Agent list unavailable. <Button type="button" onClick={()=>void agents.refetch()}>Retry Agents</Button></span>}</label>}
 {withReason&&<label>Reason{command==='assign'?' (optional)':''}<textarea className="si-textarea" maxLength={500} required={command!=='assign'} value={draft.reason} onChange={e=>change('reason',e.target.value)}/></label>}
 {command==='close'&&<label>Closure reason<select className="si-select" value={draft.closeReason} onChange={e=>change('closeReason',e.target.value)}><option value="owner_dismissed">Closed by Owner</option><option value="lost">Lost</option><option value="not_sales">Not sales</option></select></label>}
 {command==='complete_followup'&&<label>Actual outcome<select className="si-select" value={draft.disposition} onChange={e=>change('disposition',e.target.value)}>{['completed','no_answer','left_voicemail','spoke_with_customer','connected_contact_unknown','customer_called'].map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>}
 {withNote&&<label>{command==='add_note'?'Note':'Note (optional)'}<textarea className="si-textarea" maxLength={500} required={command==='add_note'} value={draft.note} onChange={e=>change('note',e.target.value)}/></label>}
 </fieldset>
 {!available&&!uncertain&&<p role="status">This action is no longer available on the current record.</p>}
 <div className="si-local-filters"><Button type="submit" disabled={pending||(!uncertain&&(changed||!available))}>{pending?'Saving…':uncertain?'Retry same request':'Save'}</Button><Button type="button" disabled={pending} onClick={onClose}>Cancel</Button></div>
 </form></dialog>;
}

