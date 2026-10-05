"use client";
/**
 * Settings (ADM-6). Role-scoped:
 * - Owner: desk controls and the intake gate, roster and daily goals, closures, contact restrictions (the inert
 *   AI-origin rows stay active and blocking until confirmed or lifted, P06c), enrollment ("Not enrolled — older" with
 *   a one-click Enroll), and attendance.
 * - Manager: attendance only (prospective; the server refuses past days, P09b).
 * - Rep: a short note; reps have no desk settings.
 * Every write sends the revision it read and an Idempotency-Key. Configuration writes replace the whole value
 * (`PATCH /configuration`), so the Owner always edits the value just read; a stale write is a 409.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { CalendarX2, ShieldAlert, SlidersHorizontal, UserCheck, Users } from "lucide-react";
import {
  isSalesOutreachApiError,
  newIdempotencyKey,
  salesOutreachCommand,
  salesOutreachConfigurationPatchResponseSchema,
  salesOutreachConfigurationReadSchema,
  salesOutreachEnrollmentApplySchema,
  salesOutreachEnrollmentCandidatesSchema,
  salesOutreachEnrollmentReportSchema,
  salesOutreachPaths,
  salesOutreachRead,
  salesOutreachRestrictionCommandResponseSchema,
  salesOutreachRestrictionsResponseSchema,
  type SalesOutreachCapabilitiesDto,
  type SalesOutreachConfigurationReadDto,
  type SalesOutreachConfigurationValue,
  type SalesOutreachEnrollmentCandidate,
  type SalesOutreachRestrictionDto,
} from "@/lib/api/salesOutreach";
import { outreachKeys } from "@/lib/query/salesOutreach";
import { useDayOverrideCommand } from "../data/use-desk-commands";
import { retryDeskRead, useTeam } from "../data/use-desk-reads";
import type { DeskViewer } from "../shell/desk-shell";
import { absoluteTime, addDays, nyDate, shortDateLabel } from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { DeskHeader, IconBadge, SkeletonLine } from "../primitives";

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

function Panel({ icon, title, hint, children, testId }: { icon: typeof Users; title: string; hint?: string; children: ReactNode; testId?: string }) {
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

function useConfiguration(enabled: boolean) {
  return useQuery({
    queryKey: outreachKeys.configuration(),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.configuration(), salesOutreachConfigurationReadSchema, signal),
    enabled,
    retry: retryDeskRead,
  });
}

/** Replaces the configuration value (the server validates it and fails closed). */
function useConfigurationWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ config, value }: { config: SalesOutreachConfigurationReadDto; value: SalesOutreachConfigurationValue }) =>
      salesOutreachCommand(
        "PATCH",
        salesOutreachPaths.configuration(),
        { expected_revision: config.revision, value },
        newIdempotencyKey("configuration"),
        salesOutreachConfigurationPatchResponseSchema,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey }),
  });
}

const CONTROL_KEYS = ["desk_enabled", "goal_metrics_enabled", "rep_sms_capture_enabled", "cadence_shadow_enabled", "cadence_enforcement_enabled"] as const;

function ControlsPanel({ config }: { config: SalesOutreachConfigurationReadDto }) {
  const write = useConfigurationWrite();
  const value = config.value;
  if (!value) return <p className="od-text-muted">{config.unavailable_reason ?? deskCopy.unavailable.configuration_unavailable}</p>;
  const toggle = (key: (typeof CONTROL_KEYS)[number] | "intake_admission_enabled") => {
    const next: SalesOutreachConfigurationValue =
      key === "intake_admission_enabled"
        ? { ...value, transition: { ...value.transition, intake_admission_enabled: !value.transition.intake_admission_enabled } }
        : { ...value, controls: { ...value.controls, [key]: !value.controls[key] } };
    write.mutate({ config, value: next });
  };
  const rows: { key: (typeof CONTROL_KEYS)[number] | "intake_admission_enabled"; on: boolean }[] = [
    ...CONTROL_KEYS.map((key) => ({ key, on: value.controls[key] })),
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
      {write.error ? <p className="od-lead__error" role="alert">{errorText(write.error)}</p> : null}
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
    write.mutate({ config, value: { ...value, goals: { ...value.goals, default_scheduled_goal: goal } } });
  };
  const toggleDay = (agentId: string, day: number) => {
    const next = schedules.map((row) =>
      row.agent_id === agentId
        ? { ...row, working_days: row.working_days.includes(day) ? row.working_days.filter((d) => d !== day) : [...row.working_days, day].sort() }
        : row,
    );
    write.mutate({ config, value: { ...value, goals: { ...value.goals, rep_work_schedules: next } } });
  };
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
      {write.error ? <p className="od-lead__error" role="alert">{errorText(write.error)}</p> : null}
    </>
  );
}

