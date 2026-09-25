import { z } from 'zod';
import { readSalesIntelligence } from './salesIntelligence';
import { assessmentCopy as copy } from '@/components/sales-intelligence/evidence-chain-copy';

/*
 * Consumer mirrors of the server presentation DTOs (vantage-main-server
 * `services/salesIntelligence/assessment/dto.ts`, MA-01 §10). Lenient on purpose:
 * enums stay strings and additive fields are optional, so a server that grows a
 * value still renders. Admin never derives a score, a level or availability; it
 * only chooses words for what the server sent. Normalization of stored versions
 * happens on the server; nothing here branches on a schema version.
 */
const nstr = z.string().nullable().optional().transform(value => value ?? null);
const strs = z.array(z.string()).optional().transform(value => value ?? []);
const loose = z.record(z.string(), z.json());

export const evidenceLocatorSchema = z.object({ source: z.string() }).catchall(z.json());
export type EvidenceLocator = z.infer<typeof evidenceLocatorSchema>;
export const evidenceRefSchema = z.object({ id: z.string(), kind: z.string(), locator: evidenceLocatorSchema,
  speaker: nstr, call_at: nstr, lineage: strs });
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
const refs = z.array(evidenceRefSchema).optional().transform(value => value ?? []);

export const scoreSchema = z.object({ score: z.number().nullable(), level: nstr, label: z.string(), confidence: nstr, rationale: nstr,
  conditions: strs, evidence: refs, stale: z.boolean().optional().default(false), stale_reason: nstr,
  applicability: z.string().optional().default('active'),
  // UI1-DATA: server level word (`· {Level}`) and RD11 `This score should cite evidence and does not.`
  level_label: nstr, evidence_missing: z.boolean().optional().default(false) });
export type Score = z.infer<typeof scoreSchema>;

const place = z.object({ city: nstr, state: nstr, zip: nstr });
export const moveViewSchema = z.object({ pickup: place, delivery: place, move_date: nstr, move_size: nstr, granot_move_size: nstr,
  cubic_feet: z.number().nullable().optional().transform(value => value ?? null),
  provenance: z.object({ source_system: nstr, changed_at: nstr, observation_id: nstr }).nullable().optional().transform(value => value ?? null),
  captured_at: nstr, evidence_status: nstr, ingestion_origin: nstr, label: nstr });
export type MoveView = z.infer<typeof moveViewSchema>;
export const observationSchema = z.object({ field: z.string(), value: loose, status: z.string(), evidence: refs });
export type Observation = z.infer<typeof observationSchema>;
const range = z.object({ min: z.number().nullable(), max: z.number().nullable() });
export const inventoryItemSchema = z.object({ label: z.string(), quantity: range, room: nstr,
  dimensions: z.object({ text: z.string(), unit: nstr }).nullable().optional().transform(value => value ?? null), handling: nstr,
  status: z.string(), evidence: refs });
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export const conflictSchema = z.object({ affects: z.string(), explanation: z.string(), evidence: refs });
export const sourceManifestEntrySchema = z.object({ kind: z.string(), id: z.string(), version: z.string(), conversation_id: nstr, call_at: nstr, lineage: strs });

/* ── UI1-DATA: final §11.3 column 3 (`From the calls`) and §11.4 move table. Every label is a server word. ── */
export const engagementSchema = z.object({ work_status: z.string(), work_status_label: z.string(), rationale: nstr, evidence: refs,
  promised_callbacks: z.array(z.object({ by: z.string(), by_label: z.string(), raw_text: z.string(), date: nstr, date_label: nstr, time_text: nstr,
    status: z.string(), status_label: z.string(), followup_created: z.boolean(), followup_id: nstr, evidence: refs })).optional().default([]),
  next_steps: z.array(z.object({ action: z.string(), action_label: z.string(), description: z.string(), owner: z.string(), owner_label: z.string(),
    date: nstr, date_label: nstr, date_text: nstr, status: z.string(), status_label: z.string(), followup_created: z.boolean(), followup_id: nstr, evidence: refs })).optional().default([]),
  effects: z.object({ applied: z.boolean(), mark_worked: z.boolean().optional(), blocked: z.json().nullable().optional(), blocked_label: nstr,
    followup_ids: strs, followups: z.array(z.object({ kind: z.string(), description: z.string(), origin: z.string(), source: z.string() })).optional().default([]),
    skipped: z.array(z.object({ index: z.number(), source: z.string(), text: z.string(), reason: z.string(), reason_label: z.string() })).optional().default([]) }).nullable().optional().transform(value => value ?? null) });
