/**
 * The Owner's Settings edits to the desk configuration. `PATCH /configuration` replaces the whole value, so each
 * edit returns the full value the Owner just read with one path changed. The value is parsed loose at every level
 * with its enums kept as text (`salesOutreachConfigurationValueSchema`), and every edit spreads it, so a key or
 * value this admin does not know yet goes back to the server unchanged (lifecycle repair ADM-0). Pure: no React,
 * no fetch.
 */
import type {
  SalesOutreachConfigurationPatch,
  SalesOutreachConfigurationReadDto,
  SalesOutreachConfigurationValue,
  SalesOutreachIntakeSource,
} from "@/lib/api/salesOutreach";

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

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Adds or removes one ISO weekday from a rep's `working_days` (other reps and fields unchanged). A rep without a
 * `rep_work_schedules` entry (P08a-1: a desk rep on the derived roster with the default schedule) gets one, started
 * from `currentDays` (the schedule the desk shows for them; every weekday by default) with the day toggled.
 */
export function withWorkingDayToggled(
  value: SalesOutreachConfigurationValue,
  agentId: string,
  day: number,
  currentDays: readonly number[] = ALL_WEEKDAYS,
): SalesOutreachConfigurationValue {
  const schedules = value.goals.rep_work_schedules ?? [];
  const toggle = (days: readonly number[]) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b));
  const next = schedules.some((row) => row.agent_id === agentId)
    ? schedules.map((row) => (row.agent_id === agentId ? { ...row, working_days: toggle(row.working_days) } : row))
    : [...schedules, { agent_id: agentId, working_days: toggle(currentDays), scheduled_goal: null }];
  return { ...value, goals: { ...value.goals, rep_work_schedules: next } };
}

/**
 * P08a-1: sets `goals.roster_rule` (`desk_reps` = automatic roster from the active, connected reps) or removes the
 * key (`null` = the server default, the explicit list), the same way the other optional keys are turned off.
 */
export function withRosterRule(value: SalesOutreachConfigurationValue, rule: "desk_reps" | "explicit" | null): SalesOutreachConfigurationValue {
  const goals = { ...value.goals };
  delete goals.roster_rule;
  return { ...value, goals: rule ? { ...goals, roster_rule: rule } : goals };
}

/** Replaces `cadence.holidays` (closures), de-duplicated and sorted. */
export function withHolidays(value: SalesOutreachConfigurationValue, holidays: readonly string[]): SalesOutreachConfigurationValue {
  return { ...value, cadence: { ...value.cadence, holidays: [...new Set(holidays)].sort() } };
}

/** The PATCH body: the edited full value plus the revision the Owner read (a stale write is a 409). */
export function configurationPatchBody(config: Pick<SalesOutreachConfigurationReadDto, "revision">, value: SalesOutreachConfigurationValue): SalesOutreachConfigurationPatch {
  return { expected_revision: config.revision, value };
}

// ---------------------------------------------------------------------------------------------
// Lifecycle repair ADM-5: the Owner configuration editor (goal counts, tunables, intake defaults, rule switches)
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;

/**
 * A numeric tunable the server added after revision 5 (olr A0, A5, B2, B10). Every one is an optional key with no
 * schema default: absent means the server's code default. The server does not serve its defaults, so the documented
 * value is listed here for the "Default (n)" copy only — the admin never writes it. Bounds mirror the server schema
 * (`src/validation/v1/salesOutreach.ts`); the server stays authoritative and refuses anything else by issue code.
 */
export type ConfigurationTunable = Readonly<{
  namespace: "evidence" | "operations" | "migration";
  field: string;
  min: number;
  max: number;
  /** The server code default (`DESK_TIMING_DEFAULTS`, `OUTREACH_FEED_LOOP_DEFAULTS`, `DECISION_RECONCILE_DEFAULT_PER_RUN`). */
  default: number;
  unit: "minutes" | "seconds" | "jobs" | "passes" | "loops" | "leads";
}>;

