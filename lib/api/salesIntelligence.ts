import { z } from 'zod';
/**
 * Consumer schemas for the interim Sales Intelligence contract (server `S-NUM-CONTRACT.md`): Numbers, Lead
 * attachments, coverage and RingCentral Accounts only. They mirror the server DTOs and derive nothing.
 * Objects are not strict, so an additive server field never breaks a read.
 */
export const availabilitySchema=z.object({action:z.string(),enabled:z.boolean(),blocker_codes:z.array(z.string()),target_id:z.string(),expected_revision:z.number()});
const leadRefSchema=z.object({model:z.enum(['FormLead','CallLead']),id:z.string()});
export const attachmentSchema=z.object({id:z.string(),revision:z.number(),contact_number_id:z.string(),lead_ref:leadRefSchema,state:z.string(),certainty_label:z.string().nullable(),
 lead_snapshot:z.object({name:z.string().nullable(),job_no:z.string().nullable(),source_label:z.string().nullable(),booked:z.boolean(),cancelled:z.boolean(),duplicate:z.boolean(),bad_lead:z.boolean()}).nullable(),
 evidence:z.array(z.object({source:z.string(),field_path:z.string(),observed_at:z.string(),window_from:z.string().nullable(),window_to:z.string().nullable()})),
 decided_at:z.string().nullable(),decision_reason:z.string().nullable(),history:z.array(z.object({from:z.string().nullable(),to:z.string().nullable(),at:z.string().nullable(),by:z.string().nullable(),reason:z.string().nullable()})),
 allowed_actions:z.array(availabilitySchema).optional()});
export const attachmentsSchema=z.object({data:z.object({items:z.array(attachmentSchema),next_cursor:z.string().nullable()})});

/* ── RingCentral Accounts: Rep Identity Links, the stored directory and directory messages ── */
export const repSchema=z.object({id:z.string(),revision:z.number(),agent_id:z.string(),agent_name:z.string(),rc_account_id:z.string(),rc_extension_id:z.string(),rc_extension_name:z.string().nullable(),rc_extension_number:z.string().nullable(),role_kind:z.string(),status:z.string(),effective_from:z.string(),effective_to:z.string().nullable(),nudge_channels_allowed:z.array(z.string()),rc_direct_numbers:z.array(z.string()).default([]),rc_team_messaging_person_id:z.string().nullable().optional(),history:z.array(z.object({at:z.string().nullable(),by:z.string().nullable(),change:z.string().nullable()}))});
/** Owner review records pager on every unique link; SMS-to-rep only when the stored snapshot has exactly one DID. Team Messaging person ids stay unresolved. */
export function reviewedNudgeChannels(directNumbers: readonly string[] | undefined): string[] {
  return (directNumbers?.length ?? 0) === 1 ? ["pager", "sms_to_rep"] : ["pager"];
}
export const directoryUserSchema=z.object({extension_id:z.string(),extension_name:z.string().nullable(),status:z.string(),candidates:z.array(z.object({agent_id:z.string(),agent_name:z.string(),basis:z.string()})),extension_number:z.string().nullable().optional(),direct_numbers:z.array(z.string()).optional(),directory_status:z.string().optional(),rc_account_id:z.string().optional(),attached_agent:z.object({id:z.string(),name:z.string()}).nullable().optional()});
export const repsSchema=z.object({as_of:z.string().optional(),data:z.object({items:z.array(repSchema),next_cursor:z.string().nullable(),directory:z.object({status:z.string(),snapshot_id:z.string().nullable(),taken_at:z.string().nullable(),accounts:z.array(z.object({rc_account_id:z.string(),snapshot_id:z.string().nullable(),taken_at:z.string().nullable(),status:z.string()})).optional(),users:z.array(directoryUserSchema),next_cursor:z.string().nullable()})})});
/** `sms_to_rep` and `call_suggestion` only appear on rows written before the interim contract. */
export const nudgeSchema=z.object({id:z.string(),revision:z.number(),rc_account_id:z.string().nullable().optional(),rc_extension_id:z.string().nullable().optional(),rep_identity_link_id:z.string().nullable(),agent_id:z.string().nullable(),actor_id:z.string(),channel:z.enum(['team_messaging','sms_to_rep','pager']),purpose:z.enum(['call_suggestion','review_context']),template_key:z.string(),template_version:z.number(),body_as_sent:z.string(),status:z.enum(['pending','sent','failed','unknown_delivery','fallback_sent']),fallback_channel:z.literal('pager').nullable(),error_code:z.string().nullable(),created_at:z.string(),sent_at:z.string().nullable(),delivery_note:z.string(),automatic_resend:z.literal(false)});
export const nudgeSendSchema=z.object({data:z.object({operation_id:z.string(),replayed:z.boolean(),nudge:nudgeSchema})});
export type DirectoryUser=z.infer<typeof directoryUserSchema>;
export type NudgeRecord=z.infer<typeof nudgeSchema>;
/** Snapshot display only. Send remains the authority. Never invents a Team Messaging person id. */
export function destinationChannels(user: Pick<DirectoryUser,'extension_number'|'direct_numbers'>, personId?: string | null): string[] {
  const channels: string[] = [];
  if (personId) channels.push('team_messaging');
  if ((user.direct_numbers?.length ?? 0) === 1) channels.push('sms_to_rep');
  if (user.extension_number) channels.push('pager');
  return channels;
}

