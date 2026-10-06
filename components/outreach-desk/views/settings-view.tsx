"use client";
/**
 * Settings (ADM-6). Role-scoped:
 * - Owner: desk controls and the intake gate, roster and daily goals, closures, the configuration editor (lifecycle
 *   repair ADM-5: goal counts, capture timing, lead re-evaluation and lead-change intake tunables, new-lead defaults,
 *   the read-only priority map, lead rules; `./configuration-editor`), contact restrictions (the inert AI-origin rows
 *   stay active and blocking until confirmed or lifted, P06c), enrollment (ADM-4: "Ready to enroll" and "Older" with a
 *   one-click Enroll, a read-only "Needs review", and the day's new-lead intake; `./enrollment-panels`), and attendance.
 * - Manager: attendance only (prospective; the server refuses past days, P09b).
 * - Rep: a short note; reps have no desk settings.
 * Every write sends the revision it read and an Idempotency-Key. Configuration writes replace the whole value
 * (`PATCH /configuration`), so the Owner always edits the value just read; a stale write is a 409.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { CalendarX2, ClipboardList, Gauge, Inbox, ListOrdered, ShieldAlert, SlidersHorizontal, Target, Timer, ToggleRight, UserCheck, UserPlus, Users } from "lucide-react";
import {
  isSalesOutreachApiError,
  newIdempotencyKey,
  salesOutreachCommand,
  salesOutreachConfigurationReadSchema,
  salesOutreachPaths,
  salesOutreachRead,
  salesOutreachRestrictionCommandResponseSchema,
  salesOutreachRestrictionsResponseSchema,
  type SalesOutreachCapabilitiesDto,
  type SalesOutreachConfigurationReadDto,
  type SalesOutreachRestrictionDto,
} from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { useDayOverrideCommand } from "../data/use-desk-commands";
import { retryDeskRead, useTeam } from "../data/use-desk-reads";
import type { DeskViewer } from "../shell/desk-shell";
import { absoluteTime, addDays, nyDate, shortDateLabel } from "../lib/format";
import { CONFIGURATION_CONTROL_KEYS, withDefaultGoal, withHolidays, withSwitchToggled, withWorkingDayToggled, type ConfigurationSwitchKey } from "../lib/configuration-patch";
import { deskCopy } from "../outreach-desk-copy";
import { DeskHeader, IconBadge, SkeletonLine } from "../primitives";
import {
  ConfigurationWriteError,
  GoalCountsEditor,
  IntakeDefaultsEditor,
  LeadRulesEditor,
  PriorityMapView,
  SettingsPanel as Panel,
  TunablesEditor,
  useConfigurationWrite,
} from "./configuration-editor";
import { AdmissionsPanel, EnrollmentPanel } from "./enrollment-panels";

const s = deskCopy.settings;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function errorText(error: unknown): string | null {
  if (!error) return null;
  if (isSalesOutreachApiError(error)) {
    if (error.code === "REVISION_CONFLICT") return deskCopy.errors.conflict;
    if (error.status === 403) return deskCopy.errors.forbidden;
    return deskCopy.errors.failed(error.message);
  }
  return deskCopy.errors.failed(null);
}

function useConfiguration(enabled: boolean) {
  return useQuery({
    queryKey: outreachKeys.configuration(),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.configuration(), salesOutreachConfigurationReadSchema, signal),
    enabled,
    retry: retryDeskRead,
  });
}

function ControlsPanel({ config }: { config: SalesOutreachConfigurationReadDto }) {
  const write = useConfigurationWrite();
  const value = config.value;
  if (!value) return <p className="od-text-muted">{config.unavailable_reason ?? deskCopy.unavailable.configuration_unavailable}</p>;
  const toggle = (key: ConfigurationSwitchKey) => write.mutate({ config, value: withSwitchToggled(value, key) });
  const rows: { key: ConfigurationSwitchKey; on: boolean }[] = [
    ...CONFIGURATION_CONTROL_KEYS.map((key) => ({ key, on: value.controls[key] })),
    { key: "intake_admission_enabled", on: value.transition.intake_admission_enabled },
  ];
  return (
    <>
      <ul className="od-toggles">
        {rows.map((row) => (
          <li key={row.key}>
            <span>{s.controlNames[row.key]}</span>
            <button type="button" role="switch" aria-checked={row.on} className="od-switch" disabled={write.isPending} onClick={() => toggle(row.key)}>
              <span className="od-switch__knob" aria-hidden="true" />
              <span>{row.on ? s.on : s.off}</span>
            </button>
          </li>
        ))}
      </ul>
      {config.activation_blockers.length ? <p className="od-text-amber">{deskCopy.settingsExtra.blockers(config.activation_blockers.length)}</p> : null}
      <p className="od-text-muted od-small">
        {deskCopy.settingsExtra.policy(config.value?.cadence.policy_version ?? null, config.version, config.updated_at ? absoluteTime(config.updated_at) : null)}
      </p>
      <ConfigurationWriteError error={write.error} />
    </>
  );
}

function RosterPanel({ config, names }: { config: SalesOutreachConfigurationReadDto; names: Map<string, string> }) {
  const write = useConfigurationWrite();
  const value = config.value;
  const [defaultGoal, setDefaultGoal] = useState(String(value?.goals.default_scheduled_goal ?? ""));
  if (!value) return null;
  const schedules = value.goals.rep_work_schedules ?? [];
  const saveDefault = () => {
    const goal = Number(defaultGoal);
    if (!Number.isInteger(goal) || goal < 0) return;
    write.mutate({ config, value: withDefaultGoal(value, goal) });
  };
  const toggleDay = (agentId: string, day: number) => write.mutate({ config, value: withWorkingDayToggled(value, agentId, day) });
  return (
    <>
      <div className="od-inline-form">
        <label>
          {deskCopy.settingsExtra.defaultGoal}
          <input className="od-input" type="number" min={0} max={10000} value={defaultGoal} onChange={(event) => setDefaultGoal(event.target.value)} />
        </label>
        <button type="button" className="od-button" onClick={saveDefault} disabled={write.isPending || defaultGoal === String(value.goals.default_scheduled_goal ?? "")}>
          {s.save}
        </button>
      </div>
      <div className="od-table-wrap">
        <table className="od-table od-table--compact">
          <thead>
            <tr>
              <th scope="col">{deskCopy.team.goals.columns.rep}</th>
              <th scope="col">{deskCopy.settingsExtra.workingDays}</th>
              <th scope="col">{s.goal}</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={3} className="od-empty">
                  {deskCopy.team.goals.empty}
                </td>
              </tr>
            ) : (
              schedules.map((row) => (
                <tr key={row.agent_id}>
                  <th scope="row">{names.get(row.agent_id) ?? deskCopy.text.unknownRep}</th>
                  <td>
                    <div className="od-daypicker" role="group" aria-label={deskCopy.settingsExtra.workingDays}>
                      {WEEKDAYS.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className="od-chip od-chip--small"
                          aria-pressed={row.working_days.includes(index + 1)}
                          disabled={write.isPending}
                          onClick={() => toggleDay(row.agent_id, index + 1)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>{row.scheduled_goal ?? value.goals.default_scheduled_goal ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ConfigurationWriteError error={write.error} />
    </>
  );
}

function ClosuresPanel({ config, today }: { config: SalesOutreachConfigurationReadDto; today: string }) {
  const write = useConfigurationWrite();
  const [date, setDate] = useState("");
  const value = config.value;
  if (!value) return null;
  const holidays = value.cadence.holidays ?? [];
  const save = (next: string[]) => write.mutate({ config, value: withHolidays(value, next) });
  return (
    <>
      <ul className="od-plainlist od-plainlist--chips">
        {holidays.length === 0 ? <li className="od-text-muted">{deskCopy.settingsExtra.noClosures}</li> : null}
        {holidays.map((day) => (
          <li key={day} className="od-chip">
            {shortDateLabel(day)}
            {day >= today ? (
              <button type="button" className="od-linkbutton" aria-label={`${deskCopy.settingsExtra.remove} ${day}`} onClick={() => save(holidays.filter((d) => d !== day))}>
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="od-inline-form">
        <label>
          {deskCopy.settingsExtra.addClosure}
          <input className="od-input" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button type="button" className="od-button" disabled={!date || write.isPending} onClick={() => save([...holidays, date])}>
          {s.save}
        </button>
      </div>
      <ConfigurationWriteError error={write.error} />
    </>
  );
}

function RestrictionRow({ row, onDone }: { row: SalesOutreachRestrictionDto; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [lifting, setLifting] = useState(false);
  const command = useMutation({
    mutationFn: (action: "confirm" | "lift") =>
      salesOutreachCommand(
        "POST",
        action === "confirm" ? salesOutreachPaths.restrictionConfirm(row.restriction_id) : salesOutreachPaths.restrictionLift(row.restriction_id),
        action === "confirm" ? { expected_revision: row.revision } : { expected_revision: row.revision, reason: reason.trim() },
        newIdempotencyKey(`restriction-${action}`),
        salesOutreachRestrictionCommandResponseSchema,
      ),
    onSuccess: onDone,
  });
  return (
    <tr>
      <td>
        {row.channels.map((channel) => deskCopy.settingsExtra.channel[channel]).join(" + ")}
        {row.needs_review ? <span className="od-pill od-pill--amber od-ml">{deskCopy.settingsExtra.needsReview}</span> : null}
      </td>
      <td>{row.origin === "owner" ? deskCopy.settingsExtra.originOwner : deskCopy.settingsExtra.originIntelligence}</td>
      <td title={absoluteTime(row.effective_at)}>{row.reason ?? "—"}</td>
      <td>{row.until ? absoluteTime(row.until) : deskCopy.settingsExtra.noEnd}</td>
      <td>
        <div className="od-inline-form">
          {row.needs_review ? (
            <button type="button" className="od-button" disabled={command.isPending} onClick={() => command.mutate("confirm")}>
              {s.confirm}
            </button>
          ) : null}
          {lifting ? (
            <>
              <input className="od-input" aria-label={s.liftReason} placeholder={s.liftReason} value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
              <button type="button" className="od-button" disabled={!reason.trim() || command.isPending} onClick={() => command.mutate("lift")}>
                {s.lift}
              </button>
            </>
          ) : (
            <button type="button" className="od-button od-button--quiet" onClick={() => setLifting(true)}>
              {s.lift}
            </button>
          )}
        </div>
        {command.error ? <p className="od-lead__error" role="alert">{errorText(command.error)}</p> : null}
      </td>
    </tr>
  );
}

function RestrictionsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: outreachKeys.restrictions("active", null),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.restrictions({ state: "active" }), salesOutreachRestrictionsResponseSchema, signal),
    retry: retryDeskRead,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: outreachKeys.restrictionsAll() as QueryKey });
  if (query.error) return <p className="od-lead__error">{errorText(query.error)}</p>;
  if (!query.data) return <SkeletonLine />;
  const rows = query.data.restrictions;
  return (
    <div className="od-table-wrap">
      <table className="od-table od-table--compact">
        <thead>
          <tr>
            <th scope="col">{deskCopy.settingsExtra.channels}</th>
            <th scope="col">{deskCopy.settingsExtra.origin}</th>
            <th scope="col">{deskCopy.settingsExtra.reason}</th>
            <th scope="col">{deskCopy.settingsExtra.until}</th>
            <th scope="col">{deskCopy.team.goals.columns.action}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="od-empty">
                {deskCopy.settingsExtra.noRestrictions}
              </td>
            </tr>
          ) : (
            rows.map((row) => <RestrictionRow key={row.restriction_id} row={row} onDone={refresh} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function AttendancePanel({ capabilities, reps, today }: { capabilities: SalesOutreachCapabilitiesDto; reps: { id: string; name: string }[]; today: string }) {
  const command = useDayOverrideCommand();
  const [agent, setAgent] = useState("");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<"absence" | "partial_day">("absence");
  const [goal, setGoal] = useState("50");
  const owner = capabilities.scope.role === "owner";
  const revision = capabilities.configuration_revision ?? 0;
  const goalNumber = reason === "absence" ? 0 : Number(goal);
  const valid = Boolean(agent) && Boolean(date) && Number.isInteger(goalNumber) && goalNumber >= 0 && revision >= 1;
  return (
    <>
      <div className="od-inline-form od-inline-form--wrap">
        <label>
          {deskCopy.team.goals.columns.rep}
          <select className="od-select od-select--plain" value={agent} onChange={(event) => setAgent(event.target.value)}>
            <option value="">{deskCopy.settingsExtra.chooseRep}</option>
            {reps.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {deskCopy.settingsExtra.date}
          <input className="od-input" type="date" min={owner ? undefined : today} max={addDays(today, 60)} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          {deskCopy.settingsExtra.kind}
          <select className="od-select od-select--plain" value={reason} onChange={(event) => setReason(event.target.value as "absence" | "partial_day")}>
            <option value="absence">{s.absence}</option>
            <option value="partial_day">{s.partialDay}</option>
          </select>
        </label>
        {reason === "partial_day" ? (
          <label>
            {s.goal}
            <input className="od-input" type="number" min={0} max={10000} value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>
        ) : null}
        <button
          type="button"
          className="od-button od-button--primary"
          disabled={!valid || command.isPending}
          onClick={() => command.mutate({ agentId: agent, body: { expected_revision: revision, business_date: date, goal: goalNumber, reason } })}
        >
          {s.save}
        </button>
      </div>
      {command.data ? <p className="od-text-green" role="status">{s.saved}</p> : null}
      {command.error ? <p className="od-lead__error" role="alert">{errorText(command.error)}</p> : null}
    </>
  );
}

/**
 * The ADM-5 editor panels. Keyed by the configuration revision in `SettingsView`, so drafts reset to the stored
 * value after every committed write (or a write elsewhere).
 */
