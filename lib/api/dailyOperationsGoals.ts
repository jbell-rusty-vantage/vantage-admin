import { z } from "zod";
import { salesOutreachDailyCallGoalRowSchema, salesOutreachTeamGoalsSchema } from "./salesOutreach";
import { DailyOperationsReadError } from "./dailyOperationsRead";
export const dailyOperationsGoalRowSchema = salesOutreachDailyCallGoalRowSchema.omit({ overdue_leads: true, calls_due_today: true, sms_due_today: true });
export type DailyOperationsGoalRow = z.infer<typeof dailyOperationsGoalRowSchema>;
export const dailyOperationsGoalSummarySchema = z.object({
  generated_at: z.string(), goal_metrics_enabled: z.boolean(), goals: salesOutreachTeamGoalsSchema.nullable(),
  daily_call_goals: z.array(dailyOperationsGoalRowSchema).nullable(),
});
export async function fetchDailyOperationsGoals(signal: AbortSignal) {
  const response = await fetch("/api/proxy/api/v1/admin/daily-operations/goal-summary", { credentials: "include", cache: "no-store", signal });
  if (!response.ok) throw new DailyOperationsReadError(response.status);
  const payload: unknown = await response.json();
  const body = payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
  return dailyOperationsGoalSummarySchema.parse(body);
}
