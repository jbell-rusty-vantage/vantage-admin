import { z } from "zod";

/**
 * Sales Outreach Desk (sod-v1) DTOs, mirrored from the server's Zod contracts (vantage-main-server
 * `src/validation/v1/salesOutreachReads.ts`, `salesOutreachCommands.ts`, `salesOutreachEnrollment.ts`,
 * `salesOutreach.ts` and `src/config/domain/salesOutreach.ts`). The server is the authority: field names,
 * enums and nullability follow it exactly, but objects are NOT strict, so an additive server field never
 * breaks a read. `tests/outreach-desk/fixtures/server/` holds the server's own example payloads and
 * `salesOutreach.test.ts` parses every one of them (the drift guard).
 *
 * Honesty rules the admin renders (server handoff): a `null` count is pending, never 0; the cadence
 * unknown reasons (`cadence_disabled`, `cadence_shadow`, `policy_unavailable`) mean unavailable; overdue
 * and ordering are never computed in the browser.
 */

// ---------------------------------------------------------------------------------------------
// Vocabularies (src/config/domain/salesOutreach.ts)
// ---------------------------------------------------------------------------------------------

export const SALES_OUTREACH_CONTRACT_VERSION = "sod-v1" as const;
export const SALES_OUTREACH_TIMEZONE = "America/New_York" as const;
/** Server path (signed by the BFF) and the browser proxy path in front of it. */
export const SALES_OUTREACH_SERVER_PATH = "api/v1/admin/sales-outreach" as const;
export const SALES_OUTREACH_BFF_PATH = `/api/proxy/${SALES_OUTREACH_SERVER_PATH}` as const;

export const SALES_OUTREACH_LEAD_MODELS = ["FormLead", "CallLead"] as const;
export const SALES_OUTREACH_SUBJECT_STATUSES = ["active", "closed", "review"] as const;
export const SALES_OUTREACH_ENROLLMENT_KINDS = ["pilot", "intake", "expansion"] as const;
export const SALES_OUTREACH_RECEIVED_QUALITIES = ["instant", "wall_clock", "missing", "unreliable"] as const;
export const SALES_OUTREACH_PRIORITY_BASES = ["accepted_observation", "intake_default", "none"] as const;
export const SALES_OUTREACH_WORKFLOWS = ["new", "quoted", "discretion", "none", "closed"] as const;
export type SalesOutreachWorkflow = (typeof SALES_OUTREACH_WORKFLOWS)[number];
export const SALES_OUTREACH_PERIOD_START_KINDS = ["intake", "transition", "activation"] as const;
export const SALES_OUTREACH_FOLLOWUP_KINDS = ["quoted_date", "callback"] as const;
export const SALES_OUTREACH_FOLLOWUP_STATUSES = ["active", "fulfilled", "missed", "cancelled", "replaced", "blocked_reschedule"] as const;
export const SALES_OUTREACH_CHANNEL_STATUSES = ["not_required", "scheduled", "due", "overdue", "blocked", "pending", "completed"] as const;
export type SalesOutreachChannelStatus = (typeof SALES_OUTREACH_CHANNEL_STATUSES)[number];
export const SALES_OUTREACH_GOAL_STATES = ["goal", "no_goal_today", "not_on_roster"] as const;
export type SalesOutreachGoalState = (typeof SALES_OUTREACH_GOAL_STATES)[number];
export const SALES_OUTREACH_GOAL_COUNT_SCOPES = ["all_outbound", "eligible_new_quoted"] as const;
export type SalesOutreachGoalCountScope = (typeof SALES_OUTREACH_GOAL_COUNT_SCOPES)[number];
export const SALES_OUTREACH_ROLES = ["owner", "manager", "rep"] as const;
export type SalesOutreachRole = (typeof SALES_OUTREACH_ROLES)[number];
export const SALES_OUTREACH_ERROR_CODES = [
  "FORBIDDEN",
  "REP_NOT_LINKED",
  "INVALID_INPUT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "NOT_FOUND",
  "REVISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "CURSOR_EXPIRED",
  "CONFIGURATION_UNAVAILABLE",
  "PROJECTION_PENDING",
  "SERVICE_UNAVAILABLE",
  "INTERNAL",
] as const;
export type SalesOutreachErrorCode = (typeof SALES_OUTREACH_ERROR_CODES)[number];
export const SALES_OUTREACH_CADENCE_EXPOSURES = ["shadow", "enforcement"] as const;
export type SalesOutreachCadenceExposure = (typeof SALES_OUTREACH_CADENCE_EXPOSURES)[number];
export const SALES_OUTREACH_QUEUE_STATES = ["needs_contact", "all_active", "blocked", "pending"] as const;
export type SalesOutreachQueueState = (typeof SALES_OUTREACH_QUEUE_STATES)[number];
export const SALES_OUTREACH_QUEUE_SORTS = ["urgency", "lead_received", "last_interaction"] as const;
export type SalesOutreachQueueSort = (typeof SALES_OUTREACH_QUEUE_SORTS)[number];
/** Every `GET /queue` query key the server accepts (its query schema is strict: anything else is 400). */
export const SALES_OUTREACH_QUEUE_FILTERS = [
  "search",
  "priority",
  "workflow",
  "move_date_from",
  "move_date_to",
  "move_date_unknown",
  "agent_id",
  "unassigned",
  "state",
  "sort",
  "direction",
  "cursor",
  "limit",
] as const;
export type SalesOutreachQueueFilterKey = (typeof SALES_OUTREACH_QUEUE_FILTERS)[number];
export const SALES_OUTREACH_LIVE_TOPICS = ["outreach_desk", "outreach_goal", "outreach_configuration"] as const;
export type SalesOutreachLiveTopic = (typeof SALES_OUTREACH_LIVE_TOPICS)[number];
export const SALES_OUTREACH_LIVE_VERSION = 1 as const;

export const SALES_OUTREACH_COVERAGE_STATES = ["complete", "partial", "unknown"] as const;
export const SALES_OUTREACH_CAPTURE_FRESHNESS_STATES = ["fresh", "delayed", "not_connected", "unknown"] as const;
export const SALES_OUTREACH_GRANOT_FRESHNESS_STATES = ["observed", "unknown"] as const;
export const SALES_OUTREACH_CONFIGURATION_STATES = ["uninitialized", "active", "unavailable"] as const;
export const SALES_OUTREACH_CADENCE_UNKNOWN_REASONS = ["cadence_disabled", "cadence_shadow", "policy_unavailable"] as const;
export type SalesOutreachCadenceUnknownReason = (typeof SALES_OUTREACH_CADENCE_UNKNOWN_REASONS)[number];
export const SALES_OUTREACH_MOVE_DATE_REVIEWS = ["passed", "unknown"] as const;
export const SALES_OUTREACH_VIEWS = ["team", "my", "activity", "settings", "numbers", "accounts"] as const;
export type SalesOutreachView = (typeof SALES_OUTREACH_VIEWS)[number];
export const SALES_OUTREACH_DESK_UNAVAILABLE_REASONS = ["configuration_uninitialized", "configuration_unavailable", "desk_disabled"] as const;
export const SALES_OUTREACH_DEPLOYED_READS = ["capabilities", "rep_days", "team", "queue", "outreach_detail", "live"] as const;
export const SALES_OUTREACH_GOAL_BASES = ["work_schedule", "default_goal", "override", "not_scheduled", "not_on_roster"] as const;
export const SALES_OUTREACH_ACTUAL_BASES = ["projection", "no_activity_recorded", "pending"] as const;
export const SALES_OUTREACH_QUEUE_WORKFLOWS = ["new", "quoted", "discretion", "none"] as const;
export const SALES_OUTREACH_MOVE_DATE_UNKNOWN_MODES = ["include", "exclude", "only"] as const;
export const SALES_OUTREACH_QUEUE_DEFAULT_LIMIT = 25;
export const SALES_OUTREACH_QUEUE_MAX_LIMIT = 100;
export const SALES_OUTREACH_PROJECTION_STATES = ["current", "stale_policy", "pending", "cadence_disabled", "policy_unavailable"] as const;
export const SALES_OUTREACH_RESTRICTION_STATES = ["active", "resolved", "expired", "all"] as const;
export const SALES_OUTREACH_ENROLLMENT_PARTITIONS = ["in_scope", "older", "already_enrolled", "closed", "excluded", "review", "not_new_or_quoted"] as const;
export type SalesOutreachEnrollmentPartition = (typeof SALES_OUTREACH_ENROLLMENT_PARTITIONS)[number];

