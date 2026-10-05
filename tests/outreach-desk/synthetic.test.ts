import assert from "node:assert/strict";
import test from "node:test";
import {
  salesOutreachCapabilitiesSchema,
  salesOutreachConfigurationReadSchema,
  salesOutreachDetailSchema,
  salesOutreachEnrollmentCandidatesSchema,
  salesOutreachEnrollmentReportSchema,
  salesOutreachEnrollmentVerifySchema,
  salesOutreachEnvelope,
  salesOutreachErrorEnvelopeSchema,
  salesOutreachAssignmentResponseSchema,
  salesOutreachDayOverrideResponseSchema,
  salesOutreachPlanCommandResponseSchema,
  salesOutreachQueueSchema,
  salesOutreachRepDaysSchema,
  salesOutreachRestrictionCommandResponseSchema,
  salesOutreachRestrictionsResponseSchema,
  salesOutreachTeamSchema,
  salesOutreachConfigurationPatchResponseSchema,
} from "../../lib/api/salesOutreach";
import { mockSalesOutreachResponse, type MockSalesOutreachInput } from "../../lib/api/salesOutreachMock";
import {
  SYNTHETIC_AGENTS,
  SYNTHETIC_REP_AGENT_ID,
  syntheticCapabilities,
  syntheticConfiguration,
  syntheticDetail,
  syntheticQueueRows,
  syntheticRepDays,
  syntheticSubjectId,
  syntheticTeam,
} from "./fixtures/synthetic";

const VARIANTS = ["desk", "m1"] as const;

test("every synthetic payload validates against the admin DTOs, in both variants", () => {
  for (const variant of VARIANTS) {
    for (const role of ["owner", "manager", "rep"] as const) {
      salesOutreachCapabilitiesSchema.parse(syntheticCapabilities(role, variant));
      salesOutreachRepDaysSchema.parse(syntheticRepDays({ role, variant }));
    }
    salesOutreachTeamSchema.parse(syntheticTeam({ role: "owner", variant }));
    salesOutreachTeamSchema.parse(syntheticTeam({ role: "manager", variant }));
    for (const row of syntheticQueueRows(variant)) salesOutreachDetailSchema.parse(syntheticDetail({ subjectId: row.subject_id, role: "owner", variant }));
    salesOutreachConfigurationReadSchema.parse(syntheticConfiguration(variant));
  }
});

test("the synthetic desk echoes the references: 277/400, 1 of 4 at goal, 18 overdue, 7 quoted with gaps, a No-goal rep", () => {
  const team = syntheticTeam({ role: "owner" });
  assert.equal(team.goals?.outbound_calls.actual, 277);
  assert.equal(team.goals?.outbound_calls.goal, 400);
  assert.deepEqual(team.goals?.reps_at_goal, { count: 1, of: 4, pending: 0 });
  assert.equal(team.distinct_overdue_leads.value, 18);
  assert.equal(team.quoted_overdue_leads.value, 7);
  const jamie = team.daily_call_goals!.find((row) => row.agent_id === SYNTHETIC_AGENTS.jamie.id)!;
  assert.equal(jamie.actual_confirmed, 108);
  assert.equal(jamie.progress, 1, "108/100 is capped");
  assert.equal(jamie.remaining, 0);
  const drew = team.daily_call_goals!.find((row) => row.agent_id === SYNTHETIC_AGENTS.drew.id)!;
  assert.equal(drew.goal_label, "No goal today");
  assert.ok(syntheticQueueRows().some((row) => row.job_pending && row.job_no === null), "a Job number pending row");
  assert.ok(syntheticQueueRows().some((row) => row.assigned_agent_id === null), "an Unassigned row");
  assert.ok(syntheticQueueRows().some((row) => !row.status_flags.needs_contact), "an All active-only row");
});

test("the M1 variant serves goal parts only: overdue metrics unavailable, no attention rows", () => {
  const team = syntheticTeam({ role: "owner", variant: "m1" });
  assert.equal(team.distinct_overdue_leads.value, null);
  assert.equal(team.distinct_overdue_leads.unknown_reason, "cadence_disabled");
  assert.equal(team.leads_needing_attention.rows, null);
  assert.equal(team.daily_call_goals![0]!.overdue_leads.unknown_reason, "cadence_disabled");
  const queue = call({ role: "owner", method: "GET", path: "queue", variant: "m1" });
  assert.equal(queue.status, 503);
  assert.equal((queue.body as { code: string }).code, "PROJECTION_PENDING");
});

