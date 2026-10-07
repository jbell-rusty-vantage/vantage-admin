"use client";
/**
 * Team outreach (ADM-5; SPECIFICATION §6.2, references/manager-desk.webp). Owner and Manager see the same desk (V02);
 * server capabilities decide the commands. M1 parts first: the four summary cards and the Daily call goals table
 * (`GET /team`). Then the compact Operations today strip and Leads needing attention.
 *
 * Rendering rules (server handoff): a null count is pending, never 0; `cadence_disabled` / `cadence_shadow` metrics
 * are unavailable; 108/100 shows a capped bar and 0 remaining; zero-goal reps say "No goal today" and are outside the
 * denominator; the label is the server's count scope ("Outbound calls"), with "Other outbound" kept separate. Nothing
 * here computes overdue or order. A failed `GET /team` (or attention queue) read is said in words, never left as
 * skeletons (ADM-0).
 */
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, CircleAlert, Clock3, Info, NotebookText, Phone, Users } from "lucide-react";
import { fetchDailyOperationsSnapshot, normalizeDailyOperationsSnapshot } from "@/lib/api/dailyOperations";
import { queryKeys } from "@/lib/query/keys";
import type { SalesOutreachCapabilitiesDto, SalesOutreachDailyCallGoalRow, SalesOutreachQueueRowDto, SalesOutreachTeamDto } from "@/lib/api/salesOutreach";
import { useQueue, useTeam } from "../data/use-desk-reads";
import { useDeskUrl } from "../data/use-desk-url";
import { deskViewHref } from "../data/desk-url";
import type { DeskViewer } from "../shell/desk-shell";
import {
  absoluteTime,
  alternateCountText,
  businessDateLabel,
  cadenceMetricText,
  countText,
  goalCoverageNote,
  nyDate,
  otherOutboundFootnote,
  otherOutboundTitle,
  ownerText,
  percentText,
  priorityPill,
  readFailureText,
  relativeDay,
  repGoalText,
  repProgressLabel,
  repZeroActivityTitle,
  rowIssue,
  shortDateLabel,
  unassignedCaption,
} from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { CopyJobButton, DeskHeader, DeskSelect, FreshnessChips, Pill, ReadFailure, SearchBox, Segmented, SkeletonLine, SummaryCard, Track } from "../primitives";
import { LeadCostCard } from "./lead-cost-card";
import { LeadPanel, type RepOption } from "./lead-panel";

const c = deskCopy.team;
const t = deskCopy.text;

type WorkflowFilter = "all" | "new" | "quoted";
type SortValue = "urgency" | "lead_received" | "last_interaction";

function scopeSubtitle(team: SalesOutreachTeamDto): string {
  const scope = team.goals?.count_scope;
  const words = scope === "eligible_new_quoted" ? c.goals.scopeEligible : scope === "mixed" ? c.goals.scopeMixed : c.goals.scopeAll;
  return c.goals.subtitle(words);
}