export type Engagement = z.infer<typeof engagementSchema>;
export const moveTableSchema = z.object({ original_origin_label: nstr, inventory_count: z.number(), source_coverage_text: nstr,
  rows: z.array(z.object({ key: z.string(), label: z.string(), lead_on_file: nstr, original: nstr,
    customer: z.array(z.object({ text: z.string(), marker: nstr, evidence: refs })),
    conflict: z.object({ explanation: z.string(), cells: strs, evidence: refs }).nullable() })),
  score_conflicts: z.array(z.object({ affects: z.string(), affects_label: nstr, explanation: z.string(), evidence: refs })).optional().default([]) });
export type MoveTable = z.infer<typeof moveTableSchema>;

export const assessmentSectionSchema = z.object({
  availability: z.string(), artifact_id: nstr, schema_version: nstr, rubric_version: nstr, model_version: nstr,
  generated_at: nstr, context_as_of: nstr, latest_conversation_at: nstr, input_mode: nstr,
  shadow: z.boolean().optional().default(false), current: z.boolean().optional().default(false),
  transaction_intent: scoreSchema, move_likelihood: scoreSchema,
  views: z.object({ original_ingestion: moveViewSchema.nullable(), canonical_current: moveViewSchema.nullable(), customer_stated: z.array(observationSchema) }),
  inventory: z.object({ items: z.array(inventoryItemSchema), coverage: nstr, limitations: strs, source_coverage: nstr }),
  conflicts: z.array(conflictSchema).optional().default([]),
  coverage: z.object({ conversations_available: z.number(), conversations_selected: z.number(), findings_selected: z.number() }).nullable().optional().transform(value => value ?? null),
  source_manifest: z.array(sourceManifestEntrySchema).optional().default([]),
  // UI1-DATA (S3-READS): additive; absent on older servers.
  engagement: engagementSchema.nullable().optional().transform(value => value ?? null),
  move_table: moveTableSchema.nullable().optional().transform(value => value ?? null),
  newer_calls_count: z.number().nullable().optional().transform(value => value ?? null),
  stale: z.boolean().optional(), stale_reason: nstr, published_at: nstr,
});
export type AssessmentSection = z.infer<typeof assessmentSectionSchema>;
export const assessmentVersionSchema = z.object({ artifact_id: z.string(), status: z.string(), label: z.string(), current: z.boolean().optional().default(false),
  generated_at: nstr, context_as_of: nstr, schema_version: z.string(), model_version: z.string(), input_mode: nstr,
  transaction_intent: z.number().nullable().optional().transform(value => value ?? null), move_likelihood: z.number().nullable().optional().transform(value => value ?? null),
  shadow: z.boolean().optional().default(false) });
export type AssessmentVersion = z.infer<typeof assessmentVersionSchema>;
export const outreachAssessmentSchema = z.object({
  subject: z.object({ outreach_record_id: z.string(), subject_key: z.string(), subject: loose, state: z.string(), contact_number_id: nstr, applicability: z.string() }),
  availability: z.string(), current: assessmentSectionSchema.nullable(), versions: z.array(assessmentVersionSchema),
  // UI1-DATA (§11.9): the Lead-only move table when there is no current assessment; absent without a Lead.
  lead_move_table: moveTableSchema.nullable().optional().transform(value => value ?? null) });
export type OutreachAssessment = z.infer<typeof outreachAssessmentSchema>;

