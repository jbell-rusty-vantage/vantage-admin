"use client";
import { useCallback,useEffect } from 'react';
import { usePathname,useRouter,useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { attentionSchema,numberSchema,outreachReadSchema,readSalesIntelligence,SalesIntelligenceError } from '@/lib/api/salesIntelligence';
import { useSalesIntelligenceLive,salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { AttentionRow } from './attention';
import { DetailPanel } from './detail-panel';
import { Badge } from './atoms/badge';
import { Button } from './atoms/button';
import { formatDateTime,label } from './lib/format';
import './styles/sales-intelligence.css';
import { NumberBrowser } from './number-browser';
import { NumberTimeline } from './number-timeline';
import { OutreachDetail } from './outreach-detail';
import { Attachments } from './attachments';
import { ReviewItems } from './review-items';
import { Reps } from './reps';
import { Restrictions } from './restrictions';
import { ManualAttachment } from './manual-attachment';
import { fetchCatalogItems } from '@/lib/api/catalog';
import Link from 'next/link';
import { officialRecordHref } from './lib/official-record';
import { AnalysisPanel } from './analysis-panel';

function Failure({error,retry}:{error:Error;retry:()=>void}) {
 return <div role="alert" className="si-local-notice">Could not refresh these records. {error instanceof SalesIntelligenceError ? label(error.code) : 'Please retry.'} <Button onClick={retry}>Retry</Button></div>;
}
function Selection({outreachId,numberId,leadId,leadModel,update}:{outreachId:string|null;numberId:string|null;leadId:string|null;leadModel:string|null;update:(values:Record<string,string|null>)=>void}) {
 const selectionParams=useSearchParams();
 const outreach=useQuery({queryKey:[...salesIntelligenceKeys.all,'outreach',outreachId],enabled:!!outreachId,
  queryFn:({signal})=>readSalesIntelligence(`outreach/${encodeURIComponent(outreachId!)}`,outreachReadSchema,signal),retry:false});
 const resolvedNumber=numberId ?? outreach.data?.data.outreach.primary_number?.id;
 const number=useQuery({queryKey:[...salesIntelligenceKeys.all,'number',resolvedNumber],enabled:!!resolvedNumber,
  queryFn:({signal})=>readSalesIntelligence(`numbers/${encodeURIComponent(resolvedNumber!)}`,numberSchema,signal),retry:false});
 return <div className="si-local-stack">
 {outreachId && outreach.isPending && <p role="status">Loading Outreach…</p>}
 {outreach.error && <Failure error={outreach.error} retry={()=>void outreach.refetch()}/>}
 {resolvedNumber && number.isPending && <p role="status">Loading Number…</p>}
 {number.error && <Failure error={number.error} retry={()=>void number.refetch()}/>}
 {number.data && <><h3>{number.data.data.e164}</h3><div className="si-chiprow"><Badge>{label(number.data.data.classification)}</Badge><Badge>Contact: {label(number.data.data.eligibility)}</Badge></div>
 <p>As of {formatDateTime(number.data.as_of)} · History known through {formatDateTime(number.data.coverage.known_through)}</p>
 <section><h3>Running analysis</h3><p>{number.data.data.running_analysis?.text ?? 'No completed analysis available.'}</p></section>
 <Attachments numberId={number.data.data.id}/>
 <ManualAttachment number={number.data.data}/>
 {number.data.data.review_items.filter(r=>r.state==='open').map(r=><Badge key={r.id} tone="amber">{label(r.cause_kind)}</Badge>)}
 <Restrictions rows={number.data.data.restrictions}/>
 </>}
 {outreach.data && <OutreachDetail record={outreach.data.data.outreach}/>}
 {number.data?.data.outreach_records.filter(r=>r.id!==outreachId).map(r=><OutreachDetail record={r} key={r.id}/>)}
 {resolvedNumber && <NumberTimeline numberId={resolvedNumber}/>}
 {resolvedNumber && <AnalysisPanel key={resolvedNumber} numberId={resolvedNumber} selectedRun={selectionParams.get('analysis_run')} onSelect={id=>update({analysis_run:id})}/>}
 {resolvedNumber&&<ReviewItems subjectKey={`number:${resolvedNumber}`}/>}
 {leadId&&leadModel&&<><Link href={officialRecordHref(leadModel==='FormLead'?'FormLead':'CallLead',leadId)}>Open official {leadModel==='FormLead'?'Form Lead':'Call Lead'}</Link><Attachments lead={{id:leadId,model:leadModel}} onNumber={id=>update({number:id})}/><ReviewItems subjectKey={`lead:${leadModel}:${leadId}`}/></>}
 <p className="si-local-notice">Rep messaging is unavailable in this preview.</p>
 </div>;
}
export function SalesIntelligenceWorkspace() {
 const params=useSearchParams(),router=useRouter(),pathname=usePathname();
 const update=useCallback((values:Record<string,string|null>)=>{const next=new URLSearchParams(params);if(['number','outreach','lead'].some(key=>key in values)&&!('analysis_run' in values))next.delete('analysis_run');Object.entries(values).forEach(([k,v])=>v===null?next.delete(k):next.set(k,v));router.replace(`${pathname}?${next}`,{scroll:false});},[params,pathname,router]);
 const live=useSalesIntelligenceLive();
 const agents=useQuery({queryKey:['catalog','agents','csi-current'],queryFn:()=>fetchCatalogItems('agents',{includeInactive:true})});
 const view=params.get('view')==='numbers'?'numbers':params.get('view')==='reps'?'reps':'attention';
 const band=params.get('band') ?? '',review=params.get('needs_review')==='true';
 const query=new URLSearchParams({limit:'50'}); if(band) query.set('band',band); if(review) query.set('needs_review','true');
 for(const key of ['state','agent_id']) {const value=params.get(key);if(value)query.set(key,value);}
 const cursor=params.get('attention_cursor'); if(cursor)query.set('cursor',cursor);
 const list=useQuery({queryKey:[...salesIntelligenceKeys.all,'attention',query.toString()],enabled:view==='attention',queryFn:({signal})=>readSalesIntelligence(`attention?${query}`,attentionSchema,signal),retry:false});
 useEffect(()=>{if(cursor && list.error instanceof SalesIntelligenceError && list.error.code==='ATTENTION_SNAPSHOT_EXPIRED')update({attention_cursor:null});},[cursor,list.error,update]);
 const outreachId=params.get('outreach'),numberId=params.get('number'),leadId=params.get('lead'),leadModel=params.get('lead_model');
 const close=()=>update({outreach:null,number:null,lead:null,lead_model:null});
 return <div className="si-root si-workspace">
 <header className="si-workspace__header"><div className="si-workspace__titlebar"><h1 className="si-workspace__title">Sales Intelligence</h1><Badge tone="blue">{live}</Badge></div>
 <p className="si-local-intro">{view==='attention'?'Needs attention':view==='numbers'?'Numbers / Search':'Reps'} · Current records</p>
 {view==='attention'&&<p className="si-text--subtle">{list.data ? `History known through ${formatDateTime(list.data.coverage.known_through)}` : 'Loading coverage…'}</p>}
 </header>
 <main className="si-workspace__main si-local-stack">
 <nav className="si-local-filters" aria-label="Sales Intelligence views"><Button aria-pressed={view==='attention'} onClick={()=>update({view:'attention'})}>Attention</Button><Button aria-pressed={view==='numbers'} onClick={()=>update({view:'numbers'})}>Numbers / Search</Button><Button aria-pressed={view==='reps'} onClick={()=>update({view:'reps'})}>Reps</Button></nav>
 {view==='reps'?<Reps params={new URLSearchParams(params)} update={update}/>:view==='numbers'?<NumberBrowser params={new URLSearchParams(params)} update={update}/>:<>
 <div className="si-local-filters"><label>Attention band <select className="si-select" value={band} onChange={e=>update({band:e.target.value||null,attention_cursor:null})}><option value="">All bands</option>{['Promised callbacks overdue','No call yet','Missed calls','Follow-ups due','No next step','Nobody owns','Going cold'].map((text,i)=><option value={i+1} key={text}>{i+1} · {text}</option>)}</select></label>
 <label><input type="checkbox" checked={review} onChange={e=>update({needs_review:e.target.checked?'true':null,attention_cursor:null})}/> Needs review</label>
 <label>Outreach state<select className="si-select" value={params.get('state')??''} onChange={e=>update({state:e.target.value||null,attention_cursor:null})}><option value="">All states</option>{['unworked','open','waiting_on_customer','identity_review','closed'].map(state=><option key={state} value={state}>{label(state)}</option>)}</select></label>
 <label>Responsible Agent<select className="si-select" value={params.get('agent_id')??''} onChange={e=>update({agent_id:e.target.value||null,attention_cursor:null})}><option value="">All Agents</option>{agents.data?.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
 <Button onClick={()=>cursor?update({attention_cursor:null}):void list.refetch()}>Refresh</Button></div>
 {list.error && <Failure error={list.error} retry={()=>void list.refetch()}/>}
 {list.isPending && <p role="status">Loading Attention…</p>}
 {list.data?.data.status==='pending_projection' && <p role="status" className="si-local-notice">Attention is being prepared. Counts are not yet available.</p>}
 {list.data?.data.status==='ready' && <><p>{list.data.data.total_items} distinct items · As of {formatDateTime(list.data.as_of)}{list.isFetching ? ' · Refreshing…' : ''}</p>
 {!list.data.data.items.length && <p>No items need attention for these filters.</p>}
 <ul className="si-rows">{list.data.data.items.map(row=><AttentionRow key={row.subject_key} row={row} selected={row.outreach?.id===outreachId || (row.subject.kind==='number_review' && row.subject.contact_number_id===numberId)||(row.subject.kind==='lead'&&row.subject.id===leadId)} onOpen={()=>update({outreach:row.outreach?.id ?? null,number:row.outreach?.primary_number?.id ?? (row.subject.kind==='number_review'?row.subject.contact_number_id:null),lead:row.subject.kind==='lead'?row.subject.id:null,lead_model:row.subject.kind==='lead'?row.subject.model:null})}/>)}</ul>
 <div className="si-local-filters">{cursor && <Button onClick={()=>update({attention_cursor:null})}>First page</Button>}{list.data.data.cursor && <Button disabled={list.isFetching} onClick={()=>update({attention_cursor:list.data!.data.cursor})}>Next Attention items</Button>}</div></>}
 </>}
 </main>
 {(outreachId || numberId || leadId) && <DetailPanel onClose={close}><Selection outreachId={outreachId} numberId={numberId} leadId={leadId} leadModel={leadModel} update={update}/></DetailPanel>}
 </div>;
}

