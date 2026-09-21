import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntent,initialDraft,easternInstant } from '../../components/sales-intelligence/lib/commands';
import { attentionSchema,destinationChannels,listNudges,nudgeDeliveryKind,numberSchema,outreachReadSchema,outreachSchema,previewNudge,reviewedNudgeChannels,sendNudge,sendSalesIntelligence,settingsSchema,timelineSchema,type Outreach,type Followup } from './salesIntelligence';
import { officialRecordHref, salesIntelligenceLeadHref } from '../../components/sales-intelligence/lib/official-record';

test('destination channels come from stored User evidence and never invent Team Messaging',()=>{
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:['+15551212']}),['sms_to_rep','pager']);
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:['+15551212','+15553434']}),['pager']);
 assert.deepEqual(destinationChannels({extension_number:null,direct_numbers:[]}),[]);
 assert.deepEqual(destinationChannels({extension_number:'102',direct_numbers:[]},'person-1'),['team_messaging','pager']);
 assert.equal(destinationChannels({extension_number:'102',direct_numbers:[]}).includes('team_messaging'),false);
});
test('nudge preview and send use the directory User contract and a stable idempotency key',async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;init:RequestInit}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});
  if(String(url).includes('/preview'))return Response.json({ok:true,as_of:'2026-09-19T15:00:00.000Z',data:{body:'Joshua — review',template_key:'review_context',template_version:1,purpose:'review_context',expected_revision:7,expected_rep_revision:null,recipient:{rc_account_id:'62948571023',rc_extension_id:'102',directory_name:'Joshua L',agent_id:null,agent_name:null,rep_identity_link_id:null,channel:'pager'},allowed_channels:['pager'],destination_evidence:'stored_checked',provider_destination_verified:false,send_time_revalidation_required:true,authorizes_send:false}});
  return Response.json({ok:true,data:{operation_id:'c'.repeat(24),replayed:false,nudge:{id:'d'.repeat(24),revision:1,outreach_record_id:'a'.repeat(24),rc_account_id:'62948571023',rc_extension_id:'102',rep_identity_link_id:null,agent_id:null,actor_id:'owner',channel:'pager',purpose:'review_context',template_key:'review_context',template_version:1,body_as_sent:'Joshua — review',status:'pending',fallback_channel:null,error_code:null,created_at:'2026-09-19T15:00:00.000Z',sent_at:null,delivery_note:'Authorized intent; delivery is not established.',automatic_resend:false}}});
 };
 try {
  const body={expected_revision:7,nudge:{outreach_record_id:'a'.repeat(24),rc_account_id:'62948571023',rc_extension_id:'102',channel:'pager',template_key:'review_context',template_version:1,purpose:'review_context'}};
  const preview=await previewNudge(body,'nudge-key');
  assert.equal(preview.authorizes_send,false);
  assert.equal(preview.recipient.rep_identity_link_id,null);
  const sent=await sendNudge(body,'nudge-key');
  assert.equal(sent.nudge.status,'pending');
  assert.equal(sent.nudge.automatic_resend,false);
  assert.deepEqual(calls[0]!.init.headers,{'Content-Type':'application/json','Idempotency-Key':'nudge-key'});
  assert.deepEqual(calls[1]!.init.headers,calls[0]!.init.headers);
 } finally {globalThis.fetch=original;}
});
test('nudge history continues with outreach id and cursor and keeps delivery kinds distinct',async()=>{
 const original=globalThis.fetch,calls:string[]=[];
 globalThis.fetch=async(url)=>{calls.push(String(url));
  return Response.json({ok:true,as_of:'2026-09-20T15:00:00.000Z',data:{items:[{id:'d'.repeat(24),revision:1,outreach_record_id:'a'.repeat(24),rc_account_id:'62948571023',rc_extension_id:'102',rep_identity_link_id:null,agent_id:null,actor_id:'owner',channel:'pager',purpose:'review_context',template_key:'review_context',template_version:1,body_as_sent:'Joshua — review',status:'unknown_delivery',fallback_channel:null,error_code:null,created_at:'2026-09-19T15:00:00.000Z',sent_at:null,delivery_note:'Delivery could not be established. Do not retry automatically.',automatic_resend:false}],next_cursor:'e'.repeat(24)}});
 };
 try {
  const page=await listNudges({outreach_record_id:'a'.repeat(24),cursor:'c'.repeat(24)});
  assert.equal(page.data.items[0]?.status,'unknown_delivery');
  assert.equal(nudgeDeliveryKind('sent'),'sent');
  assert.equal(nudgeDeliveryKind('fallback_sent'),'sent');
  assert.equal(nudgeDeliveryKind('failed'),'failed');
  assert.equal(nudgeDeliveryKind('unknown_delivery'),'unknown');
  assert.equal(nudgeDeliveryKind('pending'),'pending');
  assert.match(calls[0]!,/\/api\/proxy\/api\/v1\/admin\/sales-intelligence\/nudges\?outreach_record_id=aaaaaaaaaaaaaaaaaaaaaaaa&limit=20&cursor=cccccccccccccccccccccccc&scope=production$/);
 } finally {globalThis.fetch=original;}
});
test('Owner review records pager always and SMS-to-rep only for exactly one stored DID',()=>{
 assert.deepEqual(reviewedNudgeChannels(['+15551212']),['pager','sms_to_rep']);
 assert.deepEqual(reviewedNudgeChannels(['+15551212','+15553434']),['pager']);
 assert.deepEqual(reviewedNudgeChannels([]),['pager']);
 assert.deepEqual(reviewedNudgeChannels(undefined),['pager']);
 assert.equal(reviewedNudgeChannels(['+15551212']).includes('team_messaging'),false);
});

