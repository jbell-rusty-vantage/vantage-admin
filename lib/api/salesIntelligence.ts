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
export const repSchema=z.object({id:z.string(),revision:z.number(),agent_id:z.string(),agent_name:z.string(),rc_account_id:z.string(),rc_extension_id:z.string(),rc_extension_name:z.string().nullable(),rc_extension_number:z.string().nullable(),role_kind:z.string(),status:z.string(),effective_from:z.string(),effective_to:z.string().nullable(),nudge_channels_allowed:z.array(z.string()),rc_direct_numbers:z.array(z.string()).default([]),rc_team_messaging_person_id:z.string().nullable().optional(),history:z.array(z.object({at:z.string().nullable(),by:z.string().nullable(),change:z.string().nullable()})),metrics:z.object({status:z.literal('unknown'),interactions_total:z.null()})});
/** Owner review records pager on every unique link; SMS-to-rep only when the stored snapshot has exactly one DID. Team Messaging person ids stay unresolved. */
export function reviewedNudgeChannels(directNumbers: readonly string[] | undefined): string[] {
  return (directNumbers?.length ?? 0) === 1 ? ["pager", "sms_to_rep"] : ["pager"];
}
export const directoryUserSchema=z.object({extension_id:z.string(),extension_name:z.string().nullable(),status:z.string(),candidates:z.array(z.object({agent_id:z.string(),agent_name:z.string(),basis:z.string()})),extension_number:z.string().nullable().optional(),direct_numbers:z.array(z.string()).optional(),directory_status:z.string().optional(),rc_account_id:z.string().optional(),attached_agent:z.object({id:z.string(),name:z.string()}).nullable().optional()});
export const repsSchema=z.object({data:z.object({items:z.array(repSchema),next_cursor:z.string().nullable(),directory:z.object({status:z.string(),snapshot_id:z.string().nullable(),taken_at:z.string().nullable(),accounts:z.array(z.object({rc_account_id:z.string(),snapshot_id:z.string().nullable(),taken_at:z.string().nullable(),status:z.string()})).optional(),users:z.array(directoryUserSchema),next_cursor:z.string().nullable()})})});
export const nudgeSchema=z.object({id:z.string(),revision:z.number(),outreach_record_id:z.string().nullable(),rc_account_id:z.string().nullable().optional(),rc_extension_id:z.string().nullable().optional(),rep_identity_link_id:z.string().nullable(),agent_id:z.string().nullable(),actor_id:z.string(),channel:z.enum(['team_messaging','sms_to_rep','pager']),purpose:z.enum(['call_suggestion','review_context']),template_key:z.string(),template_version:z.number(),body_as_sent:z.string(),status:z.enum(['pending','sent','failed','unknown_delivery','fallback_sent']),fallback_channel:z.literal('pager').nullable(),error_code:z.string().nullable(),created_at:z.string(),sent_at:z.string().nullable(),delivery_note:z.string(),automatic_resend:z.literal(false)});
export const nudgePreviewSchema=z.object({as_of:z.string(),data:z.object({body:z.string(),template_key:z.string(),template_version:z.number(),purpose:z.string(),expected_revision:z.number().nullable(),expected_rep_revision:z.number().nullable(),recipient:z.object({rc_account_id:z.string(),rc_extension_id:z.string(),directory_name:z.string().nullable().optional(),agent_id:z.string().nullable(),agent_name:z.string().nullable(),rep_identity_link_id:z.string().nullable(),channel:z.string()}),allowed_channels:z.array(z.string()),destination_evidence:z.string(),provider_destination_verified:z.boolean(),send_time_revalidation_required:z.boolean(),authorizes_send:z.literal(false)})});
export const nudgeSendSchema=z.object({data:z.object({operation_id:z.string(),replayed:z.boolean(),nudge:nudgeSchema})});
export const nudgeHistorySchema=z.object({as_of:z.string(),data:z.object({items:z.array(nudgeSchema),next_cursor:z.string().nullable()})});
export type DirectoryUser=z.infer<typeof directoryUserSchema>;
export type NudgePreview=z.infer<typeof nudgePreviewSchema>['data'];
export type NudgeRecord=z.infer<typeof nudgeSchema>;
/** Snapshot display only. Preview/send remain the send authority. Never invents a Team Messaging person id. */
export function destinationChannels(user: Pick<DirectoryUser,'extension_number'|'direct_numbers'>, personId?: string | null): string[] {
  const channels: string[] = [];
  if (personId) channels.push('team_messaging');
  if ((user.direct_numbers?.length ?? 0) === 1) channels.push('sms_to_rep');
  if (user.extension_number) channels.push('pager');
  return channels;
}
const assignment = z.object({ agent: agent.nullable(), origin: z.string().nullable(),
  // UI1-DATA: additive (E4, E26). `origin` stays a string: `crm_receiver`, `inherited_outreach`, … render as server words.
  assigned_at: z.string().nullable().optional(), owner_instruction_id: z.string().nullable().optional() });
// call_state and provenance_state are server words, not Admin derivations, and stay z.string() so a
// server that grows a value still renders. Unmodelled keys are stripped, so every read field is here.
const derived = z.object({ overdue: z.boolean(), attention_band: z.number().nullable(), reasons: z.array(z.string()),
  review_badges: z.array(z.string()).optional(), call_blockers: z.array(z.string()), age_wall_ms: z.number(), age_staffed_ms: z.number(),
  // `provenance_state` values the UI knows: `needs_a_lead`, `ambiguous`, `is_the_lead` (S11-PROV). Still a string.
  call_state: z.string().optional(), provenance_state: z.string().optional(),
  // UI1-DATA: additive server facts; the browser reads them, never recomputes them.
  review_item_ids: z.array(z.string()).optional(), no_owner: z.boolean().optional(), no_next_action: z.boolean().optional(),
  cooldown: z.boolean().optional(), absence_qualified: z.boolean().optional(), policy_version: z.string().optional(),
  missing_record_responsibility: z.boolean().optional(), missing_action_responsibility: z.array(z.string()).optional(),
  action_facts: z.array(z.object({ id: z.string(), attention_due_at: z.string().nullable(), overdue: z.boolean(), contractual_overdue: z.boolean(), call_allowed: z.boolean() })).optional() });
