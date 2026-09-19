import { z } from 'zod';

const runSummary = z.object({ id:z.string(), revision:z.number(), status:z.string(), mode:z.string(), conversation_id:z.string().nullable(), created_at:z.string(), completed_at:z.string().nullable() });
export const analysisRunsSchema=z.object({data:z.object({items:z.array(runSummary),next_cursor:z.string().nullable()})});
const assertion=z.object({key:z.string(),kind:z.string(),claim:z.string()}).catchall(z.json());
export const analysisSchema=z.object({data:runSummary.extend({current:z.boolean(),editable:z.boolean(),output_digest:z.string().nullable(),suggestion_output_digest:z.string().nullable(),
 model_version:z.string(),prompt_version:z.string(),processing_reason:z.string().nullable(),original_evidence_available:z.boolean(),contact_number_id:z.string(),
 reanalysis_requests:z.array(z.object({id:z.string(),run_id:z.string(),mode:z.string(),status:z.string(),reason:z.string().nullable(),created_at:z.string()})).default([]),
 outreach:z.object({id:z.string(),revision:z.number(),state:z.string()}).nullable(),
 output:z.object({summary:z.object({overview:z.string()}).catchall(z.json()),next_step_suggestion:z.object({description:z.string(),action_kind:z.string()}).catchall(z.json()).nullable()}).catchall(z.json()).nullable(),
 findings:z.array(z.object({id:z.string(),revision:z.number(),assertion,review_state:z.string(),validation:z.json(),effects:z.array(z.object({id:z.string(),kind:z.string(),status:z.string(),reason:z.string().nullable(),target_id:z.string().nullable(),applied_at:z.string()}))})),
 actions:z.array(z.object({id:z.string(),revision:z.number(),kind:z.string(),description:z.string(),due_at:z.string().nullable(),responsible_agent_id:z.string().nullable(),status:z.string(),origin:z.string()})),
 instructions:z.array(z.object({id:z.string(),instruction_id:z.string(),revision:z.number(),finding_id:z.string().nullable(),field:z.string(),prior:z.json(),current:z.json(),actor:z.string(),happened_at:z.string(),assessment:z.string(),reason:z.string(),finding_ids:z.array(z.string()),stale:z.boolean()})),instructions_complete:z.boolean(),
 history:z.array(z.object({id:z.string(),event:z.string(),actor:z.string(),happened_at:z.string(),prior:z.json(),current:z.json()})),history_next_cursor:z.string().nullable().default(null)})});
export const analysisEvidenceSchema=z.object({data:z.object({items:z.array(z.object({id:z.string(),tool:z.string().nullable(),digest:z.string().nullable(),retrieved_at:z.string().nullable(),unavailable:z.boolean()})),next_cursor:z.string().nullable()})});
export const analysisEvidenceContentSchema=z.object({data:z.object({id:z.string(),unavailable:z.boolean(),reason:z.string().optional(),purged_at:z.string().nullable().optional(),content:z.string().nullable(),next_cursor:z.string().nullable()})});
export type Analysis=z.infer<typeof analysisSchema>['data'];
export type AnalysisFinding=Analysis['findings'][number];