test('Lead detail enters Sales Intelligence with the official Lead identity',()=>{
  const form=new URL(salesIntelligenceLeadHref('FormLead','a'.repeat(24)),'http://localhost');
  const call=new URL(salesIntelligenceLeadHref('CallLead','b'.repeat(24)),'http://localhost');
  assert.equal(form.pathname,'/sales-intelligence');
  assert.equal(form.searchParams.get('lead'),'a'.repeat(24));
  assert.equal(form.searchParams.get('lead_model'),'FormLead');
  assert.equal(call.searchParams.get('lead_model'),'CallLead');
  assert.equal(form.searchParams.has('scope'),false);
});
test('official destinations pin the host database_scope, not the API scope parameter',()=>{
 for(const model of ['FormLead','CallLead','BookedLead','CancelledLead'] as const){
  const url=new URL(officialRecordHref(model,'a'.repeat(24)),'http://localhost');
  assert.equal(url.searchParams.get('database_scope'),'production');
  assert.equal(url.searchParams.get('record'),'a'.repeat(24));
  assert.equal(url.searchParams.has('scope'),false);
 }
});

const followup={id:'b'.repeat(24),revision:3,kind:'call',description:'Call back',status:'open',due_at:null,assignment:{agent:{id:'d'.repeat(24),name:'Jordan'},origin:'owner'}} as Followup;
const record={id:'a'.repeat(24),revision:7,assignment:{agent:{id:'c'.repeat(24),name:'Alex'},origin:'owner'}} as Outreach;

test('Eastern date entry honors seasonal offsets and rejects ambiguous/nonexistent local times',()=>{
 assert.equal(easternInstant('2026-09-21T10:00'),'2026-09-21T14:00:00.000Z');
 assert.equal(easternInstant('2026-12-21T10:00'),'2026-12-21T15:00:00.000Z');
 assert.throws(()=>easternInstant('2026-03-08T02:30'),/ambiguous/);
 assert.throws(()=>easternInstant('2026-11-01T01:30'),/ambiguous/);
 assert.equal(easternInstant(''),null);
});