function GoalRow({ row, workflow }: { row: SalesOutreachDailyCallGoalRow; workflow: WorkflowFilter }) {
  const progress = repProgressLabel(row);
  const overdue = cadenceMetricText(row.overdue_leads);
  const hasGoal = row.goal_state === "goal";
  // The other scope's count ("12 to enrolled Leads", C1b) and capture coverage in words (partial vs unknown).
  const alternate = alternateCountText(row.count_scope, row.alternate_scope ? { count_scope: row.alternate_scope.count_scope, actual: row.alternate_scope.actual_confirmed } : null);
  const coverage = hasGoal ? goalCoverageNote(row.coverage) : null;
  return (
    <tr data-agent={row.agent_id}>
      <th scope="row" className="od-strong">
        {row.agent_name ?? t.unknownRep}
      </th>
      <td>
        <span className="od-nowrap" title={repZeroActivityTitle(row)}>
          {hasGoal ? repGoalText(row) : row.actual_confirmed !== null ? c.goals.callsOnly(row.actual_confirmed) : "—"}
        </span>
        {row.actual_awaiting_confirmation ? (
          <span className="od-cell__sub" title={c.goals.awaitingTitle}>
            {c.goals.awaiting(row.actual_awaiting_confirmation)}
          </span>
        ) : null}
        {alternate ? (
          <span className="od-cell__sub od-nowrap" title={alternate.title} data-testid="goal-row-alternate">
            {alternate.text}
          </span>
        ) : null}
        {row.other_outbound.count ? (
          <span className="od-cell__sub" title={otherOutboundTitle(row.other_outbound, row.count_scope)} data-testid="goal-row-other">
            {c.cards.otherOutbound(String(row.other_outbound.count))}
          </span>
        ) : null}
      </td>
      <td className="od-goal-progress">
        {hasGoal ? (
          <div className="od-goal-progress__inner">
            <Track progress={row.progress} done={row.goal_reached === true} label={`${row.agent_name ?? t.unknownRep}: ${progress.text}`} />
            <span className={progress.tone === "green" ? "od-text-green od-goal-progress__label" : "od-text-muted od-goal-progress__label"}>{progress.text}</span>
          </div>
        ) : (
          <span className="od-text-muted">{row.goal_label}</span>
        )}
        {coverage ? (
          <span className="od-cell__sub" title={coverage.title}>
            {coverage.text}
          </span>
        ) : null}
      </td>
      <td>{hasGoal ? countText(row.remaining) : "—"}</td>
      <td>
        {overdue.available ? (
          <span className={row.overdue_leads.value ? "od-text-red od-strong-red" : "od-text-muted"}>
            {row.overdue_leads.value ? c.goals.overdueCount(row.overdue_leads.value) : c.goals.noneOverdue}
          </span>
        ) : (
          <span className="od-text-muted" title={overdue.reason ?? undefined}>
            —
          </span>
        )}
      </td>
      <td>
        <Link
          className="od-button"
          href={`${deskViewHref("my", { agent: row.agent_id })}${workflow !== "all" ? `&workflow=${workflow}` : ""}`}
          aria-label={`${c.goals.viewQueue}: ${row.agent_name ?? t.unknownRep}`}
        >
          {c.goals.viewQueue}
        </Link>
      </td>
    </tr>
  );
}

function AttentionRow({ row, asOf, selected, onSelect }: { row: SalesOutreachQueueRowDto; asOf: string; selected: boolean; onSelect: (id: string) => void }) {
  const issue = rowIssue(row, asOf);
  const pill = priorityPill(row);
  const IssueIcon = issue.icon === "alert" ? CircleAlert : issue.icon === "clock" ? Clock3 : Info;
  return (
    <tr
      data-selectable="true"
      aria-selected={selected}
      tabIndex={0}
      data-subject={row.subject_id}
      onClick={() => onSelect(row.subject_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(row.subject_id);
        }
      }}
    >
      <td>
        <span className="od-strong od-job">{row.job_no ?? deskCopy.lead.jobPending}</span>
        {row.phone ? <span className="od-cell__sub">{row.phone}</span> : null}
      </td>
      <td>{ownerText(row)}</td>
      <td>
        <Pill variant={pill.variant}>{pill.text}</Pill>
      </td>
      <td>
        <span className={`od-issue od-issue--${issue.tone}`} title={issue.title}>
          <IssueIcon aria-hidden="true" />
          {issue.text}
        </span>
      </td>
      <td title={absoluteTime(row.last_interaction_at)}>{relativeDay(row.last_interaction_at, asOf)}</td>
      <td>
        <CopyJobButton jobNo={row.job_pending ? null : row.job_no} />
      </td>
    </tr>
  );
}