export const PROVENANCE_STATES = ['is_the_lead','needs_a_lead','ambiguous'] as const;
const subject = z.discriminatedUnion('kind', [z.object({ kind: z.literal('number_review'), contact_number_id: z.string() }),
  z.object({ kind: z.literal('lead'), model: z.enum(['FormLead','CallLead']), id: z.string() })]);
const followup = z.object({ id: z.string(), revision:z.number(), allowed_actions:z.array(availabilitySchema),kind: z.string(), description: z.string(), status: z.string(), due_at: z.string().nullable(),
  disposition:z.string().nullable().optional(),completion_basis:z.string().nullable().optional(),
  snoozed_until: z.string().nullable(), overdue: z.boolean(), origin: z.string(), assignment, promised_by: agent.nullable(), paused_channels: z.array(z.string()),
  // UI1-DATA (Team 4, UI-1 §5.4): additive. `attention_due_at` is the countdown reference; `promise_chain` the retry (`Try again ({attempt} of 2)`).
  attention_due_at: z.string().nullable().optional(), base_attention_due_at: z.string().nullable().optional(),
  default_kind: z.string().optional(), cancel_reason: z.string().optional(), supersedes_id: z.string().optional(),
  promise_chain: z.object({ attempt: z.number(), root_id: z.string(), root_origin: z.string() }).optional(),
  date_text: z.string().nullable().optional(), wait_expired_at: z.string().nullable().optional(), provenance_refs: z.array(z.string()).optional(),
  date_resolution: z.object({ anchor: z.string(), precision: z.string(), timezone: z.string(), policy_version: z.string(), assumption: z.string().nullable() }).optional() });
// LP-01 §7: server-owned Lead progress. Every label is a server word; Admin never derives Quoted from
// Priority or policy from a code. Optional so a server without it still renders.
export const leadProgressSchema = z.object({ lead_ref: z.object({ model: z.enum(['FormLead','CallLead']), id: z.string() }),
  granot_priority: z.string().nullable(), priority_label: z.string(), quoted: z.boolean().nullable(),
  disposition: z.string(), disposition_label: z.string(), work_observed: z.boolean(), basis: z.string().nullable(), basis_label: z.string().nullable(),
  provenance: z.string(), source_origin: z.string().nullable(), source_applied_at: z.string().nullable(), last_progress_at: z.string().nullable(),
  first_work_observed_at: z.string().nullable(), closure: z.object({ basis: z.string(), closed_at: z.string().nullable() }).nullable(),
  override: z.object({ reason: z.string(), decided_at: z.string(), decided_by: z.string(), disposition_revision: z.string() }).nullable(),
  reopen_review_id: z.string().nullable(), disposition_revision: z.string(), explanation: z.string().nullable(), no_call_observed: z.boolean(), projected_at: z.string() });
export type LeadProgress = z.infer<typeof leadProgressSchema>;
// §14.1 ordering keys frozen into each Attention row; Admin renders server order and never sorts a page locally.
// Move assessment §8: score keys are optional so snapshots published before the contract still parse (missing reads as unknown).
export const sortKeysSchema = z.object({ next_action_due: z.string().nullable(), lead_received: z.string().nullable(), last_human_contact: z.string().nullable(), last_lead_progress: z.string().nullable(),
  transaction_intent: z.number().nullable().optional(), move_likelihood: z.number().nullable().optional(),
  assessment_status: z.string().nullable().optional(), assessment_stale: z.boolean().nullable().optional(),
  // UI1-DATA (S2, D20): `last_call`, `interactions`; the closed partition adds `closed` and `time_to_close`. Absent on older snapshots.
  last_call: z.string().nullable().optional(), interactions: z.number().nullable().optional(),
  closed: z.string().nullable().optional(), time_to_close: z.number().nullable().optional(), band2_due_rank: z.number().nullable().optional() });
export const ATTENTION_SORTS = ['attention','next_action_due','lead_received','last_human_contact','last_lead_progress','transaction_intent','move_likelihood'] as const;
export type AttentionSort = (typeof ATTENTION_SORTS)[number];
export const ATTENTION_SCORE_SORTS = ['transaction_intent','move_likelihood'] as const;
export type AttentionScoreSort = (typeof ATTENTION_SCORE_SORTS)[number];
export function isScoreSort(value: string | null | undefined): value is AttentionScoreSort { return (ATTENTION_SCORE_SORTS as readonly string[]).includes(value ?? ''); }
export const ATTENTION_SORT_DEFAULT_DIRECTION: Record<AttentionSort, 'asc'|'desc'> = { attention: 'asc', next_action_due: 'asc', lead_received: 'desc', last_human_contact: 'asc', last_lead_progress: 'desc', transaction_intent: 'desc', move_likelihood: 'desc' };
/**
 * UI-1 §3.4: the new desk's nine sorts (Needs Attention and All Outreach) = ATTENTION_SORTS + `last_call`, `interactions` (S2, D20).
 * ATTENTION_SORTS stays the legacy list because the quarantined page's sort menu mirrors it (tests/legacy). Defaults
 * differ from the legacy map in one place: `last_human_contact` (Last conversation) is newest first on the new desk.
 * The words (label, direction words, null label) live in `copy.ui1.data.sorts`.
 */