test('action edit fences the aggregate and preserves null date and independent ownership',()=>{
 const draft={...initialDraft(followup),description:'Return requested call',reason:'Owner clarification'};
 const intent=buildIntent('patch_followup',draft,record,followup,'same-key');
 assert.deepEqual(intent.body,{command:'patch_followup',expected_revision:3,expected_revisions:[{target:'outreach',id:record.id,revision:7}],changes:{description:'Return requested call'},reason:'Owner clarification'});
 assert.equal(intent.path,`followups/${followup.id}`);
});
test('explicit conflict acknowledgement changes fences without overwriting untouched server fields',()=>{
 const draft={...initialDraft(followup),description:'My focused draft',reason:'Reviewed latest values'};
 const latest={...followup,revision:4,due_at:'2026-09-21T14:00:00.000Z',assignment:{agent:{id:'e'.repeat(24),name:'Casey'},origin:'owner'}};
 const intent=buildIntent('patch_followup',draft,{...record,revision:8},latest,'new-key',followup);
 assert.equal(intent.body.expected_revision,4);
 assert.deepEqual(intent.body.changes,{description:'My focused draft'});
});
test('create independent undated follow-up and optional completion next step',()=>{
 const draft={...initialDraft(),description:'Prepare estimate'};
 const intent=buildIntent('create_followup',draft,record,undefined,'create-key');
 assert.deepEqual(intent.body.action,{kind:'call',description:'Prepare estimate',due_at:null,responsible_agent_id:null});
 const completion=buildIntent('complete_followup',initialDraft(followup),record,followup,'complete-key');
 assert.equal(completion.body.disposition,'completed');
 assert.equal('next' in completion.body,false);
});
test('settings GET schema does not invent a capture coverage watermark',()=>{
 const parsed=settingsSchema.parse({
  as_of:'2026-09-19T16:00:00.000Z',
  data:{
   persisted:false,revision:1,source:'accepted_defaults',
   policy:{version:'csi-policy-v1',timezone:'America/New_York',staffed_hours:[{day:1,start_minute:480,end_minute:1200}],
    first_action_due_staffed_minutes:30,missed_callback_due_staffed_minutes:15,going_cold_staffed_minutes:1440,
    monthly_ceiling_cents:8000,per_recording_ceiling_cents:25,cooldown_attempts_24h:3,enabled_capabilities:[],
    retention:{audio_days:90,redacted_days:365,audit_days:730}},
   flags:{STT_ENABLED:false},models:{extraction:{name:'openai/gpt-5-mini',enabled:false},transcription:{name:'openai/gpt-4o-mini-transcribe',enabled:false}},
   updated_at:null,updated_by:null,
  },
 });
 assert.equal(parsed.data.source,'accepted_defaults');
 assert.equal(parsed.data.policy.staffed_hours[0]?.day,1);
});
test('settings PATCH uses Idempotency-Key and current-scope BFF',async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;init:RequestInit}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});return Response.json({ok:true,data:{response:{version:'csi-policy-r2',revision:2},replayed:false}});};
 try {
  const result=await sendSalesIntelligence({path:'settings',method:'PATCH',key:'settings-key',body:{command:'update_settings',expected_revision:1,reason:'Owner',policy:{version:'csi-policy-v1'}}});
  assert.equal(result.replayed,false);
  assert.match(calls[0]!.url,/\/api\/proxy\/api\/v1\/admin\/sales-intelligence\/settings\?scope=production$/);
  assert.deepEqual(calls[0]!.init.headers,{'Content-Type':'application/json','Idempotency-Key':'settings-key'});
  assert.equal(calls[0]!.init.method,'PATCH');
 } finally {globalThis.fetch=original;}
});
test('uncertain response retries the exact payload and key through current-scope BFF',async()=>{
 const original=globalThis.fetch,calls:Array<{url:string;init:RequestInit}>=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init:init!});if(calls.length===1)throw new Error('response lost');return Response.json({ok:true,data:{response:{id:record.id,revision:8},replayed:true}});};
 try {
  const intent=buildIntent('add_note',{...initialDraft(),note:'Synthetic note'},record,undefined,'same-intent');
  await assert.rejects(sendSalesIntelligence(intent));
  assert.equal((await sendSalesIntelligence(intent)).replayed,true);
  assert.deepEqual(calls[0],calls[1]);
  assert.match(calls[0].url,/\/api\/proxy\/api\/v1\/admin\/sales-intelligence\/.*scope=production$/);
  assert.deepEqual(calls[0].init.headers,{'Content-Type':'application/json','Idempotency-Key':'same-intent'});
 } finally {globalThis.fetch=original;}
});

/**
 * Consumer-contract regression for the reads behind the Outreach detail. Every
 * fixture below is the shape the deployed Owner API actually returns (captured
 * from `/api/v1/admin/sales-intelligence` on 2026-09-21; ids kept, customer
 * values replaced). A field the server sends and these schemas do not model is
 * stripped by zod, and a field they require that the server may omit fails the
 * whole read — both are silent in types and show up only as "it does not load".
 */
