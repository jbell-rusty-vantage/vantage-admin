"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readSalesIntelligence,repsSchema,reviewedNudgeChannels } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';
import { EvidenceCommand } from './evidence-command';
import { copy } from "./sales-intelligence-copy";
import { formatDateTime,label } from './lib/format';

export function Reps({params,update}:{params:URLSearchParams;update:(values:Record<string,string|boolean|null|undefined>)=>void}) {
 const [selectedId,setSelectedId]=useState<string|null>(null),account=params.get('rc_account_id');
 const query=new URLSearchParams({rc_account_id:account??'',limit:'50'});
 if(params.get('rep_cursor'))query.set('cursor',params.get('rep_cursor')!);
 if(params.get('directory_cursor'))query.set('directory_cursor',params.get('directory_cursor')!);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'reps',query.toString()],enabled:!!account,queryFn:({signal})=>readSalesIntelligence(`reps?${query}`,repsSchema,signal),retry:false});
 const selected=list.data?.data.items.find(row=>row.id===selectedId);
 return <section className="si-local-stack"><h2>{copy.reps.title}</h2>
 <form className="si-local-filters" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);update({rc_account_id:String(data.get('account')).trim(),rep_cursor:null,directory_cursor:null});}}><label>{copy.reps.accountLabel}<input className="si-input" name="account" required maxLength={500} key={account} defaultValue={account??''}/></label><Button type="submit">{copy.reps.load}</Button></form>
 {!account&&<p>{copy.reps.accountHint}</p>}
 {account&&list.isPending&&<p role="status">Loading Rep links…</p>}{list.error&&<p role="alert">{copy.errors.repsFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.data&&<><p>Directory {label(list.data.data.directory.status)} · Observed {formatDateTime(list.data.data.directory.taken_at)}. Provider completeness is unverified.</p>
 <p>{copy.reps.metricsUnavailable}</p>
 {list.data.data.items.map(rep=><article className="si-local-stack" key={rep.id}><h3>{rep.agent_name} · {rep.rc_extension_name??rep.rc_extension_number??'Extension name unavailable'}</h3><p>{label(rep.status)} · {label(rep.role_kind)} · Effective {formatDateTime(rep.effective_from)} through {rep.effective_to?formatDateTime(rep.effective_to):'ongoing'}</p><p>Channels {rep.nudge_channels_allowed.length?rep.nudge_channels_allowed.map(label).join(', '):'none recorded'} · Stored DIDs {rep.rc_direct_numbers.length}</p><details><summary>Identity history</summary>{rep.history.map((event,index)=><p key={index}>{formatDateTime(event.at)} · {event.change}</p>)}</details>{rep.status==='proposed'&&<Button onClick={()=>setSelectedId(rep.id)}>Review proposed identity</Button>}</article>)}
 {!list.data.data.items.length&&<p>{copy.reps.none}</p>}
 <div className="si-local-filters">{params.get('rep_cursor')&&<Button onClick={()=>update({rep_cursor:null})}>First Rep page</Button>}{list.data.data.next_cursor&&<Button disabled={list.isFetching} onClick={()=>update({rep_cursor:list.data!.data.next_cursor})}>Next Rep links</Button>}</div>
 <h3>Directory identity evidence</h3>{list.data.data.directory.users.map(user=><p key={user.extension_id}>{user.extension_name??'Name unavailable'} · {label(user.status)}{user.candidates.map(candidate=>` · ${candidate.agent_name} (${label(candidate.basis)})`).join('')}</p>)}
 <div className="si-local-filters">{params.get('directory_cursor')&&<Button onClick={()=>update({directory_cursor:null})}>First directory page</Button>}{list.data.data.directory.next_cursor&&<Button disabled={list.isFetching} onClick={()=>update({directory_cursor:list.data!.data.directory.next_cursor})}>Next directory entries</Button>}</div></>}
 {selected&&<EvidenceCommand title="Review proposed Rep identity" revision={selected.revision} enabled={selected.status==='proposed'} context={<><p>Confirm {selected.agent_name} is {selected.rc_extension_name??selected.rc_extension_id}, with role {label(selected.role_kind)}, from {formatDateTime(selected.effective_from)} through {selected.effective_to?formatDateTime(selected.effective_to):'ongoing'}.</p><p>{reviewedNudgeChannels(selected.rc_direct_numbers).includes('sms_to_rep')?copy.reps.channelsPagerSms:copy.reps.channelsPager}</p><p>{copy.reps.reviewChannels}</p></>} onClose={()=>setSelectedId(null)} build={(reason,revision)=>({method:'POST',path:`reps/${selected.id}/review`,body:{expected_revision:revision,reason,status:'reviewed',link:{agent_id:selected.agent_id,rc_account_id:selected.rc_account_id,rc_extension_id:selected.rc_extension_id,role_kind:selected.role_kind,effective_from:selected.effective_from,effective_to:selected.effective_to,nudge_channels_allowed:reviewedNudgeChannels(selected.rc_direct_numbers)}}})}/>}
 </section>;
}
