"use client";
import { useQuery } from '@tanstack/react-query';
import { numberSearchSchema,readSalesIntelligence } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';
import { Badge } from './atoms/badge';
import { formatDateTime,label } from './lib/format';

export function NumberBrowser({params,update}:{params:URLSearchParams;update:(values:Record<string,string|null>)=>void}) {
 const query=new URLSearchParams({limit:'50'});
 for(const key of ['q','classification','attachment','hygiene','active_from','active_to']) { const value=params.get(key); if(value) query.set(key,value); }
 const cursor=params.get('number_cursor'); if(cursor) query.set('cursor',cursor);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'numbers',query.toString()],
  queryFn:({signal})=>readSalesIntelligence(`numbers?${query}`,numberSearchSchema,signal),retry:false});
 const filter=(values:Record<string,string|null>)=>update({...values,number_cursor:null});
 return <section className="si-local-stack" aria-label="Number search">
 <form className="si-local-filters" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);filter({q:String(data.get('q')).trim()||null});}}>
 <label>Phone, name, Job Number or Agent<input className="si-input" name="q" key={params.get('q')} defaultValue={params.get('q')??''} maxLength={200}/></label><Button type="submit">Search</Button>
 </form>
 <div className="si-local-filters">
 <label>Classification<select className="si-select" value={params.get('classification')??''} onChange={event=>filter({classification:event.target.value||null})}><option value="">All classifications</option>{['unknown','customer','company','non_customer'].map(value=><option key={value} value={value}>{label(value)}</option>)}</select></label>
 <label>Lead connections<select className="si-select" value={params.get('attachment')??'any'} onChange={event=>filter({attachment:event.target.value})}><option value="any">All numbers</option><option value="linked">With attachments or candidates</option><option value="unlinked">Without attachments or candidates</option></select></label>
 <label><input type="checkbox" checked={params.get('hygiene')==='true'} onChange={event=>filter({hygiene:event.target.checked?'true':null})}/> Company and other internal endpoints</label>
 <Button onClick={()=>void list.refetch()}>Refresh numbers</Button>
 </div>
 {list.isPending && <p role="status">Searching Number Activity…</p>}
 {list.error && <p role="alert">Number search could not refresh. <Button onClick={()=>void list.refetch()}>Retry search</Button></p>}
 {list.data && <><p>As of {formatDateTime(list.data.as_of)} · History known through {formatDateTime(list.data.coverage.known_through)}</p>
 {!list.data.data.items.length && <p>No numbers match these filters.</p>}
 <ul className="si-rows">{list.data.data.items.map(number=><li className="si-row" key={number.id} aria-current={params.get('number')===number.id||undefined}>
 <div className="si-row__identity"><strong>{number.e164}</strong><span>{number.provider_names.join(', ')||'Name not observed'}</span></div>
 <div className="si-chiprow"><Badge>{label(number.classification)}</Badge><Badge>{label(number.eligibility)}</Badge></div>
 <p>Last activity {formatDateTime(number.last_activity_at)}</p><p>{number.rollups.attached_lead_count} attached Leads · {number.rollups.candidate_lead_count} candidates</p>
 <div className="si-row__actions"><Button onClick={()=>update({number:number.id,outreach:null,lead:null,lead_model:null})} aria-label={`Open ${number.e164}`}>Open Number Activity</Button></div>
 </li>)}</ul>
 <div className="si-local-filters">{cursor && <Button onClick={()=>update({number_cursor:null})}>First page</Button>}{list.data.data.cursor && <Button disabled={list.isFetching} onClick={()=>update({number_cursor:list.data!.data.cursor})}>Next numbers</Button>}</div></>}
 </section>;
}