function OperationsStrip() {
  const snapshot = useQuery({
    queryKey: queryKeys.dailyOperations.snapshot(),
    queryFn: async () => normalizeDailyOperationsSnapshot(await fetchDailyOperationsSnapshot()),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
  const m = snapshot.data?.metrics;
  const unreconstructable = m?.texts.unreconstructable_sent_day ?? 0;
  return (
    <section className="od-card od-ops" aria-label={c.operations.title} data-testid="operations-strip">
      <span className="od-ops__title">
        <Calendar aria-hidden="true" width={16} height={16} />
        {c.operations.title}
      </span>
      {snapshot.isError ? (
        <span className="od-text-muted">{c.operations.unavailable}</span>
      ) : (
        <span className="od-ops__metrics">
          <span>
            {c.operations.leads} <strong>{m ? m.leads.today : "…"}</strong>
          </span>
          <span>
            {c.operations.bookings} <strong>{m ? m.bookings.today : "…"}</strong>
          </span>
          <span>
            {c.operations.cancellations} <strong>{m ? m.cancellations.today : "…"}</strong>
          </span>
          <span title={c.operations.textsScope}>
            {c.operations.texts} <strong>{m ? m.texts.today : "…"}</strong> <span className="od-text-muted">({c.operations.textsScope})</span>
          </span>
          {unreconstructable > 0 ? <span className="od-text-amber">{c.operations.unreconstructable(unreconstructable)}</span> : null}
        </span>
      )}
      <Link href="/daily" className="od-ops__link">
        {c.operations.open}
        <ArrowRight aria-hidden="true" width={14} height={14} />
      </Link>
    </section>
  );
}

export function TeamView({ viewer, capabilities }: { viewer: DeskViewer; capabilities: SalesOutreachCapabilitiesDto }) {
  const url = useDeskUrl(viewer.role);
  const day = url.get("day");
  const agent = url.get("agent");
  const unassigned = url.get("unassigned") === "true";
  const workflow = (url.get("workflow") ?? "all") as WorkflowFilter;
  const q = url.get("q");
  const sort = (url.get("sort") ?? "urgency") as SortValue;
  const lead = url.get("lead");

  const team = useTeam(day, true);
  const data = team.data;
  // A failed read with nothing cached: every placeholder says "Unavailable" instead of loading forever.
  const failed = Boolean(team.error) && !data;
  const asOf = data?.as_of ?? capabilities.as_of;
  const today = nyDate(asOf);
  const cadenceOn = capabilities.controls.cadence_shadow_enabled || capabilities.controls.cadence_enforcement_enabled;
  const filtered = Boolean(agent || unassigned || workflow !== "all" || q || sort !== "urgency");
  const attentionQueue = useQueue(
    {
      agent_id: agent,
      unassigned,
      workflow: workflow === "all" ? null : workflow,
      search: q,
      sort,
      direction: sort === "lead_received" ? "desc" : sort === "last_interaction" ? "asc" : null,
      state: "needs_contact",
      limit: 10,
    },
    filtered && cadenceOn,
  );

  const rows = data?.daily_call_goals ?? null;
  const reps: RepOption[] = useMemo(
    () => (rows ?? []).map((row) => ({ id: row.agent_id, name: row.agent_name ?? t.unknownRep })),
    [rows],
  );
  const selectedRep = agent ? (rows?.find((row) => row.agent_id === agent) ?? null) : null;
  const shownRows = rows ? (agent ? rows.filter((row) => row.agent_id === agent) : rows) : null;

  const dayOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [{ value: "", label: c.today }];
    for (let back = 1; back <= 6; back += 1) {
      const date = new Date(Date.parse(`${today}T12:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10);
      options.push({ value: date, label: back === 1 ? t.yesterday : shortDateLabel(date) });
    }
    if (day && !options.some((option) => option.value === day)) options.push({ value: day, label: shortDateLabel(day) });
    return options;
  }, [today, day]);

  const goals = data?.goals ?? null;
  const goalsOff = data ? !data.goal_metrics_enabled || goals === null : false;
  const outbound = selectedRep
    ? { actual: selectedRep.actual_confirmed, goal: selectedRep.goal ?? 0, progress: selectedRep.progress, pending: selectedRep.actual_confirmed === null ? 1 : 0, done: selectedRep.goal_reached === true }
    : goals
      ? { actual: goals.outbound_calls.actual, goal: goals.outbound_calls.goal, progress: goals.outbound_calls.progress, pending: goals.outbound_calls.pending_agent_ids.length, done: false }
      : null;
  // Card 1's secondary figure: the other scope's count for the team (or the selected rep), never the goal's.
  const outboundAlternate = selectedRep
    ? alternateCountText(selectedRep.count_scope, selectedRep.alternate_scope ? { count_scope: selectedRep.alternate_scope.count_scope, actual: selectedRep.alternate_scope.actual_confirmed } : null)
    : goals
      ? alternateCountText(goals.count_scope, goals.outbound_calls.alternate)
      : null;
  const outboundCaption = outbound
    ? outbound.pending
      ? c.cards.partial(outbound.pending)
      : percentText(outbound.progress)
        ? c.cards.ofGoal(percentText(outbound.progress) as string)
        : null
    : null;
  const otherFoot = goals ? otherOutboundFootnote(goals.count_scope, goals.other_outbound_total, goals.other_outbound_breakdown) : null;
  const atGoal = selectedRep
    ? { count: selectedRep.goal_reached ? 1 : 0, of: selectedRep.goal_state === "goal" ? 1 : 0, pending: selectedRep.goal_reached === null && selectedRep.goal_state === "goal" ? 1 : 0 }
    : (goals?.reps_at_goal ?? null);
  const overdueMetric = selectedRep ? selectedRep.overdue_leads : (data?.distinct_overdue_leads ?? null);
  const overdue = overdueMetric ? cadenceMetricText(overdueMetric) : null;
  const quoted = data ? cadenceMetricText(data.quoted_overdue_leads) : null;
  const unassignedText = data ? unassignedCaption(data.unassigned) : null;

  const attentionRows = filtered ? (cadenceOn ? attentionQueue.rows.slice(0, 10) : null) : (data?.leads_needing_attention.rows ?? null);
  const attentionUnavailable = filtered ? !cadenceOn : data ? data.leads_needing_attention.rows === null : false;
  const attentionError = filtered ? (attentionQueue.query.error ?? null) : failed ? team.error : null;
  const loading = (width: number) => (failed ? t.unavailable : <SkeletonLine width={width} height={22} />);
  const scopeLabel = goals?.count_scope_label ?? c.cards.outbound;

  const ownerOptions = [
    { value: "", label: c.allReps },
    ...reps.map((rep) => ({ value: rep.id, label: rep.name })),
    { value: "unassigned", label: c.unassigned },
  ];

  return (
    <>
      <div className="od-topbar">
        <FreshnessChips freshness={data?.freshness} />
      </div>
      <div className="od-scroll">
        <div className={`od-page${lead ? " od-page--with-drawer" : ""}`}>
          <DeskHeader title={deskCopy.titles.team} subtitle={data ? businessDateLabel(data.business_day) : null} />
          {team.error ? (
            <ReadFailure what={deskCopy.readErrors.team} error={team.error} staleAsOf={data?.as_of ?? null} onRetry={() => void team.refetch()} testId="team-read-error" />
          ) : null}
          <div className="od-toolbar" role="toolbar" aria-label={c.toolbar}>
            <DeskSelect icon={Calendar} label={c.pickDay} value={day ?? ""} options={dayOptions} onChange={(value) => url.update({ day: value || null })} />
            <DeskSelect
              icon={Users}
              label={c.allReps}
              value={agent ?? ""}
              options={[{ value: "", label: c.allReps }, ...reps.map((rep) => ({ value: rep.id, label: rep.name }))]}
              onChange={(value) => url.update({ agent: value || null, unassigned: null })}
            />
            <Segmented<WorkflowFilter>
              label={c.leadFilter}
              value={workflow}
              options={[
                { value: "all", label: c.allLeads },
                { value: "new", label: c.new },
                { value: "quoted", label: c.quoted },
              ]}
              onChange={(value) => url.update({ workflow: value === "all" ? null : value })}
            />
            <div className="od-toolbar__spacer" />
            <SearchBox value={q} placeholder={c.search} onSearch={(value) => url.update({ q: value })} />
          </div>

          <div className="od-summary-row">
            <SummaryCard
              testId="card-outbound"
              icon={Phone}
              tone="blue"
              title={scopeLabel}
              value={goalsOff ? t.unavailable : outbound ? `${countText(outbound.actual)} / ${outbound.goal}` : loading(90)}
              progress={goalsOff || !outbound ? null : { value: outbound.progress, done: outbound.done, label: scopeLabel }}
              caption={
                goalsOff ? (
                  c.goals.unavailable
                ) : outboundCaption || outboundAlternate ? (
                  <>
                    {outboundCaption}
                    {outboundAlternate ? (
                      <span className="od-summary__alt" title={outboundAlternate.title} data-testid="card-outbound-alternate">
                        {outboundAlternate.text}
                      </span>
                    ) : null}
                  </>
                ) : null
              }
            />
            <SummaryCard
              testId="card-reps-at-goal"
              icon={Users}
              tone="green"
              title={c.cards.repsAtGoal}
              value={goalsOff ? t.unavailable : atGoal ? `${atGoal.count} / ${atGoal.of}` : loading(60)}
              progress={goalsOff || !atGoal ? null : { value: atGoal.of ? atGoal.count / atGoal.of : null, done: atGoal.of > 0 && atGoal.count === atGoal.of, label: c.cards.repsAtGoal }}
              caption={
                goalsOff || !atGoal
                  ? null
                  : atGoal.of === 0
                    ? c.cards.noGoals
                    : atGoal.pending
                      ? c.cards.partial(atGoal.pending)
                      : c.cards.ofReps(percentText(atGoal.count / atGoal.of) as string)
              }
            />
            <SummaryCard
              testId="card-overdue"
              icon={CircleAlert}
              tone="red"
              title={c.cards.overdue}
              value={overdue ? (overdue.available ? overdue.text : t.unavailable) : loading(40)}
              caption={
                <>
                  {overdue && !overdue.available ? <span>{overdue.reason}</span> : null}
                  {unassignedText ? (
                    <button type="button" className="od-linkbutton" data-testid="card-overdue-unassigned" onClick={() => url.update({ unassigned: "true", agent: null })}>
                      {unassignedText}
                    </button>
                  ) : null}
                </>
              }
            />
            <SummaryCard
              testId="card-quoted"
              icon={NotebookText}
              tone="amber"
              title={c.cards.quotedGaps}
              value={quoted ? (quoted.available ? quoted.text : t.unavailable) : loading(40)}
              caption={quoted && !quoted.available ? quoted.reason : null}
            />
          </div>

          {capabilities.role_capabilities.includes("daily_operations_access") ? <OperationsStrip /> : null}

          {viewer.role === "owner" ? <LeadCostCard /> : null}

          <section className="od-card" aria-labelledby="od-goals-title" data-testid="daily-call-goals">
            <div className="od-card__head">
              <div>
                <h2 id="od-goals-title" className="od-card__title">
                  {c.goals.title}
                </h2>
                <p className="od-card__subtitle">{data ? scopeSubtitle(data) : " "}</p>
              </div>
            </div>
            {goalsOff ? (
              <p className="od-empty">{c.goals.unavailable}</p>
            ) : (
              <div className="od-table-wrap">
                <table className="od-table od-table--goals">
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
                    {shownRows === null && failed ? (
                      <tr>
                        <td colSpan={6} className="od-empty">
                          {t.unavailable}
                        </td>
                      </tr>
                    ) : shownRows === null ? (
                      [0, 1, 2].map((index) => (
                        <tr key={index}>
                          <td colSpan={6}>
                            <SkeletonLine />
                          </td>
                        </tr>
                      ))
                    ) : shownRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="od-empty">
                          {c.goals.empty}
                        </td>
                      </tr>
                    ) : (
                      shownRows.map((row) => <GoalRow key={row.agent_id} row={row} workflow={workflow} />)
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="od-card__foot">
              {c.goals.footnote}
              {otherFoot ? <span data-testid="goals-other-footnote">{` ${otherFoot}`}</span> : null}
              {goals?.other_callers && goals.other_callers.agents > 0 && !selectedRep ? (
                <span data-testid="goals-other-callers">{` ${c.goals.otherCallers(goals.other_callers.confirmed + goals.other_callers.awaiting_confirmation, goals.other_callers.agents)}`}</span>
              ) : null}
            </p>
          </section>

          <section className="od-card" aria-labelledby="od-attention-title" data-testid="leads-needing-attention">
            <div className="od-card__head">
              <h2 id="od-attention-title" className="od-card__title">
                {c.attention.title}
              </h2>
              <div className="od-card__tools">
                <DeskSelect
                  icon={Users}
                  label={c.allReps}
                  value={unassigned ? "unassigned" : (agent ?? "")}
                  options={ownerOptions}
                  onChange={(value) => url.update(value === "unassigned" ? { unassigned: "true", agent: null } : { agent: value || null, unassigned: null })}
                />
                <DeskSelect<SortValue>
                  label={c.attention.sort}
                  value={sort}
                  options={[
                    { value: "urgency", label: deskCopy.my.sorts.urgency },
                    { value: "lead_received", label: deskCopy.my.sorts.lead_received },
                    { value: "last_interaction", label: deskCopy.my.sorts.last_interaction },
                  ]}
                  onChange={(value) => url.update({ sort: value === "urgency" ? null : value, direction: null })}
                />
              </div>
            </div>
            {attentionUnavailable ? (
              <p className="od-empty">{c.attention.unavailable}</p>
            ) : (
              <div className="od-table-wrap">
                <table className="od-table od-table--attention">
                  <thead>
                    <tr>
                      <th scope="col">{c.attention.columns.job}</th>
                      <th scope="col">{c.attention.columns.owner}</th>
                      <th scope="col">{c.attention.columns.priority}</th>
                      <th scope="col">{c.attention.columns.issue}</th>
                      <th scope="col">{c.attention.columns.last}</th>
                      <th scope="col">{c.attention.columns.action}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attentionError && !attentionRows?.length ? (
                      <tr>
                        <td colSpan={6} className="od-empty" role={filtered ? "alert" : undefined}>
                          {filtered ? `${deskCopy.readErrors.queue} ${readFailureText(attentionError)}` : t.unavailable}
                        </td>
                      </tr>
                    ) : attentionRows === null ? (
                      [0, 1, 2].map((index) => (
                        <tr key={index}>
                          <td colSpan={6}>
                            <SkeletonLine />
                          </td>
                        </tr>
                      ))
                    ) : attentionRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="od-empty">
                          {c.attention.empty}
                        </td>
                      </tr>
                    ) : (
                      attentionRows.map((row) => (
                        <AttentionRow key={row.subject_id} row={row} asOf={asOf} selected={row.subject_id === lead} onSelect={(id) => url.update({ lead: id })} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="od-card__foot">{c.attention.footnote}</p>
          </section>
        </div>
      </div>
      {lead ? (
        <div className="od-drawer" role="dialog" aria-modal="false" aria-label={deskCopy.lead.region}>
          <LeadPanel
            subjectId={lead}
            commands={capabilities.permitted_commands}
            cadenceSummary={capabilities.cadence_summary}
            reps={reps}
            onRevoked={() => url.update({ lead: null }, { replace: true })}
            onClose={() => url.update({ lead: null })}
          />
        </div>
      ) : null}
    </>
  );
}

