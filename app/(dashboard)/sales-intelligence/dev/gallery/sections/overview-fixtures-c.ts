/** OI-A5 gallery: synthetic compact variants of the verified C contract shapes. No runtime workspace read. */
import type { ActivityOverview, OutcomesOverview, TeamOverview, TeamRow, WorkloadCount } from "@/lib/api/salesIntelligenceOverview";

const snapshot = "outreach:gallery-phase-c";
const base = { view: "all_outreach", snapshot_id: snapshot, state: ["unworked", "open", "waiting_on_customer", "identity_review"] };
const metric = (count: number, params: Record<string, string | string[]> = {}): WorkloadCount => ({ count, drill: { params: { ...base, ...params } } });
const row = (id: string, name: string, active: boolean, assigned: number, overdue: number, today: number, noNext: number, followupActions: number, followupRecords: number, overdueActions: number): TeamRow => ({
  agent: { id, name, active },
  assigned: metric(assigned, { assigned_agent_id: [id] }), records_with_overdue: metric(overdue, { assigned_agent_id: [id], work: ["overdue_followup"] }),
  due_today: metric(today, { assigned_agent_id: [id], work: ["due_today"] }), no_next_step: metric(noNext, { assigned_agent_id: [id], work: ["no_next_step"] }), blocked: metric(0, { assigned_agent_id: [id], work: ["blocked"] }),
  followups: { actions: metric(followupActions, { followup_agent_id: [id] }), records: metric(followupRecords, { followup_agent_id: [id] }) },
  followups_overdue: { actions: metric(overdueActions, { followup_agent_id: [id], work: ["overdue_followup"] }), records: metric(overdueActions > 0 ? 1 : 0, { followup_agent_id: [id], work: ["overdue_followup"] }) },
  involved: metric(assigned, { agent_id: [id] }),
});
export const TEAM_C: TeamOverview = {
  rows: [row("alex", "Alex R.", true, 4, 2, 2, 1, 1, 1, 0), row("sam", "Sam P.", true, 2, 0, 1, 1, 4, 3, 3), row("taylor", "Taylor M.", true, 0, 0, 0, 0, 0, 0, 0), row("riley", "Riley C.", false, 1, 0, 0, 0, 0, 0, 0)],
  unassigned: { assigned: metric(1, { assignment: "unassigned" }), records_with_overdue: metric(1, { assignment: "unassigned", work: ["overdue_followup"] }), due_today: metric(1, { assignment: "unassigned", work: ["due_today"] }), no_next_step: metric(0, { assignment: "unassigned", work: ["no_next_step"] }), blocked: metric(0, { assignment: "unassigned", work: ["blocked"] }) },
  attention: { records_with_overdue: metric(3, { work: ["overdue_followup"] }), awaiting_first_call: metric(1, { band: ["2"] }), unassigned: metric(1, { assignment: "unassigned" }), needs_review: metric(1, { needs_review: "true" }) },
  snapshot_id: snapshot, as_of: "2026-09-29T19:30:02Z", status: "ready",
};
const today = { key: "today", from_day: "2026-09-29", to_day: "2026-09-29", start: "2026-09-29T04:00:00Z", end: "2026-09-29T19:30:02Z" };
export const ACTIVITY_C: ActivityOverview = { totals: { human_conversations: 7, outbound_attempts: 18 }, by_rep: [{ agent_id: "alex", name: "Alex R.", human_conversations: 3, outbound_attempts: 9 }, { agent_id: "sam", name: "Sam P.", human_conversations: 4, outbound_attempts: 9 }], unmapped: { human_conversations: 0, outbound_attempts: 2 }, coverage: [{ day: "2026-09-29", coverage: "partial", human_conversations: 7, outbound_attempts: 18 }], status: "partial", period: today };
export const OUTCOMES_C: OutcomesOverview = { leads_received: 24, quoted: 9, booked_official: 4, booked_in_granot: 2, cohort: { ...today, key: "last_7_days", from_day: "2026-09-23", start: "2026-09-23T04:00:00Z" }, observed_through: today.end, status: "ready" };
export const TEAM_PENDING_C: TeamOverview = { rows: [], unassigned: null, attention: null, snapshot_id: null, as_of: "2026-09-29T19:30:02Z", status: "pending_projection" };
export const ACTIVITY_MISSING_C: ActivityOverview = { ...ACTIVITY_C, totals: { human_conversations: null, outbound_attempts: null }, by_rep: [], unmapped: { human_conversations: null, outbound_attempts: null }, coverage: [{ day: "2020-01-01", coverage: "missing", human_conversations: null, outbound_attempts: null }], status: "partial" };