/** Labels the admin shows for each count scope (FAST-TRACK "M1 goal scope"); server `SALES_OUTREACH_COUNT_SCOPE_LABELS`. */
export const SALES_OUTREACH_COUNT_SCOPE_LABELS = {
  all_outbound: "Outbound calls",
  eligible_new_quoted: "Outbound calls (New/Quoted leads)",
} as const satisfies Record<SalesOutreachGoalCountScope, string>;
export const SALES_OUTREACH_OTHER_OUTBOUND_LABEL = "Other outbound" as const;
export const SALES_OUTREACH_GOAL_STATE_LABELS = {
  goal: null,
  no_goal_today: "No goal today",
  not_on_roster: "Not on roster",
} as const satisfies Record<SalesOutreachGoalState, string | null>;

// ---------------------------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------------------------

export const salesOutreachBusinessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "invalid calendar date");
export const salesOutreachObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/);
export const salesOutreachAgentIdSchema = salesOutreachObjectIdSchema;
export const salesOutreachSubjectIdSchema = salesOutreachObjectIdSchema;
/** Read instants: the server writes `Z`; an explicit offset is accepted too. */
const instant = z.iso.datetime({ offset: true });
const nullableInstant = instant.nullable();
const count = z.number().int().min(0);

export const salesOutreachCoverageSchema = z.object({
  state: z.enum(SALES_OUTREACH_COVERAGE_STATES),
  known_complete_through: nullableInstant,
  required_through: instant,
  gaps: z.array(z.object({ from: nullableInstant, to: instant })).max(50),
});

export const salesOutreachCaptureFreshnessSchema = z.object({
  state: z.enum(SALES_OUTREACH_CAPTURE_FRESHNESS_STATES),
  last_updated_at: nullableInstant,
  known_complete_through: nullableInstant,
  age_seconds: count.nullable(),
  reason: z.string().nullable(),
});

export const salesOutreachFreshnessSchema = z.object({
  calls: salesOutreachCaptureFreshnessSchema,
  sms: salesOutreachCaptureFreshnessSchema,
  granot: z.object({
    state: z.enum(SALES_OUTREACH_GRANOT_FRESHNESS_STATES),
    last_observed_at: nullableInstant,
    age_seconds: count.nullable(),
  }),
});
export type SalesOutreachFreshness = z.infer<typeof salesOutreachFreshnessSchema>;
export type SalesOutreachCaptureFreshness = z.infer<typeof salesOutreachCaptureFreshnessSchema>;

const scopeSchema = z.object({
  role: z.enum(SALES_OUTREACH_ROLES),
  agent_id: salesOutreachAgentIdSchema.nullable(),
});

const baseReadSchema = z.object({
  contract_version: z.literal(SALES_OUTREACH_CONTRACT_VERSION),
  as_of: instant,
  timezone: z.literal(SALES_OUTREACH_TIMEZONE),
  scope: scopeSchema,
  configuration_state: z.enum(SALES_OUTREACH_CONFIGURATION_STATES),
  configuration_version: z.string().nullable(),
  configuration_revision: count.nullable(),
});

const commonReadSchema = baseReadSchema.extend({
  projection_revision: count.nullable(),
  freshness: salesOutreachFreshnessSchema,
});

/** A cadence metric: `value` null with an `unknown_reason` means unavailable, never 0. */
export const salesOutreachCadenceMetricSchema = z.object({
  value: count.nullable(),
  unknown_reason: z.enum(SALES_OUTREACH_CADENCE_UNKNOWN_REASONS).nullable(),
});
export type SalesOutreachCadenceMetric = z.infer<typeof salesOutreachCadenceMetricSchema>;

/** One channel's requirement; `status` is already derived at `as_of` by the server. */
export const salesOutreachChannelSchema = z.object({
  required: count.nullable(),
  verified_completed: count.nullable(),
  remaining: count.nullable(),
  due_at: nullableInstant,
  oldest_actionable_due_at: nullableInstant,
  status: z.enum(SALES_OUTREACH_CHANNEL_STATUSES),
  completion_kind: z.string().nullable(),
  coverage: z.object({
    state: z.enum(SALES_OUTREACH_COVERAGE_STATES),
    known_complete_through: nullableInstant,
    gaps: z.array(z.unknown()).max(50),
  }),
  blocked_reason: z.string().nullable(),
});
export type SalesOutreachChannelDto = z.infer<typeof salesOutreachChannelSchema>;

export const salesOutreachStatusFlagsSchema = z.object({
  needs_contact: z.boolean(),
  overdue: z.boolean(),
  blocked: z.boolean(),
  pending: z.boolean(),
  move_date_passed: z.boolean(),
  move_date_unknown: z.boolean(),
  job_pending: z.boolean(),
  advisory_cooldown: z.boolean(),
});
export type SalesOutreachStatusFlags = z.infer<typeof salesOutreachStatusFlagsSchema>;

export const salesOutreachQueueRowSchema = z.object({
  subject_id: salesOutreachSubjectIdSchema,
  job_no: z.string().nullable(),
  /** "Job number pending": Copy job # is disabled, the row is never hidden and no number is fabricated. */
  job_pending: z.boolean(),
  phone: z.string().nullable(),
  name: z.string().nullable(),
  move_date: salesOutreachBusinessDateSchema.nullable(),
  move_date_review: z.enum(SALES_OUTREACH_MOVE_DATE_REVIEWS).nullable(),
  priority_raw: z.string().nullable(),
  workflow: z.enum(SALES_OUTREACH_WORKFLOWS).nullable(),
  subject_status: z.enum(["active", "review"]),
  assigned_agent_id: salesOutreachAgentIdSchema.nullable(),
  assigned_agent_name: z.string().nullable(),
  received_at: nullableInstant,
  last_interaction_at: nullableInstant,
  oldest_actionable_due_at: nullableInstant,
  next_action_due_at: nullableInstant,
  call: salesOutreachChannelSchema,
  sms: salesOutreachChannelSchema,
  status_flags: salesOutreachStatusFlagsSchema,
  exposure: z.enum(SALES_OUTREACH_CADENCE_EXPOSURES),
  computed_as_of: instant,
  publication_revision: count,
});
export type SalesOutreachQueueRowDto = z.infer<typeof salesOutreachQueueRowSchema>;

// ---------------------------------------------------------------------------------------------
// GET /capabilities
// ---------------------------------------------------------------------------------------------