function ConfigurationEditor({ config, today }: { config: SalesOutreachConfigurationReadDto; today: string }) {
  const value = config.value;
  if (!value) return null;
  const e = deskCopy.configEditor;
  return (
    <>
      <Panel icon={Target} title={e.goalCounts.title} hint={e.goalCounts.hint} testId="settings-goal-counts">
        <GoalCountsEditor config={config} value={value} today={today} />
      </Panel>
      <Panel icon={ToggleRight} title={e.rules.title} hint={e.rules.hint} testId="settings-lead-rules">
        <LeadRulesEditor config={config} value={value} />
      </Panel>
      <Panel icon={UserPlus} title={e.intake.title} hint={e.intake.hint} testId="settings-intake-defaults">
        <IntakeDefaultsEditor config={config} value={value} />
      </Panel>
      <Panel icon={ListOrdered} title={e.priorityMap.title} hint={e.priorityMap.hint} testId="settings-priority-map">
        <PriorityMapView value={value} />
      </Panel>
      <Panel icon={Timer} title={e.capture.title} hint={e.capture.hint} testId="settings-capture-timing">
        <TunablesEditor config={config} value={value} group="capture" />
      </Panel>
      <Panel icon={Gauge} title={e.drain.title} hint={e.drain.hint} testId="settings-evaluate-drain">
        <TunablesEditor config={config} value={value} group="drain" />
      </Panel>
      <Panel icon={Inbox} title={e.migration.title} hint={e.migration.hint} testId="settings-lead-change-intake">
        <TunablesEditor config={config} value={value} group="migration" />
      </Panel>
    </>
  );
}

