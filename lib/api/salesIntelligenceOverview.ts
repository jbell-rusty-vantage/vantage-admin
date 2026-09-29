import { z } from "zod";
import { readSalesIntelligence } from "./salesIntelligence";

const drillParams = z.record(z.string(), z.union([z.string(), z.array(z.string())]));
export const workloadCountSchema = z.object({ count: z.number(), drill: z.object({ params: drillParams }) });
const followups = z.object({ actions: workloadCountSchema, records: workloadCountSchema });
const baseWorkload = z.object({ assigned: workloadCountSchema, records_with_overdue: workloadCountSchema, due_today: workloadCountSchema, no_next_step: workloadCountSchema, blocked: workloadCountSchema });
export const teamRowSchema = baseWorkload.extend({ agent: z.object({ id: z.string(), name: z.string(), active: z.boolean() }), followups, followups_overdue: followups, involved: workloadCountSchema });
export const teamOverviewSchema = z.object({ ok: z.literal(true), as_of: z.string(), data: z.object({ rows: z.array(teamRowSchema), unassigned: baseWorkload.nullable(), attention: z.object({ records_with_overdue: workloadCountSchema, awaiting_first_call: workloadCountSchema, unassigned: workloadCountSchema.optional(), needs_review: workloadCountSchema }).nullable(), snapshot_id: z.string().nullable(), as_of: z.string(), status: z.string() }) });
export type TeamOverview = z.infer<typeof teamOverviewSchema>["data"];
export type TeamRow = z.infer<typeof teamRowSchema>;
export type WorkloadCount = z.infer<typeof workloadCountSchema>;

const nullableCount = z.number().nullable();
const activityNumbers = z.object({ human_conversations: nullableCount, outbound_attempts: nullableCount });
export const periodSchema = z.object({ key: z.string(), from_day: z.string(), to_day: z.string(), start: z.string(), end: z.string() });
export const activityOverviewSchema = z.object({ ok: z.literal(true), as_of: z.string(), data: z.object({ totals: activityNumbers.nullable(), by_rep: z.array(activityNumbers.extend({ agent_id: z.string(), name: z.string() })), unmapped: activityNumbers.nullable(), coverage: z.array(activityNumbers.extend({ day: z.string(), coverage: z.string() })), status: z.string(), period: periodSchema }) });
export type ActivityOverview = z.infer<typeof activityOverviewSchema>["data"];
export const outcomesOverviewSchema = z.object({ ok: z.literal(true), as_of: z.string(), data: z.object({ leads_received: nullableCount, quoted: nullableCount, booked_official: nullableCount, booked_in_granot: nullableCount, cohort: periodSchema, observed_through: z.string().nullable(), status: z.string() }) });
export type OutcomesOverview = z.infer<typeof outcomesOverviewSchema>["data"];

const periodQuery = (name: "period" | "cohort", key: string, from?: string | null, through?: string | null) => {
  const params = new URLSearchParams({ [name]: key });
  if (key === "custom" && from && through) { params.set("from", from); params.set("through", through); }
  return params.toString();
};
export const readTeamOverview = (priority: readonly string[], signal?: AbortSignal) => {
  const params = new URLSearchParams();
  for (const value of priority) params.append("priority", value);
  const suffix = params.toString();
  return readSalesIntelligence(`overview/team${suffix ? `?${suffix}` : ""}`, teamOverviewSchema, signal);
};
export const readActivityOverview = (period: string, from?: string | null, through?: string | null, signal?: AbortSignal) => readSalesIntelligence(`overview/activity?${periodQuery("period", period, from, through)}`, activityOverviewSchema, signal);
export const readOutcomesOverview = (cohort: string, from?: string | null, through?: string | null, signal?: AbortSignal) => readSalesIntelligence(`overview/outcomes?${periodQuery("cohort", cohort, from, through)}`, outcomesOverviewSchema, signal);