export const DESK_SORTS = [...ATTENTION_SORTS, 'last_call', 'interactions'] as const;
export type DeskSort = (typeof DESK_SORTS)[number];
export const DESK_SORT_DEFAULT_DIRECTION: Record<DeskSort, 'asc'|'desc'> = { ...ATTENTION_SORT_DEFAULT_DIRECTION, last_human_contact: 'desc', last_call: 'desc', interactions: 'desc' };
export function parseDeskSort(value: string | null | undefined, fallback: DeskSort = 'attention'): DeskSort { return (DESK_SORTS as readonly string[]).includes(value ?? '') ? value as DeskSort : fallback; }
/** UI-1 §3.4 order of the sort menu. */
export const DESK_SORT_ORDER: readonly DeskSort[] = ['attention','lead_received','last_call','last_human_contact','next_action_due','last_lead_progress','transaction_intent','move_likelihood','interactions'];
/** UI-1 §3.5: Closed has its own sorts (`view=closed` only; the server refuses them elsewhere). */
export const CLOSED_SORTS = ['closed','lead_received','time_to_close'] as const;
export type ClosedSort = (typeof CLOSED_SORTS)[number];
export const CLOSED_SORT_DEFAULT_DIRECTION: Record<ClosedSort, 'asc'|'desc'> = { closed: 'desc', lead_received: 'desc', time_to_close: 'asc' };
export function parseClosedSort(value: string | null | undefined): ClosedSort { return (CLOSED_SORTS as readonly string[]).includes(value ?? '') ? value as ClosedSort : 'closed'; }
/** The default sort on Needs Attention and All Outreach: Lead received, newest first (Owner, 2026-09-25; Needs Attention was Attention order). */
export const DESK_DEFAULT_SORT: DeskSort = 'lead_received';
/** Closed's default sort: Lead received, newest first (Owner, 2026-09-25; was Closed date). */
export const CLOSED_DEFAULT_SORT: ClosedSort = 'lead_received';
// Move assessment §8.1: the compact projection on an Outreach record. Server enums stay z.string() so a grown value still renders.
export const moveAssessmentSchema = z.object({ artifact_id: z.string().nullable(), status: z.string(), applicability: z.string(),
  transaction_intent: z.number().nullable(), move_likelihood: z.number().nullable(),
  transaction_intent_confidence: z.string().nullable(), move_likelihood_confidence: z.string().nullable(),
  context_as_of: z.string().nullable(), latest_conversation_at: z.string().nullable(), stale: z.boolean(), stale_reason: z.string().nullable(), published_at: z.string().nullable(),
  // UI1-DATA: server level words for the card's `· {Level}` (final §5.4).
  transaction_intent_level: z.string().nullable().optional(), transaction_intent_level_label: z.string().nullable().optional(),
  move_likelihood_level: z.string().nullable().optional(), move_likelihood_level_label: z.string().nullable().optional() });
export type MoveAssessment = z.infer<typeof moveAssessmentSchema>;
export type ScoreLabel = `${number} / 100` | 'Unknown' | 'Pending' | 'Not applicable' | 'Not assessed' | 'Unavailable';
/**
 * MA-01 §11: the card/sort wording for one score, straight from server facts. A number is `N / 100`
 * (never a percent); a real 0 stays `0 / 100`. `not_applicable` (status or read-time applicability)
 * wins over a number because the server sorts it as null. Assessed without a number is Unknown;
 * a queued job without a number is Pending; absent or `not_assessed` is Not assessed. Failed,
 * purged or unsupported results are Unavailable, never zero and never Unknown.
 */
export function scoreLabel(status: string | null | undefined, score: number | null | undefined, applicability?: string | null): ScoreLabel {
  if (status === 'not_applicable' || applicability === 'not_applicable') return 'Not applicable';
  if (typeof score === 'number' && Number.isFinite(score)) return `${Math.round(score)} / 100`;
  if (status === 'pending') return 'Pending';
  if (status === 'ready' || status === 'insufficient_evidence' || status === 'ambiguous_subject') return 'Unknown';
  if (status === 'failed' || status === 'purged' || status === 'unsupported' || status === 'unavailable') return 'Unavailable';
  return 'Not assessed';
}
export const NUMBER_SORTS = ['last_activity','last_human_conversation','first_observed'] as const;
export type NumberSort = (typeof NUMBER_SORTS)[number];
export function parseAttentionSort(value: string | null | undefined): AttentionSort { return (ATTENTION_SORTS as readonly string[]).includes(value ?? '') ? value as AttentionSort : 'attention'; }
export function parseNumberSort(value: string | null | undefined): NumberSort { return (NUMBER_SORTS as readonly string[]).includes(value ?? '') ? value as NumberSort : 'last_activity'; }
export function parseDirection(value: string | null | undefined, fallback: 'asc'|'desc'): 'asc'|'desc' { return value === 'asc' || value === 'desc' ? value : fallback; }
/* ── UI1-DATA: Outreach additions (SERVER-STATE-FOR-UI §1, desk card lines 1–7, Now strip, Situation). All optional:
 * a server or snapshot without them still parses, and the UI prints the null wording. ── */
// Card lines 2–4. Counts are null when the record has no primary Number (`No Number on file`), never zero.
export const outreachFactsSchema = z.object({
  route: z.object({ pickup_city: z.string().nullable(), pickup_state: z.string().nullable(), delivery_city: z.string().nullable(), delivery_state: z.string().nullable(),
    move_date: z.string().nullable(), source: z.string().optional() }).nullable(),
  move_date_passed: z.boolean(), last_call_at: z.string().nullable(),
  calls_total: z.number().nullable(), conversations_total: z.number().nullable(), recordings_available: z.number().nullable(), recordings_analyzed: z.number().nullable(),
  newer_call_since_assessment: z.boolean(), details_disagree: z.boolean(),
  // `due` | `overdue` | `no_due_date` | `none`: the server's state; the browser never compares due time to now.
  next_action_state: z.string(),
  rep_thread: z.json().nullable().optional() });
export type OutreachFacts = z.infer<typeof outreachFactsSchema>;
// G3: the live chip. `rep.text` is shown exactly as sent.
export const liveCallSchema = z.object({ interaction_id: z.string(), direction: z.string(), started_at: z.string(),
  rep: z.object({ kind: z.string(), agent_id: z.string().nullable().optional(), name: z.string().nullable().optional(), extension: z.string().nullable().optional(), text: z.string() }) });
export type LiveCall = z.infer<typeof liveCallSchema>;
export const bandSinceSchema = z.object({ at: z.string(), estimated: z.boolean() });
export const nextActionSchema = followup;
export type NextAction = z.infer<typeof nextActionSchema>;
// Case 2 of card line 6: the newest suggestion the server decided to show; `apply` is its command availability.
export const suggestedNextStepSchema = z.object({ run_id: z.string().optional(), action_kind: z.string(), action_label: z.string().optional(), description: z.string(),
  date_text: z.string().nullable().optional(), timezone_text: z.string().nullable().optional(),
  apply: availabilitySchema.extend({ outreach_id: z.string().optional(), outreach_expected_revision: z.number().optional(), suggestion_output_digest: z.string().optional() }).optional() });