export const summaryFindingsSectionSchema = z.object({
  availability: z.string(), scope: z.string(),
  source: z.object({ kind: z.string(), id: z.string(), version: nstr, generated_at: nstr, model_version: nstr, prompt_version: nstr }),
  summary: z.object({ sections: z.array(z.object({ key: z.string(), label: z.string(), text: z.string() })), narrative: nstr }),
  said_on_call: z.array(z.object({ index: z.number(), call_index: z.number().optional().default(0), kind: z.string(), speaker: z.string(), text: z.string(), segment_ids: z.array(z.number()).optional().default([]) })).optional().default([]),
  findings: z.array(z.object({ id: z.string(), kind: z.string(), claim: z.string(), basis: z.string(), actor: z.string(), action_status: nstr, clarity: z.string(),
    review_state: z.string(), evidence: refs,
    effects: z.array(z.object({ kind: z.string(), status: z.string(), reason: nstr, target_id: nstr })).optional().default([]),
    // UI1-DATA (final §11.5): the server's presentation words for each finding.
    category: nstr, category_label: nstr, source_word: nstr, action_status_word: nstr, value_line: nstr,
    work_result: nstr, work_result_detail: nstr, call_at: nstr, superseded_by: nstr })),
  suggested_next_step: z.object({ action_kind: z.string(), description: z.string(), date_text: nstr, timezone_text: nstr, rationale: z.string(), target_followup_id: nstr,
    // UI1-DATA (§11.3): `Applied {exact} → follow-up due {exact}`; null → the `Apply` button.
    action_label: nstr, applied_at: nstr, followup_due_at: nstr, followup_id: nstr }).nullable().optional().transform(value => value ?? null),
  applied_actions: z.array(z.object({ id: z.string(), kind: z.string(), description: z.string(), status: z.string(), due_at: nstr })).optional().default([]),
  // UI1-DATA (context provenance): `Records disputed on a call`, `Changes since the last analysis`, `Your changes and what the model made of them`.
  story_discrepancies: z.array(z.object({ story_event_id: z.string(), event_kind: z.string(), claim: z.string(), review_item_id: nstr, review_item_state: nstr, evidence: refs })).optional().default([]),
  prior_finding_relations: z.array(z.object({ prior_finding_id: z.string(), prior_kind: z.string(), prior_claim: z.string(), relation: z.string(), relation_word: z.string(),
    group: z.string(), by_finding_id: nstr, by_claim: nstr, note: nstr, review_item_id: nstr, review_item_state: nstr, evidence: refs })).optional().default([]),
  owner_instruction_assessments: z.array(z.object({ instruction_id: z.string(), instruction_revision: z.number(), instruction_text: z.string(),
    assessment: z.string(), assessment_word: z.string(), reason: z.string() })).optional().default([]),
});
export type SummaryFindingsSection = z.infer<typeof summaryFindingsSectionSchema>;
export type PresentedFinding = SummaryFindingsSection['findings'][number];

export const evidenceItemSchema = z.object({ id: z.string(), kind: z.string(), source: evidenceLocatorSchema, availability: z.string(), text: nstr,
  open: z.object({ kind: z.string() }).catchall(z.json()).nullable().optional().transform(value => value ?? null),
  // UI1-DATA (final §11.6): server labels and quote facts; `purged_at` → `Original removed under retention on {t}`.
  source_label: nstr, record_label: nstr, purged_at: nstr, quote: nstr, speaker: nstr, speaker_label: nstr, at: nstr, call_at: nstr, as_of: nstr,
  conversation_id: nstr, segment_ids: z.array(z.number()).optional().default([]) });
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export const evidenceSectionSchema = z.object({ availability: z.string(), items: z.array(evidenceItemSchema) });
export type EvidenceSection = z.infer<typeof evidenceSectionSchema>;

export const fullOutputSchema = z.object({ kind: z.string(), id: z.string(), version: nstr, generated_at: nstr, availability: z.string().optional().default('ready'),
  complete: z.boolean(), model_output: z.json().nullable(), accepted: z.json().nullable().optional().transform(value => value ?? null),
  details: z.object({ schema_version: nstr, prompt_version: nstr, model_version: nstr, digests: z.record(z.string(), z.string()).optional().default({}) }) });
export type FullOutput = z.infer<typeof fullOutputSchema>;
export const fullOutputRefSchema = z.object({ kind: z.string(), id: z.string(), label: z.string(), generated_at: nstr, version: nstr, available: z.boolean() });
export type FullOutputRef = z.infer<typeof fullOutputRefSchema>;
export const runPresentationSchema = z.object({ run_id: z.string(), summary_findings: summaryFindingsSectionSchema, evidence: evidenceSectionSchema,
  full_output: z.array(fullOutputRefSchema) });