const tunable = (
  namespace: ConfigurationTunable["namespace"],
  field: string,
  min: number,
  max: number,
  fallback: number,
  unit: ConfigurationTunable["unit"],
): ConfigurationTunable => Object.freeze({ namespace, field, min, max, default: fallback, unit });

export const CONFIGURATION_TUNABLE_GROUPS = {
  /** `evidence.*_minutes` (olr A0, `deskTimingOf`). */
  capture: [
    tunable("evidence", "call_settlement_allowance_minutes", 0, 30, 2, "minutes"),
    tunable("evidence", "today_coverage_tolerance_minutes", 5, 180, 25, "minutes"),
    tunable("evidence", "capture_freshness_tolerance_minutes", 1, 60, 10, "minutes"),
    tunable("evidence", "webhook_silence_minutes", 5, 240, 30, "minutes"),
  ],
  /** `operations.evaluate_drain_*` (olr A0 keys, A5 drain). */
  drain: [
    tunable("operations", "evaluate_drain_max_jobs", 1, 1000, 100, "jobs"),
    tunable("operations", "evaluate_drain_budget_seconds", 5, 55, 40, "seconds"),
    tunable("operations", "evaluate_drain_concurrency", 1, 4, 1, "loops"),
  ],
  /** `migration.*`: the Lead-change tail loop (olr B10) and the decision reconcile (olr B2). */
  migration: [
    tunable("migration", "feed_budget_seconds", 1, 40, 15, "seconds"),
    tunable("migration", "feed_max_passes_per_run", 1, 50, 10, "passes"),
    tunable("migration", "decision_reconcile_per_run", 1, 5000, 300, "leads"),
  ],
} as const satisfies Record<string, readonly ConfigurationTunable[]>;
export type ConfigurationTunableGroup = keyof typeof CONFIGURATION_TUNABLE_GROUPS;

/** `namespace.field`: the issue path the server reports for a tunable. */
export const tunablePath = (t: ConfigurationTunable) => `${t.namespace}.${t.field}`;

/** The stored value of a tunable, or null when it is absent (the server then uses its code default). */
export function storedTunable(value: SalesOutreachConfigurationValue, t: ConfigurationTunable): number | null {
  const stored = (value[t.namespace] as Json | undefined)?.[t.field];
  return typeof stored === "number" ? stored : null;
}

/**
 * Sets (a number) or removes (null: back to the server default) each edited tunable. Keys not edited — known or not —
 * are kept. The optional `operations` namespace is created on first use and never added empty.
 */
export function withTunables(value: SalesOutreachConfigurationValue, edits: ReadonlyArray<readonly [ConfigurationTunable, number | null]>): SalesOutreachConfigurationValue {
  const next: Json = { ...value };
  for (const [t, edit] of edits) {
    const current = next[t.namespace] as Json | undefined;
    if (edit === null && (current === undefined || !(t.field in current))) continue;
    const namespace: Json = { ...(current ?? {}) };
    if (edit === null) delete namespace[t.field];
    else namespace[t.field] = edit;
    next[t.namespace] = namespace;
  }
  return next as SalesOutreachConfigurationValue;
}

/** A draft field: blank = the default (key removed); otherwise a whole number inside the server bounds. */
export function parseTunableDraft(t: ConfigurationTunable, draft: string): { ok: true; value: number | null } | { ok: false } {
  const text = draft.trim();
  if (text === "") return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false };
  const n = Number(text);
  return n >= t.min && n <= t.max ? { ok: true, value: n } : { ok: false };
}

export type CountScopeEntry = { from_day: string; scope: string };

/** `goals.count_scope_schedule` as stored (absent = none: every outbound call counts). */
export function countScopeSchedule(value: SalesOutreachConfigurationValue): CountScopeEntry[] {
  return (value.goals.count_scope_schedule ?? []) as CountScopeEntry[];
}

/**
 * Display only (the server resolves the scope itself): the entry in effect on `day` — the last one starting on or
 * before it — or null when none has started (the default: every outbound call).
 */
export function countScopeEntryInEffect(schedule: readonly CountScopeEntry[], day: string): CountScopeEntry | null {
  let current: CountScopeEntry | null = null;
  for (const entry of schedule) {
    if (entry.from_day > day) break;
    current = entry;
  }
  return current;
}