export type SuggestedNextStep = z.infer<typeof suggestedNextStepSchema>;
export const receiverAgentSchema = z.object({ agent: agent, source: z.string().nullable(), set_at: z.string().nullable() });
// Addendum §4.3: `lead_cost: null` without a Lead (never $0). `basis`: rate | legacy | unpriced | zero.
export const leadCostSchema = z.object({ amount: z.number(), basis: z.string() });
export const latestSummarySchema = z.object({ run_id: z.string().optional(), run_kind: z.string(), overview: z.string(), completed_at: z.string(), conversations_covered: z.number().nullable() });
export const officialSchema = z.object({ status: z.string(), booking_id: z.string().nullable(), priority: z.object({ code: z.string(), label: z.string() }).nullable() });
export const outreachSchema = z.object({ id: z.string(), revision: z.number(), subject, state: z.string(), reason: z.string().nullable(),
  facts: outreachFactsSchema.optional(), live_call: liveCallSchema.nullable().optional(), band_since: bandSinceSchema.nullable().optional(),
  next_action: nextActionSchema.nullable().optional(), suggested_next_step: suggestedNextStepSchema.nullable().optional(),
  trigger_at: z.string().optional(), last_activity_at: z.string().nullable().optional(), last_attributable_outbound_at: z.string().nullable().optional(),
  prior_contact_at: z.string().nullable().optional(), last_inbound_human_at: z.string().nullable().optional(),
  first_action_due_at: z.string().nullable().optional(), first_attributable_outbound_at: z.string().nullable().optional(), first_human_conversation_at: z.string().nullable().optional(),
  receiver_agent: receiverAgentSchema.nullable().optional(), lead_cost: leadCostSchema.nullable().optional(),
  latest_summary: latestSummarySchema.nullable().optional(), official: officialSchema.nullable().optional(),
  newest_run_id: z.string().nullable().optional(), followups_cursor: z.string().nullable().optional(),
  allowed_actions:z.array(availabilitySchema),
  lead_progress: leadProgressSchema.nullable().optional(),
  lead_display:z.object({name:z.string().nullable(),job_no:z.string().nullable(),source_company:z.string().nullable()}).nullable().optional(),
  latest_number_call:z.object({id:z.string(),happened_at:z.string(),direction:z.string(),provider_result:z.string().nullable(),contact_type:z.string()}).nullable().optional(),
  related_record_links:z.array(z.object({model:z.enum(['FormLead','CallLead','BookedLead','CancelledLead']),id:z.string(),href:z.string(),certainty:z.string()})).optional(),
  lead_attachment:z.object({attachment_id:z.string(),lead_ref:z.object({model:z.enum(['FormLead','CallLead']),id:z.string()}),state:z.string(),certainty:z.string(),
   certainty_label:z.string().nullable(),decided_by:z.string(),decided_at:z.string().nullable(),confidence:z.number().nullable(),observed_at:z.string(),
   lead_display:z.object({name:z.string().nullable(),job_no:z.string().nullable()}).nullable()}).nullable().optional(),
  call_progress:z.object({state:z.string(),started_at:z.string(),started_by:z.string().nullable(),ended_at:z.string().nullable(),ended_by:z.string().nullable(),note:z.string().nullable()}).nullable().optional(),
  move_assessment: moveAssessmentSchema.nullable().optional(),
  primary_number: z.object({ id: z.string(), e164: z.string() }).nullable().optional(), assignment, followups: z.array(followup), derived,
  last_meaningful_contact_at: z.string().nullable() });
const coverage = z.object({ known_through: z.string().nullable(), gaps: z.array(z.object({ from:z.string(), to:z.string(), reason:z.string() })), ai_paused:z.boolean() });
// §7 Number card: the one resolved Lead's progress, or an explicit multiple/none. Never merged across Leads.
export const attachedLeadProgressSchema = z.object({ status: z.enum(['resolved','multiple','none']),
  lead_ref: z.object({ model: z.enum(['FormLead','CallLead']), id: z.string() }).optional(), lead_progress: leadProgressSchema.nullable().optional(),
  booking: z.object({ id: z.string(), cancelled: z.boolean() }).nullable().optional(), outreach_state: z.string().nullable().optional(),
  lead_display: z.object({ name: z.string().nullable(), job_no: z.string().nullable() }).nullable().optional(),
  // UI1-DATA (S4): additive row facts (UI-3 renders them).
  lead_status: z.string().nullable().optional(), outreach_records_total: z.number().optional(), move_assessment: moveAssessmentSchema.nullable().optional() });
export type AttachedLeadProgress = z.infer<typeof attachedLeadProgressSchema>;
export const numberSearchSchema = z.object({ as_of:z.string(), coverage, data:z.object({
  items:z.array(z.object({ id:z.string(), revision:z.number(), e164:z.string(), provider_names:z.array(z.string()),
    classification:z.string(), eligibility:z.string(), linked:z.boolean(), last_activity_at:z.string(), first_observed_at:z.string().optional(),
    rollups:z.object({ interactions_total:z.number(), human_conversations_total:z.number(), attached_lead_count:z.number(), candidate_lead_count:z.number(), last_human_conversation_at:z.string().nullable().optional(),
      recordings_total:z.number().optional(), outreach_records_total:z.number().optional() }),
    attached_lead_progress: attachedLeadProgressSchema.optional(),
    // UI1-DATA (S2/S5c G7): additive.
    created_via: z.string().optional(), has_calls: z.boolean().optional() })),
  cursor:z.string().nullable(), filters: z.object({ has_calls: z.boolean().optional() }).optional(),
  // LP-06: the order the server applied to this page; absent on pre-sort servers.
  sort:z.object({ sort:z.string(), direction:z.enum(['asc','desc']) }).optional() }) });
export const timelineSchema = z.object({ as_of:z.string(), coverage, data:z.object({ number_id:z.string(),
  items:z.array(z.object({ id:z.string(), kind:z.string(), happened_at:z.string(), observed_at:z.string(), description:z.string(),
    evidence_refs:z.array(z.string()), detail:z.record(z.string(),z.json()) })), cursor:z.string().nullable() }) });