const coverageFixture = {
  known_through:'2026-09-21T04:33:34.152Z', gaps:[], capabilities:{call_log:'ok',recording_content:'unavailable',webhook:'ok'}, ai_paused:false,
  recordings:{pending_discovery:42,media_pending:32,media_stored:138,no_recording:0,unavailable:3,failed:1,eligibility_undetermined:25},
};
const availability=(action:string,target_id:string)=>({action,enabled:true,blocker_codes:[],target_id,expected_revision:7});
const outreachFixture = {
 id:'6ab06ebd7bf77e198e58f3fa', revision:7,
 primary_number:{id:'6ab03e836894bcef715051db',e164:'+15550100200'},
 lead_display:{name:null,job_no:null,source_company:'Top 10 Forms'},
 latest_number_call:{id:'6ab0896e2bfe53f26c970327',happened_at:'2026-09-21T01:31:58.120Z',direction:'Inbound',provider_result:'Accepted',contact_type:'unknown'},
 subject:{kind:'lead',model:'CallLead',id:'6ab065812d126e8df7d70862'},
 state:'open', reason:null,
 assignment:{agent:null,origin:null,assigned_at:null,evidence_ref:null,owner_instruction_id:null},
 followups:[], followups_cursor:null, next_action:null, first_human_conversation_at:null,
 trigger_at:'2026-09-20T18:38:54.836Z', first_action_due_at:null, first_attributable_outbound_at:'2026-09-21T01:17:19.848Z', last_meaningful_contact_at:null,
 derived:{overdue:false,no_owner:true,no_next_action:true,cooldown:false,attention_band:5,reasons:['no_next_step','missing_responsibility'],
  review_item_ids:['6ab0663fe27d3c7396a328b4'],call_blockers:[],age_wall_ms:36658915,age_staffed_ms:0,policy_version:'csi-policy-0e18a9778fe3628a579c775b',
  missing_record_responsibility:true,missing_action_responsibility:[],review_badges:['unclear_commitment'],absence_qualified:false,action_facts:[]},
 related_record_links:[{model:'CallLead',id:'6ab065812d126e8df7d70862',href:'/call-leads?record=6ab065812d126e8df7d70862&database_scope=production',certainty:'exact'}],
 allowed_actions:['mark_worked','assign','set_waiting','add_note','close','reopen','create_followup'].map(action=>availability(action,'6ab06ebd7bf77e198e58f3fa')),
};

