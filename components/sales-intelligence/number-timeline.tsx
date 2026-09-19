"use client";
import { useInfiniteQuery,useQuery } from '@tanstack/react-query';
import { fetchCatalogItems } from '@/lib/api/catalog';
import { readSalesIntelligence,timelineSchema } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';
import { formatDateTime,label } from './lib/format';

function HistoryValues({value,agents}:{value:unknown;agents:Map<string,string>}) {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const data=value as Record<string,unknown>;
 return <>{typeof data.note==='string'&&<p>{data.note}</p>}{typeof data.reason==='string'&&<p>Reason: {data.reason}</p>}{typeof data.resolution_reason==='string'&&<p>Decision reason: {data.resolution_reason}</p>}{typeof data.cancel_reason==='string'&&<p>Cancellation reason: {data.cancel_reason}</p>}{typeof data.description==='string'&&<p>{data.description}</p>}{typeof data.disposition==='string'&&<p>Outcome: {label(data.disposition)}</p>}{'due_at' in data&&<p>Due {typeof data.due_at==='string'?formatDateTime(data.due_at):'Undated'}</p>}{typeof data.snoozed_until==='string'&&<p>Snoozed until {formatDateTime(data.snoozed_until)}</p>}{typeof data.closed_reason==='string'&&<p>Closure: {label(data.closed_reason)}</p>}{'responsible_agent_id' in data&&<p>{'outreach_record_id' in data?'Action assigned to':'Outreach owned by'}: {typeof data.responsible_agent_id==='string'?(agents.get(data.responsible_agent_id)??'Unknown Agent'):'Unassigned'}</p>}</>;
}

export function NumberTimeline({numberId}:{numberId:string}) {
 const agents=useQuery({queryKey:['catalog','agents','csi-current'],queryFn:()=>fetchCatalogItems('agents',{includeInactive:true})});
 const names=new Map(agents.data?.map(agent=>[agent.id,agent.name]));
 const timeline=useInfiniteQuery({queryKey:[...salesIntelligenceKeys.all,'timeline',numberId],initialPageParam:null as string|null,
  queryFn:({pageParam,signal})=>readSalesIntelligence(`numbers/${encodeURIComponent(numberId)}/timeline?limit=25${pageParam?`&cursor=${encodeURIComponent(pageParam)}`:''}`,timelineSchema,signal),
  getNextPageParam:page=>page.data.cursor??undefined,retry:false});
 return <section className="si-local-stack"><h3>Number Activity</h3>
 {timeline.isPending && <p role="status">Loading activity…</p>}
 {timeline.error && <p role="alert">Activity could not refresh. <Button onClick={()=>void timeline.refetch()}>Retry activity</Button></p>}
 {timeline.data?.pages[0].data.items.length===0 && <p>No activity observed in available history.</p>}
 <ol className="si-local-stack">{timeline.data?.pages.flatMap(page=>page.data.items).map(event=><li key={`${event.kind}:${event.id}`}>
 <strong>{event.kind==='restriction'?'Contact restriction':label(event.kind)}</strong> · {formatDateTime(event.happened_at)}
 <p>{event.description}</p>
 <HistoryValues value={event.detail.current} agents={names}/>
 {typeof event.detail.actor==='string'&&<p className="si-text--subtle">Recorded by {event.detail.actor}</p>}
 {event.detail.prior&&<details><summary>Earlier values</summary><HistoryValues value={event.detail.prior} agents={names}/></details>}
 {event.kind==='interaction' && <p>Contact: {event.detail.contact_type==='human_conversation'?'Human conversation':event.detail.contact_type==='voicemail'?'Voicemail—speaker unknown':'Connected status does not establish human contact'}</p>}
 {event.observed_at!==event.happened_at && <p className="si-text--subtle">Observed {formatDateTime(event.observed_at)}</p>}
 </li>)}</ol>
 {timeline.hasNextPage && <Button disabled={timeline.isFetching} onClick={()=>void timeline.fetchNextPage()}>Load older activity</Button>}
 </section>;
}