/* ── Coverage: every Owner read carries it; `GET /coverage` adds capture health and mapping hygiene ── */
const gapSchema=z.object({from:z.string(),to:z.string(),reason:z.string()});
/** `capabilities.call_log` / `.webhook`: `ok` | `unknown` | `unavailable` (kept as strings so a new word still renders). */
export const coverageSchema=z.object({known_through:z.string().nullable(),gaps:z.array(gapSchema),capabilities:z.record(z.string(),z.string())});
export type Coverage=z.infer<typeof coverageSchema>;
/** `status`: ok | attention | broken; `reasons[]`: webhook_down | webhook_degraded | quarantine | quarantine_over_24h | pending_finalization. */
export const captureHealthSchema = z.object({ status: z.string(), reasons: z.array(z.string()), as_of: z.string(), known_complete_through: z.string().nullable(),
  call_log: z.object({ sync_mode: z.string(), quarantined_count: z.number(), oldest_quarantined_at: z.string().nullable(), last_reconcile_at: z.string().nullable().optional(),
    last_sweep: z.object({ ran_at: z.string(), recovered_calls: z.number() }).catchall(z.json()).nullable() }),
  webhook: z.object({ state: z.string(), subscription_id_suffix: z.string().nullable(), last_receipt_at: z.string().nullable(), receipts_1h: z.number(),
    last_renewal_error: z.string().nullable(), last_renewal_at: z.string().nullable().optional(), subscription_expires_at: z.string().nullable().optional() }),
  in_progress_calls: z.number(), pending_finalization: z.number() });
export type CaptureHealth = z.infer<typeof captureHealthSchema>;
export const ownerCoverageSchema = z.object({ data: z.object({ as_of: z.string(), coverage: coverageSchema.extend({
  capture_health: captureHealthSchema,
  mapping_hygiene: z.object({ unmapped_inbound_numbers: z.number(), unmapped_directory_users: z.number().nullable(), last_directory_sync_at: z.string().nullable(), directory_status: z.string() }),
}) }) });
export type OwnerCoverage = z.infer<typeof ownerCoverageSchema>['data']['coverage'];

/* ── Numbers ── */
export const numberRollupsSchema=z.object({interactions_total:z.number(),inbound_total:z.number(),outbound_total:z.number(),human_conversations_total:z.number(),
 last_inbound_at:z.string().nullable(),last_outbound_at:z.string().nullable(),last_human_conversation_at:z.string().nullable(),
 attached_lead_count:z.number(),candidate_lead_count:z.number(),recordings_total:z.number()});
/** `open_lead` | `booked` | `cancelled` | `bad_lead` | `duplicate` | `no_sync`: the server's precedence, never recomputed here. */
export const leadOfficialSchema=z.object({status:z.string(),booking_id:z.string().nullable(),cancellation_id:z.string().nullable()});
/** Exactly one attached edge resolves; several are `multiple`; candidates never lend a Lead (`none`). Only `resolved` carries Lead fields. */
export const attachedLeadSchema=z.discriminatedUnion('status',[
 z.object({status:z.literal('resolved'),lead_ref:leadRefSchema,lead_display:z.object({name:z.string().nullable(),job_no:z.string().nullable(),source_company:z.string().nullable()}).nullable(),official:leadOfficialSchema.nullable()}),
 z.object({status:z.literal('multiple')}),
 z.object({status:z.literal('none')}),
]);
export type AttachedLead=z.infer<typeof attachedLeadSchema>;
export const numberSearchItemSchema=z.object({id:z.string(),revision:z.number(),e164:z.string(),national_ten:z.string().nullable(),kind:z.string(),classification:z.string(),eligibility:z.string(),
 provider_names:z.array(z.string()),first_observed_at:z.string(),last_activity_at:z.string(),rollups:numberRollupsSchema,linked:z.boolean(),
 match:z.object({kind:z.string()}),attached_lead:attachedLeadSchema,created_via:z.string(),has_calls:z.boolean()});
export type NumberSearchItem=z.infer<typeof numberSearchItemSchema>;
export const NUMBER_SORTS=['last_activity','last_human_conversation','first_observed','interactions'] as const;
export type NumberSort=(typeof NUMBER_SORTS)[number];
export const numberSearchSchema=z.object({as_of:z.string(),coverage:coverageSchema,data:z.object({items:z.array(numberSearchItemSchema),cursor:z.string().nullable(),
 sort:z.object({sort:z.string(),direction:z.enum(['asc','desc'])}),filters:z.object({has_calls:z.boolean()}).optional()})});