test('the Outreach read parses the body the server actually returns',()=>{
 // The server wraps the record with owner_instructions and nudges; Admin models only what it renders and must not reject the rest.
 const parsed=outreachReadSchema.parse({ok:true,as_of:'2026-09-21T04:49:17.313Z',coverage:coverageFixture,
  data:{outreach:outreachFixture,owner_instructions:[],nudges:{as_of:'2026-09-21T04:49:17.313Z',data:{items:[],next_cursor:null}}}});
 assert.equal(parsed.data.outreach.id,outreachFixture.id);
 assert.equal(parsed.data.outreach.derived.attention_band,5);
 assert.deepEqual(parsed.data.outreach.related_record_links?.map(item=>item.model),['CallLead']);
});
test('an Outreach on a Number review subject, with no Lead and no followups, still parses',()=>{
 const record=outreachSchema.parse({...outreachFixture,id:'6ab0663fe27d3c7396a328b1',
  subject:{kind:'number_review',contact_number_id:'6ab03e836894bcef715051db'},
  lead_display:null,latest_number_call:null,primary_number:null,related_record_links:[],
  derived:{...outreachFixture.derived,attention_band:null,reasons:[],review_badges:[]}});
 assert.equal(record.subject.kind,'number_review');
 assert.equal(record.primary_number,null);
});
test('the call and Lead-provenance fields survive the parse instead of being stripped',()=>{
 const record=outreachSchema.parse({...outreachFixture,
  lead_attachment:{attachment_id:'6ab083757d731e12ebb5f39f',lead_ref:{model:'CallLead',id:'6ab065812d126e8df7d70862'},state:'attached',certainty:'exact',
   certainty_label:'Exact',decided_by:'evidence',decided_at:'2026-09-21T02:10:00.000Z',confidence:0.94,observed_at:'2026-09-21T02:09:00.000Z',
   lead_display:{name:null,job_no:null}},
  call_progress:{state:'in_progress',started_at:'2026-09-21T04:40:00.000Z',started_by:'owner',ended_at:null,ended_by:null,note:null},
  derived:{...outreachFixture.derived,call_state:'in_progress',provenance_state:'attached_from_evidence'}});
 assert.equal(record.lead_attachment?.certainty,'exact');
 assert.equal(record.call_progress?.state,'in_progress');
 assert.equal(record.derived.call_state,'in_progress');
 assert.equal(record.derived.provenance_state,'attached_from_evidence');
 // A server that grows a value must not fail the read, and an absent field stays absent.
 assert.equal(outreachSchema.parse({...outreachFixture,derived:{...outreachFixture.derived,call_state:'dialing'}}).derived.call_state,'dialing');
 assert.equal(outreachSchema.parse(outreachFixture).call_progress,undefined);
});
test('Attention parses whether or not the server sends its optional status',()=>{
 const data={items:[],snapshot_id:null,cursor:null,total_items:null,reason_counts:{}};
 const page=(extra:Record<string,unknown>)=>attentionSchema.parse({ok:true,as_of:'2026-09-21T04:49:17.313Z',coverage:coverageFixture,data:{...data,...extra}});
 assert.equal(page({status:'pending_projection'}).data.status,'pending_projection');
 // `status` is optional on the server DTO; requiring it here failed the whole desk.
 assert.equal(page({}).data.status,undefined);
 assert.equal(page({status:'ready',items:[{subject_key:'lead:CallLead:6ab065812d126e8df7d70862',subject:outreachFixture.subject,
  outreach:outreachFixture,derived:outreachFixture.derived,allowed_actions:[]}]}).data.items[0]?.outreach?.id,outreachFixture.id);
 // A review-only row carries no Outreach at all.
 assert.equal(page({status:'ready',items:[{subject_key:'number:6ab03e836894bcef715051db',subject:{kind:'number_review',contact_number_id:'6ab03e836894bcef715051db'},
  outreach:null,derived:{...outreachFixture.derived,attention_band:null},allowed_actions:[]}]}).data.items[0]?.outreach,null);
});
test('the Number detail and its timeline parse the deployed read shapes',()=>{
 const number=numberSchema.parse({ok:true,as_of:'2026-09-21T04:49:24.916Z',coverage:coverageFixture,data:{
  id:'6ab03e836894bcef715051db',revision:13,e164:'+15550100200',national_ten:'5550100200',kind:'external',classification:'unknown',eligibility:'allowed',
  provider_names:['Synthetic Customer'],search_terms:[],first_observed_at:'2026-09-20T16:19:12.431Z',last_activity_at:'2026-09-21T03:39:41.120Z',
  rollups:{interactions_total:5,inbound_total:4,outbound_total:1,human_conversations_total:0,last_inbound_at:null,last_outbound_at:null,attached_lead_count:1,candidate_lead_count:0,open_outreach_count:0},
  connections:{attachments_total:1,attached:1,candidate:0,ambiguous:0,rejected:0,outreach_records_total:2,open_outreach:2,interactions_total_recount:5},
  attachments:[{id:'6ab083757d731e12ebb5f39f',revision:1,lead_ref:{model:'CallLead',id:'6ab065812d126e8df7d70862'},state:'attached',certainty:'exact'}],
  outreach_records:[outreachFixture],running_analysis:null,restrictions:[],
  review_items:[{id:'6ab0663fe27d3c7396a328b4',revision:1,subject_key:'number:6ab03e836894bcef715051db',cause_kind:'unclear_commitment',cause_key:'x',state:'open',
   evidence_refs:[],opened_at:'2026-09-21T02:00:00.000Z',updated_at:'2026-09-21T02:00:00.000Z',resolved_at:null,resolution_reason:null,allowed_actions:[]}],
  allowed_actions:[availability('open_number_review','6ab03e836894bcef715051db')]}});
 assert.equal(number.data.outreach_records[0]?.id,outreachFixture.id);
 assert.equal(number.data.attachments[0]?.state,'attached');
 const timeline=timelineSchema.parse({ok:true,as_of:'2026-09-21T04:57:27.705Z',coverage:coverageFixture,data:{number_id:'6ab03e836894bcef715051db',
  items:[{id:'6ab0896e2bfe53f26c970327',kind:'followup',happened_at:'2026-09-21T01:31:58.120Z',observed_at:'2026-09-21T01:32:00.000Z',
   subject_key:'number:6ab03e836894bcef715051db',description:'followup created',evidence_refs:['6ab0663fe27d3c7396a328b1'],
   detail:{event_kind:'create_followup',actor:'owner'}}],cursor:null}});
 assert.equal(timeline.data.items[0]?.kind,'followup');
});
