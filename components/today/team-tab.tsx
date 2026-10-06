"use client";
/**
 * Today > Team (owner only): a read-only summary of the Outreach Desk's Team outreach frame, built from the same
 * reads (`useCapabilities`, `useTeam`) and the same arithmetic as `TeamView`. Nothing here can act: assignment,
 * callbacks and overrides stay in the desk where they are audited.
 */
import Link from "next/link";
import { CircleAlert, NotebookText, Phone, Star, Users } from "lucide-react";
import { repGoalReachedAtById } from "@/components/daily/milestone";
import {
  CrmCard,
  Notice,
  Person,
  Pill,
  ReadFailure,
  SkeletonLine,
  SummaryCard,
  Track,
  formatTime,
} from "@/components/ui/crm";
import { deskViewHref } from "@/components/outreach-desk/data/desk-url";
import { useCapabilities, useTeam } from "@/components/outreach-desk/data/use-desk-reads";
import {
  cadenceMetricText,
  countText,
  percentText,
  priorityPill,
  relativeDay,
  repGoalText,
  repProgressLabel,
  rowIssue,
} from "@/components/outreach-desk/lib/format";
import { deskCopy } from "@/components/outreach-desk/outreach-desk-copy";
import type {
  SalesOutreachCapabilitiesDto,
  SalesOutreachDailyCallGoalRow,
  SalesOutreachQueueRowDto,
  SalesOutreachTeamDto,
} from "@/lib/api/salesOutreach";
import { usePulseEvents } from "./pulse-view";
import { todayCopy } from "./today-copy";

const c = todayCopy.team;
const ATTENTION_LIMIT = 10;

function unavailableReason(capabilities: SalesOutreachCapabilitiesDto): string {
  const reasons = deskCopy.unavailable;
  const reason = capabilities.unavailable_reason;
  return reason && reason in reasons ? (reasons[reason as keyof typeof reasons] as string) : reasons.error;
}

function GoalRow({ row, goalReachedAt }: { row: SalesOutreachDailyCallGoalRow; goalReachedAt?: string }) {
  const name = row.agent_name ?? deskCopy.text.unknownRep;
  const hasGoal = row.goal_state === "goal";
  const overdue = cadenceMetricText(row.overdue_leads);
  const progress = repProgressLabel(row);
  return (
    <tr data-agent={row.agent_id}>
      <th scope="row">
        <Person name={row.agent_name} fallback={deskCopy.text.unknownRep} />
        {goalReachedAt ? (
          <div>
            <Pill variant="gold" icon={Star}>
              {todayCopy.milestones.goalReached(formatTime(goalReachedAt))}
            </Pill>
          </div>
        ) : null}
      </th>
      <td className="crm-nowrap">{hasGoal ? repGoalText(row) : row.actual_confirmed !== null ? String(row.actual_confirmed) : "—"}</td>
      <td style={{ minWidth: 160 }}>
        {hasGoal ? (
          <div className="flex items-center gap-2">
            <div className="min-w-24 flex-1">
              <Track progress={row.progress} done={row.goal_reached === true} label={`${name}: ${progress.text}`} />
            </div>
            <span className={progress.tone === "green" ? "crm-text-green crm-small" : "crm-text-muted crm-small"}>{progress.text}</span>
          </div>
        ) : (
          <span className="crm-text-muted">{row.goal_label}</span>
        )}
      </td>
      <td>{hasGoal ? countText(row.remaining) : "—"}</td>
      <td>
        {overdue.available ? (
          <span className={row.overdue_leads.value ? "crm-text-red crm-strong" : "crm-text-muted"}>
            {row.overdue_leads.value ? c.goals.overdueCount(row.overdue_leads.value) : c.goals.none}
          </span>
        ) : (
          <span className="crm-text-muted" title={overdue.reason ?? undefined}>
            —
          </span>
        )}
      </td>
      <td>
        <Link className="crm-link" href={deskViewHref("my", { agent: row.agent_id })} aria-label={`${c.goals.viewQueue}: ${name}`}>
          {c.goals.viewQueue}
        </Link>
      </td>
    </tr>
  );
}

function AttentionRow({ row, asOf }: { row: SalesOutreachQueueRowDto; asOf: string }) {
  const issue = rowIssue(row, asOf);
  const pill = priorityPill(row);
  return (
    <tr data-subject={row.subject_id}>
      <th scope="row">{row.job_no ?? c.attention.jobPending}</th>
      <td>
        <Person name={row.assigned_agent_name} fallback={deskCopy.text.unassigned} />
      </td>
      <td>
        <Pill variant={pill.variant}>{pill.text}</Pill>
      </td>
      <td title={issue.title}>{issue.text}</td>
      <td>{relativeDay(row.last_interaction_at, asOf)}</td>
    </tr>
  );
}