function call(input: MockSalesOutreachInput) {
  return mockSalesOutreachResponse(input);
}
function refusal(input: MockSalesOutreachInput) {
  const response = call(input);
  return { status: response.status, code: salesOutreachErrorEnvelopeSchema.parse(response.body).code };
}
function data<T>(input: MockSalesOutreachInput, schema: { parse: (value: unknown) => { data: T } }): T {
  const response = call(input);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return schema.parse(response.body).data;
}

test("the mock serves every read with valid envelopes", () => {
  data({ role: "owner", method: "GET", path: "/api/v1/admin/sales-outreach/capabilities" }, salesOutreachEnvelope(salesOutreachCapabilitiesSchema));
  data({ role: "owner", method: "GET", path: "team" }, salesOutreachEnvelope(salesOutreachTeamSchema));
  const one = data({ role: "manager", method: "GET", path: "rep-days", query: { agent_id: SYNTHETIC_AGENTS.sam.id } }, salesOutreachEnvelope(salesOutreachRepDaysSchema));
  assert.deepEqual(one.reps?.map((rep) => rep.agent_id), [SYNTHETIC_AGENTS.sam.id]);
  const mine = data({ role: "rep", method: "GET", path: "queue" }, salesOutreachEnvelope(salesOutreachQueueSchema));
  assert.ok(mine.rows.length > 0);
  assert.ok(mine.rows.every((row) => row.assigned_agent_id === SYNTHETIC_REP_AGENT_ID), "a Rep sees only its assignment");
  assert.ok(mine.rows.every((row) => row.status_flags.needs_contact), "Needs contact is the default state");
  const unassigned = data({ role: "manager", method: "GET", path: "queue?unassigned=true&state=all_active" }, salesOutreachEnvelope(salesOutreachQueueSchema));
  assert.ok(unassigned.rows.length > 0 && unassigned.rows.every((row) => row.assigned_agent_id === null));
  const searched = data({ role: "owner", method: "GET", path: "queue", query: "search=P556104&state=all_active" }, salesOutreachEnvelope(salesOutreachQueueSchema));
  assert.ok(searched.rows.every((row) => row.job_no?.startsWith("P556104")));
  const paged = data({ role: "owner", method: "GET", path: "queue", query: "limit=3" }, salesOutreachEnvelope(salesOutreachQueueSchema));
  assert.equal(paged.rows.length, 3);
  assert.equal(paged.has_more, true);
  const next = data({ role: "owner", method: "GET", path: "queue", query: `limit=3&cursor=${paged.next_cursor}` }, salesOutreachEnvelope(salesOutreachQueueSchema));
  assert.notEqual(next.rows[0]!.subject_id, paged.rows[0]!.subject_id);
  assert.equal(next.counts.projection_pending, null, "counts are first-page only");
  data({ role: "rep", method: "GET", path: `outreach/${syntheticSubjectId(1)}` }, salesOutreachEnvelope(salesOutreachDetailSchema));
  data({ role: "owner", method: "GET", path: "configuration" }, salesOutreachEnvelope(salesOutreachConfigurationReadSchema));
  data({ role: "owner", method: "GET", path: "restrictions" }, salesOutreachEnvelope(salesOutreachRestrictionsResponseSchema));
  data({ role: "owner", method: "GET", path: "enrollment/candidates?partition=older" }, salesOutreachEnvelope(salesOutreachEnrollmentCandidatesSchema));
  data({ role: "owner", method: "POST", path: "enrollment/report", body: { selection: { mode: "backfill_scope" } } }, salesOutreachEnvelope(salesOutreachEnrollmentReportSchema));
  data({ role: "owner", method: "POST", path: "enrollment/verify", body: { run_key: "k" } }, salesOutreachEnvelope(salesOutreachEnrollmentVerifySchema));
});