export const salesOutreachCapabilitiesSchema = baseReadSchema.extend({
  controls: z.object({
    desk_enabled: z.boolean(),
    goal_metrics_enabled: z.boolean(),
    rep_sms_capture_enabled: z.boolean(),
    cadence_shadow_enabled: z.boolean(),
    cadence_enforcement_enabled: z.boolean(),
    intake_admission_enabled: z.boolean(),
  }),
  desk_available: z.boolean(),
  unavailable_reason: z.enum(SALES_OUTREACH_DESK_UNAVAILABLE_REASONS).nullable(),
  permitted_views: z.array(z.enum(SALES_OUTREACH_VIEWS)),
  permitted_filters: z.object({
    rep_days: z.array(z.enum(["business_day", "agent_id"])),
    team: z.array(z.enum(["business_day"])),
    queue: z.array(z.enum(SALES_OUTREACH_QUEUE_FILTERS)),
  }),
  live_topics: z.array(z.enum(SALES_OUTREACH_LIVE_TOPICS)),
  permitted_commands: z.array(z.string()),
  role_capabilities: z.array(z.string()),
  deployed_reads: z.array(z.enum(SALES_OUTREACH_DEPLOYED_READS)),
});
export type SalesOutreachCapabilitiesDto = z.infer<typeof salesOutreachCapabilitiesSchema>;

// ---------------------------------------------------------------------------------------------
// GET /rep-days
// ---------------------------------------------------------------------------------------------

export const salesOutreachGoalProvenanceSchema = z.object({
  source: z.enum(["configuration", "projection_snapshot"]),
  basis: z.enum(SALES_OUTREACH_GOAL_BASES),
  configuration_version: z.string().nullable(),
  roster_version: z.string().nullable(),
  scheduled_working_day: z.boolean().nullable(),
  override: z
    .object({
      business_date: salesOutreachBusinessDateSchema,
      goal: count,
      reason: z.enum(["absence", "partial_day"]),
    })
    .nullable(),
});

export const salesOutreachRepDaySchema = z.object({
  agent_id: salesOutreachAgentIdSchema,
  agent_name: z.string().nullable(),
  reviewed_link: z.boolean(),
  goal_state: z.enum(SALES_OUTREACH_GOAL_STATES),
  goal_label: z.string().nullable(),
  goal: count.nullable(),
  goal_provenance: salesOutreachGoalProvenanceSchema,
  count_scope: z.enum(SALES_OUTREACH_GOAL_COUNT_SCOPES),
  count_scope_label: z.string(),
  /** Confirmed (Call Log) outbound credits; null while pending, never a guessed 0. */
  actual_confirmed: count.nullable(),
  /** Webhook-seen calls not yet in the Call Log: shown separately, never counted toward progress. */
  actual_awaiting_confirmation: count.nullable(),
  actual_basis: z.enum(SALES_OUTREACH_ACTUAL_BASES),
  remaining: count.nullable(),
  /** Capped at 1 by the server; null without a positive goal or a known actual. */
  progress: z.number().min(0).max(1).nullable(),
  goal_reached: z.boolean().nullable(),
  other_outbound: z.object({ count: count.nullable(), label: z.literal(SALES_OUTREACH_OTHER_OUTBOUND_LABEL) }),
  coverage: salesOutreachCoverageSchema,
  unknown_reason: z.string().nullable(),
  projection_revision: count.nullable(),
  computed_as_of: nullableInstant,
});
export type SalesOutreachRepDayDto = z.infer<typeof salesOutreachRepDaySchema>;

const countScopeOrMixed = z.enum([...SALES_OUTREACH_GOAL_COUNT_SCOPES, "mixed"]);

export const salesOutreachRepDaysSchema = commonReadSchema.extend({
  business_day: salesOutreachBusinessDateSchema,
  is_today: z.boolean(),
  goal_metrics_enabled: z.boolean(),
  count_scope: countScopeOrMixed.nullable(),
  reps: z.array(salesOutreachRepDaySchema).nullable(),
  unknown_reason: z.enum(["goal_metrics_disabled"]).nullable(),
});
export type SalesOutreachRepDaysDto = z.infer<typeof salesOutreachRepDaysSchema>;

export type SalesOutreachRepDaysQuery = { business_day?: string; agent_id?: string };

// ---------------------------------------------------------------------------------------------
// GET /team
// ---------------------------------------------------------------------------------------------

export const salesOutreachTeamGoalsSchema = z.object({
  count_scope: countScopeOrMixed.nullable(),
  count_scope_label: z.string().nullable(),
  outbound_calls: z.object({
    actual: count.nullable(),
    goal: count,
    progress: z.number().min(0).max(1).nullable(),
    incomplete: z.boolean(),
    pending_agent_ids: z.array(salesOutreachAgentIdSchema),
    unknown_reason: z.string().nullable(),
  }),
  reps_at_goal: z.object({ count, of: count, pending: count }),
  other_outbound_total: count.nullable(),
  roster_size: count,
});

export const salesOutreachDailyCallGoalRowSchema = salesOutreachRepDaySchema.extend({
  overdue_leads: salesOutreachCadenceMetricSchema,
});
export type SalesOutreachDailyCallGoalRow = z.infer<typeof salesOutreachDailyCallGoalRowSchema>;

export const salesOutreachTeamSchema = commonReadSchema.extend({
  business_day: salesOutreachBusinessDateSchema,
  is_today: z.boolean(),
  goal_metrics_enabled: z.boolean(),
  goals: salesOutreachTeamGoalsSchema.nullable(),
  goals_unknown_reason: z.enum(["goal_metrics_disabled"]).nullable(),
  daily_call_goals: z.array(salesOutreachDailyCallGoalRowSchema).nullable(),
  distinct_overdue_leads: salesOutreachCadenceMetricSchema,
  quoted_overdue_leads: salesOutreachCadenceMetricSchema,
  unassigned: z.object({ count: count.nullable(), overdue: salesOutreachCadenceMetricSchema }),
  leads_needing_attention: z.object({
    rows: z.array(salesOutreachQueueRowSchema).nullable(),
    limit: z.number().int().min(1).max(100),
    unknown_reason: z.enum(SALES_OUTREACH_CADENCE_UNKNOWN_REASONS).nullable(),
  }),
  cadence_exposure: z.enum(SALES_OUTREACH_CADENCE_EXPOSURES).nullable(),
  /** Owner-only advanced readiness; null for a Manager. */
  readiness: z
    .object({
      configuration_state: z.enum(SALES_OUTREACH_CONFIGURATION_STATES),
      activation_blockers: z.array(z.string()),
    })
    .nullable(),
});
export type SalesOutreachTeamDto = z.infer<typeof salesOutreachTeamSchema>;

// ---------------------------------------------------------------------------------------------
// GET /queue
// ---------------------------------------------------------------------------------------------

export const salesOutreachQueueFiltersSchema = z.object({
  search: z.string().nullable(),
  priority: z.string(),
  workflow: z.enum([...SALES_OUTREACH_QUEUE_WORKFLOWS, "all"]),
  move_date_from: salesOutreachBusinessDateSchema.nullable(),
  move_date_to: salesOutreachBusinessDateSchema.nullable(),
  move_date_unknown: z.enum(SALES_OUTREACH_MOVE_DATE_UNKNOWN_MODES),
  agent_id: salesOutreachAgentIdSchema.nullable(),
  unassigned: z.boolean(),
  state: z.enum(SALES_OUTREACH_QUEUE_STATES),
});