/** The summary cards' arithmetic is `TeamView`'s: outbound, reps at goal, overdue, quoted, goalsOff. */
export function TeamSummaryView({
  team,
  error,
  onRetry,
  goalReachedAt,
}: {
  team: SalesOutreachTeamDto | undefined;
  error?: unknown;
  onRetry?: () => void;
  /** Rep id -> when that rep reached today's goal (the Outreach milestone facts); marks the row "Goal reached 2:41 PM". */
  goalReachedAt?: ReadonlyMap<string, string>;
}) {
  const failed = Boolean(error) && !team;
  const goals = team?.goals ?? null;
  const goalsOff = team ? !team.goal_metrics_enabled || goals === null : false;
  const outbound = goals
    ? { actual: goals.outbound_calls.actual, goal: goals.outbound_calls.goal, progress: goals.outbound_calls.progress, pending: goals.outbound_calls.pending_agent_ids.length }
    : null;
  const atGoal = goals?.reps_at_goal ?? null;
  const overdue = team ? cadenceMetricText(team.distinct_overdue_leads) : null;
  const quoted = team ? cadenceMetricText(team.quoted_overdue_leads) : null;
  const rows = team?.daily_call_goals ?? null;
  const attention = team?.leads_needing_attention.rows ?? null;
  const asOf = team?.as_of ?? "";
  const scopeLabel = goals?.count_scope_label ?? c.cards.outbound;
  const placeholder = (width: number) => (failed ? c.unavailable : <SkeletonLine width={width} height={22} />);

  return (
    <div className="crm-stack" data-testid="today-team">
      {error ? <ReadFailure what={c.loadError} error={error} onRetry={onRetry} testId="today-team-error" /> : null}
      <div className="crm-summary-row">
        <SummaryCard
          testId="today-team-outbound"
          icon={Phone}
          tone="blue"
          title={scopeLabel}
          value={goalsOff ? c.unavailable : outbound ? `${countText(outbound.actual)} / ${outbound.goal}` : placeholder(90)}
          progress={goalsOff || !outbound ? null : { value: outbound.progress, label: scopeLabel }}
          caption={
            goalsOff
              ? c.goalsOff
              : outbound
                ? outbound.pending
                  ? c.partial(outbound.pending)
                  : percentText(outbound.progress)
                    ? c.ofGoal(percentText(outbound.progress) as string)
                    : null
                : null
          }
        />
        <SummaryCard
          testId="today-team-at-goal"
          icon={Users}
          tone="green"
          title={c.cards.repsAtGoal}
          value={goalsOff ? c.unavailable : atGoal ? `${atGoal.count} / ${atGoal.of}` : placeholder(60)}
          progress={goalsOff || !atGoal ? null : { value: atGoal.of ? atGoal.count / atGoal.of : null, done: atGoal.of > 0 && atGoal.count === atGoal.of, label: c.cards.repsAtGoal }}
          caption={
            goalsOff || !atGoal
              ? null
              : atGoal.of === 0
                ? c.noGoals
                : atGoal.pending
                  ? c.partial(atGoal.pending)
                  : c.ofReps(percentText(atGoal.count / atGoal.of) as string)
          }
        />
        <SummaryCard
          testId="today-team-overdue"
          icon={CircleAlert}
          tone="red"
          title={c.cards.overdue}
          value={overdue ? (overdue.available ? overdue.text : c.unavailable) : placeholder(40)}
          caption={overdue && !overdue.available ? overdue.reason : null}
        />
        <SummaryCard
          testId="today-team-quoted"
          icon={NotebookText}
          tone="amber"
          title={c.cards.quotedGaps}
          value={quoted ? (quoted.available ? quoted.text : c.unavailable) : placeholder(40)}
          caption={quoted && !quoted.available ? quoted.reason : null}
        />
      </div>

      <CrmCard title={c.goals.title} testId="today-team-goals" foot={c.readOnly}>
        {goalsOff ? (
          <p className="crm-empty">{c.goalsOff}</p>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th scope="col">{c.goals.columns.rep}</th>
                  <th scope="col">{c.goals.columns.calls}</th>
                  <th scope="col">{c.goals.columns.progress}</th>
                  <th scope="col">{c.goals.columns.remaining}</th>
                  <th scope="col">{c.goals.columns.overdue}</th>
                  <th scope="col">{c.goals.columns.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  <tr>
                    <td colSpan={6} className="crm-text-muted">
                      {failed ? c.unavailable : <SkeletonLine />}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="crm-text-muted">
                      {c.goals.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => <GoalRow key={row.agent_id} row={row} goalReachedAt={goalReachedAt?.get(row.agent_id)} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </CrmCard>

      <CrmCard
        title={c.attention.title}
        testId="today-team-attention"
        tools={
          <Link className="crm-link" href={c.attention.seeAllHref}>
            {c.attention.seeAll}
          </Link>
        }
      >
        {team && attention === null ? (
          <p className="crm-empty">{c.attention.unavailable}</p>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th scope="col">{c.attention.columns.job}</th>
                  <th scope="col">{c.attention.columns.owner}</th>
                  <th scope="col">{c.attention.columns.priority}</th>
                  <th scope="col">{c.attention.columns.issue}</th>
                  <th scope="col">{c.attention.columns.last}</th>
                </tr>
              </thead>
              <tbody>
                {attention === null ? (
                  <tr>
                    <td colSpan={5} className="crm-text-muted">
                      {failed ? c.unavailable : <SkeletonLine />}
                    </td>
                  </tr>
                ) : attention.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="crm-text-muted">
                      {c.attention.empty}
                    </td>
                  </tr>
                ) : (
                  attention.slice(0, ATTENTION_LIMIT).map((row) => <AttentionRow key={row.subject_id} row={row} asOf={asOf} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </CrmCard>
    </div>
  );
}

export function TeamTab() {
  const capabilities = useCapabilities();
  const deskAvailable = capabilities.data?.desk_available !== false;
  const team = useTeam(null, deskAvailable);
  const events = usePulseEvents();

  if (capabilities.data && capabilities.data.desk_available === false) {
    return (
      <Notice icon={Users} tone="amber" title={c.unavailableTitle} testId="today-team-unavailable">
        <p>{unavailableReason(capabilities.data)}</p>
        <p>
          <Link className="crm-link" href={c.settingsHref}>
            {c.openSettings}
          </Link>
        </p>
      </Notice>
    );
  }
  return (
    <TeamSummaryView
      team={team.data}
      error={team.error}
      onRetry={() => void team.refetch()}
      goalReachedAt={repGoalReachedAtById(events.data?.items ?? [])}
    />
  );
}
