"use client";
/**
 * The selected-lead panel (SPECIFICATION §6.1, the right panel of sales-rep-desk.webp): Job Number, phone, name,
 * workflow and schedule day, today's Call and SMS requirements (independent), Copy job #, the next action, recent
 * activity, the Quoted date / callback controls the role may use, assignment for coordinators, this lead's schedule
 * explained from the server's explanation codes and, for a New lead, the capabilities' read-only New lead schedule.
 * Every status is the server's; times are interpolated from `as_of`.
 *
 * A 403/404 means the lead left this viewer's scope (reassignment, foreign id): its cached rows are cleared and the
 * selection is dropped (`onRevoked`).
 */
import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, CircleAlert, CircleCheck, Clock3, UserRound, X } from "lucide-react";
import {
  isSalesOutreachApiError,
  type SalesOutreachCadenceSummaryDto,
  type SalesOutreachChannelDto,
  type SalesOutreachDetailDto,
} from "@/lib/api/salesOutreach";
import { clearSubject } from "@/lib/query/salesOutreach";
import { useDetail } from "../data/use-desk-reads";
import {
  isoToNewYorkLocal,
  newYorkLocalToIso,
  useAssignmentCommand,
  useCallbackCommand,
  useQuotedFollowupCommand,
} from "../data/use-desk-commands";
import {
  absoluteTime,
  cadenceSummaryLines,
  durationWords,
  enrollmentSourceText,
  isUnverified,
  isVerifiedOverdue,
  knownThroughTime,
  nyDate,
  relativeDay,
  reviewReasonText,
  shortDateLabel,
} from "../lib/format";
import { reportUnknownDeskCode } from "../lib/unknown-codes";
import { deskCopy } from "../outreach-desk-copy";
import { CopyJobButton, SkeletonLine } from "../primitives";

const c = deskCopy.lead;
const t = deskCopy.text;

export type RepOption = { id: string; name: string };

type NextAction = { text: string; sub: string | null; tone: "red" | "amber" | "green" | "muted"; icon: typeof Clock3 };

type ReviewFacts = { subject?: Pick<SalesOutreachDetailDto["subject"], "status" | "review_reasons"> };

/** A `projection_state` in words; an unknown value reads as "Pending" (reported). `current` has no line. */
function projectionStateText(state: unknown): string | null {
  if (state === "current" || state === null || state === undefined) return null;
  const text = typeof state === "string" && Object.hasOwn(c.projectionStates, state) ? c.projectionStates[state] : undefined;
  if (text) return text;
  reportUnknownDeskCode({ kind: "explanation_value", code: "projection_state", value: state });
  return t.pending;
}

/** The review reasons the server explains (`review` explanation codes), else the subject's own list. */
function reviewReasonsOf(detail: Pick<SalesOutreachDetailDto, "policy"> & ReviewFacts): unknown[] {
  const explained = detail.policy.explanation.filter((item) => item.code === "review").map((item) => item.value);
  if (explained.length) return explained;
  return detail.subject?.status === "review" ? detail.subject.review_reasons.slice(0, 5) : [];
}

/**
 * The panel's headline action, from the server's channel statuses only. A review subject with nothing due says why it
 * is in review ("Needs review: no phone number to call") instead of a projection state.
 */