export const salesOutreachQueueSchema = commonReadSchema.extend({
  filters: salesOutreachQueueFiltersSchema,
  sort: z.enum(SALES_OUTREACH_QUEUE_SORTS),
  direction: z.enum(["asc", "desc"]),
  limit: z.number().int().min(1).max(SALES_OUTREACH_QUEUE_MAX_LIMIT),
  cadence_exposure: z.enum(SALES_OUTREACH_CADENCE_EXPOSURES),
  enforcement_labels: z.boolean(),
  rows: z.array(salesOutreachQueueRowSchema).max(SALES_OUTREACH_QUEUE_MAX_LIMIT),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  counts: z.object({
    projection_pending: count.nullable(),
    excluded_unknown_move_date: count.nullable(),
  }),
});
export type SalesOutreachQueueDto = z.infer<typeof salesOutreachQueueSchema>;

/** The desk's queue request. Absent/null/empty values are omitted; server defaults are not echoed. */
export type SalesOutreachQueueRequest = {
  search?: string | null;
  /** `all` (default), `unknown` or an observed code such as `0`, `1`, `3`. */
  priority?: string | null;
  workflow?: (typeof SALES_OUTREACH_QUEUE_WORKFLOWS)[number] | "all" | null;
  move_date_from?: string | null;
  move_date_to?: string | null;
  move_date_unknown?: (typeof SALES_OUTREACH_MOVE_DATE_UNKNOWN_MODES)[number] | null;
  agent_id?: string | null;
  unassigned?: boolean | null;
  state?: SalesOutreachQueueState | null;
  sort?: SalesOutreachQueueSort | null;
  direction?: "asc" | "desc" | null;
  cursor?: string | null;
  limit?: number | null;
};

/**
 * The `GET /queue` query for a request: only the server's strict keys, in a fixed order, defaults dropped
 * (`priority=all`, `workflow=all`, `state=needs_contact`, `sort=urgency`, `unassigned=false`). Urgency order is
 * fixed, so `direction` is sent only with another sort; `agent_id` and `unassigned` are mutually exclusive
 * (Unassigned wins). Search is trimmed and capped at the server's 100 characters.
 */
export function salesOutreachQueueQuery(request: SalesOutreachQueueRequest): URLSearchParams {
  const query = new URLSearchParams();
  const search = request.search?.trim().slice(0, 100);
  if (search) query.set("search", search);
  if (request.priority && request.priority !== "all") query.set("priority", request.priority);
  if (request.workflow && request.workflow !== "all") query.set("workflow", request.workflow);
  if (request.move_date_from) query.set("move_date_from", request.move_date_from);
  if (request.move_date_to) query.set("move_date_to", request.move_date_to);
  if (request.move_date_unknown) query.set("move_date_unknown", request.move_date_unknown);
  if (request.unassigned) query.set("unassigned", "true");
  else if (request.agent_id) query.set("agent_id", request.agent_id);
  if (request.state && request.state !== "needs_contact") query.set("state", request.state);
  const sort = request.sort ?? "urgency";
  if (sort !== "urgency") {
    query.set("sort", sort);
    if (request.direction) query.set("direction", request.direction);
  }
  if (request.cursor) query.set("cursor", request.cursor);
  if (request.limit != null) query.set("limit", String(Math.min(SALES_OUTREACH_QUEUE_MAX_LIMIT, Math.max(1, Math.trunc(request.limit)))));
  return query;
}

// ---------------------------------------------------------------------------------------------
// GET /outreach/:id
// ---------------------------------------------------------------------------------------------

const planRowSchema = z.object({
  plan_id: salesOutreachObjectIdSchema,
  kind: z.enum(SALES_OUTREACH_FOLLOWUP_KINDS),
  status: z.enum(SALES_OUTREACH_FOLLOWUP_STATUSES),
  selected_date: salesOutreachBusinessDateSchema.nullable(),
  appointment_at: nullableInstant,
  due_at: instant,
  window_minutes: count.nullable(),
  effective_at: instant,
  ended_at: nullableInstant,
  end_reason: z.string().nullable(),
  revision: count,
});
export type SalesOutreachPlanRow = z.infer<typeof planRowSchema>;

const windowChannelSchema = z.object({
  required: count,
  completed: count,
  /** Null when the cadence runs in shadow and the actor is not the Owner (no missed label). */
  missed: count.nullable(),
  waived: count,
  superseded: count,
  open: count,
});

const catchUpSchema = z.object({ outstanding: z.boolean(), missed_count: count, state: z.string().nullable() });

export const salesOutreachContactEventSchema = z.object({
  event_id: salesOutreachObjectIdSchema,
  channel: z.enum(["call", "sms"]),
  direction: z.enum(["inbound", "outbound"]),
  kind: z.string(),
  event_at: instant,
  business_date: salesOutreachBusinessDateSchema,
  verification: z.string(),
  exclusion_reason: z.string().nullable(),
  actor_agent_id: salesOutreachAgentIdSchema.nullable(),
  actor_agent_name: z.string().nullable(),
  outbound_goal_credit: z.boolean(),
  restricted_at_contact: z.boolean(),
});
export type SalesOutreachContactEvent = z.infer<typeof salesOutreachContactEventSchema>;

