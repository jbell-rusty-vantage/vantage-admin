"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readSalesIntelligence,repsSchema } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';
import { EvidenceCommand } from './evidence-command';
import { formatDateTime,label } from './lib/format';

export function Reps({params,update}:{params:URLSearchParams;update:(values:Record<string,string|null>)=>void}) {
 const [selectedId,setSelectedId]=useState<string|null>(null),account=params.get('rc_account_id');
 const query=new URLSearchParams({rc_account_id:account??'',limit:'50'});
 if(params.get('rep_cursor'))query.set('cursor',params.get('rep_cursor')!);
 if(params.get('directory_cursor'))query.set('directory_cursor',params.get('directory_cursor')!);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'reps',query.toString()],enabled:!!account,queryFn:({signal})=>readSalesIntelligence(`reps?${query}`,repsSchema,signal),retry:false});
 const selected=list.data?.data.items.find(row=>row.id===selectedId);
 return <section className="si-local-stack"><h2>Reps</h2>
 <form className="si-local-filters" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);update({rc_account_id:String(data.get('account')).trim(),rep_cursor:null,directory_cursor:null});}}><label>RingCentral account ID<input className="si-input" name="account" required maxLength={500} key={account} defaultValue={account??''}/></label><Button type="submit">Load stored Rep links</Button></form>
 {!account&&<p>Enter the account whose stored directory you want to review. Account discovery is not supplied by the current API.</p>}
 {account&&list.isPending&&<p role="status">Loading Rep links…</p>}{list.error&&<p role="alert">Rep links could not refresh. <Button onClick={()=>void list.refetch()}>Retry Reps</Button></p>}
 {list.data&&<><p>Directory {label(list.data.data.directory.status)} · Observed {formatDateTime(list.data.data.directory.taken_at)}. Provider completeness is unverified.</p>
 <p>Rep metrics are unavailable. Reviewed identity is required for attribution. Messaging remains disabled.</p>
 {list.data.data.items.map(rep=><article className="si-local-stack" key={rep.id}><h3>{rep.agent_name} · {rep.rc_extension_name??rep.rc_extension_number??'Extension name unavailable'}</h3><p>{label(rep.status)} · {label(rep.role_kind)} · Effective {formatDateTime(rep.effective_from)} through {rep.effective_to?formatDateTime(rep.effective_to):'ongoing'}</p><details><summary>Identity history</summary>{rep.history.map((event,index)=><p key={index}>{formatDateTime(event.at)} · {event.change}</p>)}</details>{rep.status==='proposed'&&<Button onClick={()=>setSelectedId(rep.id)}>Review proposed identity</Button>}</article>)}
 {!list.data.data.items.length&&<p>No Rep links recorded for this page.</p>}
 <div className="si-local-filters">{params.get('rep_cursor')&&<Button onClick={()=>update({rep_cursor:null})}>First Rep page</Button>}{list.data.data.next_cursor&&<Button disabled={list.isFetching} onClick={()=>update({rep_cursor:list.data!.data.next_cursor})}>Next Rep links</Button>}</div>
 <h3>Directory identity evidence</h3>{list.data.data.directory.users.map(user=><p key={user.extension_id}>{user.extension_name??'Name unavailable'} · {label(user.status)}{user.candidates.map(candidate=>` · ${candidate.agent_name} (${label(candidate.basis)})`).join('')}</p>)}
 <div className="si-local-filters">{params.get('directory_cursor')&&<Button onClick={()=>update({directory_cursor:null})}>First directory page</Button>}{list.data.data.directory.next_cursor&&<Button disabled={list.isFetching} onClick={()=>update({directory_cursor:list.data!.data.directory.next_cursor})}>Next directory entries</Button>}</div></>}
 {selected&&<EvidenceCommand title="Review proposed Rep identity" revision={selected.revision} enabled={selected.status==='proposed'} context={<p>Confirm {selected.agent_name} is {selected.rc_extension_name??selected.rc_extension_id}, with role {label(selected.role_kind)}, from {formatDateTime(selected.effective_from)} through {selected.effective_to?formatDateTime(selected.effective_to):'ongoing'}. This establishes reviewed identity; it sends no message.</p>} onClose={()=>setSelectedId(null)} build={(reason,revision)=>({method:'POST',path:`reps/${selected.id}/review`,body:{expected_revision:revision,reason,status:'reviewed',link:{agent_id:selected.agent_id,rc_account_id:selected.rc_account_id,rc_extension_id:selected.rc_extension_id,role_kind:selected.role_kind,effective_from:selected.effective_from,effective_to:selected.effective_to,nudge_channels_allowed:selected.nudge_channels_allowed,...(selected.rc_team_messaging_person_id!==undefined?{rc_team_messaging_person_id:selected.rc_team_messaging_person_id}:{})}}})}/>}
 </section>;
}