/**
 * Adds an entry starting on `fromDay` (or replaces the scope of the one starting that day), ascending by `from_day`.
 * Stored entries keep their objects, so their unknown keys go back unchanged. Only a later day may change: the server
 * refuses the rest (`count_scope_not_prospective`), and the editor offers only days after today.
 */
export function withCountScopeEntry(value: SalesOutreachConfigurationValue, fromDay: string, scope: string): SalesOutreachConfigurationValue {
  const schedule = countScopeSchedule(value);
  const existing = schedule.find((entry) => entry.from_day === fromDay);
  const entry = existing ? { ...existing, scope } : { from_day: fromDay, scope };
  const next = [...schedule.filter((row) => row.from_day !== fromDay), entry].sort((a, b) => (a.from_day < b.from_day ? -1 : a.from_day > b.from_day ? 1 : 0));
  return { ...value, goals: { ...value.goals, count_scope_schedule: next } };
}

/** Removes the entry starting on `fromDay`; an emptied schedule is removed (absent = every outbound call). */
export function withoutCountScopeEntry(value: SalesOutreachConfigurationValue, fromDay: string): SalesOutreachConfigurationValue {
  const next = countScopeSchedule(value).filter((entry) => entry.from_day !== fromDay);
  const goals: Json = { ...value.goals, count_scope_schedule: next };
  if (next.length === 0) delete goals.count_scope_schedule;
  return { ...value, goals: goals as SalesOutreachConfigurationValue["goals"] };
}

/** Sets one source of `cadence.intake_default_rule`. Unchanged when the rule is not installed (the server needs all five sources). */
export function withIntakeDefault(value: SalesOutreachConfigurationValue, source: SalesOutreachIntakeSource, rule: string): SalesOutreachConfigurationValue {
  const current = value.cadence.intake_default_rule;
  if (!current) return value;
  return { ...value, cadence: { ...value.cadence, intake_default_rule: { ...current, [source]: rule } } };
}

/**
 * The Owner's rule switches (olr B6, C2c, C2d). Each is an optional key: absent = off (the server code default), on =
 * the one approved value. Turning one off removes the key, so the value reads as it did before the key existed.
 */
export const CONFIGURATION_RULE_SWITCHES = {
  expansion_admission: { namespace: "transition", field: "expansion_admission_enabled", on: true, off: [false] },
  no_contact_number: { namespace: "cadence", field: "no_contact_number_rule", on: "review_no_cadence", off: [] },
  call_association: { namespace: "evidence", field: "call_association_rule", on: "single_active_subject_on_link", off: ["number_lead"] },
} as const satisfies Record<string, { namespace: "transition" | "cadence" | "evidence"; field: string; on: unknown; off: readonly unknown[] }>;
export type ConfigurationRuleSwitch = keyof typeof CONFIGURATION_RULE_SWITCHES;

/** `on`, `off` (absent or an explicit off value), or `other`: a value this admin does not know (the switch leaves it alone). */
export function ruleSwitchState(value: SalesOutreachConfigurationValue, key: ConfigurationRuleSwitch): "on" | "off" | "other" {
  const sw = CONFIGURATION_RULE_SWITCHES[key];
  const stored = (value[sw.namespace] as Json)[sw.field];
  if (stored === undefined) return "off";
  if (stored === sw.on) return "on";
  return (sw.off as readonly unknown[]).includes(stored) ? "off" : "other";
}

/** Turns a rule switch on (its approved value) or off (the key removed). */
export function withRuleSwitch(value: SalesOutreachConfigurationValue, key: ConfigurationRuleSwitch, on: boolean): SalesOutreachConfigurationValue {
  const sw = CONFIGURATION_RULE_SWITCHES[key];
  const namespace: Json = { ...(value[sw.namespace] as Json) };
  if (on) namespace[sw.field] = sw.on;
  else delete namespace[sw.field];
  return { ...value, [sw.namespace]: namespace } as SalesOutreachConfigurationValue;
}
