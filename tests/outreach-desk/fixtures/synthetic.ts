/**
 * A coherent synthetic Sales Outreach Desk for the mock API and the visual checks. Synthetic people,
 * job numbers and phones only (no production data). Numbers echo the owner references
 * (`docs/sales-outreach-desk/references/manager-desk.webp`, `sales-rep-desk.webp`): Thursday Oct 1, four
 * reps at 64/108/83/22 of 100, 277/400 team calls, 18 overdue leads, 7 Quoted leads with gaps.
 *
 * Every payload here is a server-shaped `data` body (the `{ ok, data }` envelope is added by the mock) and
 * validates against `lib/api/salesOutreach.ts` (see `synthetic.test.ts`). Two variants:
 * - `desk`: the full desk with cadence enforcement on, SMS capture connected;
 * - `m1`: M1 Call progress only — goal parts, cadence off (overdue metrics `cadence_disabled`, no attention
 *   rows, the queue answers 503 PROJECTION_PENDING).
 */
import type {
  SalesOutreachCapabilitiesDto,
  SalesOutreachChannelDto,
  SalesOutreachConfigurationReadDto,
  SalesOutreachConfigurationValue,
  SalesOutreachDailyCallGoalRow,
  SalesOutreachDetailDto,
  SalesOutreachEnrollmentCandidatesDto,
  SalesOutreachEnrollmentReportDto,
  SalesOutreachFreshness,
  SalesOutreachQueueRowDto,
  SalesOutreachRepDayDto,
  SalesOutreachRepDaysDto,
  SalesOutreachRestrictionsResponse,
  SalesOutreachRole,
  SalesOutreachTeamDto,
} from "@/lib/api/salesOutreach";

export type SyntheticVariant = "desk" | "m1";

export const SYNTHETIC_AS_OF = "2026-10-01T16:00:00.000Z";
export const SYNTHETIC_BUSINESS_DAY = "2026-10-01";
const CONFIG_VERSION = "sod-cfg-synthetic-1";
const CONFIG_REVISION = 3;
const ROSTER_VERSION = "roster-2026-10-01-synthetic";

export const SYNTHETIC_AGENTS = {
  alex: { id: "6650a1b2c3d4e5f607180001", name: "Alex Morgan" },
  jamie: { id: "6650a1b2c3d4e5f607180002", name: "Jamie Park" },
  sam: { id: "6650a1b2c3d4e5f607180003", name: "Sam Taylor" },
  casey: { id: "6650a1b2c3d4e5f607180004", name: "Casey Reed" },
  drew: { id: "6650a1b2c3d4e5f607180005", name: "Drew Lane" },
} as const;
export type SyntheticAgentKey = keyof typeof SYNTHETIC_AGENTS;
/** The Rep the visual "My outreach" check signs in as. */
export const SYNTHETIC_REP_AGENT_ID = SYNTHETIC_AGENTS.alex.id;
const agentName = (id: string | null) => Object.values(SYNTHETIC_AGENTS).find((agent) => agent.id === id)?.name ?? null;

// ---------------------------------------------------------------------------------------------
// Shared read envelope parts
// ---------------------------------------------------------------------------------------------

function freshness(variant: SyntheticVariant): SalesOutreachFreshness {
  return {
    calls: {
      state: "fresh",
      last_updated_at: "2026-10-01T15:59:20.000Z",
      known_complete_through: "2026-10-01T15:59:00.000Z",
      age_seconds: 40,
      reason: null,
    },
    sms:
      variant === "desk"
        ? { state: "fresh", last_updated_at: "2026-10-01T15:58:50.000Z", known_complete_through: "2026-10-01T15:58:30.000Z", age_seconds: 70, reason: null }
        : { state: "not_connected", last_updated_at: null, known_complete_through: null, age_seconds: null, reason: "rep_sms_capture_disabled" },
    granot: { state: "observed", last_observed_at: "2026-10-01T15:57:10.000Z", age_seconds: 170 },
  };
}

function base(role: SalesOutreachRole, agentId: string | null) {
  return {
    contract_version: "sod-v1" as const,
    as_of: SYNTHETIC_AS_OF,
    timezone: "America/New_York" as const,
    scope: { role, agent_id: agentId },
    configuration_state: "active" as const,
    configuration_version: CONFIG_VERSION,
    configuration_revision: CONFIG_REVISION,
  };
}

/** The fields every projection read shares (`as_of`, scope, configuration, freshness). */
export function syntheticCommonRead(role: SalesOutreachRole, agentId: string | null, variant: SyntheticVariant) {
  return { ...base(role, agentId), projection_revision: 57, freshness: freshness(variant) };
}

// ---------------------------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------------------------

