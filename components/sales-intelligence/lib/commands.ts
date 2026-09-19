import type { CommandIntent,Followup,Outreach } from '@/lib/api/salesIntelligence';

export const commandLabels:Record<string,string>={mark_worked:'Mark as worked',assign:'Assign Outreach',set_waiting:'Wait for customer',add_note:'Add note',close:'Close Outreach',reopen:'Reopen Outreach',create_followup:'Add follow-up',patch_followup:'Edit follow-up / assignment',complete_followup:'Complete follow-up',snooze_followup:'Snooze follow-up',cancel_followup:'Cancel follow-up'};
export type Draft={kind:string;description:string;due:string;agent:string;reason:string;note:string;disposition:string;closeReason:string};
const eastern=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export const easternInput=(iso:string)=>eastern.format(new Date(iso)).replace(' ','T');
export function initialDraft(action?:Followup):Draft {return {kind:action?.kind??'call',description:action?.description??'',due:action?.due_at?easternInput(action.due_at):'',agent:action?.assignment.agent?.id??'',reason:'',note:'',disposition:'completed',closeReason:'owner_dismissed'};}
function text(value:string) {const result=value.trim();if(!result||result.length>500)throw new Error('Enter between 1 and 500 characters.');return result;}
export function easternInstant(value:string) {
 if(!value.trim())return null;
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))throw new Error('Enter a complete date and time.');
 const normalized=value.length===16?`${value}:00`:value,naive=Date.parse(`${normalized}Z`);
 const matches=[4,5].map(hours=>new Date(naive+hours*3600000)).filter(candidate=>Number.isFinite(+candidate)&&easternInput(candidate.toISOString())===normalized);
 if(matches.length!==1)throw new Error('This Eastern time is missing or ambiguous at a daylight-saving change. Choose an unambiguous time.');
 return matches[0].toISOString();
}
export function buildIntent(command:string,draft:Draft,record:Outreach,action:Followup|undefined,key:string,originalAction=action):CommandIntent {
 const body:Record<string,unknown>={command,expected_revision:action?.revision??record.revision};
 let path=`outreach/${record.id}/commands`,method:'POST'|'PATCH'='POST';
 if(command==='mark_worked') {if(draft.note.trim())body.note=text(draft.note);}
 else if(command==='assign') {body.responsible_agent_id=draft.agent||null;if(draft.reason.trim())body.reason=text(draft.reason);}
 else if(command==='set_waiting') {body.until=easternInstant(draft.due);if(!body.until)throw new Error('A wait needs an end date.');body.reason=text(draft.reason);}
 else if(command==='add_note')body.text=text(draft.note);
 else if(command==='close') {body.reason=draft.closeReason;if(draft.note.trim())body.note=text(draft.note);}
 else if(command==='reopen')body.reason=text(draft.reason);
 else if(command==='create_followup') {path='followups';body.outreach_record_id=record.id;body.action={kind:draft.kind,description:text(draft.description),due_at:easternInstant(draft.due),responsible_agent_id:draft.agent||null};}
 else if(action) {
  body.expected_revisions=[{target:'outreach',id:record.id,revision:record.revision}];
  path=`followups/${action.id}`;
  if(command==='patch_followup') {
   method='PATCH';const changes:Record<string,unknown>={};
   if(draft.kind!==originalAction!.kind)changes.kind=draft.kind;
   if(draft.description.trim()!==originalAction!.description)changes.description=text(draft.description);
   if(draft.due!==initialDraft(originalAction).due)changes.due_at=easternInstant(draft.due);
   if((draft.agent||null)!==(originalAction!.assignment.agent?.id??null))changes.responsible_agent_id=draft.agent||null;
   if(!Object.keys(changes).length)throw new Error('Change at least one follow-up field.');
   body.changes=changes;body.reason=text(draft.reason);
  } else if(command==='complete_followup') {path+='/complete';body.disposition=draft.disposition;if(draft.note.trim())body.note=text(draft.note);}
  else if(command==='snooze_followup') {path+='/snooze';body.until=easternInstant(draft.due);if(!body.until)throw new Error('Snooze needs an end date.');body.reason=text(draft.reason);}
  else if(command==='cancel_followup') {path+='/cancel';body.reason=text(draft.reason);}
  else throw new Error('This command is unavailable.');
 } else throw new Error('This command is unavailable.');
 return {path,method,body,key};
}
