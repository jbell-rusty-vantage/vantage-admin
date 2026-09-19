import { z } from 'zod';
// Consumer schemas mirror current server dto.ts/numberActivity DTOs. No domain derivation.
const agent = z.object({ id: z.string(), name: z.string() });
export const availabilitySchema=z.object({action:z.string(),enabled:z.boolean(),blocker_codes:z.array(z.string()),target_id:z.string(),expected_revision:z.number()});
export const attachmentSchema=z.object({id:z.string(),revision:z.number(),contact_number_id:z.string(),lead_ref:z.object({model:z.enum(['FormLead','CallLead']),id:z.string()}),state:z.string(),certainty_label:z.string().nullable(),
 lead_snapshot:z.object({name:z.string().nullable(),job_no:z.string().nullable(),source_label:z.string().nullable(),booked:z.boolean(),cancelled:z.boolean(),duplicate:z.boolean(),bad_lead:z.boolean()}).nullable(),
 evidence:z.array(z.object({source:z.string(),field_path:z.string(),observed_at:z.string(),window_from:z.string().nullable(),window_to:z.string().nullable()})),
 decided_at:z.string().nullable(),decision_reason:z.string().nullable(),history:z.array(z.object({from:z.string().nullable(),to:z.string().nullable(),at:z.string().nullable(),by:z.string().nullable(),reason:z.string().nullable()})),
 allowed_actions:z.array(availabilitySchema).optional()});
export const attachmentsSchema=z.object({data:z.object({items:z.array(attachmentSchema),next_cursor:z.string().nullable()})});
export const reviewItemsSchema=z.object({data:z.object({items:z.array(z.object({id:z.string(),revision:z.number(),subject_key:z.string(),cause_kind:z.string(),state:z.string(),opened_at:z.string(),resolution_reason:z.string().nullable(),evidence_refs:z.array(z.string()),allowed_actions:z.array(availabilitySchema)})),cursor:z.string().nullable()})});
export const repSchema=z.object({id:z.string(),revision:z.number(),agent_id:z.string(),agent_name:z.string(),rc_account_id:z.string(),rc_extension_id:z.string(),rc_extension_name:z.string().nullable(),rc_extension_number:z.string().nullable(),role_kind:z.string(),status:z.string(),effective_from:z.string(),effective_to:z.string().nullable(),nudge_channels_allowed:z.array(z.string()),rc_team_messaging_person_id:z.string().nullable().optional(),history:z.array(z.object({at:z.string().nullable(),by:z.string().nullable(),change:z.string().nullable()})),metrics:z.object({status:z.literal('unknown'),interactions_total:z.null()})});
export const repsSchema=z.object({data:z.object({items:z.array(repSchema),next_cursor:z.string().nullable(),directory:z.object({status:z.string(),snapshot_id:z.string().nullable(),taken_at:z.string().nullable(),users:z.array(z.object({extension_id:z.string(),extension_name:z.string().nullable(),status:z.string(),candidates:z.array(z.object({agent_id:z.string(),agent_name:z.string(),basis:z.string()}))})),next_cursor:z.string().nullable()})})});
const assignment = z.object({ agent: agent.nullable(), origin: z.string().nullable() });
const derived = z.object({ overdue: z.boolean(), attention_band: z.number().nullable(), reasons: z.array(z.string()),
  review_badges: z.array(z.string()).optional(), call_blockers: z.array(z.string()), age_wall_ms: z.number(), age_staffed_ms: z.number() });
const subject = z.discriminatedUnion('kind', [z.object({ kind: z.literal('number_review'), contact_number_id: z.string() }),
  z.object({ kind: z.literal('lead'), model: z.enum(['FormLead','CallLead']), id: z.string() })]);
const followup = z.object({ id: z.string(), revision:z.number(), allowed_actions:z.array(availabilitySchema),kind: z.string(), description: z.string(), status: z.string(), due_at: z.string().nullable(),
  disposition:z.string().nullable().optional(),completion_basis:z.string().nullable().optional(),
  snoozed_until: z.string().nullable(), overdue: z.boolean(), origin: z.string(), assignment, promised_by: agent.nullable(), paused_channels: z.array(z.string()) });