export function nextAction(detail: Pick<SalesOutreachDetailDto, "requirements" | "as_of" | "policy"> & ReviewFacts): NextAction {
  const { call, sms } = detail.requirements;
  const since = (channel: SalesOutreachChannelDto) => channel.oldest_actionable_due_at ?? channel.due_at;
  const cooldown = detail.policy.advisory_cooldown.warning ? c.explanation.advisory_cooldown : null;
  if (isVerifiedOverdue(call)) {
    const from = since(call);
    return { text: c.callOverdue, sub: from ? t.overdueBy(durationWords(Date.parse(detail.as_of) - Date.parse(from))) : cooldown, tone: "red", icon: CircleAlert };
  }
  if (isVerifiedOverdue(sms)) return { text: c.smsOverdue, sub: cooldown, tone: "red", icon: CircleAlert };
  // A passed deadline capture can't prove yet: amber "not yet verified", never "overdue" or "due now".
  const unverified = isUnverified(call) ? call : isUnverified(sms) ? sms : null;
  if (unverified) {
    const known = knownThroughTime(unverified.verification?.verified_through, detail.as_of);
    return { text: unverified === call ? c.callNotYetVerified : c.smsNotYetVerified, sub: known ? c.knownThrough(known) : c.waitingCapture, tone: "amber", icon: Clock3 };
  }
  if (call.status === "due") {
    const due = call.due_at && Date.parse(call.due_at) > Date.parse(detail.as_of) && nyDate(call.due_at) === nyDate(detail.as_of);
    // Due now (or with no later deadline today) reads as the reference's red "Next call due now"; due later today is amber.
    return due
      ? { text: c.callDueBy(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(call.due_at as string))), sub: cooldown, tone: "amber", icon: Clock3 }
      : { text: c.nextCallDue, sub: cooldown, tone: "red", icon: Clock3 };
  }
  if (sms.status === "due") return { text: c.smsDue, sub: cooldown, tone: "amber", icon: Clock3 };
  if (call.status === "completed" || sms.status === "completed") return { text: c.allDone, sub: null, tone: "green", icon: CircleCheck };
  const reasons = reviewReasonsOf(detail);
  if (detail.subject?.status === "review" || reasons.length) {
    const more = reasons.length > 1 ? c.moreReviewReasons(reasons.length - 1) : null;
    return { text: reviewReasonText(reasons[0] ?? null), sub: more, tone: "amber", icon: CircleAlert };
  }
  const status = projectionStateText(detail.policy.projection_state);
  if (status) return { text: status, sub: null, tone: "muted", icon: Clock3 };
  return { text: t.noIssue, sub: null, tone: "muted", icon: CircleCheck };
}

/** Explanation codes rendered by their own branch in `explanationLines`; every other known code has a copy line. */
const HANDLED_EXPLANATION_CODES = new Set(["projection_state", "workflow", "schedule_day", "priority_basis", "quoted_date", "review", "engine_state"]);

/**
 * One readable line per explanation code (D01: deterministic codes rendered as text, never generated prose). A code
 * or value without copy is never shown raw: the line falls back ("Needs review", "Pending") or is dropped, and the
 * code is reported (logged once in development).
 */
export function explanationLines(detail: Pick<SalesOutreachDetailDto, "policy" | "requirements"> & ReviewFacts): string[] {
  const lines: string[] = [];
  const workflow = detail.policy.workflow;
  const day = detail.policy.schedule_day;
  if (workflow === "new" && day !== null) lines.push(`${c.newLead} · ${c.dayN(day)}`);
  if (workflow === "quoted") lines.push(c.quotedLead);
  const call = detail.requirements.call.required;
  const sms = detail.requirements.sms.required;
  if (detail.requirements.call.status !== "not_required" || detail.requirements.sms.status !== "not_required") {
    lines.push(c.todayNeeds(c.callsUnit(call), c.smsUnit(sms)));
  }
  let reviewed = false;
  for (const item of detail.policy.explanation) {
    switch (item.code) {
      case "projection_state": {
        const text = projectionStateText(item.value);
        if (text) lines.push(text);
        break;
      }
      case "workflow":
      case "schedule_day":
        break;
      case "priority_basis":
        if (item.value === "intake_default") lines.push(c.explanation.priority_intake_default);
        else if (item.value === "accepted_observation") lines.push(c.explanation.priority_accepted_observation);
        else if (item.value !== "none") reportUnknownDeskCode({ kind: "explanation_value", code: item.code, value: item.value });
        break;
      case "quoted_date":
        lines.push(`${c.explanation.quoted_date}: ${typeof item.value === "string" ? shortDateLabel(item.value) : t.pending}`);
        break;
      case "review":
        reviewed = true;
        lines.push(reviewReasonText(item.value));
        break;
      case "engine_state": {
        const text = typeof item.value === "string" && Object.hasOwn(c.engineStates, item.value) ? c.engineStates[item.value] : undefined;
        if (text) lines.push(text);
        else if (item.value !== "active") reportUnknownDeskCode({ kind: "explanation_value", code: item.code, value: item.value });
        break;
      }
      default: {
        const text = Object.hasOwn(c.explanation, item.code) && !HANDLED_EXPLANATION_CODES.has(item.code) ? c.explanation[item.code] : undefined;
        if (text) lines.push(text);
        else reportUnknownDeskCode({ kind: "explanation_code", code: null, value: item.code });
      }
    }
  }
  // An older server (or a truncated explanation) may carry the review status without `review` codes.
  if (!reviewed && detail.subject?.status === "review") {
    const reasons = detail.subject.review_reasons.slice(0, 5);
    if (reasons.length) for (const reason of reasons) lines.push(reviewReasonText(reason));
    else lines.push(reviewReasonText(null));
  }
  return [...new Set(lines)];
}