test("the mock answers commands with valid responses and refuses stale revisions", () => {
  const quoted = syntheticSubjectId(2);
  data({ role: "rep", method: "PATCH", path: `outreach/${quoted}/quoted-followup`, body: { expected_revision: 1, period_id: syntheticSubjectId(802), selected_date: "2026-10-05" } }, salesOutreachEnvelope(salesOutreachPlanCommandResponseSchema));
  data({ role: "manager", method: "PATCH", path: `outreach/${quoted}/callback`, body: { operation: "set", expected_revision: 1, appointment_at: "2026-10-02T19:00:00.000Z", replace_active_plan: true } }, salesOutreachEnvelope(salesOutreachPlanCommandResponseSchema));
  assert.deepEqual(refusal({ role: "rep", method: "PATCH", path: `outreach/${quoted}/quoted-followup`, body: { expected_revision: 0 } }), { status: 409, code: "REVISION_CONFLICT" });
  data({ role: "manager", method: "PATCH", path: `outreach/${quoted}/assignment`, body: { expected_revision: 2, agent_id: SYNTHETIC_AGENTS.sam.id } }, salesOutreachEnvelope(salesOutreachAssignmentResponseSchema));
  data({ role: "manager", method: "PATCH", path: `goals/${SYNTHETIC_AGENTS.sam.id}/day-override`, body: { expected_revision: 3, business_date: "2026-10-02", goal: 0, reason: "absence" } }, salesOutreachEnvelope(salesOutreachDayOverrideResponseSchema));
  data({ role: "owner", method: "PATCH", path: "configuration", body: { expected_revision: 3, value: {} } }, salesOutreachEnvelope(salesOutreachConfigurationPatchResponseSchema));
  const restriction = syntheticSubjectId(901);
  data({ role: "owner", method: "POST", path: `restrictions/${restriction}/confirm`, body: { expected_revision: 1 } }, salesOutreachEnvelope(salesOutreachRestrictionCommandResponseSchema));
  data({ role: "owner", method: "POST", path: `restrictions/${restriction}/lift`, body: { expected_revision: 1, reason: "Customer asked again" } }, salesOutreachEnvelope(salesOutreachRestrictionCommandResponseSchema));
});

test("the mock refuses what the server refuses for each role", () => {
  assert.deepEqual(refusal({ role: "admin", method: "GET", path: "capabilities" }), { status: 403, code: "FORBIDDEN" }, "generic admin gets no desk");
  assert.deepEqual(refusal({ role: "rep", method: "GET", path: "team" }), { status: 403, code: "FORBIDDEN" });
  assert.deepEqual(refusal({ role: "rep", method: "GET", path: "rep-days", query: { agent_id: SYNTHETIC_AGENTS.sam.id } }), { status: 403, code: "FORBIDDEN" });
  assert.deepEqual(refusal({ role: "rep", method: "GET", path: "queue", query: { agent_id: SYNTHETIC_AGENTS.sam.id } }), { status: 403, code: "FORBIDDEN" });
  assert.deepEqual(refusal({ role: "rep", method: "GET", path: "queue?unassigned=true" }), { status: 403, code: "FORBIDDEN" });
  const foreign = syntheticQueueRows().find((row) => row.assigned_agent_id === SYNTHETIC_AGENTS.casey.id)!.subject_id;
  assert.deepEqual(refusal({ role: "rep", method: "GET", path: `outreach/${foreign}` }), { status: 404, code: "NOT_FOUND" }, "a foreign Lead reads as absent");
  assert.deepEqual(refusal({ role: "rep", method: "PATCH", path: `outreach/${foreign}/callback`, body: { operation: "cancel", expected_revision: 0 } }), { status: 404, code: "NOT_FOUND" });
  assert.deepEqual(refusal({ role: "owner", method: "GET", path: "outreach/ffffffffffffffffffffffff" }), { status: 404, code: "NOT_FOUND" });
  assert.deepEqual(refusal({ role: "rep", method: "PATCH", path: `outreach/${foreign}/assignment`, body: { expected_revision: 2, agent_id: null } }), { status: 403, code: "FORBIDDEN" });
  assert.deepEqual(refusal({ role: "rep", method: "PATCH", path: `goals/${SYNTHETIC_REP_AGENT_ID}/day-override`, body: {} }), { status: 403, code: "FORBIDDEN" });
  assert.deepEqual(refusal({ role: "manager", method: "PATCH", path: `goals/${SYNTHETIC_AGENTS.sam.id}/day-override`, body: { expected_revision: 3, business_date: "2026-09-30", goal: 50, reason: "partial_day" } }), { status: 403, code: "FORBIDDEN" }, "historical edits are Owner-only");
  for (const path of ["configuration", "restrictions", "enrollment/candidates?partition=older"]) {
    assert.deepEqual(refusal({ role: "manager", method: "GET", path }), { status: 403, code: "FORBIDDEN" }, path);
  }
  assert.deepEqual(refusal({ role: "owner", method: "GET", path: "queue?cursor=garbage" }), { status: 409, code: "CURSOR_EXPIRED" });
  assert.deepEqual(refusal({ role: "owner", method: "GET", path: "nope" }), { status: 404, code: "NOT_FOUND" });
});
