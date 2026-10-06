/**
 * The Owner's Settings edits to the desk configuration. `PATCH /configuration` replaces the whole value, so each
 * edit returns the full value the Owner just read with one path changed. The value is parsed loose at every level
 * with its enums kept as text (`salesOutreachConfigurationValueSchema`), and every edit spreads it, so a key or
 * value this admin does not know yet goes back to the server unchanged (lifecycle repair ADM-0). Pure: no React,
 * no fetch.
 */
import type { SalesOutreachConfigurationPatch, SalesOutreachConfigurationReadDto, SalesOutreachConfigurationValue } from "@/lib/api/salesOutreach";

export const CONFIGURATION_CONTROL_KEYS = ["desk_enabled", "goal_metrics_enabled", "rep_sms_capture_enabled", "cadence_shadow_enabled", "cadence_enforcement_enabled"] as const;
export type ConfigurationSwitchKey = (typeof CONFIGURATION_CONTROL_KEYS)[number] | "intake_admission_enabled";

/** Flips one desk control, or the intake gate (`transition.intake_admission_enabled`). */
export function withSwitchToggled(value: SalesOutreachConfigurationValue, key: ConfigurationSwitchKey): SalesOutreachConfigurationValue {
  if (key === "intake_admission_enabled") {
    return { ...value, transition: { ...value.transition, intake_admission_enabled: !value.transition.intake_admission_enabled } };
  }
  return { ...value, controls: { ...value.controls, [key]: !value.controls[key] } };
}

/** Sets `goals.default_scheduled_goal`. */
export function withDefaultGoal(value: SalesOutreachConfigurationValue, goal: number): SalesOutreachConfigurationValue {
  return { ...value, goals: { ...value.goals, default_scheduled_goal: goal } };
}

/** Adds or removes one ISO weekday from a rep's `working_days` (other reps and fields unchanged). */
export function withWorkingDayToggled(value: SalesOutreachConfigurationValue, agentId: string, day: number): SalesOutreachConfigurationValue {
  const schedules = value.goals.rep_work_schedules ?? [];
  const next = schedules.map((row) =>
    row.agent_id === agentId
      ? { ...row, working_days: row.working_days.includes(day) ? row.working_days.filter((d) => d !== day) : [...row.working_days, day].sort((a, b) => a - b) }
      : row,
  );
  return { ...value, goals: { ...value.goals, rep_work_schedules: next } };
}

/** Replaces `cadence.holidays` (closures), de-duplicated and sorted. */
export function withHolidays(value: SalesOutreachConfigurationValue, holidays: readonly string[]): SalesOutreachConfigurationValue {
  return { ...value, cadence: { ...value.cadence, holidays: [...new Set(holidays)].sort() } };
}

/** The PATCH body: the edited full value plus the revision the Owner read (a stale write is a 409). */
export function configurationPatchBody(config: Pick<SalesOutreachConfigurationReadDto, "revision">, value: SalesOutreachConfigurationValue): SalesOutreachConfigurationPatch {
  return { expected_revision: config.revision, value };
}
