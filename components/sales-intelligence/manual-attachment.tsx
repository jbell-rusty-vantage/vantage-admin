"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchGlobalSearch } from '@/lib/api/admin';
import { attachmentsSchema,readSalesIntelligence,type NumberRead } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { officialRecordHref } from './lib/official-record';
import { EvidenceCommand } from './evidence-command';
import { Button } from './atoms/button';

type Choice={id:string;model:'FormLead'|'CallLead';name:string;detail?:string};
export function ManualAttachment({number}:{number:NumberRead['data']}) {
 const [query,setQuery]=useState(''),[choice,setChoice]=useState<Choice|null>(null);
 const search=useQuery({queryKey:[...salesIntelligenceKeys.all,'official-lead-search',query],enabled:query.length>=2,queryFn:()=>fetchGlobalSearch({q:query,database_scope:'production',limit:10}),retry:false});
 const candidates=search.data?.groups.flatMap(group=>{
  const model=['form_lead','form-leads'].includes(group.record_type)?'FormLead' as const:['call_lead','call-leads'].includes(group.record_type)?'CallLead' as const:null;
  return model?group.items.filter(item=>item.database_scope==='production').map(item=>({id:item.id,model,name:item.primary_label,detail:item.secondary_label})):[];
 })??[];
 const pair=useQuery({queryKey:[...salesIntelligenceKeys.all,'attachment-pair',number.id,choice?.model,choice?.id],enabled:!!choice,queryFn:({signal})=>readSalesIntelligence(`attachments?contact_number_id=${number.id}&lead_model=${choice!.model}&lead_id=${choice!.id}&limit=1`,attachmentsSchema,signal),retry:false});
 const edge=pair.data?.data.items[0],availability=(edge?.allowed_actions??number.allowed_actions).find(action=>action.action==='attach_lead');
 return <details><summary>Find another Lead to attach</summary><div className="si-local-stack">
 <p>Search Current Form Leads and Call Leads. Search results are evidence to review; searching does not attach a Lead.</p>
 <form className="si-local-stack" onSubmit={event=>{event.preventDefault();setChoice(null);setQuery(String(new FormData(event.currentTarget).get('leadQuery')).trim());}}><label>Find Lead by name, phone or Job Number<input className="si-input" name="leadQuery" minLength={2} maxLength={200} required/></label><Button type="submit">Search official Leads</Button></form>
 {query&&search.isPending&&<p role="status">Searching official Leads…</p>}{search.error&&<p role="alert">Lead search could not load. <Button onClick={()=>void search.refetch()}>Retry Lead search</Button></p>}
 {search.isSuccess&&!candidates.length&&<p>No Leads in these search results. Refine the search.</p>}
 {candidates.map(item=><article key={`${item.model}:${item.id}`}><p>{item.name} · {item.detail}</p><Link href={officialRecordHref(item.model,item.id)}>Inspect official {item.model==='FormLead'?'Form Lead':'Call Lead'}</Link><Button onClick={()=>setChoice(item)}>Review attachment for {item.name}</Button></article>)}
 {choice&&pair.isPending&&<p role="status">Checking existing attachment…</p>}{choice&&pair.error&&<p role="alert">Attachment check failed. <Button onClick={()=>void pair.refetch()}>Retry attachment check</Button></p>}
 {choice&&pair.isSuccess&&<EvidenceCommand key={`${choice.model}:${choice.id}`} title="Attach selected Lead" revision={edge?.revision??number.revision} enabled={availability?.enabled===true} context={<p>Attach {choice.name} ({choice.model==='FormLead'?'Form Lead':'Call Lead'}) to {number.e164}. {edge?`Current attachment: ${edge.state}.`:'No attachment currently exists for this pair.'} The server will recheck the evidence and preserve official-record authority.</p>} onClose={()=>setChoice(null)} build={(reason,revision)=>({method:'POST',path:'attachments/attach',body:{command:'attach_lead',expected_revision:revision,contact_number_id:number.id,lead_ref:{model:choice.model,id:choice.id},reason}})}/>}
 </div></details>;
}