/*
 * UI1-DATA: timeline v2 (`GET /outreach/:id/timeline`, `GET /numbers/:id/timeline`, final §10, UI-1 §5.3).
 * `kind` and `group` stay strings: an unknown kind renders from its server `title`/`description`. The v2
 * presentation fields default so a TIMELINE_V2-off (v1) page still parses; `title` is then absent and the
 * row falls back to `description`.
 */
export const timelineCallSchema = z.object({ interaction_id: z.string(), direction: z.string(), result: z.string().nullable(), connected: z.boolean().optional(),
  contact_type: z.string().nullable(), duration_seconds: z.number().nullable(), recording_count: z.number().optional(), recording_state: z.string(),
  conversation_id: z.string().nullable(),
  rep: z.object({ agent_id: z.string().nullable(), name: z.string().nullable(), status: z.string(), extension: z.string().nullable() }).nullable(),
  // G2 / G4 (S5c): absent on pre-S5c captures.
  terminal: z.boolean().optional(), in_progress: z.boolean().optional(), call_log_state: z.string().nullable().optional(), observed_reason: z.string().nullable().optional() });
export type TimelineCall = z.infer<typeof timelineCallSchema>;
export const timelineEventSchema = z.object({ id: z.string(), kind: z.string(), happened_at: z.string(), observed_at: z.string(), description: z.string(),
  subject_key: z.string().optional(), evidence_refs: z.array(z.string()).optional().default([]), detail: z.record(z.string(), z.json()).optional().default({}),
  title: z.string().optional(), group: z.string().optional(), kind_order: z.number().optional(),
  chips: z.array(z.string()).optional().default([]), routine: z.boolean().optional().default(false), recorded_late: z.boolean().optional().default(false),
  job_no: z.string().nullable().optional().default(null),
  actor: z.object({ kind: z.string(), agent_id: z.string().nullable().optional(), name: z.string().nullable() }).nullable().optional().default(null),
  action: z.object({ kind: z.string(), href: z.string().optional() }).catchall(z.json()).nullable().optional().default(null),
  call: timelineCallSchema.nullable().optional().default(null) });
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export const timelineV2Schema = z.object({ as_of: z.string(), coverage, data: z.object({ scope: z.string().optional(),
  number_id: z.string().nullable(), outreach_id: z.string().nullable().optional(), items: z.array(timelineEventSchema), cursor: z.string().nullable(),
  kinds: z.array(z.string()).nullable().optional().default(null),
  coverage: z.object({ truncated_sources: z.array(z.string()) }).optional().default({ truncated_sources: [] }) }) });
export type TimelinePage = z.infer<typeof timelineV2Schema>;

/* ── UI1-DATA: Conversations and transcript (final §11.7, UI-1 §5.2). Server labels are shown as sent. ── */
const repIdentity = z.object({ name: z.string().nullable(), status: z.string() });
export const conversationCardSchema = z.object({ conversation_id: z.string(), interaction_id: z.string(), run_id: z.string().nullable().optional(),
  started_at: z.string(), started_at_label: z.string(), direction: z.string(), direction_label: z.string(),
  duration_seconds: z.number().nullable(), rep: repIdentity, contact_type: z.string().nullable(), contact_type_label: z.string(),
  recording_count: z.number().optional(), recording_state: z.string(), recording_label: z.string().optional(), media_available: z.boolean(),
  transcript_available: z.boolean().optional(), transcript_version: z.string().nullable().optional(),
  summary_source: z.string().nullable(), summary_sections: z.array(z.object({ key: z.string(), label: z.string(), text: z.string().nullable() })),
  in_progress: z.boolean().optional(), terminal: z.boolean().optional(), call_log_state: z.string().nullable().optional() });
export type ConversationCard = z.infer<typeof conversationCardSchema>;
export const otherCallSchema = z.object({ interaction_id: z.string(), started_at: z.string(), started_at_label: z.string(), direction: z.string(), direction_label: z.string(),
  duration_seconds: z.number().nullable(), rep: repIdentity, result: z.string().nullable(), contact_type: z.string().nullable(), contact_type_label: z.string(),
  recording_count: z.number().optional(), in_progress: z.boolean().optional(), terminal: z.boolean().optional(), call_log_state: z.string().nullable().optional() });
export type OtherCall = z.infer<typeof otherCallSchema>;
export const conversationsSchema = z.object({ as_of: z.string(), coverage, data: z.object({ contact_number_id: z.string(),
  items: z.array(conversationCardSchema), other_calls: z.array(otherCallSchema), next_cursor: z.string().nullable() }) });
export type ConversationsPage = z.infer<typeof conversationsSchema>;
export const transcriptSchema = z.object({ as_of: z.string(), coverage, data: z.object({ conversation_id: z.string(), started_at: z.string().nullable(),
  available: z.boolean(), reason: z.string().nullable().optional(), transcript_version: z.string().nullable(),
  offset: z.number(), limit: z.number(), total: z.number(), next_offset: z.number().nullable(),
  segments: z.array(z.object({ sid: z.union([z.number(), z.string()]), at: z.string().nullable(), start_ms: z.number().nullable(), end_ms: z.number().nullable(),
    speaker: z.string(), speaker_label: z.string(), text: z.string(), timing_source: z.string().optional() })),
  completeness: z.object({ complete: z.boolean(), missing_ranges: z.array(z.string()) }) }) });
export type TranscriptPage = z.infer<typeof transcriptSchema>;
// UI1-DATA (S2): the frozen keys every filter reads. `priority` is a Granot code, `no_lead`, or null (= `Not set`).
export const filterKeysSchema = z.object({ band: z.number().nullable(), needs_review: z.boolean(), state: z.string().nullable(), agents: z.array(z.string()),
  attachment: z.string(), priority: z.string().nullable(), has_recording: z.boolean(), has_assessment: z.boolean(), newer_call: z.boolean(),
  ti: z.number().nullable(), ml: z.number().nullable(), received_at: z.string().nullable(), move_date: z.string().nullable(),
  outcome: z.string().nullable(), closed_at: z.string().nullable(),
  live_call: z.boolean().optional(), overdue: z.boolean().optional(), responsible: z.string().nullable().optional() });
