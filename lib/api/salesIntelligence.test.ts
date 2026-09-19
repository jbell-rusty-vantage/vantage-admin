import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntent,initialDraft,easternInstant } from '../../components/sales-intelligence/lib/commands';
import { destinationChannels,previewNudge,reviewedNudgeChannels,sendNudge,sendSalesIntelligence,type Outreach,type Followup } from './salesIntelligence';
import { officialRecordHref } from '../../components/sales-intelligence/lib/official-record';

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
test('Owner review records pager always and SMS-to-rep only for exactly one stored DID',()=>{
 assert.deepEqual(reviewedNudgeChannels(['+15551212']),['pager','sms_to_rep']);
 assert.deepEqual(reviewedNudgeChannels(['+15551212','+15553434']),['pager']);
 assert.deepEqual(reviewedNudgeChannels([]),['pager']);
 assert.deepEqual(reviewedNudgeChannels(undefined),['pager']);
 assert.equal(reviewedNudgeChannels(['+15551212']).includes('team_messaging'),false);
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
