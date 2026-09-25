"use client";
import { useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { reviewItemsSchema,readSalesIntelligence } from '@/lib/api/salesIntelligence';
import { salesIntelligenceKeys } from '@/lib/query/salesIntelligence';
import { Button } from './atoms/button';
import { EvidenceCommand } from './evidence-command';
import { copy } from "./sales-intelligence-copy";
import { formatDateTime,label,reviewCauseLabel } from './lib/format';
import { useLandOnHash } from './outreach/land-on-hash';

export function ReviewItems({subjectKey}:{subjectKey:string}) {
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const list=useInfiniteQuery({queryKey:[...salesIntelligenceKeys.all,'reviews',subjectKey],initialPageParam:null as string|null,
  queryFn:({pageParam,signal})=>readSalesIntelligence(`review-items?subject_key=${encodeURIComponent(subjectKey)}&limit=25${pageParam?`&cursor=${encodeURIComponent(pageParam)}`:''}`,reviewItemsSchema,signal),getNextPageParam:page=>page.data.cursor??undefined,retry:false});
 const rows=list.data?.pages.flatMap(p=>p.data.items)??[],selected=rows.find(r=>r.id===selectedId);
 // UI1-ANALYSIS-WIRE: a finding relation's link (`?tab=work#review-item-{id}`) lands on its row once the list is read.
 const root=useRef<HTMLElement>(null);
 useLandOnHash(root,list.isSuccess);
 return <section ref={root} className="si-local-stack"><h3>{copy.needsReview.title}</h3>{list.isPending&&<p role="status">Loading review decisions…</p>}
 {list.error&&<p role="alert">{copy.errors.reviewsFailed} <Button variant="link" onClick={()=>void list.refetch()}>{copy.actions.retry}</Button></p>}
 {list.isSuccess&&!rows.length&&<p>{copy.empty.reviewsNone}</p>}
 {rows.map(row=><article key={row.id} id={`review-item-${row.id}`}><h4>{reviewCauseLabel(row.cause_kind)} · {label(row.state)}</h4><p>Opened {formatDateTime(row.opened_at)}</p>{row.resolution_reason&&<p>{row.resolution_reason}</p>}
 <p>Resolve identity through attachments and contact restrictions through their dedicated controls. Dismissing a decision cannot lift those blockers.</p>
 {row.allowed_actions.map(action=><Button key={action.action} disabled={!action.enabled} onClick={()=>setSelectedId(row.id)}>Resolve with no further action</Button>)}</article>)}
 {list.hasNextPage&&<Button disabled={list.isFetching} onClick={()=>void list.fetchNextPage()}>{copy.actions.loadMore}</Button>}
 {selected&&<EvidenceCommand title="Resolve review with no further action" revision={selected.revision} enabled={selected.allowed_actions.some(a=>a.action==='resolve_review'&&a.enabled)} context={<p>{reviewCauseLabel(selected.cause_kind)} · {label(selected.state)}. Existing identity and contact blockers remain enforced.</p>} onClose={()=>setSelectedId(null)} build={(reason,revision)=>({method:'POST',path:`review-items/${selected.id}/resolve`,body:{command:'resolve_review',expected_revision:revision,resolution:'no_action',completed_command_id:null,reason}})}/>}
 </section>;
}

