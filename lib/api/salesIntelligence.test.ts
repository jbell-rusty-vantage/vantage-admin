import test from 'node:test';
import assert from 'node:assert/strict';
import { easternInstant } from '../../components/sales-intelligence/lib/eastern';
import { officialRecordHref } from '../../components/sales-intelligence/lib/official-record';
import {
 attachedLeadSchema,destinationChannels,interactionDetailSchema,numberDetailSchema,numberSearchSchema,ownerCoverageSchema,repsSchema,reviewedNudgeChannels,
 sendNudge,sendSalesIntelligence,timelineSchema,
} from './salesIntelligence';

test('destination channels come from stored User evidence and never invent Team Messaging',()=>{
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:['+15551212']}),['sms_to_rep','pager']);
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:['+15551212','+15553434']}),['pager']);
 assert.deepEqual(destinationChannels({extension_number:null,direct_numbers:[]}),[]);
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:[]},'person-1'),['team_messaging','pager']);
 assert.equal(destinationChannels({extension_number:'102',direct_numbers:[]}).includes('team_messaging'),false);
});

const nudgeRow={id:'d'.repeat(24),revision:1,rc_account_id:'62948571023',rc_extension_id:'102',rep_identity_link_id:null,agent_id:null,actor_id:'owner',channel:'pager',purpose:'review_context',template_key:'review_context',template_version:1,body_as_sent:'Joshua — review',status:'pending',fallback_channel:null,error_code:null,created_at:'2026-09-19T15:00:00.000Z',sent_at:null,delivery_note:'Authorized intent; delivery is not established.',automatic_resend:false};

test('a directory message sends the interim command body once, with a stable idempotency key',async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;init:RequestInit}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({ok:true,data:{operation_id:'c'.repeat(24),replayed:false,nudge:nudgeRow}});};
 try {
  const body={nudge:{rc_account_id:'62948571023',rc_extension_id:'102',channel:'pager',template_key:'review_context',template_version:1,purpose:'review_context',allow_pager_fallback:false,body:'Joshua — review'}};
  const sent=await sendNudge(body,'nudge-key');
  assert.equal(sent.nudge.status,'pending');
  assert.equal(sent.nudge.automatic_resend,false);
  assert.equal(calls.length,1);
  assert.match(calls[0]!.url,/\/api\/proxy\/api\/v1\/admin\/sales-intelligence\/nudges\?scope=production$/);
  assert.deepEqual(calls[0]!.init.headers,{'Content-Type':'application/json','Idempotency-Key':'nudge-key'});
  const sentBody=JSON.parse(String(calls[0]!.init.body));
  assert.equal('outreach_record_id' in sentBody.nudge,false);
  assert.equal('expected_revision' in sentBody,false);
  // A historical row written before the interim contract still parses (its Outreach link is simply not read).
  globalThis.fetch=async()=>Response.json({ok:true,data:{operation_id:'c'.repeat(24),replayed:true,nudge:{...nudgeRow,outreach_record_id:'a'.repeat(24),channel:'sms_to_rep',purpose:'call_suggestion',status:'unknown_delivery'}}});
  assert.equal((await sendNudge(body,'nudge-key')).nudge.status,'unknown_delivery');
 } finally {globalThis.fetch=original;}
});

test('Owner review records pager always and SMS-to-rep only for exactly one stored DID',()=>{
 assert.deepEqual(reviewedNudgeChannels(['+15551212']),['pager','sms_to_rep']);
 assert.deepEqual(reviewedNudgeChannels(['+15551212','+15553434']),['pager']);
 assert.deepEqual(reviewedNudgeChannels([]),['pager']);
 assert.deepEqual(reviewedNudgeChannels(undefined),['pager']);
 assert.equal(reviewedNudgeChannels(['+15551212']).includes('team_messaging'),false);
});

test('official destinations carry no database scope and no API scope parameter',()=>{
 for(const model of ['FormLead','CallLead','BookedLead','CancelledLead'] as const){
  const url=new URL(officialRecordHref(model,'a'.repeat(24)),'http://localhost');
  assert.equal(url.searchParams.has('database_scope'),false);
  assert.equal(url.searchParams.get('record'),'a'.repeat(24));
  assert.equal(url.searchParams.has('scope'),false);
 }
});

