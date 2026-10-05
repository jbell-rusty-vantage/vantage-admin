"use client";
/**
 * My outreach (ADM-4; SPECIFICATION §6.1, references/sales-rep-desk.webp). The Rep's default frame; an Owner or
 * Manager opens it for one rep with `agent=<id>` (P09a). M1 part first: the horizontal goal card (`GET /rep-days`).
 * Then the queue (`GET /queue`, server-filtered, server-sorted, cursor-paged) and the selected-lead panel.
 *
 * The headline is today's goal across all eligible work, independent of the queue's search, tab or move date (§6.3).
 * Selection is `lead=<subject_id>` in the URL; a lead that leaves the filtered list stays selected and says so.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, ClipboardCopy, Info, Users } from "lucide-react";
import type { SalesOutreachCapabilitiesDto, SalesOutreachQueueRowDto, SalesOutreachRepDayDto } from "@/lib/api/salesOutreach";
import { isSalesOutreachApiError } from "@/lib/api/salesOutreach";
import { useQueue, useRepDays, useTeam } from "../data/use-desk-reads";
import { useDeskUrl } from "../data/use-desk-url";
import { deskViewHref, type MovePreset } from "../data/desk-url";
import type { DeskViewer } from "../shell/desk-shell";
import {
  absoluteTime,
  businessDateLabel,
  callsTodayText,
  cadenceMetricText,
  channelStatus,
  countText,
  leadAgeText,
  moveDateRange,
  nyDate,
  overdueByText,
  percentText,
  relativeDay,
} from "../lib/format";
import { deskCopy } from "../outreach-desk-copy";
import { CopyJobButton, DeskHeader, DeskSelect, FreshnessChips, SearchBox, SkeletonLine, Track } from "../primitives";
import { LeadPanel, type RepOption } from "./lead-panel";

const c = deskCopy.my;
const t = deskCopy.text;

type Tab = "all" | "new" | "quoted";
type WorkState = "needs_contact" | "all_active";
type SortValue = "urgency" | "lead_received" | "last_interaction";

function GoalCard({
  rep,
  goalMetricsEnabled,
  overdueLeads,
  businessDay,
  isToday,
}: {
  rep: SalesOutreachRepDayDto | null;
  goalMetricsEnabled: boolean;
  overdueLeads: { text: string; available: boolean; reason: string | null } | null;
  businessDay: string | null;
  isToday: boolean;
}) {
  const hasGoal = rep?.goal_state === "goal";
  const pct = rep ? percentText(rep.progress) : null;
  const caption = !rep
    ? null
    : !hasGoal
      ? (rep.goal_label ?? c.noGoal)
      : rep.goal_reached
        ? c.goalMet
        : rep.remaining !== null
          ? c.toGoal(rep.remaining)
          : c.waitingCapture;
  const scope = rep?.count_scope === "eligible_new_quoted" ? deskCopy.team.goals.scopeEligible : deskCopy.team.goals.scopeAll;
  const metric = (value: string, label: string, tone: string, title?: string) => (
    <div className="od-goal__metric" title={title}>
      <span className={`od-goal__metric-value ${value === "—" ? "od-text-muted" : tone}`}>{value}</span>
      <span className={`od-goal__metric-label ${tone}`}>{label}</span>
    </div>
  );
  return (
    <section className="od-card od-goal" aria-labelledby="od-goal-title" data-testid="goal-card">
      <div className="od-goal__main">
        <h2 id="od-goal-title" className="od-goal__title">
          {isToday || !businessDay ? c.goalTitle : c.goalTitleFor(businessDateLabel(businessDay))}
        </h2>
        {!goalMetricsEnabled ? (
          <p className="od-goal__off">{deskCopy.team.goals.unavailable}</p>
        ) : !rep ? (
          <SkeletonLine width={240} height={34} />
        ) : (
          <div className="od-goal__row">
            <p className="od-goal__count">
              {hasGoal ? (
                <>
                  <span className="od-goal__actual">{countText(rep.actual_confirmed)}</span>
                  <span className="od-goal__of"> / {rep.goal}</span>
                </>
              ) : (
                <span className="od-goal__of">{rep.goal_label ?? c.noGoal}</span>
              )}
            </p>
            {hasGoal ? (
              <div className="od-goal__progress">
                <div className="od-goal__trackline">
                  <Track size="lg" progress={rep.progress} done={rep.goal_reached === true} label={c.goalTitle} />
                  <span className="od-goal__pct">{pct ?? t.pending}</span>
                </div>
                <p className="od-goal__caption">
                  {caption}
                  <span aria-hidden="true"> · </span>
                  {scope}
                  {rep.actual_awaiting_confirmation ? <span className="od-text-muted" title={deskCopy.team.goals.awaitingTitle}> · {deskCopy.team.goals.awaiting(rep.actual_awaiting_confirmation)}</span> : null}
                  {rep.other_outbound.count ? <span className="od-text-muted"> · {deskCopy.team.cards.otherOutbound(String(rep.other_outbound.count))}</span> : null}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="od-goal__metrics">
        {metric(overdueLeads?.available ? overdueLeads.text : "—", c.overdue, "od-text-red", overdueLeads?.reason ?? deskCopy.my.metricUnavailable)}
        {metric("—", c.callsDue, "od-text-amber", deskCopy.my.metricUnavailable)}
        {metric("—", c.smsDue, "od-text-green", deskCopy.my.metricUnavailable)}
      </div>
    </section>
  );
}

function QueueRow({
  row,
  asOf,
  selected,
  onSelect,
  onMove,
}: {
  row: SalesOutreachQueueRowDto;
  asOf: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (from: HTMLTableRowElement, step: 1 | -1) => void;
}) {
  const overdueBy = overdueByText(row.call, asOf);
  const sms = channelStatus(row.sms, asOf, "sms");
  const toneClass = (tone: string) => (tone === "red" ? "od-text-red" : tone === "amber" ? "od-text-amber" : tone === "green" ? "od-text-green" : "od-text-muted");
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
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          onMove(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
        }
      }}
    >
      <td>
        <span className="od-strong od-job">{row.job_no ?? deskCopy.lead.jobPending}</span>
        {row.phone ? <span className="od-cell__sub">{row.phone}</span> : null}
      </td>
      <td className={row.status_flags.overdue ? "od-text-red od-strong-red" : undefined} title={absoluteTime(row.received_at)}>
        {leadAgeText(row.received_at, asOf)}
      </td>
      <td className="od-text-muted" title={absoluteTime(row.last_interaction_at)}>
        {relativeDay(row.last_interaction_at, asOf)}
      </td>
      <td>
        <span>{callsTodayText(row.call)}</span>
        {overdueBy ? <span className="od-cell__sub od-text-red">{overdueBy}</span> : null}
      </td>
      <td className={toneClass(sms.tone)}>{sms.text}</td>
      <td>
        <CopyJobButton jobNo={row.job_pending ? null : row.job_no} />
      </td>
    </tr>
  );
}

export function MyView({ viewer, capabilities }: { viewer: DeskViewer; capabilities: SalesOutreachCapabilitiesDto }) {
  const url = useDeskUrl(viewer.role);
  const coordinator = viewer.role !== "rep";
  const agent = coordinator ? url.get("agent") : null;
  const day = url.get("day");
  const tab = (url.get("workflow") ?? "new") as Tab;
  const work = (url.get("state") ?? "needs_contact") as WorkState;
  const q = url.get("q");
  const sort = (url.get("sort") ?? "urgency") as SortValue;
  const direction = (url.get("direction") ?? (sort === "lead_received" ? "desc" : "asc")) as "asc" | "desc";
  const move = url.get("move") as MovePreset | null;
  const lead = url.get("lead");

  const repDays = useRepDays(day, agent, !coordinator || Boolean(agent));
  const team = useTeam(day, coordinator);
  const asOf = repDays.data?.as_of ?? team.data?.as_of ?? capabilities.as_of;
  const today = nyDate(asOf);
  const rep = repDays.data?.reps?.[0] ?? null;
  const teamRow = agent ? (team.data?.daily_call_goals?.find((row) => row.agent_id === agent) ?? null) : null;
  const overdueLeads = coordinator && teamRow ? cadenceMetricText(teamRow.overdue_leads) : null;
  const reps: RepOption[] = useMemo(
    () => (team.data?.daily_call_goals ?? []).map((row) => ({ id: row.agent_id, name: row.agent_name ?? t.unknownRep })),
    [team.data],
  );
  const repName = rep?.agent_name ?? teamRow?.agent_name ?? null;

  const cadenceOn = capabilities.controls.cadence_shadow_enabled || capabilities.controls.cadence_enforcement_enabled;
  const queue = useQueue(
    {
      agent_id: agent,
      workflow: tab === "all" ? null : tab,
      state: work,
      search: q,
      sort,
      direction: sort === "urgency" ? null : direction,
      ...moveDateRange(move, today),
    },
    cadenceOn && (!coordinator || Boolean(agent) || viewer.role === "owner" || viewer.role === "manager"),
  );
  const queueError = queue.query.error;
  const queueUnavailable = !cadenceOn || (isSalesOutreachApiError(queueError) && queueError.unavailable);
  const rows = queue.rows;
  const first = queue.first;

  // Select the first row on the first load only (the reference's selected row), without a history entry. Once any lead
  // has been selected, a cleared selection (revoked by a reassignment, or closed) stays cleared.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (lead) {
      autoSelected.current = true;
      return;
    }
    if (!autoSelected.current && rows.length > 0) {
      autoSelected.current = true;
      url.update({ lead: rows[0]!.subject_id }, { replace: true });
    }
  }, [lead, rows, url]);

  const [announce, setAnnounce] = useState("");
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (lastCount.current !== null && lastCount.current !== rows.length) setAnnounce(`${deskCopy.live.updated}: ${rows.length}`);
    lastCount.current = rows.length;
  }, [rows.length]);

  const moveFocus = (from: HTMLTableRowElement, step: 1 | -1) => {
    const target = (step === 1 ? from.nextElementSibling : from.previousElementSibling) as HTMLTableRowElement | null;
    target?.focus();
  };
  const selectedMissing = Boolean(lead && rows.length > 0 && !queue.query.hasNextPage && !rows.some((row) => row.subject_id === lead));

  const title = coordinator ? (agent ? deskCopy.titles.myInspecting(repName ?? t.unknownRep) : deskCopy.titles.my) : deskCopy.titles.my;
  const freshness = repDays.data?.freshness ?? team.data?.freshness;
  const isToday = repDays.data?.is_today ?? true;

  return (
    <div className="od-scroll">
      <div className="od-page od-page--my">
        <DeskHeader
          title={title}
          subtitle={repDays.data ? businessDateLabel(repDays.data.business_day) : team.data ? businessDateLabel(team.data.business_day) : null}
          right={<FreshnessChips freshness={freshness} />}
        />
        {coordinator ? (
          <div className="od-toolbar">
            <DeskSelect
              icon={Users}
              label={deskCopy.team.allReps}
              value={agent ?? ""}
              options={[{ value: "", label: deskCopy.team.allReps }, ...reps.map((option) => ({ value: option.id, label: option.name }))]}
              onChange={(value) => url.update({ agent: value || null, lead: null })}
            />
            <Link className="od-button od-button--quiet" href={deskViewHref("team")}>
              {c.backToTeam}
            </Link>
          </div>
        ) : null}
        {!coordinator || agent ? (
          <GoalCard
            rep={rep}
            goalMetricsEnabled={repDays.data ? repDays.data.goal_metrics_enabled : capabilities.controls.goal_metrics_enabled}
            overdueLeads={overdueLeads}
            businessDay={repDays.data?.business_day ?? null}
            isToday={isToday}
          />
        ) : null}

        <div className="od-workspace">
          <div className="od-workspace__main">
            <div className="od-tabs" role="tablist" aria-label={c.tabsLabel}>
              {(["new", "quoted", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className="od-tab"
                  onClick={() => url.update({ workflow: value === "new" ? null : value, lead: null })}
                >
                  {c.tabs[value]}
                </button>
              ))}
            </div>
            <div className="od-filterbar">
              <div className="od-chips" role="group" aria-label={c.workLabel}>
                {(["needs_contact", "all_active"] as const).map((value) => (
                  <button key={value} type="button" className="od-chip" aria-pressed={work === value} onClick={() => url.update({ state: value === "needs_contact" ? null : value })}>
                    {c.work[value]}
                  </button>
                ))}
              </div>
              <SearchBox value={q} placeholder={c.search} onSearch={(value) => url.update({ q: value })} />
              <p className="od-flowhint">
                <ClipboardCopy aria-hidden="true" width={15} height={15} />
                {c.flow}
              </p>
            </div>
            <section className="od-card od-queue" aria-labelledby="od-queue-title" data-testid="queue">
              <div className="od-card__head">
                <div className="od-queue__heading">
                  <h2 id="od-queue-title" className="od-card__title">
                    {c.queueTitle}
                  </h2>
                  <label className="od-sortlink">
                    <ArrowDown aria-hidden="true" width={15} height={15} />
                    <span className="od-sr-only">{c.sortLabel}</span>
                    <select value={sort} onChange={(event) => url.update({ sort: event.target.value === "urgency" ? null : event.target.value, direction: null })}>
                      <option value="urgency">{c.sorts.urgency}</option>
                      <option value="lead_received">{c.sorts.lead_received}</option>
                      <option value="last_interaction">{c.sorts.last_interaction}</option>
                    </select>
                  </label>
                  {sort !== "urgency" ? (
                    <button
                      type="button"
                      className="od-button od-button--quiet od-button--icon"
                      aria-label={direction === "desc" ? c.oldest : c.newest}
                      title={direction === "desc" ? c.newest : c.oldest}
                      onClick={() => url.update({ direction: direction === "desc" ? "asc" : "desc" })}
                    >
                      {direction === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
                    </button>
                  ) : null}
                </div>
                <DeskSelect<MovePreset | "">
                  icon={CalendarRange}
                  label={c.moveDate}
                  value={move ?? ""}
                  options={[
                    { value: "", label: c.moveDates.anyShort },
                    { value: "upcoming", label: `${c.moveDate}: ${c.moveDates.upcoming}` },
                    { value: "today", label: `${c.moveDate}: ${c.moveDates.today}` },
                    { value: "next7", label: `${c.moveDate}: ${c.moveDates.next7}` },
                    { value: "past", label: `${c.moveDate}: ${c.moveDates.past}` },
                    { value: "unknown", label: `${c.moveDate}: ${c.moveDates.unknown}` },
                  ]}
                  onChange={(value) => url.update({ move: value || null })}
                />
              </div>
              {first?.counts.projection_pending ? (
                <p className="od-queue__note">
                  <Info aria-hidden="true" width={14} height={14} /> {c.pendingCount(first.counts.projection_pending)}
                </p>
              ) : null}
              {first?.counts.excluded_unknown_move_date ? (
                <p className="od-queue__note od-text-amber">
                  <Info aria-hidden="true" width={14} height={14} /> {c.excludedUnknown(first.counts.excluded_unknown_move_date)}
                </p>
              ) : null}
              {queueUnavailable ? (
                <p className="od-empty">{c.queueUnavailable}</p>
              ) : (
                <div className="od-table-wrap">
                  <table className="od-table od-table--queue">
                    <thead>
                      <tr>
                        <th scope="col">{c.columns.job}</th>
                        <th scope="col">{c.columns.age}</th>
                        <th scope="col">{c.columns.last}</th>
                        <th scope="col">{c.columns.calls}</th>
                        <th scope="col">{c.columns.sms}</th>
                        <th scope="col">{c.columns.copy}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.query.isPending ? (
                        [0, 1, 2, 3].map((index) => (
                          <tr key={index}>
                            <td colSpan={6}>
                              <SkeletonLine />
                            </td>
                          </tr>
                        ))
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="od-empty">
                            {work === "needs_contact" && !q ? c.emptyNeeds : c.empty}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <QueueRow
                            key={row.subject_id}
                            row={row}
                            asOf={first?.as_of ?? asOf}
                            selected={row.subject_id === lead}
                            onSelect={(id) => url.update({ lead: id })}
                            onMove={moveFocus}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {queue.query.hasNextPage ? (
                <div className="od-queue__more">
                  <button type="button" className="od-button od-button--quiet" disabled={queue.query.isFetchingNextPage} onClick={() => void queue.query.fetchNextPage()}>
                    <ArrowUpDown aria-hidden="true" />
                    {c.loadMore}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          <div className="od-workspace__side">
            {selectedMissing ? <p className="od-queue__note">{c.selectedNotInList}</p> : null}
            {lead ? (
              <LeadPanel
                subjectId={lead}
                commands={capabilities.permitted_commands}
                reps={coordinator ? reps : null}
                onRevoked={() => url.update({ lead: null }, { replace: true })}
              />
            ) : (
              <aside className="od-card od-lead od-lead--empty">
                <p className="od-lead__muted">{c.selectHint}</p>
              </aside>
            )}
          </div>
        </div>
        <p className="od-sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>
  );
}