function ClosuresPanel({ config, today }: { config: SalesOutreachConfigurationReadDto; today: string }) {
  const write = useConfigurationWrite();
  const [date, setDate] = useState("");
  const value = config.value;
  if (!value) return null;
  const holidays = value.cadence.holidays ?? [];
  const save = (next: string[]) => write.mutate({ config, value: { ...value, cadence: { ...value.cadence, holidays: [...new Set(next)].sort() } } });
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
      {write.error ? <p className="od-lead__error" role="alert">{errorText(write.error)}</p> : null}
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

/** One-click Enroll for an eligible older Lead: report (zero writes, manifest) then apply that exact manifest. */
function useEnrollOne() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (candidate: SalesOutreachEnrollmentCandidate) => {
      const cohort = `owner-older-${nyDate(new Date())}`;
      const report = await salesOutreachCommand(
        "POST",
        salesOutreachPaths.enrollmentReport(),
        { selection: { mode: "selected", lead_refs: [candidate.lead] }, kind: "expansion", cohort_id: cohort },
        newIdempotencyKey("enroll-report"),
        salesOutreachEnrollmentReportSchema,
      );
      if (report.lead_refs.length === 0) throw new Error(deskCopy.settingsExtra.notEligible);
      return salesOutreachCommand(
        "POST",
        salesOutreachPaths.enrollmentApply(),
        { kind: "expansion", cohort_id: report.cohort_id, lead_refs: report.lead_refs, manifest_hash: report.manifest_hash },
        newIdempotencyKey("enroll-apply"),
        salesOutreachEnrollmentApplySchema,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: outreachKeys.all as QueryKey }),
  });
}

function EnrollmentPanel() {
  const query = useQuery({
    queryKey: outreachKeys.enrollmentCandidates("older", null),
    queryFn: ({ signal }) => salesOutreachRead(salesOutreachPaths.enrollmentCandidates({ partition: "older", limit: 25 }), salesOutreachEnrollmentCandidatesSchema, signal),
    retry: retryDeskRead,
  });
  const enroll = useEnrollOne();
  if (query.error) return <p className="od-lead__error">{errorText(query.error)}</p>;
  if (!query.data) return <SkeletonLine />;
  const items = query.data.items;
  return (
    <>
      <p className="od-text-muted od-small">{deskCopy.settingsExtra.olderHint(query.data.scope.lookback_days ?? null)}</p>
      <div className="od-table-wrap">
        <table className="od-table od-table--compact">
          <thead>
            <tr>
              <th scope="col">{deskCopy.team.attention.columns.job}</th>
              <th scope="col">{deskCopy.settingsExtra.received}</th>
              <th scope="col">{deskCopy.team.attention.columns.priority}</th>
              <th scope="col">{deskCopy.team.goals.columns.action}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="od-empty">
                  {deskCopy.settingsExtra.noOlder}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.lead.id}>
                  <td>
                    <span className="od-strong">{item.job_no ?? deskCopy.lead.jobPending}</span>
                    {item.name ? <span className="od-cell__sub">{item.name}</span> : null}
                  </td>
                  <td>{item.received_date ? shortDateLabel(item.received_date) : deskCopy.text.unknown}</td>
                  <td>{item.workflow === "quoted" ? deskCopy.workflows.quoted : item.workflow === "new" ? deskCopy.workflows.new : (item.priority_raw ?? deskCopy.text.unknown)}</td>
                  <td>
                    <button type="button" className="od-button" disabled={enroll.isPending} onClick={() => enroll.mutate(item)}>
                      {deskCopy.settingsExtra.enroll}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {enroll.error ? <p className="od-lead__error" role="alert">{isSalesOutreachApiError(enroll.error) && enroll.error.issues?.some((issue) => issue.code === "migration_paused") ? deskCopy.settingsExtra.migrationPaused : errorText(enroll.error)}</p> : null}
      {enroll.data ? <p className="od-text-green" role="status">{deskCopy.settingsExtra.enrolled(enroll.data.status)}</p> : null}
    </>
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
          <Panel icon={Users} title={s.enrollment} hint={deskCopy.settingsExtra.enrollmentHint} testId="settings-enrollment">
            <EnrollmentPanel />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