export const numberAttachmentSchema=z.object({id:z.string(),revision:z.number(),lead_ref:leadRefSchema,state:z.string(),certainty:z.string(),
 lead_display:z.object({name:z.string().nullable(),job_no:z.string().nullable()}).nullable(),decided_at:z.string().nullable(),decided_by:z.string().nullable(),decision_reason:z.string().nullable()});
/** Read-only in the interim: there is no resolve command. `origin: intelligence` rows are recorded history. */
export const numberRestrictionSchema=z.object({id:z.string(),revision:z.number(),channels:z.array(z.string()),until:z.string().nullable(),origin:z.string(),state:z.string()});
export type NumberRestriction=z.infer<typeof numberRestrictionSchema>;
export const numberDetailSchema=z.object({as_of:z.string(),coverage:coverageSchema,data:z.object({id:z.string(),revision:z.number(),e164:z.string(),national_ten:z.string().nullable(),kind:z.string(),
 classification:z.string(),eligibility:z.string(),provider_names:z.array(z.string()),search_terms:z.array(z.string()),first_observed_at:z.string(),last_activity_at:z.string(),
 created_via:z.string(),has_calls:z.boolean(),rollups:numberRollupsSchema,attached_lead:attachedLeadSchema,attachments:z.array(numberAttachmentSchema),
 restrictions:z.array(numberRestrictionSchema),
 connections:z.object({attachments_total:z.number(),attached:z.number(),candidate:z.number(),ambiguous:z.number(),rejected:z.number(),interactions_total_recount:z.number()}),
 allowed_actions:z.array(availabilitySchema)})});
export type NumberDetail=z.infer<typeof numberDetailSchema>['data'];
/** `interaction` (provider call metadata) and `lead_message` (no body) events, newest first. */
export const timelineEventSchema=z.object({id:z.string(),kind:z.string(),happened_at:z.string(),observed_at:z.string(),subject_key:z.string(),description:z.string(),
 evidence_refs:z.array(z.string()),detail:z.record(z.string(),z.json())});
export type TimelineEvent=z.infer<typeof timelineEventSchema>;
export const timelineSchema=z.object({as_of:z.string(),coverage:coverageSchema,data:z.object({number_id:z.string(),items:z.array(timelineEventSchema),cursor:z.string().nullable()})});
/** The rep a call is attributed to at its start; only `reviewed` names an Agent. */
export const callRepSchema=z.object({status:z.string(),agent_id:z.string().nullable(),agent_name:z.string().nullable(),extension_id:z.string().nullable(),extension_number:z.string().nullable()});
export const callLegSchema=z.object({leg_type:z.string().nullable(),direction:z.string().nullable(),result:z.string().nullable(),start_time:z.string().nullable(),duration_seconds:z.number().nullable(),extension_id:z.string().nullable()});
export const interactionDetailSchema=z.object({direction:z.string().nullable(),provider_result:z.string().nullable(),contact_type:z.string().nullable(),duration_seconds:z.number().nullable(),
 terminal:z.boolean().nullable().optional(),call_log_state:z.string().nullable().optional(),recording_count:z.number().optional(),answered_at:z.string().nullable().optional(),ended_at:z.string().nullable().optional(),
 company_e164:z.string().nullable().optional(),rep:callRepSchema.nullable().optional(),legs:z.array(callLegSchema).optional(),legs_overflow_count:z.number().optional()});
export type InteractionDetail=z.infer<typeof interactionDetailSchema>;
export const leadMessageDetailSchema=z.object({status:z.string().nullable(),purpose:z.string().nullable().optional(),origin:z.string().nullable().optional(),
 sent_at:z.string().nullable().optional(),delivered_at:z.string().nullable().optional()});

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
export async function sendNudge(body: Record<string, unknown>, key: string) {
  const response = await fetch('/api/proxy/api/v1/admin/sales-intelligence/nudges?scope=production', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new SalesIntelligenceError(payload.code ?? payload.registry_code ?? 'COMMAND_FAILED', response.status, payload.request_id);
  return nudgeSendSchema.parse(payload).data;
}
export type CommandIntent={path:string;method:'POST'|'PATCH';body:Record<string,unknown>;key:string};
/** Attachment and Rep identity commands answer `{ response, replayed }`; a Number rebuild answers `{ job_id, dedupe_key, number_id, replayed }`. */
export const commandResultSchema=z.object({ok:z.literal(true),data:z.object({response:z.record(z.string(),z.json()).optional(),replayed:z.boolean()}).catchall(z.json())});
export async function sendSalesIntelligence(intent:CommandIntent) {
 const response=await fetch(`/api/proxy/api/v1/admin/sales-intelligence/${intent.path}?scope=production`,{
  method:intent.method,headers:{'Content-Type':'application/json','Idempotency-Key':intent.key},body:JSON.stringify(intent.body)});
 const body=await response.json();
 if(!response.ok||!body.ok)throw new SalesIntelligenceError(body.code??body.registry_code??'COMMAND_FAILED',response.status,body.request_id);
 return commandResultSchema.parse(body).data;
}
