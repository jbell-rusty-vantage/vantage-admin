"use client";
/**
 * The Owner configuration editor in Settings (lifecycle repair ADM-5): goal counts (`goals.count_scope_schedule`),
 * capture timing (`evidence.*_minutes`), lead re-evaluation (`operations.evaluate_drain_*`), lead-change intake
 * (`migration.feed_*`, `decision_reconcile_per_run`), new-lead defaults (`cadence.intake_default_rule`), the read-only
 * Granot priority map, and the lead rules (`transition.expansion_admission_enabled`, `cadence.no_contact_number_rule`,
 * `evidence.call_association_rule`).
 *
 * Every write is a full-value `PATCH /configuration` built from the value just read (`../lib/configuration-patch`), so
 * every key this admin does not edit — known or not — goes back unchanged (ADM-0). A refusal reads issue by issue, by
 * code (`../lib/configuration-issues`). A key the server added after revision 5 may be absent: it then runs on the
 * server's code default, shown as "Default (n)"; clearing a field removes the key again.
 */
import { useId, useState, type ReactNode } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  SALES_OUTREACH_GOAL_COUNT_SCOPES,
  SALES_OUTREACH_INTAKE_DEFAULTS,
  SALES_OUTREACH_INTAKE_SOURCES,
  newIdempotencyKey,
  salesOutreachCommand,
  salesOutreachConfigurationPatchResponseSchema,
  salesOutreachPaths,
  type SalesOutreachConfigurationReadDto,
  type SalesOutreachConfigurationValue,
} from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { addDays, shortDateLabel } from "../lib/format";
import {
  CONFIGURATION_RULE_SWITCHES,
  CONFIGURATION_TUNABLE_GROUPS,
  configurationPatchBody,
  countScopeEntryInEffect,
  countScopeSchedule,
  parseTunableDraft,
  ruleSwitchState,
  storedTunable,
  withCountScopeEntry,
  withIntakeDefault,
  withoutCountScopeEntry,
  withRuleSwitch,
  withTunables,
  type ConfigurationRuleSwitch,
  type ConfigurationTunable,
  type ConfigurationTunableGroup,
} from "../lib/configuration-patch";
import { configurationWriteError } from "../lib/configuration-issues";
import { deskCopy } from "../outreach-desk-copy";
import { IconBadge } from "../primitives";

const c = deskCopy.configEditor;

/** A Settings card: icon, title, optional hint. */
export function SettingsPanel({ icon, title, hint, children, testId }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode; testId?: string }) {
  const id = useId();
  return (
    <section className="od-card od-settings" aria-labelledby={id} data-testid={testId}>
      <div className="od-settings__head">
        <IconBadge icon={icon} tone="blue" size={40} />
        <div>
          <h2 id={id} className="od-card__title">
            {title}
          </h2>
          {hint ? <p className="od-card__subtitle">{hint}</p> : null}
        </div>
      </div>
      <div className="od-settings__body">{children}</div>
    </section>
  );
}

/**
 * Replaces the configuration value (the server validates it and fails closed). `value` is always an edit of the
 * value just read, so keys this admin does not know are sent back unchanged.
 */
export function useConfigurationWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ config, value }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue }) =>
      salesOutreachCommand(
        "PATCH",
        salesOutreachPaths.configuration(),
        configurationPatchBody(config, value),
        newIdempotencyKey("configuration"),
        salesOutreachConfigurationPatchResponseSchema,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey }),
  });
}