export const salesOutreachDetailSchema = commonReadSchema.extend({
  subject: z.object({
    subject_id: salesOutreachSubjectIdSchema,
    lead_model: z.enum(SALES_OUTREACH_LEAD_MODELS),
    status: z.enum(SALES_OUTREACH_SUBJECT_STATUSES),
    review_reasons: z.array(z.string()).max(50),
    received_at: nullableInstant,
    received_date: salesOutreachBusinessDateSchema.nullable(),
    received_quality: z.enum(SALES_OUTREACH_RECEIVED_QUALITIES),
    enrollment: z.object({
      cohort_id: z.string(),
      kind: z.enum(SALES_OUTREACH_ENROLLMENT_KINDS),
      enrolled_at: instant,
      activation_at: instant,
    }),
    job_no: z.string().nullable(),
    job_pending: z.boolean(),
    phone: z.string().nullable(),
    name: z.string().nullable(),
    move_date: salesOutreachBusinessDateSchema.nullable(),
    move_date_review: z.enum(SALES_OUTREACH_MOVE_DATE_REVIEWS).nullable(),
  }),
  priority: z.object({
    raw: z.string().nullable(),
    basis: z.enum(SALES_OUTREACH_PRIORITY_BASES),
    accepted_at: nullableInstant,
    uncertain: z.boolean(),
  }),
  assignment: z.object({
    assigned_agent_id: salesOutreachAgentIdSchema.nullable(),
    assigned_agent_name: z.string().nullable(),
    unassigned: z.boolean(),
    /** Send as `expected_revision` to `PATCH /outreach/:id/assignment`. */
    assignment_revision: count,
    lead_receiver_agent_id: salesOutreachAgentIdSchema.nullable(),
    in_sync: z.boolean(),
  }),
  plan: z.object({
    /** Send as `expected_revision` to the quoted-followup and callback commands. */
    plan_revision: count,
    active: planRowSchema.nullable(),
    history: z.array(planRowSchema).max(50),
  }),
  policy: z.object({
    projection_state: z.enum(SALES_OUTREACH_PROJECTION_STATES),
    exposure: z.enum(SALES_OUTREACH_CADENCE_EXPOSURES).nullable(),
    enforcement_labels: z.boolean(),
    workflow: z.enum(SALES_OUTREACH_WORKFLOWS).nullable(),
    engine_state: z.string().nullable(),
    policy_version: z.string().nullable(),
    configuration_version: z.string().nullable(),
    schedule_day: z.number().int().nullable(),
    period: z
      .object({
        period_id: salesOutreachObjectIdSchema,
        workflow: z.enum(SALES_OUTREACH_WORKFLOWS),
        start_kind: z.enum(SALES_OUTREACH_PERIOD_START_KINDS),
        priority: z.string().nullable(),
        started_at: instant,
      })
      .nullable(),
    quoted: z
      .object({
        selected_date: salesOutreachBusinessDateSchema.nullable(),
        first_required_date: salesOutreachBusinessDateSchema.nullable(),
        basis: z.string(),
        plan_id: z.string().nullable(),
      })
      .nullable(),
    callback: z
      .object({ plan_id: z.string(), appointment_at: instant, due_at: instant, outcome: z.string(), fulfilled_by_event_id: z.string().nullable() })
      .nullable(),
    initial_response: z.object({ due_at: nullableInstant, outcome: z.string(), fulfilled_at: nullableInstant }).nullable(),
    advisory_cooldown: z.object({ warning: z.boolean(), unsuccessful_attempts: count }),
    catch_up: z.object({ call: catchUpSchema, sms: catchUpSchema }).nullable(),
    blocked_until: z.object({ call: nullableInstant, sms: nullableInstant }),
    /** Deterministic explanation codes the admin renders as text (no generated text, D01). */
    explanation: z.array(z.object({ code: z.string(), value: z.union([z.string(), z.number()]).nullable() })).max(30),
  }),
  requirements: z.object({ call: salesOutreachChannelSchema, sms: salesOutreachChannelSchema }),
  status_flags: salesOutreachStatusFlagsSchema,
  oldest_actionable_due_at: nullableInstant,
  next_action_due_at: nullableInstant,
  last_interaction_at: nullableInstant,
  shadow_labels: z
    .object({
      call_status: z.enum(SALES_OUTREACH_CHANNEL_STATUSES),
      sms_status: z.enum(SALES_OUTREACH_CHANNEL_STATUSES),
      overdue: z.boolean(),
    })
    .nullable(),
  history: z.object({
    window_history: z
      .array(
        z.object({
          business_date: salesOutreachBusinessDateSchema,
          schedule_day: z.number().int().nullable(),
          workflow: z.enum(SALES_OUTREACH_WORKFLOWS).nullable(),
          closed_date: z.boolean(),
          call: windowChannelSchema,
          sms: windowChannelSchema,
        }),
      )
      .max(30),
    window_summary: z
      .object({
        dates: count,
        call_missed: count.nullable(),
        sms_missed: count.nullable(),
      })
      .nullable(),
    missed_labels_hidden: z.boolean(),
    contact_events: z.array(salesOutreachContactEventSchema).max(100),
    contact_events_truncated: z.boolean(),
    assignment_changes: z
      .array(
        z.object({
          applied_at: instant,
          from_agent_id: salesOutreachAgentIdSchema.nullable(),
          to_agent_id: salesOutreachAgentIdSchema.nullable(),
        }),
      )
      .max(50),
  }),
  restrictions: z
    .array(
      z.object({
        channels: z.array(z.enum(["call", "sms"])),
        until: nullableInstant,
        reason: z.string().nullable(),
        origin: z.enum(["owner", "intelligence"]),
        confirmed: z.boolean(),
      }),
    )
    .max(20),
  computed_as_of: nullableInstant,
  publication_revision: count.nullable(),
});
export type SalesOutreachDetailDto = z.infer<typeof salesOutreachDetailSchema>;

// ---------------------------------------------------------------------------------------------
// GET /live (SSE `event: invalidation`)
// ---------------------------------------------------------------------------------------------

export const salesOutreachLiveChangeSchema = z.object({
  topic: z.enum(SALES_OUTREACH_LIVE_TOPICS),
  subject_ids: z.array(salesOutreachSubjectIdSchema).max(100),
  agent_ids: z.array(salesOutreachAgentIdSchema).max(10),
  business_day: salesOutreachBusinessDateSchema.nullable(),
  revision: count.nullable(),
});
export type SalesOutreachLiveChange = z.infer<typeof salesOutreachLiveChangeSchema>;

export const salesOutreachLiveFrameSchema = z.object({
  version: z.literal(SALES_OUTREACH_LIVE_VERSION),
  contract_version: z.literal(SALES_OUTREACH_CONTRACT_VERSION),
  reason: z.enum(["connect", "reconnect", "change", "clock"]),
  as_of: instant,
  refetch: z.enum(["all", "scoped"]),
  topics: z.array(z.enum(SALES_OUTREACH_LIVE_TOPICS)),
  changes: z.array(salesOutreachLiveChangeSchema).max(200),
});
export type SalesOutreachLiveFrame = z.infer<typeof salesOutreachLiveFrameSchema>;

// ---------------------------------------------------------------------------------------------
// Envelopes and errors
// ---------------------------------------------------------------------------------------------

export const salesOutreachEnvelope = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data });

/** The refusal envelope; parsed leniently (an unknown code is kept as a string). */
export const salesOutreachErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  error: z.string().optional(),
  request_id: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), code: z.string(), message: z.string().optional() })).max(50).optional(),
});
export type SalesOutreachErrorEnvelope = z.infer<typeof salesOutreachErrorEnvelopeSchema>;

/** A refused or failed desk call. `code` is the server's code, or `READ_FAILED`/`COMMAND_FAILED` when the body was not an envelope. */
export class SalesOutreachApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null = null,
    readonly issues: SalesOutreachErrorEnvelope["issues"] = undefined,
  ) {
    super(message);
    this.name = "SalesOutreachApiError";
  }

  /** 403/404: the selected Lead (or the whole scope) is no longer readable; clear it from the cache. */
  get revokesAccess(): boolean {
    return this.status === 403 || this.status === 404;
  }

  /** 503 CONFIGURATION_UNAVAILABLE / PROJECTION_PENDING / SERVICE_UNAVAILABLE: the desk part is unavailable, not empty. */
  get unavailable(): boolean {
    return this.status === 503;
  }
}

export function isSalesOutreachApiError(error: unknown): error is SalesOutreachApiError {
  return error instanceof SalesOutreachApiError;
}

/** Turns any response body into a typed error, leniently (a proxy 401/502 body is not a desk envelope). */
export function salesOutreachErrorFromBody(status: number, body: unknown, fallbackCode: string): SalesOutreachApiError {
  const parsed = salesOutreachErrorEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return new SalesOutreachApiError(status, parsed.data.code, parsed.data.error ?? parsed.data.code, parsed.data.request_id ?? null, parsed.data.issues);
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  // The generic BFF also carries the server code as `registry_code`.
  const code = typeof record.code === "string" ? record.code : typeof record.registry_code === "string" ? record.registry_code : fallbackCode;
  const message = typeof record.error === "string" ? record.error : code;
  const issues = Array.isArray(record.issues) ? (record.issues as SalesOutreachErrorEnvelope["issues"]) : undefined;
  return new SalesOutreachApiError(status, code, message, typeof record.request_id === "string" ? record.request_id : null, issues);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * A desk read through the BFF (`/api/proxy/api/v1/admin/sales-outreach/<path>`). `path` is relative, with its
 * own query (e.g. `queue?state=all_active`). Returns the validated `data`; throws `SalesOutreachApiError`.
 */
export async function salesOutreachRead<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${SALES_OUTREACH_BFF_PATH}/${path.replace(/^\//, "")}`, { signal, cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !body || (body as { ok?: unknown }).ok !== true) {
    throw salesOutreachErrorFromBody(response.status, body, "READ_FAILED");
  }
  return salesOutreachEnvelope(schema).parse(body).data;
}

/** A desk command through the BFF. Every write carries an `Idempotency-Key` (the server refuses without one). */
export async function salesOutreachCommand<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  idempotencyKey: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`${SALES_OUTREACH_BFF_PATH}/${path.replace(/^\//, "")}`, {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload || (payload as { ok?: unknown }).ok !== true) {
    throw salesOutreachErrorFromBody(response.status, payload, "COMMAND_FAILED");
  }
  return salesOutreachEnvelope(schema).parse(payload).data;
}

