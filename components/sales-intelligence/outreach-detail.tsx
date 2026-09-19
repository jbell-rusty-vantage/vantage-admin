"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Outreach } from '@/lib/api/salesIntelligence';
import { officialRecordHref } from './lib/official-record';
import { FollowupCard } from './followup-card';
import { OwnershipSplit } from './ownership';
import { Badge } from './atoms/badge';
import { Button } from './atoms/button';
import { CommandDialog } from './command-dialog';
import { commandLabels } from './lib/commands';
import { copy } from "./sales-intelligence-copy";
import { contactTypeLabel, formatDateTime,label } from './lib/format';

export function OutreachDetail({record}:{record:Outreach}) {
 const [editing,setEditing]=useState<{command:string;actionId?:string}|null>(null);
 const selected=record.followups.find(action=>action.id===editing?.actionId);
 const link=record.subject.kind==='lead'?officialRecordHref(record.subject.model,record.subject.id):null;
 return <section className="si-local-stack"><h3>{copy.panel.outreach} · {label(record.state)}</h3>
 <OwnershipSplit overallOwner={record.assignment.agent}/>
 {record.lead_display&&<p>{record.lead_display.name??copy.fields.unknown} · Job Number {record.lead_display.job_no??copy.time.notObserved} · {record.lead_display.source_company??copy.fields.unknown}</p>}
 {link&&<Link href={link}>Open official Lead</Link>}
 {record.related_record_links?.filter(item=>item.model==='BookedLead'||item.model==='CancelledLead').map(item=><Link key={`${item.model}:${item.id}`} href={officialRecordHref(item.model,item.id)}>Open official {item.model==='BookedLead'?'Booking':'Cancellation'} · {label(item.certainty)}</Link>)}
 {record.latest_number_call&&<p>{copy.fields.lastActivity}: {label(record.latest_number_call.direction)} · {record.latest_number_call.provider_result?label(record.latest_number_call.provider_result):copy.fields.unknown} · {contactTypeLabel(record.latest_number_call.contact_type)} · {formatDateTime(record.latest_number_call.happened_at)}</p>}
 <p>{copy.fields.lastMeaningfulContact}: {formatDateTime(record.last_meaningful_contact_at)}</p>
 <div className="si-chiprow">{record.derived.reasons.map(reason=><Badge key={reason}>{label(reason)}</Badge>)}{record.derived.review_badges?.map(reason=><Badge tone="amber" key={reason}>{label(reason)}</Badge>)}</div>
 {record.derived.call_blockers.length>0&&<p>Calling blocked: {record.derived.call_blockers.map(label).join(', ')}</p>}
 <div className="si-local-filters">{record.allowed_actions.filter(action=>commandLabels[action.action]).map(action=><Button key={action.action} disabled={!action.enabled} title={action.blocker_codes.map(label).join(', ')} onClick={()=>setEditing({command:action.action})}>{commandLabels[action.action]}</Button>)}</div>
 <h3>{copy.panel.followups}</h3>{record.followups.filter(f=>f.status==='open').map(f=><div className="si-local-stack" key={f.id}><FollowupCard followup={f} overallOwner={record.assignment.agent}/><div className="si-local-filters">{f.allowed_actions.filter(action=>commandLabels[action.action]).map(action=><Button key={action.action} disabled={!action.enabled} onClick={()=>setEditing({command:action.action,actionId:f.id})}>{commandLabels[action.action]}</Button>)}</div></div>)}
 {!record.followups.some(f=>f.status==='open')&&<p>{copy.empty.followupsNone}</p>}
 <details><summary>{copy.panel.completedFollowups}</summary>{record.followups.filter(f=>f.status!=='open').map(f=><FollowupCard key={f.id} followup={f} overallOwner={record.assignment.agent}/>)}</details>
 {editing&&<CommandDialog key={`${editing.command}:${editing.actionId??record.id}`} command={editing.command} record={record} action={selected} onClose={()=>setEditing(null)}/>}
 </section>;
}