export type RunPresentation = z.infer<typeof runPresentationSchema>;

const owner = <T extends z.ZodType>(data: T) => z.object({ as_of: z.string().optional(), data });
export const outreachAssessmentReadSchema = owner(outreachAssessmentSchema);
export const assessmentReadSchema = owner(assessmentSectionSchema);
export const evidenceReadSchema = owner(evidenceSectionSchema);
export const fullOutputReadSchema = owner(fullOutputSchema);
export const runPresentationReadSchema = owner(runPresentationSchema);

const enc = encodeURIComponent;
export const readOutreachAssessment = (outreachId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`outreach/${enc(outreachId)}/assessment`, outreachAssessmentReadSchema, signal);
export const readAssessment = (artifactId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`assessments/${enc(artifactId)}`, assessmentReadSchema, signal);
export const readAssessmentEvidence = (artifactId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`assessments/${enc(artifactId)}/evidence`, evidenceReadSchema, signal);
export const readAssessmentOutput = (artifactId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`assessments/${enc(artifactId)}/output`, fullOutputReadSchema, signal);
export const readRunPresentation = (runId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`analysis-runs/${enc(runId)}/presentation`, runPresentationReadSchema, signal);
export const readRunOutput = (runId: string, outputId: string, signal?: AbortSignal) =>
  readSalesIntelligence(`analysis-runs/${enc(runId)}/output/${enc(outputId)}`, fullOutputReadSchema, signal);

/* ── Labels: words for server values. Never a percent sign, never a derived score. ── */

const known = <T extends Record<string, string>>(map: T, value: string | null | undefined, fallback: string) =>
  value != null && Object.prototype.hasOwnProperty.call(map, value) ? map[value as keyof T] : fallback;
const humanize = (value: string) => value.replaceAll('_', ' ');
const SCORE_WORDS = new Set<string>(Object.values(copy.scoreWord));

/** `75 / 100` for a number; otherwise the server's word (Unknown, Pending, Not applicable, Not assessed, Unavailable). A real 0 stays `0 / 100`. */
export function scoreText(score: { score: number | null; label?: string | null; applicability?: string | null } | null | undefined, availability?: string | null): string {
  // Closed or CRM-terminal work has no actionable score, even when a historical number is retained (§11).
  if (score?.applicability && score.applicability !== 'active') return copy.scoreWord.notApplicable;
  if (score && typeof score.score === 'number' && Number.isFinite(score.score)) return `${Math.round(score.score)} / 100`;
  if (availability && availability in copy.availabilityScore) return copy.availabilityScore[availability as keyof typeof copy.availabilityScore];
  const word = score?.label?.trim();
  if (word && SCORE_WORDS.has(word)) return word;
  return copy.scoreWord.unknown;
}
/** The retained number behind a Not applicable score, for explicit closed-state review only. */
export const historicalScoreText = (score: Pick<Score, 'score' | 'applicability'>) =>
  score.applicability !== 'active' && typeof score.score === 'number' ? copy.historical(`${Math.round(score.score)} / 100`) : null;