test('Eastern date entry honors seasonal offsets and rejects ambiguous/nonexistent local times',()=>{
 assert.equal(easternInstant('2026-09-21T10:00'),'2026-09-21T14:00:00.000Z');
 assert.equal(easternInstant('2026-12-21T10:00'),'2026-12-21T15:00:00.000Z');
 assert.throws(()=>easternInstant('2026-03-08T02:30'),/ambiguous/);
 assert.throws(()=>easternInstant('2026-11-01T01:30'),/ambiguous/);
 assert.equal(easternInstant(''),null);
});

test('an uncertain command retries the exact payload and key; a Number rebuild response parses',async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;init:RequestInit}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});if(calls.length===1)throw new Error('response lost');
  return Response.json({ok:true,data:{job_id:'f'.repeat(24),dedupe_key:'rebuild:x',number_id:'a'.repeat(24),replayed:true}});};
 try {
  const intent={path:`numbers/${'a'.repeat(24)}/rebuild`,method:'POST' as const,key:'same-intent',body:{command:'rebuild_number',expected_revision:3,reason:'Recount'}};
  await assert.rejects(sendSalesIntelligence(intent));
  const result=await sendSalesIntelligence(intent);
  assert.equal(result.replayed,true);
  assert.equal(result.response,undefined);
  assert.deepEqual(calls[0],calls[1]);
  assert.match(calls[0]!.url,/\/api\/proxy\/api\/v1\/admin\/sales-intelligence\/numbers\/a{24}\/rebuild\?scope=production$/);
  assert.deepEqual(calls[0]!.init.headers,{'Content-Type':'application/json','Idempotency-Key':'same-intent'});
  globalThis.fetch=async()=>Response.json({ok:true,data:{response:{attachment_id:'b'.repeat(24),revision:2,state:'attached',certainty:'owner_confirmed'},replayed:false}});
  assert.equal((await sendSalesIntelligence({path:'attachments/attach',method:'POST',key:'k',body:{}})).response?.state,'attached');
 } finally {globalThis.fetch=original;}
});

/* Consumer-contract regression for the interim reads (server `S-NUM-CONTRACT.md`). Ids are synthetic. */
const coverage={known_through:'2026-09-21T04:33:34.152Z',gaps:[],capabilities:{call_log:'ok',webhook:'ok'}};
const rollups={interactions_total:5,inbound_total:4,outbound_total:1,human_conversations_total:1,last_inbound_at:'2026-09-21T03:39:41.120Z',last_outbound_at:null,
 last_human_conversation_at:'2026-09-21T01:00:00.000Z',attached_lead_count:1,candidate_lead_count:0,recordings_total:2};
const availability=(action:string,target_id:string)=>({action,enabled:true,blocker_codes:[],target_id,expected_revision:13});

test('the attached Lead keeps none / multiple / resolved; only resolved carries Lead facts',()=>{
 const resolved=attachedLeadSchema.parse({status:'resolved',lead_ref:{model:'FormLead',id:'b'.repeat(24)},lead_display:{name:'Synthetic Lead',job_no:'5562924',source_company:'Top 10 Forms'},official:{status:'cancelled',booking_id:'c'.repeat(24),cancellation_id:'d'.repeat(24)}});
 assert.equal(resolved.status,'resolved');
 assert.deepEqual(attachedLeadSchema.parse({status:'multiple'}),{status:'multiple'});
 // A Lead field on `multiple` / `none` is never kept, so no Lead fact of one Lead is shown on a Number that has several.
 assert.deepEqual(attachedLeadSchema.parse({status:'none',lead_ref:{model:'FormLead',id:'b'.repeat(24)}}),{status:'none'});
 assert.equal(attachedLeadSchema.safeParse({status:'resolved'}).success,false);
 assert.equal(attachedLeadSchema.parse({status:'resolved',lead_ref:{model:'CallLead',id:'b'.repeat(24)},lead_display:null,official:null}).status,'resolved');
});