/** A fresh idempotency key for one user intent (retry the same intent with the same key). */
export function newIdempotencyKey(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 200);
}

/** Relative read paths (append to `salesOutreachRead`). */
export const salesOutreachPaths = {
  capabilities: () => "capabilities",
  repDays: (query: SalesOutreachRepDaysQuery = {}) => withQuery("rep-days", query),
  team: (query: { business_day?: string } = {}) => withQuery("team", query),
  queue: (request: SalesOutreachQueueRequest = {}) => {
    const query = salesOutreachQueueQuery(request).toString();
    return query ? `queue?${query}` : "queue";
  },
  detail: (subjectId: string) => `outreach/${encodeURIComponent(subjectId)}`,
  quotedFollowup: (subjectId: string) => `outreach/${encodeURIComponent(subjectId)}/quoted-followup`,
  callback: (subjectId: string) => `outreach/${encodeURIComponent(subjectId)}/callback`,
  assignment: (subjectId: string) => `outreach/${encodeURIComponent(subjectId)}/assignment`,
  dayOverride: (agentId: string) => `goals/${encodeURIComponent(agentId)}/day-override`,
  configuration: () => "configuration",
  restrictions: (query: { state?: (typeof SALES_OUTREACH_RESTRICTION_STATES)[number]; cursor?: string; limit?: number } = {}) => withQuery("restrictions", query),
  restrictionConfirm: (restrictionId: string) => `restrictions/${encodeURIComponent(restrictionId)}/confirm`,
  restrictionLift: (restrictionId: string) => `restrictions/${encodeURIComponent(restrictionId)}/lift`,
  enrollmentCandidates: (query: { partition: SalesOutreachEnrollmentPartition; cursor?: string; limit?: number }) => withQuery("enrollment/candidates", query),
  enrollmentReport: () => "enrollment/report",
  enrollmentApply: () => "enrollment/apply",
  enrollmentVerify: () => "enrollment/verify",
} as const;

function withQuery(path: string, query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

// ---------------------------------------------------------------------------------------------
// Commands (salesOutreachCommands.ts)
// ---------------------------------------------------------------------------------------------

const revision = count;
const commandInstant = z.iso.datetime({ offset: true });
const reasonText = z.string().trim().min(1).max(200);

export const salesOutreachQuotedFollowupRequestSchema = z.object({
  expected_revision: revision,
  period_id: salesOutreachObjectIdSchema,
  selected_date: salesOutreachBusinessDateSchema,
  replace_active_plan: z.boolean().optional(),
});
export type SalesOutreachQuotedFollowupRequest = z.infer<typeof salesOutreachQuotedFollowupRequestSchema>;

export const salesOutreachCallbackRequestSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("set"), expected_revision: revision, appointment_at: commandInstant, replace_active_plan: z.boolean().optional() }),
  z.object({ operation: z.literal("reschedule"), expected_revision: revision, appointment_at: commandInstant }),
  z.object({ operation: z.literal("cancel"), expected_revision: revision }),
]);
export type SalesOutreachCallbackRequest = z.infer<typeof salesOutreachCallbackRequestSchema>;

export const salesOutreachAssignmentRequestSchema = z.object({
  expected_revision: revision,
  agent_id: salesOutreachAgentIdSchema.nullable(),
});
export type SalesOutreachAssignmentRequest = z.infer<typeof salesOutreachAssignmentRequestSchema>;

export const salesOutreachDayOverrideRequestSchema = z
  .object({
    expected_revision: z.number().int().min(1),
    business_date: salesOutreachBusinessDateSchema,
    goal: z.number().int().min(0).max(10_000),
    reason: z.enum(["absence", "partial_day"]),
  })
  .refine((o) => o.reason !== "absence" || o.goal === 0, { message: "an absence override has goal 0", path: ["goal"] });
export type SalesOutreachDayOverrideRequest = z.infer<typeof salesOutreachDayOverrideRequestSchema>;

export const salesOutreachRestrictionAddRequestSchema = z.object({
  contact_number_id: salesOutreachObjectIdSchema,
  channels: z
    .array(z.enum(["call", "sms"]))
    .min(1)
    .max(2)
    .refine((c) => new Set(c).size === c.length, "duplicate channel"),
  until: commandInstant.nullable().optional(),
  reason: reasonText,
});
export type SalesOutreachRestrictionAddRequest = z.infer<typeof salesOutreachRestrictionAddRequestSchema>;
export const salesOutreachRestrictionConfirmRequestSchema = z.object({ expected_revision: z.number().int().min(1) });
export const salesOutreachRestrictionLiftRequestSchema = z.object({ expected_revision: z.number().int().min(1), reason: reasonText });

const contract = z.literal(SALES_OUTREACH_CONTRACT_VERSION);

export const salesOutreachPlanSchema = z.object({
  plan_id: salesOutreachObjectIdSchema,
  kind: z.enum(SALES_OUTREACH_FOLLOWUP_KINDS),
  period_id: salesOutreachObjectIdSchema.nullable(),
  selected_date: z.string().nullable(),
  appointment_at: z.string().nullable(),
  appointment_local: z.object({ business_date: z.string(), minute: z.number().int() }).nullable(),
  due_at: z.string(),
  window_minutes: z.number().int().nullable(),
  effective_at: z.string(),
  status: z.literal("active"),
  revision: z.number().int(),
});

export const salesOutreachPlanCommandResponseSchema = z.object({
  contract_version: contract,
  subject_id: salesOutreachObjectIdSchema,
  plan_revision: z.number().int(),
  plan: salesOutreachPlanSchema.nullable(),
  ended_plan: z
    .object({ plan_id: salesOutreachObjectIdSchema, kind: z.enum(SALES_OUTREACH_FOLLOWUP_KINDS), status: z.enum(["replaced", "cancelled"]) })
    .nullable(),
  changed: z.boolean(),
  replayed: z.boolean(),
});
export type SalesOutreachPlanCommandResponse = z.infer<typeof salesOutreachPlanCommandResponseSchema>;

export const salesOutreachAssignmentResponseSchema = z.object({
  contract_version: contract,
  subject_id: salesOutreachObjectIdSchema,
  assigned_agent_id: salesOutreachObjectIdSchema.nullable(),
  previous_agent_id: salesOutreachObjectIdSchema.nullable(),
  assignment_revision: z.number().int(),
  lead_revision: z.number().int(),
  receiver_agent_source: z.literal("manual").nullable(),
  changed: z.boolean(),
  replayed: z.boolean(),
});
export type SalesOutreachAssignmentResponse = z.infer<typeof salesOutreachAssignmentResponseSchema>;

const dayOverride = z.object({ goal: z.number().int(), reason: z.enum(["absence", "partial_day"]) });
export const salesOutreachDayOverrideResponseSchema = z.object({
  contract_version: contract,
  agent_id: salesOutreachObjectIdSchema,
  business_date: z.string(),
  override: dayOverride,
  previous: dayOverride.nullable(),
  revision: z.number().int(),
  version: z.string(),
  changed: z.boolean(),
  replayed: z.boolean(),
});
export type SalesOutreachDayOverrideResponse = z.infer<typeof salesOutreachDayOverrideResponseSchema>;