export const outreachSchema = z.object({ id: z.string(), revision: z.number(), subject, state: z.string(), reason: z.string().nullable(),
  allowed_actions:z.array(availabilitySchema),
  lead_display:z.object({name:z.string().nullable(),job_no:z.string().nullable(),source_company:z.string().nullable()}).nullable().optional(),
  latest_number_call:z.object({id:z.string(),happened_at:z.string(),direction:z.string(),provider_result:z.string().nullable(),contact_type:z.string()}).nullable().optional(),
  related_record_links:z.array(z.object({model:z.enum(['FormLead','CallLead','BookedLead','CancelledLead']),id:z.string(),href:z.string(),certainty:z.string()})).optional(),
  primary_number: z.object({ id: z.string(), e164: z.string() }).nullable().optional(), assignment, followups: z.array(followup), derived,
  last_meaningful_contact_at: z.string().nullable() });
const coverage = z.object({ known_through: z.string().nullable(), gaps: z.array(z.object({ from:z.string(), to:z.string(), reason:z.string() })), ai_paused:z.boolean() });
export const numberSearchSchema = z.object({ as_of:z.string(), coverage, data:z.object({
  items:z.array(z.object({ id:z.string(), revision:z.number(), e164:z.string(), provider_names:z.array(z.string()),
    classification:z.string(), eligibility:z.string(), linked:z.boolean(), last_activity_at:z.string(),
    rollups:z.object({ interactions_total:z.number(), human_conversations_total:z.number(), attached_lead_count:z.number(), candidate_lead_count:z.number() }) })),
  cursor:z.string().nullable() }) });
export const timelineSchema = z.object({ as_of:z.string(), coverage, data:z.object({ number_id:z.string(),
  items:z.array(z.object({ id:z.string(), kind:z.string(), happened_at:z.string(), observed_at:z.string(), description:z.string(),
    evidence_refs:z.array(z.string()), detail:z.record(z.string(),z.json()) })), cursor:z.string().nullable() }) });
export const attentionSchema = z.object({ as_of: z.string(), coverage, data: z.object({ items: z.array(z.object({ subject_key:z.string(), subject,
  outreach: outreachSchema.nullable(), derived })), snapshot_id: z.string().nullable(), total_items:z.number().nullable(), cursor:z.string().nullable(), status:z.enum(['ready','pending_projection']) }) });
export const numberSchema = z.object({ as_of:z.string(), coverage, data:z.object({ id:z.string(), revision:z.number(), allowed_actions:z.array(availabilitySchema), e164:z.string(), classification:z.string(), eligibility:z.string(),
  outreach_records:z.array(outreachSchema), running_analysis:z.object({ text:z.string(), computed_at:z.string() }).nullable(),
  attachments:z.array(z.object({ id:z.string(), state:z.string(), certainty:z.string(), lead_ref:z.object({ model:z.string(), id:z.string() }) })),
  review_items:z.array(z.object({ id:z.string(), cause_kind:z.string(), state:z.string() })),
  restrictions:z.array(z.object({ id:z.string(), revision:z.number(), channels:z.array(z.string()), state:z.string(), until:z.string().nullable(), allowed_actions:z.array(availabilitySchema) })) }) });
export const outreachReadSchema = z.object({ as_of:z.string(), coverage, data:z.object({ outreach:outreachSchema }) });
export type Outreach = z.infer<typeof outreachSchema>;
export type Followup = z.infer<typeof followup>;
export type Agent = z.infer<typeof agent>;
export type AttentionRow = z.infer<typeof attentionSchema>['data']['items'][number];
export type NumberRead = z.infer<typeof numberSchema>;
export class SalesIntelligenceError extends Error {
  constructor(readonly code:string, readonly status:number, readonly requestId?:string) { super(code); }
}
export async function readSalesIntelligence<T>(path:string, schema:z.ZodType<T>, signal?:AbortSignal):Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`/api/proxy/api/v1/admin/sales-intelligence/${path}${separator}scope=production`, { signal, cache:'no-store' });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new SalesIntelligenceError(body.code ?? body.registry_code ?? 'READ_FAILED', response.status, body.request_id);
  return schema.parse(body);
}
export type CommandIntent={path:string;method:'POST'|'PATCH';body:Record<string,unknown>;key:string};
const commandResultSchema=z.object({ok:z.literal(true),data:z.object({response:z.record(z.string(),z.json()),replayed:z.boolean()})});
export async function sendSalesIntelligence(intent:CommandIntent) {
 const response=await fetch(`/api/proxy/api/v1/admin/sales-intelligence/${intent.path}?scope=production`,{
  method:intent.method,headers:{'Content-Type':'application/json','Idempotency-Key':intent.key},body:JSON.stringify(intent.body)});
 const body=await response.json();
 if(!response.ok||!body.ok)throw new SalesIntelligenceError(body.code??body.registry_code??'COMMAND_FAILED',response.status,body.request_id);
 return commandResultSchema.parse(body).data;
}