/** Version rows carry only numbers + status; the same wording as the section. */
export const versionScoreText = (value: number | null, status: string) => scoreText({ score: value }, typeof value === 'number' ? null : status === 'ready' || status === 'insufficient_evidence' ? null : status);
export const levelText = (level: string | null | undefined) => level ? known(copy.level, level, humanize(level)) : copy.level.unknown;
export const confidenceText = (confidence: string | null | undefined) => known(copy.confidence, confidence, copy.confidenceUnstated);
export const availabilityText = (availability: string | null | undefined) => availability ? known(copy.availability, availability, humanize(availability)) : copy.availability.unavailable;
export const applicabilityText = (applicability: string | null | undefined) => known(copy.applicability, applicability, copy.applicability.active);
export const inputModeText = (mode: string | null | undefined) => mode ? known(copy.inputMode, mode, humanize(mode)) : copy.notRecorded;
export function freshnessText(score: Pick<Score, 'stale' | 'stale_reason'>): string {
  if (!score.stale) return copy.freshness.current;
  return score.stale_reason ? copy.freshness.staleBecause(humanize(score.stale_reason)) : copy.freshness.stale;
}
/** The original-ingestion view is labelled from the server's `label`, never inferred. */
export const originalViewLabel = (view: Pick<MoveView, 'label'> | null | undefined) => known(copy.viewLabel, view?.label ?? 'unknown', copy.viewLabel.unknown);
export const coverageText = (value: string | null | undefined) => value ? known(copy.inventoryCoverage, value, humanize(value)) : copy.notRecorded;
export const sourceCoverageText = (value: string | null | undefined) => value ? known(copy.sourceCoverage, value, humanize(value)) : copy.notRecorded;
export const itemStatusText = (value: string) => known(copy.itemStatus, value, humanize(value));
export const observationStatusText = (value: string) => known(copy.observationStatus, value, humanize(value));
export const evidenceKindText = (kind: string) => known(copy.evidenceKind, kind, humanize(kind));
export const evidenceAvailabilityText = (value: string) => known(copy.evidenceAvailability, value, humanize(value));
export const outputKindText = (kind: string) => known(copy.outputKind, kind, humanize(kind));
export const scopeText = (scope: string) => known(copy.scope, scope, humanize(scope));

/* ── Move details ── */