export const salesOutreachRestrictionSchema = z.object({
  restriction_id: salesOutreachObjectIdSchema,
  contact_number_id: salesOutreachObjectIdSchema,
  channels: z.array(z.enum(["call", "sms"])),
  origin: z.enum(["owner", "intelligence"]),
  state: z.enum(["active", "expired", "resolved"]),
  effective_at: z.string(),
  until: z.string().nullable(),
  reason: z.string().nullable(),
  /** An active AI-origin row no Owner has confirmed: it still blocks until confirmed or lifted. */
  needs_review: z.boolean(),
  confirmed_at: z.string().nullable(),
  confirmed_by: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolved_by: z.string().nullable(),
  resolution_reason: z.string().nullable(),
  revision: z.number().int(),
});
export type SalesOutreachRestrictionDto = z.infer<typeof salesOutreachRestrictionSchema>;

export const salesOutreachRestrictionCommandResponseSchema = z.object({
  contract_version: contract,
  restriction: salesOutreachRestrictionSchema,
  changed: z.boolean(),
  replayed: z.boolean(),
});
export type SalesOutreachRestrictionCommandResponse = z.infer<typeof salesOutreachRestrictionCommandResponseSchema>;

export const salesOutreachRestrictionsResponseSchema = z.object({
  contract_version: contract,
  as_of: z.string(),
  state: z.enum(SALES_OUTREACH_RESTRICTION_STATES),
  restrictions: z.array(salesOutreachRestrictionSchema),
  next_cursor: salesOutreachObjectIdSchema.nullable(),
});
export type SalesOutreachRestrictionsResponse = z.infer<typeof salesOutreachRestrictionsResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Configuration (salesOutreach.ts value; GET/PATCH /configuration)
// ---------------------------------------------------------------------------------------------

const minuteOfDay = z.number().int().min(0).max(1440);
const isoWeekday = z.number().int().min(1).max(7);
const rule = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullable();

export const salesOutreachConfigurationValueSchema = z.object({
  controls: z.object({
    desk_enabled: z.boolean(),
    cadence_shadow_enabled: z.boolean(),
    cadence_enforcement_enabled: z.boolean(),
    rep_sms_capture_enabled: z.boolean(),
    goal_metrics_enabled: z.boolean(),
  }),
  transition: z.object({
    legacy_planning_paused: z.boolean(),
    migrated_cohort_id: z.string().nullable(),
    activation_at: nullableInstant,
    intake_admission_enabled: z.boolean(),
    intake_admission_at: nullableInstant,
    intake_admission_watermark: z.string().nullable(),
    backfill_lookback_days: z.number().int().nullable(),
    backfill_include_upcoming_moves: z.boolean().nullable(),
  }),
  cadence: z.object({
    policy_version: z.string().nullable(),
    approval_ref: z.string().nullable(),
    timezone: z.literal(SALES_OUTREACH_TIMEZONE),
    calendar_mode: rule(["new_york_calendar_date"]),
    working_days: z.array(z.object({ iso_weekday: isoWeekday, open_minute: minuteOfDay, close_minute: minuteOfDay })).nullable(),
    holidays: z.array(salesOutreachBusinessDateSchema).nullable(),
    initial_response_working_minutes: z.number().int().nullable(),
    new_days_1_3_calls: z.object({ required: z.number().int(), optional: z.number().int() }).nullable(),
    new_call_slots: z
      .array(z.object({ from_day: z.number().int(), to_day: z.number().int().nullable(), deadline_minutes: z.array(minuteOfDay) }))
      .nullable(),
    new_call_min_spacing_minutes: z.number().int().nullable(),
    sms_cutoff_minute: minuteOfDay.nullable(),
    sms_mode: rule(["fixed_sequence"]),
    sms_sequence: z
      .object({ initial_days: z.array(z.number().int()), repeat_from_day: z.number().int(), repeat_every_days: z.number().int() })
      .nullable(),
    quoted_open_minute: minuteOfDay.nullable(),
    quoted_due_minute: minuteOfDay.nullable(),
    quoted_same_day_cutoff_minute: minuteOfDay.nullable(),
    return_to_new_mode: rule(["original_age_partial_day"]),
    late_arrival_rule: z
      .object({ two_calls_before_minute: minuteOfDay, one_call_through_minute: minuteOfDay, sms_through_minute: minuteOfDay })
      .nullable(),
    catchup_mode: rule(["one_per_channel"]),
    restriction_clock_rule: rule(["waive_pause_resume_next_working_date"]),
    callback_window_minutes: z.number().int().nullable(),
    callback_mode: rule(["explicit_human_appointment"]),
    cooldown_warning_threshold: z.number().int().nullable(),
    cooldown_warning_hours: z.number().int().nullable(),
    cooldown_mode: rule(["advisory_warning"]),
    assignment_timeline_rule: rule(["continuous_timeline"]),
    intake_default_rule: z
      .object({
        website_form: z.enum(["new", "review"]),
        best_relocation: z.enum(["new", "review"]),
        ringcentral_call: z.enum(["new", "review"]),
        manual: z.enum(["new", "review"]),
        granot_created: z.enum(["new", "review"]),
      })
      .nullable(),
    uncertain_priority_rule: rule(["retain_last_verified"]),
    priority_map: z
      .object({
        codes: z.array(
          z.object({
            code: z.string(),
            workflow: z.enum(["new", "quoted", "discretion", "closed", "none"]),
            closure_reason: z.enum(["granot_booked", "crm_bad_disposition", "crm_dead_disposition"]).nullable(),
          }),
        ),
        unmapped_workflow: z.enum(["none"]),
        official_booking_workflow: z.enum(["closed"]),
      })
      .nullable(),
    transition_day_rule: rule(["partial_day_allowance"]),
    move_date_rule: rule(["review_label_only"]),
    lead_eligibility_rule: rule(["no_sync_viable_duplicates_excluded"]),
    precedence_rule: rule(["closure_restriction_schedule_priority"]),
  }),
  evidence: z.object({
    qualifying_call_rule: rule(["terminal_call_log_attempt"]),
    goal_rep_rule: rule(["reviewed_initiator_only"]),
    helping_rep_rule: rule(["reviewed_helper_cadence_only"]),
    sms_success_rule: rule(["sent_or_delivered"]),
    sms_failure_correction_rule: rule(["revoke_on_confirmed_failure"]),
    roster_version: z.string().nullable(),
    event_time_rule: rule(["outbound_start_inbound_handled_sms_sent"]),
    operating_window_rule: rule(["goal_full_date_cadence_open_hours"]),
    originating_inbound_rule: rule(["unique_association_initial_response"]),
    restricted_contact_rule: rule(["history_only_zero_credit"]),
  }),
  migration: z.object({
    paused: z.boolean(),
    batch_size: z.number().int(),
    batch_ceiling: z.number().int(),
    interval_seconds: z.number().int(),
    max_batch_bytes: z.number().int().nullable(),
    max_batch_ms: z.number().int().nullable(),
    min_oplog_window_seconds: z.number().int().nullable(),
    warning_oplog_window_seconds: z.number().int().nullable(),
    max_replication_lag_seconds: z.number().int().nullable(),
    max_consumer_lag_seconds: z.number().int().nullable(),
    max_incremental_write_bytes_per_second: z.number().int().nullable(),
  }),
  goals: z.object({
    roster_version: z.string().nullable(),
    rep_work_schedules: z
      .array(z.object({ agent_id: salesOutreachAgentIdSchema, working_days: z.array(isoWeekday), scheduled_goal: z.number().int().nullable() }))
      .nullable(),
    default_scheduled_goal: z.number().int().nullable(),
    effective_day_overrides: z
      .array(
        z.object({
          agent_id: salesOutreachAgentIdSchema,
          business_date: salesOutreachBusinessDateSchema,
          goal: z.number().int(),
          reason: z.enum(["absence", "partial_day"]),
        }),
      )
      .nullable(),
    zero_goal_rule: rule(["no_goal_today_excluded_from_denominator"]),
  }),
});
export type SalesOutreachConfigurationValue = z.infer<typeof salesOutreachConfigurationValueSchema>;