function ActivityList({ detail }: { detail: SalesOutreachDetailDto }) {
  const events = [...detail.history.contact_events].sort((a, b) => Date.parse(b.event_at) - Date.parse(a.event_at)).slice(0, 5);
  if (events.length === 0) return <p className="od-lead__muted">{c.noActivity}</p>;
  return (
    <ol className="od-timeline">
      {events.map((event, index) => {
        const verification = c.verification[event.verification] ?? "";
        const red = event.kind === "sms_failed" || event.kind === "inbound_missed";
        return (
          <li key={event.event_id} className="od-timeline__item" data-first={index === 0 ? "true" : undefined}>
            <span className={`od-timeline__dot${red ? " od-timeline__dot--red" : ""}`} aria-hidden="true" />
            <span title={absoluteTime(event.event_at)}>{relativeDay(event.event_at, detail.as_of)}</span>
            <span aria-hidden="true"> · </span>
            <span>{c.events[event.kind] ?? c.events.other}</span>
            {event.actor_agent_name ? <span className="od-lead__muted"> · {event.actor_agent_name}</span> : null}
            {verification ? <span className={red ? "od-text-red" : "od-text-amber"}> · {verification}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function AssignmentControl({ detail, reps }: { detail: SalesOutreachDetailDto; reps: RepOption[] }) {
  const id = useId();
  const [value, setValue] = useState(detail.assignment.assigned_agent_id ?? "");
  const command = useAssignmentCommand(detail.subject.subject_id);
  const current = detail.assignment.assigned_agent_id ?? "";
  const options = reps.some((rep) => rep.id === current) || !current ? reps : [...reps, { id: current, name: detail.assignment.assigned_agent_name ?? t.unknownRep }];
  return (
    <div className="od-lead__control">
      <label htmlFor={id} className="od-lead__label">
        {c.assignLabel}
      </label>
      <div className="od-lead__row">
        <select id={id} className="od-select od-select--plain" value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">{t.unassigned}</option>
          {options.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="od-button"
          disabled={value === current || command.isPending}
          onClick={() => command.mutate({ expected_revision: detail.assignment.assignment_revision, agent_id: value || null })}
        >
          {c.saveAssign}
        </button>
      </div>
      <CommandError error={command.error} />
    </div>
  );
}

function QuotedDateControl({ detail }: { detail: SalesOutreachDetailDto }) {
  const id = useId();
  const active = detail.plan.active;
  const [value, setValue] = useState(detail.policy.quoted?.selected_date ?? "");
  const command = useQuotedFollowupCommand(detail.subject.subject_id);
  const period = detail.policy.period;
  if (!period) return null;
  const replace = Boolean(active && active.kind !== "quoted_date");
  return (
    <div className="od-lead__control">
      <label htmlFor={id} className="od-lead__label">
        {c.quotedDate}
      </label>
      <div className="od-lead__row">
        <input id={id} type="date" className="od-input" value={value} min={nyDate(detail.as_of)} onChange={(event) => setValue(event.target.value)} />
        <button
          type="button"
          className="od-button"
          disabled={!value || value === detail.policy.quoted?.selected_date || command.isPending}
          onClick={() =>
            command.mutate({ expected_revision: detail.plan.plan_revision, period_id: period.period_id, selected_date: value, ...(replace ? { replace_active_plan: true } : {}) })
          }
        >
          {c.setQuoted}
        </button>
      </div>
      <CommandError error={command.error} />
    </div>
  );
}

function CallbackControl({ detail }: { detail: SalesOutreachDetailDto }) {
  const id = useId();
  const active = detail.plan.active?.kind === "callback" ? detail.plan.active : null;
  const [value, setValue] = useState(active?.appointment_at ? isoToNewYorkLocal(active.appointment_at) : "");
  const command = useCallbackCommand(detail.subject.subject_id);
  const [open, setOpen] = useState(false);
  const iso = newYorkLocalToIso(value);
  const replace = Boolean(detail.plan.active && detail.plan.active.kind !== "callback");
  if (!active && !open) {
    return (
      <button type="button" className="od-linkbutton od-lead__toggle" onClick={() => setOpen(true)}>
        {c.scheduleCallback}
      </button>
    );
  }
  return (
    <div className="od-lead__control">
      <label htmlFor={id} className="od-lead__label">
        {active?.appointment_at ? c.callbackAt(absoluteTime(active.appointment_at)) : c.callback}
      </label>
      <div className="od-lead__row">
        <input id={id} type="datetime-local" className="od-input" value={value} onChange={(event) => setValue(event.target.value)} />
        <button
          type="button"
          className="od-button"
          disabled={!iso || command.isPending}
          onClick={() =>
            iso &&
            command.mutate(
              active
                ? { operation: "reschedule", expected_revision: detail.plan.plan_revision, appointment_at: iso }
                : { operation: "set", expected_revision: detail.plan.plan_revision, appointment_at: iso, ...(replace ? { replace_active_plan: true } : {}) },
            )
          }
        >
          {c.setCallback}
        </button>
        {active ? (
          <button type="button" className="od-button od-button--quiet" disabled={command.isPending} onClick={() => command.mutate({ operation: "cancel", expected_revision: detail.plan.plan_revision })}>
            {c.cancelCallback}
          </button>
        ) : null}
      </div>
      <CommandError error={command.error} />
    </div>
  );
}

function CommandError({ error }: { error: unknown }) {
  if (!error) return null;
  const text = isSalesOutreachApiError(error)
    ? error.code === "REVISION_CONFLICT"
      ? deskCopy.errors.conflict
      : error.status === 403
        ? deskCopy.errors.forbidden
        : deskCopy.errors.failed(error.message)
    : deskCopy.errors.failed(null);
  return (
    <p className="od-lead__error" role="alert">
      {text}
    </p>
  );
}

export function LeadPanel({
  subjectId,
  commands,
  cadenceSummary = null,
  reps,
  onRevoked,
  onClose,
}: {
  subjectId: string;
  /** The server's `permitted_commands` for this viewer. */
  commands: readonly string[];
  /** The capabilities' read-only New lead schedule, shown for New leads. */
  cadenceSummary?: SalesOutreachCadenceSummaryDto | null;
  /** Coordinators: the reps they may assign to. */
  reps: RepOption[] | null;
  onRevoked: () => void;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useDetail(subjectId);
  const error = query.error;
  const revoked = isSalesOutreachApiError(error) && error.revokesAccess;
  useEffect(() => {
    if (!revoked) return;
    clearSubject(queryClient, subjectId);
    onRevoked();
  }, [revoked, queryClient, subjectId, onRevoked]);

  const detail = query.data;
  return (
    <aside className="od-card od-lead" aria-label={c.region} aria-busy={query.isFetching}>
      {onClose ? (
        <button type="button" className="od-lead__close od-button od-button--quiet" onClick={onClose} aria-label={c.close}>
          <X aria-hidden="true" />
        </button>
      ) : null}
      {revoked ? (
        <p className="od-lead__muted" role="status">
          {c.revoked}
        </p>
      ) : !detail ? (
        error ? (
          <p className="od-lead__error" role="alert">
            {deskCopy.errors.failed(null)}
          </p>
        ) : (
          <div className="od-lead__loading" aria-label={c.loading}>
            <SkeletonLine width="60%" height={22} />
            <SkeletonLine width="40%" />
            <SkeletonLine width="50%" />
            <SkeletonLine height={38} />
          </div>
        )
      ) : (
        <LeadPanelBody detail={detail} commands={commands} cadenceSummary={cadenceSummary} reps={reps} />
      )}
    </aside>
  );
}

function LeadPanelBody({
  detail,
  commands,
  cadenceSummary,
  reps,
}: {
  detail: SalesOutreachDetailDto;
  commands: readonly string[];
  cadenceSummary: SalesOutreachCadenceSummaryDto | null;
  reps: RepOption[] | null;
}) {
  const s = detail.subject;
  const next = nextAction(detail);
  const NextIcon = next.icon;
  const lines = explanationLines(detail);
  const schedule = detail.policy.workflow === "new" ? cadenceSummaryLines(cadenceSummary) : [];
  const workflowLine =
    detail.policy.workflow === "new"
      ? [c.newLead, detail.policy.schedule_day !== null ? c.dayN(detail.policy.schedule_day) : null].filter(Boolean).join(" · ")
      : detail.policy.workflow === "quoted"
        ? [c.quotedLead, detail.policy.quoted?.selected_date ? shortDateLabel(detail.policy.quoted.selected_date) : null].filter(Boolean).join(" · ")
        : null;
  const call = detail.requirements.call;
  const sms = detail.requirements.sms;
  const today =
    call.status !== "not_required" || sms.status !== "not_required" ? c.todayNeeds(c.callsUnit(call.required), c.smsUnit(sms.required)) : null;
  const canQuoted = commands.includes("quoted_followup") && detail.policy.workflow === "quoted";
  const canCallback = commands.includes("callback");
  const canAssign = commands.includes("assignment") && reps !== null;
  return (
    <div className="od-lead__body" key={detail.subject.subject_id}>
      <div>
        <h2 className="od-lead__job">{s.job_no ?? c.jobPending}</h2>
        {s.phone ? <p className="od-lead__phone">{s.phone}</p> : null}
        {s.name ? <p className="od-lead__name">{s.name}</p> : null}
        {workflowLine ? <p className="od-lead__meta">{workflowLine}</p> : null}
        {today ? <p className="od-lead__meta">{today}</p> : null}
        <p className="od-lead__meta" data-testid="lead-enrollment">
          {enrollmentSourceText(s.enrollment)}
        </p>
      </div>
      <CopyJobButton jobNo={s.job_pending ? null : s.job_no} block />
      <div className={`od-lead__next od-lead__next--${next.tone}`}>
        <NextIcon aria-hidden="true" />
        <div>
          <p className="od-lead__next-title">{next.text}</p>
          {next.sub ? <p className="od-lead__muted">{next.sub}</p> : null}
        </div>
      </div>
      {canAssign ? <AssignmentControl detail={detail} reps={reps ?? []} /> : detail.assignment.assigned_agent_name ? (
        <p className="od-lead__meta">
          <UserRound aria-hidden="true" width={14} height={14} /> {c.assignedTo} {detail.assignment.assigned_agent_name}
        </p>
      ) : null}
      {canQuoted ? <QuotedDateControl detail={detail} /> : null}
      {canCallback ? <CallbackControl detail={detail} /> : null}
      <section aria-labelledby={`${s.subject_id}-activity`}>
        <h3 id={`${s.subject_id}-activity`} className="od-lead__section">
          {c.recentActivity}
        </h3>
        <ActivityList detail={detail} />
      </section>
      <section className="od-infobox">
        <BarChart3 aria-hidden="true" />
        <div>
          <h3>{c.automaticTitle}</h3>
          <p>{c.automaticBody}</p>
        </div>
      </section>
      {lines.length ? (
        <section className="od-infobox">
          <CalendarDays aria-hidden="true" />
          <div>
            <h3>{c.policyTitle}</h3>
            <ul>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {schedule.length ? (
        <section className="od-infobox" data-testid="lead-schedule">
          <CalendarDays aria-hidden="true" />
          <div>
            <h3>{c.schedule.title}</h3>
            <ul>
              {schedule.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      <p className="od-lead__foot">{c.footnote}</p>
    </div>
  );
}