const rec = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** Unknown quantity is null, never one. */
export function quantityText(quantity: { min: number | null; max: number | null } | null | undefined): string {
  const min = num(quantity?.min), max = num(quantity?.max);
  if (min === null && max === null) return copy.scoreWord.unknown;
  if (min !== null && max !== null) return min === max ? String(min) : `${min}–${max}`;
  return min !== null ? copy.atLeast(min) : copy.upTo(max!);
}
export function placeText(place: { city: string | null; state: string | null; zip: string | null } | null | undefined): string {
  if (!place) return copy.scoreWord.unknown;
  const region = [place.state, place.zip].filter(Boolean).join(' ');
  return [place.city, region].filter(Boolean).join(', ') || copy.scoreWord.unknown;
}
function amountText(amount: unknown, currency: string | null) {
  const range = rec(amount), min = num(range.min), max = num(range.max);
  if (min === null && max === null) return null;
  const money = (value: number) => (currency ? `${currency} ${value}` : String(value));
  return min !== null && max !== null && min !== max ? `${money(min)}–${money(max)}` : money((min ?? max)!);
}
/** One readable line per customer statement, using only what the server sent. */
export function observationText(observation: Pick<Observation, 'field' | 'value'>): string {
  const v = rec(observation.value);
  switch (observation.field) {
    case 'pickup_location': case 'delivery_location': {
      const text = [str(v.line), str(v.city), [str(v.state), str(v.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ') || copy.scoreWord.unknown;
      const precision = str(v.precision);
      return precision && precision !== 'address' ? `${text} (${copy.precision(humanize(precision))})` : text;
    }
    case 'move_date': {
      const raw = str(v.raw_text), date = str(v.date), end = str(v.end_date), applies = str(v.applies_to), flex = str(v.flexibility), precision = str(v.precision);
      const normalized = date ? (end && end !== date ? `${date} to ${end}` : date) : copy.unresolvedDate;
      const parts = [`${normalized}${raw ? ` — “${raw}”` : ''}`];
      if (applies && applies !== 'unspecified') parts.push(humanize(applies));
      if (flex && flex !== 'unknown') parts.push(humanize(flex));
      if (precision) parts.push(copy.precision(humanize(precision)));
      return parts.join(' · ');
    }
    case 'move_size': {
      const text = str(v.text), unit = str(v.unit), basis = str(v.basis), amount = quantityText(rec(v.value) as { min: number | null; max: number | null });
      return [text ?? `${amount}${unit ? ` ${humanize(unit)}` : ''}`, basis && basis !== 'unknown' ? humanize(basis) : null].filter(Boolean).join(' · ');
    }
    case 'service': {
      const service = str(v.service), status = str(v.status), detail = str(v.detail), duration = str(v.duration_text);
      return [service ? humanize(service) : copy.scoreWord.unknown, status ? humanize(status) : null, detail, duration].filter(Boolean).join(' · ');
    }
    case 'access': {
      const end = str(v.end), constraint = str(v.constraint), detail = str(v.detail);
      return [end ? humanize(end) : null, constraint ? humanize(constraint) : null, detail].filter(Boolean).join(' · ');
    }
    case 'money': {
      const basis = str(v.basis), text = str(v.text), amount = amountText(v.amount, str(v.currency));
      return [basis ? humanize(basis) : null, amount, text ? `“${text}”` : null].filter(Boolean).join(' · ');
    }
    default:
      return JSON.stringify(observation.value);
  }
}
const FIELD_ORDER = ['pickup_location', 'delivery_location', 'move_date', 'move_size', 'service', 'access', 'money'];
export type ObservationGroup = { field: string; label: string; items: Observation[] };
/** Customer statements grouped by field in a stable reading order; unknown fields keep their own group at the end. */
export function groupObservations(observations: readonly Observation[]): ObservationGroup[] {
  const groups = new Map<string, Observation[]>();
  for (const observation of observations) groups.set(observation.field, [...(groups.get(observation.field) ?? []), observation]);
  const rank = (field: string) => { const index = FIELD_ORDER.indexOf(field); return index < 0 ? FIELD_ORDER.length : index; };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([field, items]) => ({ field, label: known(copy.observationField, field, humanize(field)), items }));
}
export type ViewRow = { label: string; value: string };
/** Rows for the Original / Current Lead views. Missing values say Unknown; nothing is copied between views. */
export function moveViewRows(view: MoveView | null): ViewRow[] {
  if (!view) return [];
  const unknown = copy.scoreWord.unknown;
  const rows: ViewRow[] = [
    { label: copy.rows.pickup, value: placeText(view.pickup) },
    { label: copy.rows.delivery, value: placeText(view.delivery) },
    { label: copy.rows.moveDate, value: view.move_date ?? unknown },
    { label: copy.rows.moveSize, value: view.move_size ?? unknown },
  ];
  if (view.granot_move_size) rows.push({ label: copy.rows.granotMoveSize, value: view.granot_move_size });
  rows.push({ label: copy.rows.cubicFeet, value: view.cubic_feet === null ? unknown : String(view.cubic_feet) });
  if (view.ingestion_origin) rows.push({ label: copy.rows.origin, value: humanize(view.ingestion_origin) });
  if (view.evidence_status) rows.push({ label: copy.rows.evidenceStatus, value: humanize(view.evidence_status) });
  if (view.provenance?.source_system) rows.push({ label: copy.rows.sourceSystem, value: humanize(view.provenance.source_system) });
  return rows;
}

/* ── Evidence ── */

/** Where a citation points, in words. Identifiers stay visible so the Owner can match them. */
export function locatorText(locator: EvidenceLocator): string {
  const l = locator as Record<string, unknown>;
  const s = (key: string) => str(l[key]);
  switch (locator.source) {
    case 'summary_artifact': return copy.locator.summaryArtifact(s('section') ?? '', s('conversation_id'));
    case 'legacy_run': return copy.locator.legacyRun(s('run_id') ?? '', s('section') ?? '');
    case 'conversation_summary': return copy.locator.conversationSummary(s('conversation_id') ?? '', s('section') ?? '');
    case 'finding': return copy.locator.finding(s('finding_id') ?? '', num(l.revision));
    case 'lead': return copy.locator.lead(s('model') ?? '', s('id') ?? '', s('view') === 'ingested', s('field_path') ?? '');
    case 'official': return copy.locator.official(s('model') ?? '', s('id') ?? '', s('field_path') ?? '');
    case 'owner_correction': return copy.locator.ownerCorrection(num(l.revision));
    case 'analysis_transcript': return copy.locator.transcript(Array.isArray(l.segment_ids) ? l.segment_ids.length : 0, s('transcript_version'));
    case 'analysis_record': return copy.locator.record(s('record_type') ?? '', s('record_id') ?? '', Array.isArray(l.field_paths) ? l.field_paths.filter((p): p is string => typeof p === 'string') : []);
    default: return humanize(locator.source);
  }
}
const SUMMARY_SOURCES = new Set(['summary_artifact', 'legacy_run', 'conversation_summary']);
/** Summary citations stay summary text; only a transcript quote kept by the analysis is called a quote. */
export function evidenceTextLabel(item: Pick<EvidenceItem, 'kind' | 'source'>): string {
  if (SUMMARY_SOURCES.has(item.source.source)) return copy.textLabel.summary;
  if (item.kind === 'transcript_quote' || item.source.source === 'analysis_transcript') return copy.textLabel.quote;
  if (item.source.source === 'finding') return copy.textLabel.finding;
  return copy.textLabel.other;
}
/** A focused list keeps the server's order; unknown ids are reported so a missing citation is visible. */
export function focusEvidence(items: readonly EvidenceItem[], ids: readonly string[] | null) {
  if (!ids) return { items: [...items], missing: [] as string[] };
  const wanted = new Set(ids);
  const found = items.filter(item => wanted.has(item.id));
  return { items: found, missing: ids.filter(id => !found.some(item => item.id === id)) };
}

/* ── Versions and full output ── */

export type VersionOption = { id: string; label: string; current: boolean; shadow: boolean };
export function versionOption(version: AssessmentVersion, formatTime: (value: string | null) => string): VersionOption {
  const scores = `${copy.score.transaction_intent} ${versionScoreText(version.transaction_intent, version.status)} · ${copy.score.move_likelihood} ${versionScoreText(version.move_likelihood, version.status)}`;
  const parts = [formatTime(version.generated_at), version.label, copy.schemaVersion(version.schema_version), scores];
  if (version.current) parts.push(copy.currentVersion);
  if (version.shadow) parts.push(copy.shadow);
  return { id: version.artifact_id, label: parts.join(' · '), current: version.current, shadow: version.shadow };
}

export type OutputChoice = { key: string; kind: string; label: string; generated_at: string | null; version: string | null; available: boolean;
  source: { type: 'assessment'; artifact_id: string } | { type: 'run'; run_id: string; output_id: string } };
/** Every retained output the Owner can open: assessment versions (newest first, as the server lists them), then the selected run's outputs. */
export function outputChoices(input: { versions?: readonly AssessmentVersion[] | null; runId?: string | null; runRefs?: readonly FullOutputRef[] | null }): OutputChoice[] {
  const assessment = (input.versions ?? []).map((version): OutputChoice => ({ key: `assessment:${version.artifact_id}`, kind: 'move_assessment',
    label: `${outputKindText('move_assessment')}${version.current ? ` · ${copy.currentVersion}` : ` · ${copy.earlierVersion}`} · ${version.label}`,
    generated_at: version.generated_at, version: version.schema_version, available: !['purged', 'unsupported', 'unavailable', 'pending'].includes(version.status),
    source: { type: 'assessment', artifact_id: version.artifact_id } }));
  const run = input.runId ? (input.runRefs ?? []).map((ref): OutputChoice => ({ key: `run:${input.runId}:${ref.id}`, kind: ref.kind, label: ref.label,
    generated_at: ref.generated_at, version: ref.version, available: ref.available, source: { type: 'run', run_id: input.runId!, output_id: ref.id } })) : [];
  return [...assessment, ...run];
}
export type OutputRepresentation = { key: 'model_output' | 'accepted'; label: string; value: unknown };
/** Exact retained model object and the server-expanded accepted envelope, never merged or relabelled. */
export function outputRepresentations(output: Pick<FullOutput, 'model_output' | 'accepted'>): { items: OutputRepresentation[]; note: string | null } {
  const items: OutputRepresentation[] = [];
  if (output.model_output !== null) items.push({ key: 'model_output', label: copy.output.modelOutput, value: output.model_output });
  if (output.accepted !== null) items.push({ key: 'accepted', label: copy.output.accepted, value: output.accepted });
  const note = output.model_output === null && output.accepted !== null ? copy.output.acceptedOnly : null;
  return { items, note };
}
/** The exact text `Copy output` puts on the clipboard: the whole selected representation, pretty-printed, nothing omitted. */
export const outputJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);