/** `GET /configuration` (Owner): `value` is null when the stored configuration is unavailable. */
export const salesOutreachConfigurationReadSchema = z.object({
  contract_version: contract,
  as_of: instant,
  timezone: z.literal(SALES_OUTREACH_TIMEZONE),
  configuration_state: z.enum(SALES_OUTREACH_CONFIGURATION_STATES),
  revision: count,
  version: z.string().nullable(),
  content_hash: z.string().nullable(),
  approval_ref: z.string().nullable(),
  updated_at: nullableInstant,
  updated_by: z.string().nullable(),
  unavailable_reason: z.string().nullable(),
  value: salesOutreachConfigurationValueSchema.nullable(),
  activation_blockers: z.array(z.string()),
});
export type SalesOutreachConfigurationReadDto = z.infer<typeof salesOutreachConfigurationReadSchema>;

/** `PATCH /configuration` body: a full replacement of the value plus the revision the Owner read. */
export const salesOutreachConfigurationPatchSchema = z.object({
  expected_revision: count,
  value: z.unknown(),
});
export type SalesOutreachConfigurationPatch = z.infer<typeof salesOutreachConfigurationPatchSchema>;

export const salesOutreachConfigurationPatchResponseSchema = z.object({
  contract_version: contract,
  revision: count,
  version: z.string(),
  content_hash: z.string(),
  changed: z.boolean(),
  replayed: z.boolean(),
});
export type SalesOutreachConfigurationPatchResponse = z.infer<typeof salesOutreachConfigurationPatchResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Enrollment (salesOutreachEnrollment.ts requests; service result types for responses)
// ---------------------------------------------------------------------------------------------

export const salesOutreachLeadRefSchema = z.object({
  model: z.enum(SALES_OUTREACH_LEAD_MODELS),
  id: z.string().regex(/^[a-fA-F\d]{24}$/),
});
export type SalesOutreachLeadRef = z.infer<typeof salesOutreachLeadRefSchema>;

const cohortId = z.string().trim().regex(/^[A-Za-z0-9:._-]{1,120}$/);
const enrollmentSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("backfill_scope") }),
  z.object({ mode: z.literal("selected"), lead_refs: z.array(salesOutreachLeadRefSchema).min(1).max(20_000) }),
]);

export const salesOutreachEnrollmentReportRequestSchema = z.object({
  selection: enrollmentSelectionSchema,
  kind: z.enum(["pilot", "expansion"]).optional(),
  cohort_id: cohortId.optional(),
});
export type SalesOutreachEnrollmentReportRequest = z.infer<typeof salesOutreachEnrollmentReportRequestSchema>;

export const salesOutreachEnrollmentApplyRequestSchema = z.object({
  kind: z.enum(["pilot", "expansion"]),
  cohort_id: cohortId,
  lead_refs: z.array(salesOutreachLeadRefSchema).min(1).max(20_000),
  manifest_hash: z.string().regex(/^[a-f\d]{64}$/),
  deadline_seconds: z.number().int().min(0).max(700).optional(),
});
export type SalesOutreachEnrollmentApplyRequest = z.infer<typeof salesOutreachEnrollmentApplyRequestSchema>;

export const salesOutreachEnrollmentVerifyRequestSchema = z.object({ run_key: z.string().trim().regex(/^[A-Za-z0-9:._-]{1,120}$/) });

const enrollmentScopeSchema = z.object({
  mode: z.enum(["backfill_scope", "selected"]),
  today: z.string(),
  cutoff_date: z.string().optional(),
  lookback_days: z.number().int().optional(),
  include_upcoming_moves: z.boolean().optional(),
});

export const salesOutreachEnrollmentCandidateSchema = z.object({
  lead: salesOutreachLeadRefSchema,
  partition: z.enum(SALES_OUTREACH_ENROLLMENT_PARTITIONS),
  reason: z.string(),
  workflow: z.enum(SALES_OUTREACH_WORKFLOWS).nullable(),
  priority_raw: z.string().nullable(),
  received_date: z.string().nullable(),
  move_date: z.string().nullable(),
  job_no: z.string().nullable(),
  name: z.string().nullable(),
});
export type SalesOutreachEnrollmentCandidate = z.infer<typeof salesOutreachEnrollmentCandidateSchema>;

export const salesOutreachEnrollmentCandidatesSchema = z.object({
  contract_version: contract,
  as_of: z.string(),
  partition: z.enum(SALES_OUTREACH_ENROLLMENT_PARTITIONS),
  scope: enrollmentScopeSchema,
  items: z.array(salesOutreachEnrollmentCandidateSchema),
  next_cursor: z.string().nullable(),
  scanned: z.number().int(),
});
export type SalesOutreachEnrollmentCandidatesDto = z.infer<typeof salesOutreachEnrollmentCandidatesSchema>;

export const salesOutreachEnrollmentReportSchema = z.object({
  contract_version: contract,
  mode: z.literal("report"),
  as_of: z.string(),
  kind: z.enum(["pilot", "expansion"]),
  cohort_id: z.string(),
  configuration_version: z.string(),
  configuration_revision: z.number().int(),
  algorithm_version: z.union([z.string(), z.number()]),
  scope: enrollmentScopeSchema,
  counts: z.record(z.string(), z.number().int()),
  reasons: z.record(z.string(), z.number().int()),
  lead_refs: z.array(salesOutreachLeadRefSchema),
  manifest_hash: z.string(),
  review: z.array(salesOutreachEnrollmentCandidateSchema),
  review_truncated: z.boolean(),
  writes: z.literal(0),
});
export type SalesOutreachEnrollmentReportDto = z.infer<typeof salesOutreachEnrollmentReportSchema>;

export const salesOutreachEnrollmentApplySchema = z.object({
  contract_version: contract,
  mode: z.literal("apply"),
  run_key: z.string(),
  status: z.enum(["running", "completed", "paused", "lease_held", "failed"]),
  activation_at: z.string(),
  manifest_hash: z.string(),
  selected: z.number().int(),
  next_index: z.number().int(),
  batches_this_call: z.number().int(),
  counts: z.record(z.string(), z.number().int()),
  pause_reason: z.string().nullable(),
  replayed: z.boolean(),
});
export type SalesOutreachEnrollmentApplyDto = z.infer<typeof salesOutreachEnrollmentApplySchema>;

export const salesOutreachEnrollmentVerifySchema = z.object({
  contract_version: contract,
  mode: z.literal("verify"),
  run_key: z.string(),
  run_status: z.enum(["running", "completed", "failed", "paused"]),
  complete: z.boolean(),
  consistent: z.boolean(),
  counts: z.record(z.string(), z.number().int()),
  mismatches: z.array(z.object({ lead: salesOutreachLeadRefSchema, problem: z.string() })),
});
export type SalesOutreachEnrollmentVerifyDto = z.infer<typeof salesOutreachEnrollmentVerifySchema>;