const QUEUE_FILTERS_COORDINATOR = [
  "search", "priority", "workflow", "move_date_from", "move_date_to", "move_date_unknown",
  "agent_id", "unassigned", "state", "sort", "direction", "cursor", "limit",
] as const;
const QUEUE_FILTERS_REP = QUEUE_FILTERS_COORDINATOR.filter((filter) => filter !== "agent_id" && filter !== "unassigned");

const ROLE_CAPABILITIES: Record<SalesOutreachRole, string[]> = {
  owner: [
    "activation", "assign_reassign", "base_goal_edits", "cadence_policy_edits", "configuration_edit", "configuration_read",
    "daily_operations_access", "explicit_callback_commands", "historical_responsibility_goal_setting_edits", "individual_rep_filter",
    "lift_contact_restriction", "migration", "override_authoritative_closure", "own_assigned_reads", "prospective_absence_override",
    "prospective_partial_day_override", "quoted_date_commands", "rollback", "roster_edits", "team_reads", "unassigned_reads", "work_schedule_edits",
  ],
  manager: [
    "assign_reassign", "daily_operations_access", "explicit_callback_commands", "individual_rep_filter", "own_assigned_reads",
    "prospective_absence_override", "prospective_partial_day_override", "quoted_date_commands", "team_reads", "unassigned_reads",
  ],
  rep: ["explicit_callback_commands", "own_assigned_reads", "quoted_date_commands"],
};

export function syntheticCapabilities(role: SalesOutreachRole, variant: SyntheticVariant = "desk"): SalesOutreachCapabilitiesDto {
  const coordinator = role !== "rep";
  const enforcement = variant === "desk";
  const commands = ["quoted_followup", "callback"];
  if (coordinator) commands.push("assignment", "day_override");
  if (role === "owner") commands.push("restrictions", "configuration_edit");
  return {
    ...base(role, role === "rep" ? SYNTHETIC_REP_AGENT_ID : null),
    controls: {
      desk_enabled: true,
      goal_metrics_enabled: true,
      rep_sms_capture_enabled: enforcement,
      cadence_shadow_enabled: false,
      cadence_enforcement_enabled: enforcement,
      intake_admission_enabled: enforcement,
    },
    desk_available: true,
    unavailable_reason: null,
    permitted_views: role === "owner" ? ["team", "my", "settings", "numbers", "accounts"] : coordinator ? ["team", "my"] : ["my"],
    permitted_filters: {
      rep_days: coordinator ? ["business_day", "agent_id"] : ["business_day"],
      team: coordinator ? ["business_day"] : [],
      queue: coordinator ? [...QUEUE_FILTERS_COORDINATOR] : [...QUEUE_FILTERS_REP],
    },
    live_topics: ["outreach_desk", "outreach_goal", "outreach_configuration"],
    permitted_commands: commands,
    role_capabilities: [...ROLE_CAPABILITIES[role]],
    deployed_reads: ["capabilities", "rep_days", "team", "queue", "outreach_detail", "live"],
  };
}

// ---------------------------------------------------------------------------------------------
// Rep days and the team
// ---------------------------------------------------------------------------------------------

type GoalSpec = { key: SyntheticAgentKey; actual: number; awaiting: number; overdue: number; noGoal?: boolean };
const GOAL_SPECS: GoalSpec[] = [
  { key: "alex", actual: 64, awaiting: 1, overdue: 8 },
  { key: "jamie", actual: 108, awaiting: 0, overdue: 2 },
  { key: "sam", actual: 83, awaiting: 2, overdue: 3 },
  { key: "casey", actual: 22, awaiting: 0, overdue: 5 },
  { key: "drew", actual: 0, awaiting: 0, overdue: 0, noGoal: true },
];

function repDay(spec: GoalSpec): SalesOutreachRepDayDto {
  const agent = SYNTHETIC_AGENTS[spec.key];
  const goal = spec.noGoal ? 0 : 100;
  return {
    agent_id: agent.id,
    agent_name: agent.name,
    reviewed_link: true,
    goal_state: spec.noGoal ? "no_goal_today" : "goal",
    goal_label: spec.noGoal ? "No goal today" : null,
    goal,
    goal_provenance: {
      source: "configuration",
      basis: spec.noGoal ? "override" : "default_goal",
      configuration_version: CONFIG_VERSION,
      roster_version: ROSTER_VERSION,
      scheduled_working_day: true,
      override: spec.noGoal ? { business_date: SYNTHETIC_BUSINESS_DAY, goal: 0, reason: "absence" } : null,
    },
    count_scope: "all_outbound",
    count_scope_label: "Outbound calls",
    actual_confirmed: spec.actual,
    actual_awaiting_confirmation: spec.awaiting,
    actual_basis: spec.actual > 0 ? "projection" : "no_activity_recorded",
    remaining: Math.max(0, goal - spec.actual),
    progress: goal > 0 ? Math.min(1, Number((spec.actual / goal).toFixed(4))) : null,
    goal_reached: goal > 0 ? spec.actual >= goal : false,
    other_outbound: { count: spec.key === "sam" ? 4 : 0, label: "Other outbound" },
    coverage: { state: "complete", known_complete_through: "2026-10-01T15:59:00.000Z", required_through: "2026-10-01T15:55:00.000Z", gaps: [] },
    unknown_reason: null,
    projection_revision: 57,
    computed_as_of: "2026-10-01T15:59:30.000Z",
  };
}

