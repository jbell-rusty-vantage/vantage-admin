"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Outreach } from '@/lib/api/salesIntelligence';
import { officialRecordHref } from './lib/official-record';
import { FollowupCard } from './followup-card';
import { OwnershipSplit } from './ownership';
import { CallStateBadge, CallStateLine } from './call-state';
import { LeadProvenance } from './lead-provenance';
import { Badge } from './atoms/badge';
import { Button } from './atoms/button';
import { CommandDialog } from './command-dialog';
import { MessageRepDialog } from './message-rep-dialog';
import { commandLabels } from './lib/commands';
import { callBlockerSentence, splitCommands } from './lib/owner-now';
import { copy } from "./sales-intelligence-copy";
import { contactTypeLabel, formatDateTime,label } from './lib/format';

type Availability = Outreach['allowed_actions'][number];

export function OutreachDetail({record,accountId}:{record:Outreach;accountId?:string|null}) {
 const [editing,setEditing]=useState<{command:string;actionId?:string}|null>(null);
 const [messaging,setMessaging]=useState(false);
 const selected=record.followups.find(action=>action.id===editing?.actionId);
 const link=record.subject.kind==='lead'?officialRecordHref(record.subject.model,record.subject.id):null;
 const deck=splitCommands(record.allowed_actions,commandLabels);
 const command=(item:Availability,variant:'primary'|'secondary'|'ghost'='secondary')=>
  <Button key={item.action} variant={variant} disabled={!item.enabled}
   title={item.enabled?undefined:callBlockerSentence(item.action,record,item.blocker_codes,copy.call.blockers,copy.call.blockerCodes)||undefined}
   onClick={()=>setEditing({command:item.action})}>{commandLabels[item.action]}</Button>;
 return <section className="si-local-stack"><h3>{copy.panel.outreach} · {label(record.state)}</h3>
 <div className="si-chiprow"><CallStateBadge record={record}/></div>
 <CallStateLine record={record}/>
 <OwnershipSplit overallOwner={record.assignment.agent}/>
 <LeadProvenance record={record}/>
 {record.lead_display&&<p>{record.lead_display.name??copy.fields.unknown} · Job Number {record.lead_display.job_no??copy.time.notObserved} · {record.lead_display.source_company??copy.fields.unknown}</p>}
 {link&&<Link href={link}>Open official Lead</Link>}
 {record.related_record_links?.filter(item=>item.model==='BookedLead'||item.model==='CancelledLead').map(item=><Link key={`${item.model}:${item.id}`} href={officialRecordHref(item.model,item.id)}>Open official {item.model==='BookedLead'?'Booking':'Cancellation'} · {label(item.certainty)}</Link>)}
 {record.latest_number_call&&<p>{copy.fields.lastActivity}: {label(record.latest_number_call.direction)} · {record.latest_number_call.provider_result?label(record.latest_number_call.provider_result):copy.fields.unknown} · {contactTypeLabel(record.latest_number_call.contact_type)} · {formatDateTime(record.latest_number_call.happened_at)}</p>}
 <p>{copy.fields.lastMeaningfulContact}: {formatDateTime(record.last_meaningful_contact_at)}</p>
 <div className="si-chiprow">{record.derived.reasons.map(reason=><Badge key={reason}>{label(reason)}</Badge>)}{record.derived.review_badges?.map(reason=><Badge tone="amber" key={reason}>{label(reason)}</Badge>)}</div>
 {record.derived.call_blockers.length>0&&<p>Calling blocked: {record.derived.call_blockers.map(label).join(', ')}</p>}
 <div className="si-actions"><span className="si-ownership__label">{copy.now.decide}</span>
 <div className="si-actions__primary">{deck.call&&command(deck.call,'primary')}{deck.secondary.map(item=>command(item))}
 <Button variant="ghost" disabled={record.state==='closed'} onClick={()=>setMessaging(true)}>{copy.messageRep.title}</Button></div>
 {!!deck.more.length&&<details className="si-now__more"><summary>{copy.now.moreActions}</summary><div className="si-actions__secondary">{deck.more.map(item=>command(item,'ghost'))}</div></details>}
 </div>
 <h3>{copy.panel.followups}</h3>{record.followups.filter(f=>f.status==='open').map(f=><div className="si-local-stack" key={f.id}><FollowupCard followup={f} overallOwner={record.assignment.agent}/><div className="si-local-filters">{f.allowed_actions.filter(action=>commandLabels[action.action]).map(action=><Button key={action.action} disabled={!action.enabled} onClick={()=>setEditing({command:action.action,actionId:f.id})}>{commandLabels[action.action]}</Button>)}</div></div>)}
 {!record.followups.some(f=>f.status==='open')&&<p>{copy.empty.followupsNone}</p>}
 <details><summary>{copy.panel.completedFollowups}</summary>{record.followups.filter(f=>f.status!=='open').map(f=><FollowupCard key={f.id} followup={f} overallOwner={record.assignment.agent}/>)}</details>
 {editing&&<CommandDialog key={`${editing.command}:${editing.actionId??record.id}`} command={editing.command} record={record} action={selected} onClose={()=>setEditing(null)}/>}
 {messaging&&<MessageRepDialog record={record} accountId={accountId??null} onClose={()=>setMessaging(false)}/>}
 </section>;
}