export function SettingsView({ viewer, capabilities }: { viewer: DeskViewer; capabilities: SalesOutreachCapabilitiesDto }) {
  const owner = viewer.role === "owner";
  const coordinator = viewer.role !== "rep";
  const config = useConfiguration(owner);
  const team = useTeam(null, coordinator && capabilities.desk_available);
  const today = nyDate(capabilities.as_of);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of team.data?.daily_call_goals ?? []) if (row.agent_name) map.set(row.agent_id, row.agent_name);
    return map;
  }, [team.data]);
  const reps = useMemo(() => {
    const ids = new Set<string>([...names.keys(), ...(config.data?.value?.goals.rep_work_schedules ?? []).map((row) => row.agent_id)]);
    return [...ids].map((id) => ({ id, name: names.get(id) ?? deskCopy.text.unknownRep }));
  }, [names, config.data]);
  const subtitle = owner ? s.ownerSubtitle : coordinator ? s.managerSubtitle : s.repSubtitle;
  return (
    <div className="od-scroll">
      <div className="od-page">
        <DeskHeader title={s.title} subtitle={subtitle} />
        {!coordinator ? (
          <section className="od-card od-notice">
            <IconBadge icon={UserCheck} />
            <p>{s.repNote}</p>
          </section>
        ) : null}
        {owner ? (
          config.isPending ? (
            <SkeletonLine height={80} />
          ) : config.data ? (
            <>
              <Panel icon={SlidersHorizontal} title={s.controls} testId="settings-controls">
                <ControlsPanel config={config.data} />
              </Panel>
              <Panel icon={Users} title={s.roster} testId="settings-roster">
                <RosterPanel config={config.data} names={names} />
              </Panel>
              <Panel icon={CalendarX2} title={deskCopy.settingsExtra.closures} testId="settings-closures">
                <ClosuresPanel config={config.data} today={today} />
              </Panel>
              {config.data.value ? <ConfigurationEditor key={config.data.revision} config={config.data} today={today} /> : null}
            </>
          ) : (
            <p className="od-lead__error">{errorText(config.error)}</p>
          )
        ) : null}
        {coordinator && capabilities.permitted_commands.includes("day_override") ? (
          <Panel icon={UserCheck} title={s.attendance} hint={owner ? deskCopy.settingsExtra.attendanceOwner : s.attendanceHint} testId="settings-attendance">
            <AttendancePanel capabilities={capabilities} reps={reps} today={today} />
          </Panel>
        ) : null}
        {owner && capabilities.permitted_commands.includes("restrictions") ? (
          <Panel icon={ShieldAlert} title={s.restrictions} hint={s.restrictionsHint} testId="settings-restrictions">
            <RestrictionsPanel />
          </Panel>
        ) : null}
        {owner ? (
          <>
            <Panel icon={Users} title={s.enrollment} hint={deskCopy.settingsExtra.enrollmentHint} testId="settings-enrollment">
              <EnrollmentPanel />
            </Panel>
            <Panel icon={ClipboardList} title={deskCopy.settingsExtra.admissions.title} hint={deskCopy.settingsExtra.admissions.hint} testId="settings-admissions">
              <AdmissionsPanel today={today} />
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}