export type FilterKeys = z.infer<typeof filterKeysSchema>;
// Final §8 / addendum §2.2: the closed outcome line. `reason` includes `granot_booked`; `time_to_close_ms` null (never 0) when unknown.
export const closedOutcomeSchema = z.object({ reason: z.string(), origin: z.string(), closed_at: z.string(), time_to_close_ms: z.number().nullable(),
  calls_total: z.number().nullable(),
  booking: z.object({ id: z.string(), book_date: z.string(), total_binder_amount: z.number().nullable(), job_no: z.string().nullable().optional(), agent_name: z.string().nullable().optional() }).nullable(),
  cancellation: z.object({ id: z.string(), cancel_date: z.string().nullable(), reason: z.string().nullable() }).nullable(),
  priority: z.object({ code: z.string(), label: z.string() }).nullable(), note: z.string().nullable() });
export type ClosedOutcome = z.infer<typeof closedOutcomeSchema>;
export const attentionRowSchema = z.object({ subject_key:z.string(), subject,
  outreach: outreachSchema.nullable(), derived, sort_keys: sortKeysSchema.optional(),
  // Move assessment §8: `false` rows are reachable only in `view=all_outreach`; absent reads as in Attention.
  in_attention: z.boolean().optional(),
  // UI1-DATA: `filter_keys` (S2), the closed partition's `outcome` (absent on active rows), a Number-review row's own actions.
  filter_keys: filterKeysSchema.optional(), outcome: closedOutcomeSchema.optional(), partition: z.string().optional(),
  allowed_actions: z.array(availabilitySchema).optional() });
// Final §6: five tiles computed at publish. Absent (not null) on a snapshot without metrics → every tile `—`.
export const deskMetricsSchema = z.object({ as_of: z.string(), leads_received_7d: z.number(), not_called_yet: z.number(), callbacks_overdue: z.number(),
  awaiting_assessment: z.number(), booked_7d: z.number(), booked_7d_median_days: z.number().nullable().optional() });
export type DeskMetrics = z.infer<typeof deskMetricsSchema>;
// Addendum §5: per Priority key (`0`…`9`, `not_set`, `no_lead`), the count in each view. Keys are present only when seen.
export const priorityCountsSchema = z.record(z.string(), z.object({ attention: z.number(), active: z.number(), closed: z.number() }));
export type PriorityCounts = z.infer<typeof priorityCountsSchema>;
export const attentionSchema = z.object({ as_of: z.string(), coverage, data: z.object({ items: z.array(attentionRowSchema),
  snapshot_id: z.string().nullable(), total_items:z.number().nullable(), cursor:z.string().nullable(), reason_counts:z.record(z.string(), z.number()).optional(),
  metrics: deskMetricsSchema.optional(), priority_counts: priorityCountsSchema.optional(),
  // Optional on the server DTO, so requiring it here would fail the whole Attention read on a page the server still publishes.
  status:z.enum(['ready','pending_projection']).optional(), stale:z.boolean().optional(),
  // §14.1: the sort the server produced this page under. Absent means the server has no sort contract; the UI shows "unavailable" rather than sorting locally.
  sort:z.string().optional(), direction:z.enum(['asc','desc']).optional(), view:z.string().optional(), freshness:z.string().optional() }) });
export const numberSchema = z.object({ as_of:z.string(), coverage, data:z.object({ id:z.string(), revision:z.number(), allowed_actions:z.array(availabilitySchema), e164:z.string(), classification:z.string(), eligibility:z.string(),
  outreach_records:z.array(outreachSchema), running_analysis:z.object({ text:z.string(), run_id:z.string().optional(), computed_at:z.string() }).nullable(),
  attachments:z.array(z.object({ id:z.string(), state:z.string(), certainty:z.string(), lead_ref:z.object({ model:z.string(), id:z.string() }) })),
  review_items:z.array(z.object({ id:z.string(), cause_kind:z.string(), state:z.string() })),
  restrictions:z.array(z.object({ id:z.string(), revision:z.number(), channels:z.array(z.string()), state:z.string(), until:z.string().nullable(), allowed_actions:z.array(availabilitySchema) })) }) });
// UI1-DATA: Owner corrections on this record (Work tab). `prior`/`current` are the recorded values, kept as JSON.
export const ownerInstructionSchema = z.object({ instruction_id: z.string(), revision: z.number(), field: z.string(), state: z.string(),
  happened_at: z.string(), finding_id: z.string().nullable().optional(), followup_id: z.string().nullable().optional(), subject_key: z.string().optional(),
  actor: z.object({ kind: z.string(), id: z.string().nullable().optional() }).catchall(z.json()).optional(),
  prior: z.json().optional(), current: z.json().optional() });
export type OwnerInstruction = z.infer<typeof ownerInstructionSchema>;
const nudgePageSchema = z.object({ items: z.array(nudgeSchema), next_cursor: z.string().nullable() });
export const outreachReadSchema = z.object({ as_of:z.string(), coverage, data:z.object({ outreach:outreachSchema,
  // UI1-DATA: the detail read's Work-tab companions. Always empty `nudges.items` for a rep.
  owner_instructions: z.array(ownerInstructionSchema).optional(),
  // Older servers wrapped it as the history read (`{ as_of, data: { items, next_cursor } }`); both read as `{ items, next_cursor }`.
  nudges: z.union([nudgePageSchema, z.object({ data: nudgePageSchema }).transform((value) => value.data)]).optional() }) });
export type OutreachRead = z.infer<typeof outreachReadSchema>;
/** `status`: ok | attention | broken; `reasons[]`: webhook_down | webhook_degraded | quarantine | quarantine_over_24h | pending_finalization. */
export const captureHealthSchema = z.object({ status: z.string(), reasons: z.array(z.string()), as_of: z.string(), known_complete_through: z.string().nullable(),
  call_log: z.object({ sync_mode: z.string(), quarantined_count: z.number(), oldest_quarantined_at: z.string().nullable(), last_reconcile_at: z.string().nullable().optional(),
    last_sweep: z.object({ ran_at: z.string(), recovered_calls: z.number() }).catchall(z.json()).nullable() }),
  webhook: z.object({ state: z.string(), subscription_id_suffix: z.string().nullable(), last_receipt_at: z.string().nullable(), receipts_1h: z.number(),
    last_renewal_error: z.string().nullable(), last_renewal_at: z.string().nullable().optional(), subscription_expires_at: z.string().nullable().optional() }),
  in_progress_calls: z.number(), pending_finalization: z.number() });
