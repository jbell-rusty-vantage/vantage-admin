"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import type { Outreach } from '@/lib/api/salesIntelligence';
import { officialRecordHref } from './lib/official-record';
import { FollowupCard } from './followup-card';
import { OwnershipSplit } from './ownership';
import { CallStateBadge, CallStateLine } from './call-state';
import { LeadProvenance } from './lead-provenance';
import { LeadProgressSection } from './lead-progress';
import { Badge } from './atoms/badge';
import { Button } from './atoms/button';
import { CommandDialog } from './command-dialog';
import { MessageRepPanel } from './composer';
import { siKeys } from './data/query-keys';
import { commandLabels } from './lib/commands';
import { callBlockerSentence, offeredActions, splitCommands } from './lib/owner-now';
import { copy } from "./sales-intelligence-copy";
import { contactTypeLabel, formatDateTime,label } from './lib/format';

type Availability = Outreach['allowed_actions'][number];

/**
 * UI1-SHELL (UI-1 §5.4): the follow-ups part of the Work tab. Open follow-ups first, each with the commands its own
 * `allowed_actions[]` offers (every one opens the kept `command-dialog.tsx`), then completed, cancelled and superseded
 * ones under a disclosure. With `asOf` each card formats its times against the response's `as_of`.
 */
export function FollowupsSection({record,asOf}:{record:Outreach;asOf?:string}) {
 const [editing,setEditing]=useState<{command:string;actionId:string}|null>(null);
 const w=copy.ui1.outreach.work;
 const selected=record.followups.find(action=>action.id===editing?.actionId);
 const open=record.followups.filter(f=>f.status==='open'),done=record.followups.filter(f=>f.status!=='open');
 return <section className="si-local-stack" aria-label={w.followupsTitle}>
 <h3 className="si-heading si-heading--3">{w.followupsTitle}</h3>
 {open.map(f=><div className="si-local-stack" key={f.id}><FollowupCard followup={f} overallOwner={record.assignment.agent} asOf={asOf}/>
  <div className="si-local-filters">{f.allowed_actions.filter(action=>commandLabels[action.action]).map(action=><Button key={action.action} disabled={!action.enabled} title={action.enabled?undefined:callBlockerSentence(action.action,record,action.blocker_codes,copy.call.blockers,copy.call.blockerCodes)||undefined} onClick={()=>setEditing({command:action.action,actionId:f.id})}>{commandLabels[action.action]}</Button>)}</div></div>)}
 {!open.length&&<p className="si-time is-null">{w.noFollowups}</p>}
 {!!done.length&&<details><summary>{copy.panel.completedFollowups} ({done.length})</summary><div className="si-local-stack">{done.map(f=><FollowupCard key={f.id} followup={f} overallOwner={record.assignment.agent} asOf={asOf}/>)}</div></details>}
 {record.followups_cursor&&<p className="si-text--sm si-text--subtle">{w.moreFollowups}</p>}
 {editing&&<CommandDialog key={`${editing.command}:${editing.actionId}`} command={editing.command} record={record} action={selected} onClose={()=>setEditing(null)}/>}
 </section>;
}

/** The response `as_of` of the cached detail read, for the legacy page's Message rep panel (never the browser clock). */
function useCachedAsOf(id:string):string|null {
 const client=useQueryClient();
 const direct=client.getQueryData<{as_of?:string}>(siKeys.outreach(id));
 if(direct?.as_of)return direct.as_of;
 const byLead=client.getQueriesData<{as_of?:string;data?:{outreach?:{id?:string}}}>({queryKey:siKeys.outreachByLead('','').slice(0,2)});
 return byLead.find(([,data])=>data?.data?.outreach?.id===id)?.[1]?.as_of??null;
}

/** Legacy page (`_legacy/workspace.tsx`) Work panel. `Message rep` opens the new composer panel (UI1-CHAT). */
export function OutreachDetail({record}:{record:Outreach;accountId?:string|null}) {
 const [editing,setEditing]=useState<{command:string}|null>(null);
 const [messaging,setMessaging]=useState(false);
 const asOf=useCachedAsOf(record.id);
 const link=record.subject.kind==='lead'?officialRecordHref(record.subject.model,record.subject.id):null;
 const deck=splitCommands(offeredActions(record.allowed_actions),commandLabels);
 const command=(item:Availability,variant:'primary'|'secondary'|'ghost'='secondary')=>
  <Button key={item.action} variant={variant} disabled={!item.enabled}
   title={item.enabled?undefined:callBlockerSentence(item.action,record,item.blocker_codes,copy.call.blockers,copy.call.blockerCodes)||undefined}
   onClick={()=>setEditing({command:item.action})}>{commandLabels[item.action]}</Button>;
 return <section className="si-local-stack"><h3>{copy.panel.outreach} · {label(record.state)}</h3>
 <div className="si-chiprow"><CallStateBadge record={record}/></div>
 <CallStateLine record={record}/>
 <OwnershipSplit overallOwner={record.assignment.agent}/>
 <LeadProvenance record={record}/>
 <LeadProgressSection record={record} onCommand={command=>setEditing({command})}/>
 {record.lead_display&&<p>{record.lead_display.name??copy.fields.unknown} · Job Number {record.lead_display.job_no??copy.time.notObserved} · {record.lead_display.source_company??copy.fields.unknown}</p>}
 {link&&<Link href={link}>Open official Lead</Link>}
 {record.related_record_links?.filter(item=>item.model==='BookedLead'||item.model==='CancelledLead').map(item=><Link key={`${item.model}:${item.id}`} href={officialRecordHref(item.model,item.id)}>Open official {item.model==='BookedLead'?'Booking':'Cancellation'} · {label(item.certainty)}</Link>)}
 {record.latest_number_call&&<p>{copy.fields.lastActivity}: {label(record.latest_number_call.direction)} · {record.latest_number_call.provider_result?label(record.latest_number_call.provider_result):copy.fields.unknown} · {contactTypeLabel(record.latest_number_call.contact_type)} · {formatDateTime(record.latest_number_call.happened_at)}</p>}
 <p>{copy.fields.lastMeaningfulContact}: {formatDateTime(record.last_meaningful_contact_at)}</p>
 <div className="si-chiprow">{record.derived.reasons.map(reason=><Badge key={reason}>{label(reason)}</Badge>)}{record.derived.review_badges?.map(reason=><Badge tone="amber" key={reason}>{label(reason)}</Badge>)}</div>
 {record.derived.call_blockers.length>0&&<p>Calling blocked: {record.derived.call_blockers.map(label).join(', ')}</p>}
 <div className="si-actions"><span className="si-ownership__label">{copy.now.decide}</span>
 <div className="si-actions__primary">{deck.call&&command(deck.call,'primary')}{deck.secondary.map(item=>command(item))}
 <Button variant="ghost" disabled={record.state==='closed'||!asOf} onClick={()=>setMessaging(true)}>{copy.messageRep.title}</Button></div>
 {!!deck.more.length&&<details className="si-now__more"><summary>{copy.now.moreActions}</summary><div className="si-actions__secondary">{deck.more.map(item=>command(item,'ghost'))}</div></details>}
 </div>
 <FollowupsSection record={record}/>
 {editing&&<CommandDialog key={`${editing.command}:${record.id}`} command={editing.command} record={record} onClose={()=>setEditing(null)}/>}
 {messaging&&asOf&&<MessageRepPanel outreach={record} asOf={asOf} mode="panel" onClose={()=>setMessaging(false)}/>}
 </section>;
}