/** A failed configuration write: the conflict, or each refused issue by its code (never the server's text). */
export function ConfigurationWriteError({ error }: { error: unknown }) {
  const shown = configurationWriteError(error);
  if (!shown) return null;
  return (
    <div className="od-lead__error" role="alert" data-testid="configuration-error">
      <p>{shown.summary}</p>
      {shown.lines.length ? (
        <ul className="od-issues">
          {shown.lines.map((line) => (
            <li key={line.text} data-code={line.code}>
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const scopeLabel = (scope: string) => c.goalCounts.scopes[scope] ?? c.goalCounts.scopeFallback;

/** `goals.count_scope_schedule`: started entries read-only, upcoming entries removable, new entries from tomorrow on. */
export function GoalCountsEditor({ config, value, today }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue; today: string }) {
  const write = useConfigurationWrite();
  const tomorrow = addDays(today, 1);
  const [day, setDay] = useState(tomorrow);
  const [scope, setScope] = useState<string>(SALES_OUTREACH_GOAL_COUNT_SCOPES[1]);
  const schedule = countScopeSchedule(value);
  const inEffect = countScopeEntryInEffect(schedule, today);
  const canAdd = day >= tomorrow && !write.isPending;
  return (
    <>
      <p className="od-strong" data-testid="goal-counts-today">
        {inEffect ? c.goalCounts.today(scopeLabel(inEffect.scope)) : c.goalCounts.todayDefault}
      </p>
      {schedule.length === 0 ? (
        <p className="od-text-muted od-small">{c.goalCounts.none}</p>
      ) : (
        <div className="od-table-wrap">
          <table className="od-table od-table--compact" data-testid="goal-counts-schedule">
            <thead>
              <tr>
                <th scope="col">{c.goalCounts.columns.from}</th>
                <th scope="col">{c.goalCounts.columns.counts}</th>
                <th scope="col">{c.goalCounts.columns.status}</th>
                <th scope="col">{deskCopy.team.goals.columns.action}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => {
                const upcoming = entry.from_day > today;
                const state = upcoming ? c.goalCounts.states.upcoming : entry === inEffect ? c.goalCounts.states.inEffect : c.goalCounts.states.ended;
                return (
                  <tr key={entry.from_day} data-day={entry.from_day}>
                    <th scope="row">{shortDateLabel(entry.from_day)}</th>
                    <td>{scopeLabel(entry.scope)}</td>
                    <td>
                      <span className={upcoming ? "od-pill od-pill--neutral" : entry === inEffect ? "od-pill od-pill--new" : "od-pill od-pill--neutral"}>{state}</span>
                    </td>
                    <td>
                      {upcoming ? (
                        <button
                          type="button"
                          className="od-button od-button--quiet"
                          aria-label={c.goalCounts.removeEntry(shortDateLabel(entry.from_day))}
                          disabled={write.isPending}
                          onClick={() => write.mutate({ config, value: withoutCountScopeEntry(value, entry.from_day) })}
                        >
                          {c.goalCounts.remove}
                        </button>
                      ) : (
                        <span className="od-text-muted od-small">{c.goalCounts.locked}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="od-inline-form">
        <label>
          {c.goalCounts.from}
          <input className="od-input" type="date" min={tomorrow} value={day} onChange={(event) => setDay(event.target.value)} data-testid="goal-counts-day" />
        </label>
        <label>
          {c.goalCounts.counts}
          <select className="od-select od-select--plain" value={scope} onChange={(event) => setScope(event.target.value)} data-testid="goal-counts-scope">
            {SALES_OUTREACH_GOAL_COUNT_SCOPES.map((option) => (
              <option key={option} value={option}>
                {scopeLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="od-button" disabled={!canAdd} onClick={() => write.mutate({ config, value: withCountScopeEntry(value, day, scope) })}>
          {c.goalCounts.add}
        </button>
      </div>
      <ConfigurationWriteError error={write.error} />
      {write.isSuccess ? (
        <p className="od-text-green od-small" role="status">
          {c.saved}
        </p>
      ) : null}
    </>
  );
}

const unitText = (t: ConfigurationTunable) => c.units[t.unit] ?? t.unit;

/** One group of numeric tunables: blank = the server default (the key is removed), else a whole number in bounds. */
export function TunablesEditor({ config, value, group }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue; group: ConfigurationTunableGroup }) {
  const write = useConfigurationWrite();
  const tunables: readonly ConfigurationTunable[] = CONFIGURATION_TUNABLE_GROUPS[group];
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(tunables.map((t) => [t.field, storedTunable(value, t)?.toString() ?? ""])),
  );
  const [invalid, setInvalid] = useState<string[]>([]);
  const changed = tunables.some((t) => (drafts[t.field] ?? "").trim() !== (storedTunable(value, t)?.toString() ?? ""));
  const save = () => {
    const edits: Array<readonly [ConfigurationTunable, number | null]> = [];
    const bad: string[] = [];
    for (const t of tunables) {
      const parsed = parseTunableDraft(t, drafts[t.field] ?? "");
      if (!parsed.ok) bad.push(c.invalid(c.tunables[t.field]?.label ?? t.field, t.min, t.max));
      else if (parsed.value !== storedTunable(value, t)) edits.push([t, parsed.value]);
    }
    setInvalid(bad);
    if (bad.length || edits.length === 0) return;
    write.mutate({ config, value: withTunables(value, edits) });
  };
  return (
    <>
      <ul className="od-tunables">
        {tunables.map((t) => {
          const stored = storedTunable(value, t);
          const words = c.tunables[t.field];
          const inputId = `od-tunable-${group}-${t.field}`;
          return (
            <li key={t.field} data-field={t.field}>
              <div>
                <label htmlFor={inputId} className="od-strong">
                  {words?.label ?? t.field}
                </label>
                {words?.hint ? <p className="od-text-muted od-small">{words.hint}</p> : null}
              </div>
              <div className="od-tunables__value">
                <input
                  id={inputId}
                  className="od-input od-input--number"
                  type="number"
                  inputMode="numeric"
                  min={t.min}
                  max={t.max}
                  step={1}
                  placeholder={String(t.default)}
                  value={drafts[t.field] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [t.field]: event.target.value }))}
                />
                <span className="od-small od-text-muted" data-testid="tunable-state">
                  {stored === null ? c.defaultValue(t.default, unitText(t)) : c.setValue(stored, unitText(t))} · {c.range(t.min, t.max)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="od-inline-form">
        <button type="button" className="od-button" disabled={!changed || write.isPending} onClick={save}>
          {c.save}
        </button>
        <span className="od-text-muted od-small">{c.useDefault}</span>
      </div>
      {invalid.length ? (
        <ul className="od-lead__error od-issues" role="alert">
          {invalid.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <ConfigurationWriteError error={write.error} />
      {write.isSuccess ? (
        <p className="od-text-green od-small" role="status">
          {c.saved}
        </p>
      ) : null}
    </>
  );
}

/** `cadence.intake_default_rule`: one select per source; each change is one PATCH (refusals read by code). */
export function IntakeDefaultsEditor({ config, value }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue }) {
  const write = useConfigurationWrite();
  const rule = value.cadence.intake_default_rule;
  if (!rule) return <p className="od-text-muted">{c.intake.notInstalled}</p>;
  return (
    <>
      <ul className="od-toggles">
        {SALES_OUTREACH_INTAKE_SOURCES.map((source) => {
          const current = String(rule[source]);
          const known = (SALES_OUTREACH_INTAKE_DEFAULTS as readonly string[]).includes(current);
          return (
            <li key={source} data-source={source}>
              <label htmlFor={`od-intake-${source}`}>{c.intake.sources[source]}</label>
              <select
                id={`od-intake-${source}`}
                className="od-select od-select--plain"
                value={current}
                disabled={write.isPending}
                onChange={(event) => write.mutate({ config, value: withIntakeDefault(value, source, event.target.value) })}
              >
                {known ? null : <option value={current}>{c.intake.ruleFallback}</option>}
                {SALES_OUTREACH_INTAKE_DEFAULTS.map((option) => (
                  <option key={option} value={option}>
                    {c.intake.rules[option]}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <ConfigurationWriteError error={write.error} />
    </>
  );
}

const workflowLabel = (workflow: string) => c.priorityMap.workflows[workflow] ?? c.priorityMap.fallback;

/** `cadence.priority_map`, read-only (editable in a later release). */
export function PriorityMapView({ value }: { value: SalesOutreachConfigurationValue }) {
  const map = value.cadence.priority_map;
  if (!map) return <p className="od-text-muted">{c.priorityMap.notInstalled}</p>;
  return (
    <>
      <div className="od-table-wrap">
        <table className="od-table od-table--compact" data-testid="priority-map">
          <thead>
            <tr>
              <th scope="col">{c.priorityMap.columns.code}</th>
              <th scope="col">{c.priorityMap.columns.workflow}</th>
              <th scope="col">{c.priorityMap.columns.closes}</th>
            </tr>
          </thead>
          <tbody>
            {map.codes.map((row) => (
              <tr key={row.code} data-code={row.code}>
                <th scope="row">{row.code}</th>
                <td>{workflowLabel(row.workflow)}</td>
                <td>{row.closure_reason ? (c.priorityMap.closures[row.closure_reason] ?? c.priorityMap.fallback) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="od-text-muted od-small">
        {c.priorityMap.unmapped(workflowLabel(map.unmapped_workflow))} {c.priorityMap.official(workflowLabel(map.official_booking_workflow))}
      </p>
    </>
  );
}

const RULE_SWITCH_KEYS = Object.keys(CONFIGURATION_RULE_SWITCHES) as ConfigurationRuleSwitch[];

/** The optional lead rules: off = key absent; a value this admin does not know is shown and left alone. */
export function LeadRulesEditor({ config, value }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue }) {
  const write = useConfigurationWrite();
  const backfillInstalled = value.transition.backfill_lookback_days !== null && value.transition.backfill_include_upcoming_moves !== null;
  return (
    <>
      <ul className="od-rules">
        {RULE_SWITCH_KEYS.map((key) => {
          const state = ruleSwitchState(value, key);
          const blocked = key === "expansion_admission" && state === "off" && !backfillInstalled;
          return (
            <li key={key} data-rule={key}>
              <div>
                <span className="od-strong">{c.rules.names[key]}</span>
                <p className="od-text-muted od-small">{c.rules.hints[key]}</p>
                {state === "other" ? <p className="od-text-amber od-small">{c.rules.other}</p> : null}
                {blocked ? <p className="od-text-amber od-small">{c.rules.needsBackfill}</p> : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state === "on"}
                aria-label={c.rules.names[key]}
                className="od-switch"
                disabled={write.isPending || state === "other" || blocked}
                onClick={() => write.mutate({ config, value: withRuleSwitch(value, key, state !== "on") })}
              >
                <span className="od-switch__knob" aria-hidden="true" />
                <span>{state === "on" ? deskCopy.settings.on : deskCopy.settings.off}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <ConfigurationWriteError error={write.error} />
    </>
  );
}