export type CaptureHealth = z.infer<typeof captureHealthSchema>;
const stage = z.object({ pending:z.number(), leased:z.number(), retry:z.number(), paused:z.number(), dead_letter:z.number(), oldest_queued_at:z.string().nullable() });
export const ownerCoverageSchema = z.object({ data:z.object({ as_of:z.string(), coverage:z.object({
  known_through:z.string().nullable(), gaps:z.array(z.object({ from:z.string(), to:z.string(), reason:z.string() })),
  capabilities:z.record(z.string(), z.enum(['ok','denied','unknown','unavailable'])), ai_paused:z.boolean(),
  recordings:z.object({ pending_discovery:z.number(), media_pending:z.number(), media_stored:z.number(), no_recording:z.number(), unavailable:z.number(), failed:z.number(), eligibility_undetermined:z.number() }).optional(),
  stages:z.object({ recording:stage, transcription:stage, analysis:stage, application:stage }),
  budget:z.object({ status:z.enum(['known','unknown']), month:z.string().nullable(), ceiling_cents:z.number(), actual_cents:z.number().nullable(), reserved_cents:z.number().nullable(), remaining_cents:z.number().nullable() }),
  // Optional: a server still on the previous revision publishes coverage without it, and the Owner read must not fail for that.
  analysis_admission:z.object({
    status:z.enum(['admitted','per_recording_ceiling','monthly_budget','no_active_period','configuration_missing']),
    estimated_cents_per_conversation:z.number().nullable(), per_recording_ceiling_cents:z.number(), model:z.string(), pricing_version:z.string().nullable(),
    limits:z.object({ steps:z.number(), context_tokens:z.number(), output_tokens:z.number(), total_input_tokens:z.number(), total_output_tokens:z.number(), elapsed_ms:z.number() }),
    paused:z.object({ per_recording_ceiling:z.number(), budget:z.number(), configuration:z.number() }),
    unresolved_reservations:z.object({ count:z.number(), estimated_cents:z.number() }),
  }).optional(),
  mapping_hygiene:z.object({ unmapped_inbound_numbers:z.number(), unmapped_directory_users:z.number().nullable(), last_directory_sync_at:z.string().nullable(), directory_status:z.enum(['stored','missing']) }),
  flags:z.record(z.string(), z.boolean()),
  models:z.object({ extraction:z.object({ name:z.string(), enabled:z.boolean() }), transcription:z.object({ name:z.string(), enabled:z.boolean() }) }),
  settings:z.object({ persisted:z.boolean(), revision:z.number(), version:z.string(), source:z.enum(['persisted','accepted_defaults']), timezone:z.string(), first_action_due_staffed_minutes:z.number(), missed_callback_due_staffed_minutes:z.number(), going_cold_staffed_minutes:z.number(), monthly_ceiling_cents:z.number(), per_recording_ceiling_cents:z.number().optional() }),
  backfill:z.object({
    available:z.boolean(),
    owner_triggered:z.literal(true),
    days:z.number().int().nonnegative(),
    planned:z.number().int().nonnegative().nullable(),
    partial:z.number().int().nonnegative().nullable(),
    complete:z.number().int().nonnegative().nullable(),
    failed:z.number().int().nonnegative().nullable(),
    known_complete_through:z.string().nullable(),
    gaps:z.array(z.object({ from:z.string(), to:z.string(), reason:z.string() })),
    note:z.string(),
  }),
  // UI1-DATA (S5c-HEALTH, G6): capture health. Optional: absent before S5c.
  capture_health: captureHealthSchema.optional(),
}) }) });
export const settingsSchema = z.object({ as_of:z.string(), data:z.object({
  persisted:z.boolean(), revision:z.number(), source:z.enum(['persisted','accepted_defaults']),
  policy:z.object({ version:z.string(), timezone:z.string(), staffed_hours:z.array(z.object({ day:z.number().int().min(1).max(7), start_minute:z.number(), end_minute:z.number() })),
    first_action_due_staffed_minutes:z.number(), missed_callback_due_staffed_minutes:z.number(), going_cold_staffed_minutes:z.number(),
    monthly_ceiling_cents:z.number(), per_recording_ceiling_cents:z.number(), cooldown_attempts_24h:z.number(),
    enabled_capabilities:z.array(z.string()), retention:z.object({ audio_days:z.number(), redacted_days:z.number(), audit_days:z.number() }) }),
  flags:z.record(z.string(), z.boolean()),
  models:z.object({ extraction:z.object({ name:z.string(), enabled:z.boolean() }), transcription:z.object({ name:z.string(), enabled:z.boolean() }) }),
  updated_at:z.string().nullable(), updated_by:z.string().nullable(),
}) });
export type OwnerCoverage = z.infer<typeof ownerCoverageSchema>['data']['coverage'];

/* ── UI1-DATA: Closed history (E27) — closed rows older than the 90-day partition, same row shape as `view=closed`. ── */
export const closedHistorySchema = z.object({ as_of: z.string(), coverage, data: z.object({ items: z.array(attentionRowSchema), cursor: z.string().nullable(),
  retention: z.object({ days: z.number().nullable(), basis: z.string().optional() }) }) });
export type ClosedHistoryPage = z.infer<typeof closedHistorySchema>;

/* ── UI1-DATA: Overview (addendum §6, UI-1 §4). Envelope `{ ok, data: { as_of, … } }`. Shares are 0–1 or null; the UI prints counts. ── */
const bandCounts = z.record(z.string(), z.number());
const spendLine = z.object({ spend: z.number(), rate: z.number(), legacy: z.number(), leads: z.number(), unpriced_leads: z.number(), zero_leads: z.number() });
const spendBySource = spendLine.extend({ source: z.string(), unit_cpl: z.number().nullable() });
const overviewOutcomes = z.object({ leads: z.number(), quoted: z.number(), booked_in_granot: z.number(), booked_official: z.number(), bookings: z.number(), booking_rate: z.number().nullable() });
const overviewInteractions = z.object({ calls: z.number(), outbound_attempts: z.number(), answered_inbound: z.number(), human_conversations: z.number(),
  talk_minutes: z.number(), attempt_conversation_rate: z.number().nullable(), recovered_calls: z.number() });