export function syntheticRepDays(input: { role: SalesOutreachRole; agentId?: string | null; variant?: SyntheticVariant }): SalesOutreachRepDaysDto {
  const variant = input.variant ?? "desk";
  const scopeAgent = input.role === "rep" ? SYNTHETIC_REP_AGENT_ID : (input.agentId ?? null);
  const reps = GOAL_SPECS.map(repDay).filter((row) => !scopeAgent || row.agent_id === scopeAgent);
  return {
    ...syntheticCommonRead(input.role, scopeAgent, variant),
    business_day: SYNTHETIC_BUSINESS_DAY,
    is_today: true,
    goal_metrics_enabled: true,
    count_scope: "all_outbound",
    reps,
    unknown_reason: null,
  };
}

const cadenceOff = { value: null, unknown_reason: "cadence_disabled" as const };

export function syntheticTeam(input: { role: Exclude<SalesOutreachRole, "rep">; variant?: SyntheticVariant }): SalesOutreachTeamDto {
  const variant = input.variant ?? "desk";
  const enforcement = variant === "desk";
  const rows: SalesOutreachDailyCallGoalRow[] = GOAL_SPECS.map((spec) => ({
    ...repDay(spec),
    overdue_leads: enforcement ? { value: spec.overdue, unknown_reason: null } : cadenceOff,
  }));
  const goalReps = GOAL_SPECS.filter((spec) => !spec.noGoal);
  const actual = GOAL_SPECS.reduce((sum, spec) => sum + spec.actual, 0);
  const goal = goalReps.length * 100;
  return {
    ...syntheticCommonRead(input.role, null, variant),
    business_day: SYNTHETIC_BUSINESS_DAY,
    is_today: true,
    goal_metrics_enabled: true,
    goals: {
      count_scope: "all_outbound",
      count_scope_label: "Outbound calls",
      outbound_calls: { actual, goal, progress: Math.min(1, Number((actual / goal).toFixed(4))), incomplete: false, pending_agent_ids: [], unknown_reason: null },
      reps_at_goal: { count: goalReps.filter((spec) => spec.actual >= 100).length, of: goalReps.length, pending: 0 },
      other_outbound_total: 4,
      roster_size: GOAL_SPECS.length,
    },
    goals_unknown_reason: null,
    daily_call_goals: rows,
    distinct_overdue_leads: enforcement ? { value: 18, unknown_reason: null } : cadenceOff,
    quoted_overdue_leads: enforcement ? { value: 7, unknown_reason: null } : cadenceOff,
    unassigned: { count: 2, overdue: enforcement ? { value: 0, unknown_reason: null } : cadenceOff },
    leads_needing_attention: enforcement
      ? { rows: syntheticQueueRows().filter((row) => row.status_flags.needs_contact).slice(0, 10), limit: 10, unknown_reason: null }
      : { rows: null, limit: 10, unknown_reason: "cadence_disabled" },
    cadence_exposure: enforcement ? "enforcement" : null,
    readiness: input.role === "owner" ? { configuration_state: "active", activation_blockers: [] } : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Queue rows
// ---------------------------------------------------------------------------------------------

function channel(
  required: number | null,
  done: number | null,
  status: SalesOutreachChannelDto["status"],
  dueAt: string | null,
  oldest: string | null = null,
): SalesOutreachChannelDto {
  return {
    required,
    verified_completed: done,
    remaining: required === null || done === null ? null : Math.max(0, required - done),
    due_at: dueAt,
    oldest_actionable_due_at: oldest,
    status,
    completion_kind: status === "completed" ? "verified" : null,
    coverage: { state: "complete", known_complete_through: "2026-10-01T15:59:00.000Z", gaps: [] },
    blocked_reason: null,
  };
}

const TODAY_CLOSE = "2026-10-02T00:00:00.000Z"; // 20:00 New York on Oct 1
const TODAY_NOON = "2026-10-01T16:00:00.000Z";

type RowSpec = {
  n: number;
  job: string | null;
  phone: string;
  name: string;
  agent: SyntheticAgentKey | null;
  workflow: "new" | "quoted" | "discretion";
  priority: string | null;
  received: string;
  last: string | null;
  move: string | null;
  call: SalesOutreachChannelDto;
  sms: SalesOutreachChannelDto;
  overdue?: boolean;
  needsContact?: boolean;
};

export function syntheticSubjectId(n: number): string {
  return `6650a1b2c3d4e5f6071a${n.toString(16).padStart(4, "0")}`;
}

const ROW_SPECS: RowSpec[] = [
  {
    n: 1, job: "P5561042", phone: "(512) 555-0142", name: "Taylor Brooks", agent: "alex", workflow: "new", priority: "0",
    received: "2026-09-29T13:20:00.000Z", last: "2026-09-29T18:40:00.000Z", move: "2026-10-24",
    call: channel(3, 0, "overdue", TODAY_CLOSE, "2026-09-29T16:00:00.000Z"),
    sms: channel(1, 0, "overdue", TODAY_CLOSE, "2026-09-30T00:00:00.000Z"),
    overdue: true,
  },
  {
    n: 2, job: "P5562081", phone: "(303) 555-0181", name: "Avery Stone", agent: "alex", workflow: "quoted", priority: "1",
    received: "2026-09-18T15:00:00.000Z", last: "2026-09-25T17:00:00.000Z", move: "2026-10-15",
    call: channel(1, 0, "overdue", TODAY_CLOSE, "2026-09-26T00:00:00.000Z"),
    sms: channel(0, 0, "not_required", null),
    overdue: true,
  },
  {
    n: 3, job: "P5563091", phone: "(415) 555-0191", name: "Quinn Harper", agent: "casey", workflow: "new", priority: "0",
    received: "2026-09-28T16:30:00.000Z", last: "2026-09-28T19:05:00.000Z", move: "2026-11-02",
    call: channel(2, 0, "overdue", TODAY_CLOSE, "2026-09-30T00:00:00.000Z"),
    sms: channel(1, 0, "overdue", TODAY_CLOSE, "2026-09-30T00:00:00.000Z"),
    overdue: true,
  },
  {
    n: 4, job: "P5563155", phone: "(720) 555-0155", name: "Casey Wong", agent: "jamie", workflow: "new", priority: "0",
    received: "2026-09-30T14:10:00.000Z", last: "2026-09-30T20:30:00.000Z", move: "2026-10-12",
    call: channel(3, 1, "overdue", TODAY_CLOSE, TODAY_NOON),
    sms: channel(1, 1, "completed", null),
    overdue: true,
  },
  {
    n: 5, job: "P5561043", phone: "(713) 555-0143", name: "Morgan Diaz", agent: "alex", workflow: "new", priority: null,
    received: "2026-10-01T13:05:00.000Z", last: "2026-10-01T13:10:00.000Z", move: "2026-10-30",
    call: channel(3, 1, "due", TODAY_CLOSE),
    sms: channel(1, 0, "due", TODAY_CLOSE),
  },
  {
    n: 6, job: "P5563120", phone: "(617) 555-0120", name: "Drew Patel", agent: "sam", workflow: "quoted", priority: "1",
    received: "2026-09-20T14:00:00.000Z", last: "2026-09-30T15:20:00.000Z", move: "2026-10-20",
    call: channel(1, 0, "due", TODAY_CLOSE),
    sms: channel(0, 0, "not_required", null),
  },
  {
    n: 7, job: "P5563200", phone: "(404) 555-0200", name: "Jesse Kim", agent: null, workflow: "new", priority: "0",
    received: "2026-10-01T14:40:00.000Z", last: null, move: null,
    call: channel(3, 0, "due", TODAY_CLOSE),
    sms: channel(1, 0, "due", TODAY_CLOSE),
  },
  {
    n: 8, job: null, phone: "(305) 555-0210", name: "Sam Rivera", agent: "casey", workflow: "new", priority: "0",
    received: "2026-10-01T15:10:00.000Z", last: null, move: "2026-10-09",
    call: channel(3, 0, "due", TODAY_CLOSE),
    sms: channel(1, 0, "due", TODAY_CLOSE),
  },
  {
    n: 9, job: "P5561044", phone: "(602) 555-0144", name: "Jordan Lee", agent: "alex", workflow: "new", priority: "0",
    received: "2026-09-28T14:00:00.000Z", last: "2026-09-30T19:00:00.000Z", move: "2026-10-18",
    call: channel(2, 1, "due", TODAY_CLOSE),
    sms: channel(0, 0, "not_required", null),
  },
  {
    n: 10, job: "P5561045", phone: "(206) 555-0145", name: "Riley Chen", agent: "alex", workflow: "new", priority: "0",
    received: "2026-09-24T15:00:00.000Z", last: "2026-09-30T20:00:00.000Z", move: "2026-11-05",
    call: channel(1, 0, "due", TODAY_CLOSE),
    sms: channel(0, 0, "scheduled", "2026-10-03T00:00:00.000Z"),
  },
  {
    n: 11, job: "P5563310", phone: "(512) 555-0310", name: "Harper Cole", agent: null, workflow: "quoted", priority: "1",
    received: "2026-09-22T14:00:00.000Z", last: "2026-09-29T16:00:00.000Z", move: "2026-10-28",
    call: channel(1, 0, "due", TODAY_CLOSE),
    sms: channel(0, 0, "not_required", null),
  },
  {
    n: 12, job: "P5561050", phone: "(512) 555-0150", name: "Parker Gray", agent: "alex", workflow: "quoted", priority: "1",
    received: "2026-09-21T14:00:00.000Z", last: "2026-09-30T18:00:00.000Z", move: "2026-11-12",
    call: channel(0, 0, "scheduled", "2026-10-06T00:00:00.000Z"),
    sms: channel(0, 0, "not_required", null),
    needsContact: false,
  },
];

function toRow(spec: RowSpec, variant: SyntheticVariant): SalesOutreachQueueRowDto {
  const agentId = spec.agent ? SYNTHETIC_AGENTS[spec.agent].id : null;
  const needsContact = spec.needsContact ?? true;
  const dueTimes = [spec.call.due_at, spec.sms.due_at].filter((value): value is string => value !== null).sort();
  const oldest = [spec.call.oldest_actionable_due_at, spec.sms.oldest_actionable_due_at].filter((value): value is string => value !== null).sort();
  return {
    subject_id: syntheticSubjectId(spec.n),
    job_no: spec.job,
    job_pending: spec.job === null,
    phone: spec.phone,
    name: spec.name,
    move_date: spec.move,
    move_date_review: spec.move === null ? "unknown" : null,
    priority_raw: spec.priority,
    workflow: spec.workflow,
    subject_status: "active",
    assigned_agent_id: agentId,
    assigned_agent_name: agentName(agentId),
    received_at: spec.received,
    last_interaction_at: spec.last,
    oldest_actionable_due_at: oldest[0] ?? null,
    next_action_due_at: dueTimes[0] ?? null,
    call: spec.call,
    sms: spec.sms,
    status_flags: {
      needs_contact: needsContact,
      overdue: Boolean(spec.overdue),
      blocked: false,
      pending: false,
      move_date_passed: false,
      move_date_unknown: spec.move === null,
      job_pending: spec.job === null,
      advisory_cooldown: false,
    },
    exposure: variant === "desk" ? "enforcement" : "shadow",
    computed_as_of: "2026-10-01T15:59:30.000Z",
    publication_revision: 50 + spec.n,
  };
}

/** Every synthetic queue row in urgency order (overdue first, then next due), as the server would order it. */
export function syntheticQueueRows(variant: SyntheticVariant = "desk"): SalesOutreachQueueRowDto[] {
  return ROW_SPECS.map((spec) => toRow(spec, variant));
}

// ---------------------------------------------------------------------------------------------
// Selected-lead detail
// ---------------------------------------------------------------------------------------------

export function syntheticDetail(input: { subjectId: string; role: SalesOutreachRole; variant?: SyntheticVariant }): SalesOutreachDetailDto | null {
  const variant = input.variant ?? "desk";
  const row = syntheticQueueRows(variant).find((candidate) => candidate.subject_id === input.subjectId);
  if (!row) return null;
  const spec = ROW_SPECS.find((candidate) => syntheticSubjectId(candidate.n) === input.subjectId)!;
  const enforcement = variant === "desk";
  const scheduleDay = Math.max(1, Math.round((Date.parse(SYNTHETIC_BUSINESS_DAY) - Date.parse(spec.received.slice(0, 10))) / 86_400_000) + 1);
  const quoted = spec.workflow === "quoted";
  const callEvents = spec.last
    ? [
        {
          event_id: syntheticSubjectId(500 + spec.n),
          channel: "call" as const,
          direction: "outbound" as const,
          kind: "outbound_attempt",
          event_at: spec.last,
          business_date: spec.last.slice(0, 10),
          verification: "confirmed",
          exclusion_reason: null,
          actor_agent_id: row.assigned_agent_id,
          actor_agent_name: row.assigned_agent_name,
          outbound_goal_credit: true,
          restricted_at_contact: false,
        },
        {
          event_id: syntheticSubjectId(600 + spec.n),
          channel: "sms" as const,
          direction: "outbound" as const,
          kind: "sms_sent",
          event_at: new Date(Date.parse(spec.last) - 5 * 3_600_000 - 25 * 60_000).toISOString(),
          business_date: spec.last.slice(0, 10),
          verification: "confirmed",
          exclusion_reason: null,
          actor_agent_id: row.assigned_agent_id,
          actor_agent_name: row.assigned_agent_name,
          outbound_goal_credit: false,
          restricted_at_contact: false,
        },
      ]
    : [];
  return {
    ...syntheticCommonRead(input.role, input.role === "rep" ? SYNTHETIC_REP_AGENT_ID : null, variant),
    subject: {
      subject_id: row.subject_id,
      lead_model: "FormLead",
      status: "active",
      review_reasons: [],
      received_at: spec.received,
      received_date: spec.received.slice(0, 10),
      received_quality: "instant",
      enrollment: { cohort_id: "backfill:2026-09-30", kind: "expansion", enrolled_at: "2026-09-30T12:00:00.000Z", activation_at: "2026-09-30T12:00:00.000Z" },
      job_no: row.job_no,
      job_pending: row.job_pending,
      phone: row.phone,
      name: row.name,
      move_date: row.move_date,
      move_date_review: row.move_date_review,
    },
    priority: {
      raw: spec.priority,
      basis: spec.priority === null ? "intake_default" : "accepted_observation",
      accepted_at: spec.priority === null ? null : spec.received,
      uncertain: false,
    },
    assignment: {
      assigned_agent_id: row.assigned_agent_id,
      assigned_agent_name: row.assigned_agent_name,
      unassigned: row.assigned_agent_id === null,
      assignment_revision: 2,
      lead_receiver_agent_id: row.assigned_agent_id,
      in_sync: true,
    },
    plan: quoted
      ? {
          plan_revision: 1,
          active: {
            plan_id: syntheticSubjectId(700 + spec.n),
            kind: "quoted_date",
            status: "active",
            selected_date: spec.n === 12 ? "2026-10-05" : "2026-09-25",
            appointment_at: null,
            due_at: spec.n === 12 ? "2026-10-06T00:00:00.000Z" : "2026-09-26T00:00:00.000Z",
            window_minutes: null,
            effective_at: "2026-09-22T15:00:00.000Z",
            ended_at: null,
            end_reason: null,
            revision: 1,
          },
          history: [],
        }
      : { plan_revision: 0, active: null, history: [] },
    policy: {
      projection_state: enforcement ? "current" : "cadence_disabled",
      exposure: enforcement ? "enforcement" : null,
      enforcement_labels: enforcement,
      workflow: spec.workflow,
      engine_state: quoted ? "quoted_followup" : "new_cadence",
      policy_version: "final-policy-2026-10-03-v1",
      configuration_version: CONFIG_VERSION,
      schedule_day: quoted ? null : scheduleDay,
      period: {
        period_id: syntheticSubjectId(800 + spec.n),
        workflow: spec.workflow,
        start_kind: "activation",
        priority: spec.priority,
        started_at: "2026-09-30T12:00:00.000Z",
      },
      quoted: quoted
        ? { selected_date: spec.n === 12 ? "2026-10-05" : "2026-09-25", first_required_date: spec.n === 12 ? "2026-10-05" : "2026-09-25", basis: "selected_date", plan_id: syntheticSubjectId(700 + spec.n) }
        : null,
      callback: null,
      initial_response: quoted ? null : { due_at: new Date(Date.parse(spec.received) + 30 * 60_000).toISOString(), outcome: "fulfilled", fulfilled_at: spec.last },
      advisory_cooldown: { warning: false, unsuccessful_attempts: spec.last ? 1 : 0 },
      catch_up: { call: { outstanding: Boolean(spec.overdue), missed_count: spec.overdue ? 2 : 0, state: spec.overdue ? "one_per_channel" : null }, sms: { outstanding: false, missed_count: 0, state: null } },
      blocked_until: { call: null, sms: null },
      explanation: quoted
        ? [{ code: "quoted_daily_call_from_selected_date", value: spec.n === 12 ? "2026-10-05" : "2026-09-25" }]
        : [
            { code: "new_schedule_day", value: scheduleDay },
            { code: "new_calls_required_today", value: row.call.required },
            { code: "new_sms_required_today", value: row.sms.required },
          ],
    },
    requirements: { call: row.call, sms: row.sms },
    status_flags: row.status_flags,
    oldest_actionable_due_at: row.oldest_actionable_due_at,
    next_action_due_at: row.next_action_due_at,
    last_interaction_at: row.last_interaction_at,
    shadow_labels: null,
    history: {
      window_history: [
        {
          business_date: "2026-09-30",
          schedule_day: quoted ? null : Math.max(1, scheduleDay - 1),
          workflow: spec.workflow,
          closed_date: false,
          call: { required: quoted ? 1 : 3, completed: 1, missed: enforcement ? (spec.overdue ? 2 : 0) : null, waived: 0, superseded: 0, open: 0 },
          sms: { required: quoted ? 0 : 1, completed: quoted ? 0 : 1, missed: enforcement ? 0 : null, waived: 0, superseded: 0, open: 0 },
        },
      ],
      window_summary: { dates: 1, call_missed: enforcement ? (spec.overdue ? 2 : 0) : null, sms_missed: enforcement ? 0 : null },
      missed_labels_hidden: !enforcement,
      contact_events: callEvents,
      contact_events_truncated: false,
      assignment_changes: row.assigned_agent_id ? [{ applied_at: "2026-09-29T13:25:00.000Z", from_agent_id: null, to_agent_id: row.assigned_agent_id }] : [],
    },
    restrictions: [],
    computed_as_of: row.computed_as_of,
    publication_revision: row.publication_revision,
  };
}

// ---------------------------------------------------------------------------------------------
// Owner settings: configuration, restrictions, enrollment
// ---------------------------------------------------------------------------------------------

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export function syntheticConfigurationValue(variant: SyntheticVariant = "desk"): SalesOutreachConfigurationValue {
  const enforcement = variant === "desk";
  return {
    controls: {
      desk_enabled: true,
      cadence_shadow_enabled: false,
      cadence_enforcement_enabled: enforcement,
      rep_sms_capture_enabled: enforcement,
      goal_metrics_enabled: true,
    },
    transition: {
      legacy_planning_paused: false,
      migrated_cohort_id: enforcement ? "backfill:2026-09-30" : null,
      activation_at: enforcement ? "2026-09-30T12:00:00.000Z" : null,
      intake_admission_enabled: enforcement,
      intake_admission_at: enforcement ? "2026-09-30T12:00:00.000Z" : null,
      intake_admission_watermark: null,
      backfill_lookback_days: 90,
      backfill_include_upcoming_moves: true,
    },
    cadence: {
      policy_version: "final-policy-2026-10-03-v1",
      approval_ref: "owner-session-2026-10-03-FINAL-01",
      timezone: "America/New_York",
      calendar_mode: "new_york_calendar_date",
      working_days: ALL_WEEKDAYS.map((iso_weekday) => ({ iso_weekday, open_minute: 480, close_minute: 1200 })),
      holidays: [],
      initial_response_working_minutes: 30,
      new_days_1_3_calls: { required: 2, optional: 1 },
      new_call_slots: [
        { from_day: 1, to_day: 5, deadline_minutes: [720, 1200] },
        { from_day: 6, to_day: null, deadline_minutes: [1200] },
      ],
      new_call_min_spacing_minutes: 60,
      sms_cutoff_minute: 1200,
      sms_mode: "fixed_sequence",
      sms_sequence: { initial_days: [1, 2, 3], repeat_from_day: 6, repeat_every_days: 3 },
      quoted_open_minute: 480,
      quoted_due_minute: 1200,
      quoted_same_day_cutoff_minute: 1170,
      return_to_new_mode: "original_age_partial_day",
      late_arrival_rule: { two_calls_before_minute: 1080, one_call_through_minute: 1170, sms_through_minute: 1170 },
      catchup_mode: "one_per_channel",
      restriction_clock_rule: "waive_pause_resume_next_working_date",
      callback_window_minutes: 15,
      callback_mode: "explicit_human_appointment",
      cooldown_warning_threshold: 3,
      cooldown_warning_hours: 24,
      cooldown_mode: "advisory_warning",
      assignment_timeline_rule: "continuous_timeline",
      intake_default_rule: { website_form: "new", best_relocation: "new", ringcentral_call: "new", manual: "new", granot_created: "review" },
      uncertain_priority_rule: "retain_last_verified",
      priority_map: {
        codes: [
          { code: "0", workflow: "new", closure_reason: null },
          { code: "1", workflow: "quoted", closure_reason: null },
          { code: "3", workflow: "discretion", closure_reason: null },
          { code: "5", workflow: "closed", closure_reason: "granot_booked" },
          { code: "7", workflow: "closed", closure_reason: "crm_bad_disposition" },
          { code: "8", workflow: "closed", closure_reason: "crm_dead_disposition" },
        ],
        unmapped_workflow: "none",
        official_booking_workflow: "closed",
      },
      transition_day_rule: "partial_day_allowance",
      move_date_rule: "review_label_only",
      lead_eligibility_rule: "no_sync_viable_duplicates_excluded",
      precedence_rule: "closure_restriction_schedule_priority",
    },
    evidence: {
      qualifying_call_rule: "terminal_call_log_attempt",
      goal_rep_rule: "reviewed_initiator_only",
      helping_rep_rule: "reviewed_helper_cadence_only",
      sms_success_rule: "sent_or_delivered",
      sms_failure_correction_rule: "revoke_on_confirmed_failure",
      roster_version: ROSTER_VERSION,
      event_time_rule: "outbound_start_inbound_handled_sms_sent",
      operating_window_rule: "goal_full_date_cadence_open_hours",
      originating_inbound_rule: "unique_association_initial_response",
      restricted_contact_rule: "history_only_zero_credit",
    },
    migration: {
      paused: true,
      batch_size: 25,
      batch_ceiling: 100,
      interval_seconds: 10,
      max_batch_bytes: null,
      max_batch_ms: null,
      min_oplog_window_seconds: null,
      warning_oplog_window_seconds: null,
      max_replication_lag_seconds: null,
      max_consumer_lag_seconds: null,
      max_incremental_write_bytes_per_second: null,
    },
    goals: {
      roster_version: ROSTER_VERSION,
      rep_work_schedules: Object.values(SYNTHETIC_AGENTS).map((agent) => ({ agent_id: agent.id, working_days: ALL_WEEKDAYS, scheduled_goal: null })),
      default_scheduled_goal: 100,
      effective_day_overrides: [{ agent_id: SYNTHETIC_AGENTS.drew.id, business_date: SYNTHETIC_BUSINESS_DAY, goal: 0, reason: "absence" }],
      zero_goal_rule: "no_goal_today_excluded_from_denominator",
    },
  };
}

export function syntheticConfiguration(variant: SyntheticVariant = "desk"): SalesOutreachConfigurationReadDto {
  return {
    contract_version: "sod-v1",
    as_of: SYNTHETIC_AS_OF,
    timezone: "America/New_York",
    configuration_state: "active",
    revision: CONFIG_REVISION,
    version: CONFIG_VERSION,
    content_hash: "c".repeat(64),
    approval_ref: "owner-session-2026-10-03-FINAL-01",
    updated_at: "2026-09-30T12:00:00.000Z",
    updated_by: "owner@example.test",
    unavailable_reason: null,
    value: syntheticConfigurationValue(variant),
    activation_blockers: [],
  };
}

export function syntheticRestrictions(): SalesOutreachRestrictionsResponse {
  const row = (n: number, overrides: Partial<SalesOutreachRestrictionsResponse["restrictions"][number]> = {}) => ({
    restriction_id: syntheticSubjectId(900 + n),
    contact_number_id: syntheticSubjectId(950 + n),
    channels: ["call", "sms"] as Array<"call" | "sms">,
    origin: "intelligence" as const,
    state: "active" as const,
    effective_at: "2026-09-20T12:00:00.000Z",
    until: null,
    reason: null,
    needs_review: true,
    confirmed_at: null,
    confirmed_by: null,
    resolved_at: null,
    resolved_by: null,
    resolution_reason: null,
    revision: 1,
    ...overrides,
  });
  return {
    contract_version: "sod-v1",
    as_of: SYNTHETIC_AS_OF,
    state: "active",
    restrictions: [
      row(1),
      row(2, { channels: ["sms"] }),
      row(3, { origin: "owner", needs_review: false, reason: "Customer asked for email only", confirmed_at: "2026-09-25T15:00:00.000Z", confirmed_by: "owner@example.test", revision: 2 }),
    ],
    next_cursor: null,
  };
}

export function syntheticEnrollmentCandidates(partition: SalesOutreachEnrollmentCandidatesDto["partition"] = "older"): SalesOutreachEnrollmentCandidatesDto {
  return {
    contract_version: "sod-v1",
    as_of: SYNTHETIC_AS_OF,
    partition,
    scope: { mode: "backfill_scope", today: SYNTHETIC_BUSINESS_DAY, cutoff_date: "2026-07-03", lookback_days: 90, include_upcoming_moves: true },
    items: [
      { lead: { model: "FormLead", id: syntheticSubjectId(1001) }, partition, reason: partition === "older" ? "received_before_lookback" : "synthetic", workflow: "new", priority_raw: "0", received_date: "2026-06-12", move_date: "2026-06-30", job_no: "P5550012", name: "Rowan Ellis" },
      { lead: { model: "CallLead", id: syntheticSubjectId(1002) }, partition, reason: partition === "older" ? "received_before_lookback" : "synthetic", workflow: "quoted", priority_raw: "1", received_date: "2026-05-28", move_date: null, job_no: "P5550027", name: "Emery Fox" },
    ],
    next_cursor: null,
    scanned: 2,
  };
}

export function syntheticEnrollmentReport(): SalesOutreachEnrollmentReportDto {
  return {
    contract_version: "sod-v1",
    mode: "report",
    as_of: SYNTHETIC_AS_OF,
    kind: "expansion",
    cohort_id: "backfill:2026-10-01",
    configuration_version: CONFIG_VERSION,
    configuration_revision: CONFIG_REVISION,
    algorithm_version: "enroll-v1",
    scope: { mode: "backfill_scope", today: SYNTHETIC_BUSINESS_DAY, cutoff_date: "2026-07-03", lookback_days: 90, include_upcoming_moves: true },
    counts: { in_scope: 2, older: 2, already_enrolled: 12, closed: 4, excluded: 1, review: 1, not_new_or_quoted: 3 },
    reasons: { received_time_missing: 1 },
    lead_refs: [
      { model: "FormLead", id: syntheticSubjectId(1101) },
      { model: "CallLead", id: syntheticSubjectId(1102) },
    ],
    manifest_hash: "a".repeat(64),
    review: [],
    review_truncated: false,
    writes: 0,
  };
}