test('the Numbers list, Number detail, timeline and coverage parse the interim read shapes',()=>{
 const item={id:'a'.repeat(24),revision:13,e164:'+15550100200',national_ten:'5550100200',kind:'external',classification:'customer',eligibility:'allowed',
  provider_names:['Synthetic Customer'],first_observed_at:'2026-09-20T16:19:12.431Z',last_activity_at:'2026-09-21T03:39:41.120Z',rollups,linked:true,
  match:{kind:'none'},attached_lead:{status:'none'},created_via:'call',has_calls:true};
 const page=numberSearchSchema.parse({ok:true,as_of:'2026-09-21T04:49:24.916Z',coverage,data:{items:[item],cursor:'next',sort:{sort:'last_activity',direction:'desc'}}});
 assert.equal(page.data.items[0]?.attached_lead.status,'none');
 assert.equal(page.data.sort.sort,'last_activity');
 const detail=numberDetailSchema.parse({ok:true,as_of:'2026-09-21T04:49:24.916Z',coverage,data:{...item,search_terms:['5550100200'],
  attachments:[{id:'e'.repeat(24),revision:1,lead_ref:{model:'CallLead',id:'b'.repeat(24)},state:'attached',certainty:'exact',lead_display:{name:'Synthetic Lead',job_no:null},decided_at:null,decided_by:null,decision_reason:null}],
  restrictions:[{id:'f'.repeat(24),revision:2,channels:['call'],until:null,origin:'intelligence',state:'active'}],
  connections:{attachments_total:1,attached:1,candidate:0,ambiguous:0,rejected:0,interactions_total_recount:5},
  allowed_actions:[availability('attach_lead','a'.repeat(24)),availability('rebuild_number','a'.repeat(24))]}});
 assert.equal(detail.data.restrictions[0]?.origin,'intelligence');
 assert.equal('running_analysis' in detail.data,false);
 assert.equal('outreach_records' in detail.data,false);
 const timeline=timelineSchema.parse({ok:true,as_of:'2026-09-21T04:57:27.705Z',coverage,data:{number_id:'a'.repeat(24),cursor:null,items:[
  {id:'1',kind:'interaction',happened_at:'2026-09-21T01:31:58.120Z',observed_at:'2026-09-21T01:32:00.000Z',subject_key:`number:${'a'.repeat(24)}`,description:'Inbound call',evidence_refs:[],
   detail:{direction:'inbound',provider_result:'connected',provider_connected:true,contact_type:'human_conversation',duration_seconds:245,terminal:true,call_log_state:'settled',recording_count:1,recording_ids:['r1'],
    rep:{status:'reviewed',agent_id:'c'.repeat(24),agent_name:'Jordan',extension_id:'101',extension_number:'101'},legs:[{leg_type:'Accept',direction:'Inbound',result:'Accepted',start_time:'2026-09-21T01:31:58.120Z',duration_seconds:240,extension_id:'101'}],legs_overflow_count:0}},
  {id:'2',kind:'lead_message',happened_at:'2026-09-21T01:00:00.000Z',observed_at:'2026-09-21T01:00:00.000Z',subject_key:`number:${'a'.repeat(24)}`,description:'Lead message sent',evidence_refs:[],
   detail:{status:'sent',purpose:'first_contact',origin:'system',dispatch_mode:'live',sent_at:'2026-09-21T01:00:00.000Z',delivered_at:null,lead_ref:{model:'FormLead',id:'b'.repeat(24)}}}]}});
 const call=interactionDetailSchema.parse(timeline.data.items[0]!.detail);
 assert.equal(call.rep?.agent_name,'Jordan');
 assert.equal(call.legs?.length,1);
 const owner=ownerCoverageSchema.parse({ok:true,data:{as_of:'2026-09-21T05:00:00.000Z',coverage:{...coverage,
  call_log_capture:{quarantined_count:0,oldest_quarantined_at:null,sync_mode:'on',last_sweep:null},
  capture_health:{as_of:'2026-09-21T05:00:00.000Z',status:'ok',reasons:[],known_complete_through:'2026-09-21T04:00:00.000Z',
   call_log:{sync_mode:'on',last_reconcile_at:null,quarantined_count:0,oldest_quarantined_at:null,last_sweep:null},
   webhook:{state:'healthy',subscription_id_suffix:'ab12',subscription_expires_at:null,last_receipt_at:null,receipts_1h:3,last_renewal_at:null,last_renewal_error:null},
   in_progress_calls:0,pending_finalization:0},
  mapping_hygiene:{unmapped_inbound_numbers:2,unmapped_directory_users:null,last_directory_sync_at:null,directory_status:'missing'}}}});
 assert.equal(owner.data.coverage.capture_health.status,'ok');
 assert.equal(owner.data.coverage.mapping_hygiene.unmapped_inbound_numbers,2);
 const reps=repsSchema.parse({ok:true,as_of:'2026-09-21T05:00:00.000Z',coverage,data:{items:[],next_cursor:null,directory:{status:'stored',snapshot_id:null,taken_at:null,users:[],next_cursor:null}}});
 assert.equal(reps.as_of,'2026-09-21T05:00:00.000Z');
});