const overviewPeriod = z.object({ key: z.string(), start: z.string(), end: z.string(), from_day: z.string(), to_day: z.string() });
export const overviewRepSchema = z.object({ agent, open_assignments: z.object({ open: z.number(), overdue: z.number(), bands: bandCounts }),
  interactions: overviewInteractions, outcomes: overviewOutcomes, spend: spendLine, cost_per_booking: z.number().nullable(), by_source: z.array(spendBySource) });
export type OverviewRep = z.infer<typeof overviewRepSchema>;
export const overviewDataSchema = z.object({ as_of: z.string(), snapshot_id: z.string().nullable(), status: z.string(),
  scope: z.object({ agent_id: z.string() }).nullable(), filters: z.object({ priority: z.array(z.string()).nullable() }).catchall(z.json()),
  periods: z.object({ activity: overviewPeriod, spend: overviewPeriod }),
  now: z.object({ bands: bandCounts, needs_review: z.number(), unassigned: z.number(), live_calls: z.number(), active: z.number().optional(),
    capture_health: z.object({ status: z.string() }).nullable() }),
  desk: z.object({
    speed_to_lead: z.object({ leads: z.number(), worked: z.number(), median_staffed_minutes: z.number().nullable(), p90_staffed_minutes: z.number().nullable(),
      still_waiting: z.number(), missed_target: z.number(), target_staffed_minutes: z.number() }),
    callbacks_kept: z.object({ due: z.number(), kept: z.number(), kept_contact_unknown: z.number(), kept_unreached: z.number(), not_kept: z.number(),
      pending: z.number(), overdue_now: z.number(), kept_share: z.number().nullable() }),
    missed_calls_returned: z.object({ episodes: z.number(), returned_on_time: z.number(), returned_late: z.number(), still_open: z.number(),
      closed_unreturned: z.number().optional(), on_time_share: z.number().nullable(), median_staffed_minutes_to_return: z.number().nullable() }),
    flow: z.object({ new_outreach: z.number(), moved_to_quoted: z.number(), booked_in_granot: z.number(), booked: z.number(), crm_bad_dead: z.number(),
      owner_closed: z.number(), closed_total: z.number().optional(), net_active_change: z.number(),
      bands: z.object({ moves: z.number(), into_band: bandCounts, out_of_band: bandCounts, excluded_baseline_or_policy: z.number(), capture_repair: z.number() }),
      time_in_band: z.record(z.string(), z.object({ known: z.number(), unknown: z.number(), median_ms: z.number().nullable() })) }) }),
  reps: z.array(overviewRepSchema),
  unmapped: z.object({ extensions: z.array(z.string()), interactions: overviewInteractions }).nullable(),
  unassigned: z.object({ records_now: z.number(), spend: spendLine, outcomes: overviewOutcomes, cost_per_booking: z.number().nullable(), by_source: z.array(spendBySource) }).nullable(),
  spend: z.object({ total: spendLine.extend({ outcomes: overviewOutcomes }), by_rep: z.array(spendLine.extend({ agent_id: z.string().nullable() })), by_source: z.array(spendBySource) }),
  // E23: anonymous team medians on a rep's (or one-rep-scoped) read; each metric null below 3 contributing reps (C11).
  team_medians: z.record(z.string(), z.number().nullable()).nullable().optional() });
export type Overview = z.infer<typeof overviewDataSchema>;
export const overviewSchema = z.object({ data: overviewDataSchema });

/** A refusal body (`{ ok: false, code, error, request_id }`): 400/403/404/500 from any read or command. */
export const errorBodySchema = z.object({ ok: z.literal(false), code: z.string(), error: z.string(), request_id: z.string().optional(),
  issues: z.array(z.object({ code: z.string(), path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]) }).catchall(z.json())).optional() });
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type SettingsRead = z.infer<typeof settingsSchema>['data'];
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
export async function previewNudge(body: Record<string, unknown>, key: string) {
  const response = await fetch('/api/proxy/api/v1/admin/sales-intelligence/nudges/preview?scope=production', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new SalesIntelligenceError(payload.code ?? payload.registry_code ?? 'COMMAND_FAILED', response.status, payload.request_id);
  return nudgePreviewSchema.parse(payload).data;
}
export async function sendNudge(body: Record<string, unknown>, key: string) {
  const response = await fetch('/api/proxy/api/v1/admin/sales-intelligence/nudges?scope=production', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new SalesIntelligenceError(payload.code ?? payload.registry_code ?? 'COMMAND_FAILED', response.status, payload.request_id);
  return nudgeSendSchema.parse(payload).data;
}
export async function listNudges(query: { outreach_record_id?: string; rc_account_id?: string; rc_extension_id?: string; cursor?: string; limit?: number }, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (query.outreach_record_id) params.set("outreach_record_id", query.outreach_record_id);
  params.set("limit", String(query.limit ?? 20));
  if (query.rc_account_id) params.set("rc_account_id", query.rc_account_id);
  if (query.rc_extension_id) params.set("rc_extension_id", query.rc_extension_id);
  if (query.cursor) params.set("cursor", query.cursor);
  return readSalesIntelligence(`nudges?${params}`, nudgeHistorySchema, signal);
}
export function nudgeDeliveryKind(status: NudgeRecord["status"]): "sent" | "failed" | "unknown" | "pending" {
  if (status === "sent" || status === "fallback_sent") return "sent";
  if (status === "failed") return "failed";
  if (status === "unknown_delivery") return "unknown";
  return "pending";
}
export type CommandIntent={path:string;method:'POST'|'PATCH';body:Record<string,unknown>;key:string};
export const commandResultSchema=z.object({ok:z.literal(true),data:z.object({response:z.record(z.string(),z.json()),replayed:z.boolean()})});
export async function sendSalesIntelligence(intent:CommandIntent) {
 const response=await fetch(`/api/proxy/api/v1/admin/sales-intelligence/${intent.path}?scope=production`,{
  method:intent.method,headers:{'Content-Type':'application/json','Idempotency-Key':intent.key},body:JSON.stringify(intent.body)});
 const body=await response.json();
 if(!response.ok||!body.ok)throw new SalesIntelligenceError(body.code??body.registry_code??'COMMAND_FAILED',response.status,body.request_id);
 return commandResultSchema.parse(body).data;
}
